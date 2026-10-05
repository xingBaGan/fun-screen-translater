import { BoundingBox, ComicTextType, TextBubble } from '@/types/manga';

/**
 * 竖排阅读顺序重排（日漫从右往左，从上往下）
 * 根据 X 坐标从大到小（右到左）、Y 坐标从小到大（上到下）计算阅读顺序
 */
export function sortJapaneseReadingOrder(bubbles: TextBubble[]): TextBubble[] {
  return [...bubbles]
    .sort((a, b) => {
      // 容差判定：若两文本块在 X 轴相差不大（重叠或同列），优先比较 Y
      const xDiff = (b.box.x + b.box.width / 2) - (a.box.x + a.box.width / 2);
      if (Math.abs(xDiff) < 60) {
        return a.box.y - b.box.y;
      }
      return xDiff;
    })
    .map((bubble, index) => ({
      ...bubble,
      readingOrderIndex: index + 1,
    }));
}

/**
 * 振假名 (Furigana) 过滤逻辑
 * 日漫中汉字旁边常有小字注音假名，如果 OCR 混在一起通常会带有括号或紧随汉字
 */
export function cleanFuriganaText(rawText: string): string {
  // 过滤括号内的纯假名注音，如 漢字(かんじ) -> 漢字
  let cleaned = rawText.replace(/（[ぁ-んァ-ヶ]+）|\([ぁ-んァ-ヶ]+\)/g, '');
  // 规范化日文换行与多余空格
  cleaned = cleaned.replace(/[\r\n]+/g, ' ').trim();
  return cleaned;
}

export interface OptimalFontResult {
  fontSize: number;
  lineHeight: number;
  maxLines: number;
  paddingH: number;
  paddingV: number;
  isSingleColumn: boolean;
}

/**
 * 自适应字号与排版参数估算
 * 根据目标气泡/文本块类型、宽高与中文字数，计算合适且不溢出的字号 (px)、行高与安全边距
 */
export function calculateOptimalFontSize(
  text: string,
  box: BoundingBox,
  scale: number,
  isVertical: boolean = false,
  textType: ComicTextType = 'bubble'
): OptimalFontResult {
  const scaledWidth = Math.max(box.width * scale, 10);
  const scaledHeight = Math.max(box.height * scale, 10);
  const cleanText = (text || '').trim();
  const charCount = Math.max(cleanText.length, 1);

  // 比例自适应内边距：防止窄长气泡被死边距挤占
  const paddingH = Math.max(1, Math.min(Math.round(scaledWidth * 0.05), 4));
  const paddingV = Math.max(1, Math.min(Math.round(scaledHeight * 0.05), 4));

  const availW = Math.max(scaledWidth - paddingH * 2, 8);
  const availH = Math.max(scaledHeight - paddingV * 2, 8);

  const isNarrowVertical = isVertical || (scaledHeight > scaledWidth * 2.0 && scaledWidth < 36);

  // 1. 标题类型：字号更大，边距更紧凑，富有视觉张力
  if (textType === 'title') {
    const maxSize = Math.min(32, Math.max(12, Math.floor(availH * 0.75)));
    const minSize = 9;
    let bestSize = minSize;

    for (let size = maxSize; size >= minSize; size -= 0.5) {
      const charsPerLine = Math.max(1, Math.floor(availW / (size * 0.95)));
      const lines = Math.ceil(charCount / charsPerLine);
      const lineHeight = Math.round(size * 1.15);
      if (lines * lineHeight <= availH) {
        bestSize = size;
        break;
      }
    }
    const lineHeight = Math.round(bestSize * 1.18);
    const maxLines = Math.max(1, Math.floor(availH / lineHeight));
    return {
      fontSize: bestSize,
      lineHeight,
      maxLines,
      paddingH,
      paddingV,
      isSingleColumn: false,
    };
  }

  // 2. 拟声词 (SFX) 类型：醒目短小，略微倾斜，契合漫画音效动感
  if (textType === 'sfx') {
    const maxSize = Math.min(26, Math.max(10, Math.floor(availH * 0.75)));
    const minSize = 7.5;
    let bestSize = minSize;

    for (let size = maxSize; size >= minSize; size -= 0.5) {
      const charsPerLine = Math.max(1, Math.floor(availW / (size * 0.95)));
      const lines = Math.ceil(charCount / charsPerLine);
      const lineHeight = Math.round(size * 1.15);
      if (lines * lineHeight <= availH) {
        bestSize = size;
        break;
      }
    }
    const lineHeight = Math.round(bestSize * 1.18);
    const maxLines = Math.max(1, Math.floor(availH / lineHeight));
    return {
      fontSize: bestSize,
      lineHeight,
      maxLines,
      paddingH,
      paddingV,
      isSingleColumn: false,
    };
  }

  // 3. 常规对白气泡 (bubble) 与旁白 (free_text)
  // 窄长单列竖排气泡优化：当可用宽度仅够单字排布时
  const isSingleColumn = isNarrowVertical && availW < 22;

  // 上限默认不超过 17px，防止手机屏幕上文字过大显得突兀
  const maxSize = Math.min(17, Math.max(8, Math.floor(availW * 0.95)));
  const minSize = 6.5; // 支持小字号确保不溢出
  let bestSize = minSize;

  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const charsPerLine = isSingleColumn
      ? 1
      : Math.max(1, Math.floor(availW / (size * 0.96)));
    const lines = Math.ceil(charCount / charsPerLine);
    const lineHeight = Math.round(size * 1.18);
    const totalH = lines * lineHeight;

    if (totalH <= availH && (isSingleColumn || size <= availW)) {
      bestSize = size;
      break;
    }
  }

  const lineHeight = Math.round(bestSize * 1.20);
  const maxLines = Math.max(1, Math.floor(availH / lineHeight));

  return {
    fontSize: bestSize,
    lineHeight,
    maxLines,
    paddingH,
    paddingV,
    isSingleColumn,
  };
}

/**
 * 转换颜色为带透明度的 RGBA 字符串，与漫画背景平滑融为一体
 * @param color 支持 #RGB, #RRGGBB, rgb(...) 或 rgba(...)
 * @param targetOpacity 推荐透明度 0.85 ~ 0.92
 */
export function blendColorWithOpacity(color: string, targetOpacity: number = 0.88): string {
  if (!color) return `rgba(255, 255, 255, ${targetOpacity})`;
  const trimmed = color.trim();

  // 若已经是 rgba(...)
  if (trimmed.startsWith('rgba')) {
    const match = trimmed.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
    if (match) {
      const r = match[1];
      const g = match[2];
      const b = match[3];
      const currentAlpha = parseFloat(match[4]);
      const finalAlpha = Math.min(currentAlpha, targetOpacity);
      return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
    }
    return trimmed;
  }

  // 若是 rgb(...)
  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${targetOpacity})`;
    }
  }

  // 十六进制颜色
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16) || 255;
      const g = parseInt(hex.substring(2, 4), 16) || 255;
      const b = parseInt(hex.substring(4, 6), 16) || 255;
      return `rgba(${r}, ${g}, ${b}, ${targetOpacity})`;
    }
  }

  return `rgba(255, 255, 255, ${targetOpacity})`;
}

/**
 * 判断背景颜色是否偏浅亮色
 */
export function isColorLight(color: string): boolean {
  if (!color) return true;
  const trimmed = color.trim();
  let r = 255, g = 255, b = 255;

  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16) || 255;
      g = parseInt(hex.substring(2, 4), 16) || 255;
      b = parseInt(hex.substring(4, 6), 16) || 255;
    }
  } else if (trimmed.startsWith('rgb')) {
    const m = trimmed.match(/\d+/g);
    if (m && m.length >= 3) {
      r = parseInt(m[0], 10) || 255;
      g = parseInt(m[1], 10) || 255;
      b = parseInt(m[2], 10) || 255;
    }
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
  return luminance > 0.52;
}

/**
 * 智能解析最契合漫画原作印刷风格的译文字体颜色
 */
export function resolveMangaTextColor(bubble: TextBubble, isLightBg: boolean): string {
  // 1. 若气泡自带明确指定的检测文字色 (非默认灰色)
  if (bubble.detectedTextColor && bubble.detectedTextColor !== '#0F172A') {
    return bubble.detectedTextColor;
  }

  // 2. 根据文本类型赋予漫画专属印刷色调
  if (bubble.textType === 'title') {
    return bubble.detectedTextColor || '#C026D3'; // 艺术标题紫/紫红
  }

  if (bubble.textType === 'sfx') {
    return bubble.detectedTextColor || '#DC2626'; // 拟声特效字红/橙红
  }

  if (bubble.textType === 'free_text') {
    return isLightBg ? '#1E293B' : '#F1F5F9';
  }

  // 3. 经典常规对白气泡：日漫高清晰度印刷浓黑油墨色 (Zinc-900 / #18181B)
  return isLightBg ? '#18181B' : '#F8FAFC';
}
