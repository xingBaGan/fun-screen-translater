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

/**
 * 自适应字号估算
 * 根据目标气泡/文本块类型、宽高与中文字数，计算合适且不溢出的字号 (px)
 */
export function calculateOptimalFontSize(
  text: string,
  box: BoundingBox,
  scale: number,
  isVertical: boolean = false,
  textType: ComicTextType = 'bubble'
): { fontSize: number; lineHeight: number } {
  const scaledWidth = box.width * scale;
  const scaledHeight = box.height * scale;
  const charCount = Math.max(text.length, 1);

  // 标题类型：字号更大，边距更紧凑
  if (textType === 'title') {
    const paddingX = Math.max(scaledWidth * 0.08, 6);
    const paddingY = Math.max(scaledHeight * 0.08, 6);
    const availableWidth = Math.max(scaledWidth - paddingX * 2, 20);
    const availableHeight = Math.max(scaledHeight - paddingY * 2, 20);

    let bestSize = 20;
    for (let size = 42; size >= 15; size--) {
      const charsPerLine = Math.max(Math.floor(availableWidth / size), 1);
      const estimatedLines = Math.ceil(charCount / charsPerLine);
      const estimatedHeight = estimatedLines * (size * 1.25);
      if (estimatedHeight <= availableHeight) {
        bestSize = size;
        break;
      }
    }
    return {
      fontSize: bestSize,
      lineHeight: Math.round(bestSize * 1.2),
    };
  }

  // 拟声词 (SFX) 类型：醒目短小
  if (textType === 'sfx') {
    const availableHeight = Math.max(scaledHeight * 0.8, 16);
    const size = Math.min(26, Math.max(12, Math.floor(availableHeight * 0.65)));
    return {
      fontSize: size,
      lineHeight: Math.round(size * 1.2),
    };
  }

  // 预留常规气泡内边距 (Padding)
  const paddingX = Math.max(scaledWidth * 0.12, 8);
  const paddingY = Math.max(scaledHeight * 0.12, 8);
  const availableWidth = Math.max(scaledWidth - paddingX * 2, 20);
  const availableHeight = Math.max(scaledHeight - paddingY * 2, 20);

  // 二分查找或估算合适字号（范围 10px ~ 24px）
  let bestSize = 13;
  for (let size = 24; size >= 10; size--) {
    const charsPerLine = Math.max(Math.floor(availableWidth / size), 1);
    const estimatedLines = Math.ceil(charCount / charsPerLine);
    const estimatedHeight = estimatedLines * (size * 1.3);

    if (estimatedHeight <= availableHeight) {
      bestSize = size;
      break;
    }
  }

  return {
    fontSize: bestSize,
    lineHeight: Math.round(bestSize * 1.35),
  };
}
