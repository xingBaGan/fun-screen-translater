import { MangaPage } from '@/types/manga';

// 页面 1：校园青春对白（包含典型椭圆气泡、双语气泡、竖排文字）
const panel1Svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E2E8F0"/>
      <stop offset="50%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <pattern id="mangaDots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#64748B" opacity="0.3"/>
    </pattern>
  </defs>

  <!-- 漫画分镜背景与网点 -->
  <rect width="600" height="800" fill="url(#bgGrad)"/>
  <rect width="600" height="800" fill="url(#mangaDots)"/>

  <!-- 上部分镜 (Panel 1) -->
  <rect x="30" y="30" width="540" height="340" fill="#FFFFFF" stroke="#0F172A" stroke-width="4"/>
  <line x1="30" y1="200" x2="570" y2="200" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="4"/>
  
  <!-- 角色剪影与速度线 -->
  <path d="M 400 370 Q 430 220 500 210 Q 560 230 570 370 Z" fill="#334155" opacity="0.85"/>
  <line x1="420" y1="50" x2="350" y2="300" stroke="#CBD5E1" stroke-width="1.5"/>
  <line x1="480" y1="40" x2="410" y2="290" stroke="#CBD5E1" stroke-width="1.5"/>

  <!-- 气泡 1 (右上角 角色A发问) -->
  <ellipse cx="440" cy="110" rx="90" ry="65" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <polygon points="460,170 480,210 440,173" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <polygon points="458,168 478,206 442,171" fill="#FFFFFF"/>
  <text x="440" y="100" font-family="sans-serif" font-weight="bold" font-size="16" fill="#0F172A" text-anchor="middle">
    待て！お前、
  </text>
  <text x="440" y="125" font-family="sans-serif" font-weight="bold" font-size="16" fill="#0F172A" text-anchor="middle">
    どこへ行く気だ？
  </text>

  <!-- 气泡 2 (左上 角色B冷漠回应) -->
  <ellipse cx="160" cy="130" rx="95" ry="60" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <polygon points="180,185 205,225 165,188" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <polygon points="178,183 203,221 167,186" fill="#FFFFFF"/>
  <text x="160" y="122" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    フン、お前には
  </text>
  <text x="160" y="145" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    関係ないだろう。
  </text>

  <!-- 下部分镜 (Panel 2) -->
  <rect x="30" y="390" width="540" height="380" fill="#F8FAFC" stroke="#0F172A" stroke-width="4"/>
  <path d="M 80 770 Q 140 540 220 530 Q 300 550 320 770 Z" fill="#475569" opacity="0.9"/>

  <!-- 气泡 3 (右下 震惊/热血对白) -->
  <path d="M 330 460 Q 480 430 520 530 Q 530 630 400 640 Q 360 690 330 650 Q 280 600 330 460 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <text x="410" y="515" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    そんな冷たいこと
  </text>
  <text x="410" y="540" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    言うなよ…！
  </text>
  <text x="410" y="570" font-family="sans-serif" font-weight="bold" font-size="16" fill="#DC2626" text-anchor="middle">
    俺達は仲間だろ！？
  </text>

  <!-- 气泡 4 (左下 独白小气泡) -->
  <ellipse cx="140" cy="460" rx="75" ry="45" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
  <text x="140" y="458" font-family="sans-serif" font-weight="bold" font-size="14" fill="#0F172A" text-anchor="middle">
    あいつ…本気配だ。
  </text>
  <text x="140" y="478" font-family="sans-serif" font-weight="bold" font-size="13" fill="#64748B" text-anchor="middle">
    （逃げられない…）
  </text>
</svg>
`;

// 页面 2：异世界奇幻召唤
const panel2Svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <radialGradient id="magicCircle" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#1E293B" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </radialGradient>
  </defs>

  <rect width="600" height="800" fill="#0F172A"/>
  <circle cx="300" cy="400" r="240" fill="url(#magicCircle)" opacity="0.6"/>
  <circle cx="300" cy="400" r="220" stroke="#38BDF8" stroke-width="2" stroke-dasharray="10 5" fill="none"/>

  <!-- 气泡 1 (魔法少女登场 竖排台词) -->
  <ellipse cx="430" cy="180" rx="85" ry="110" fill="#FFFFFF" stroke="#38BDF8" stroke-width="3"/>
  <polygon points="420,285 410,340 440,288" fill="#FFFFFF"/>
  <text x="430" y="145" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    我が名はルナ。
  </text>
  <text x="430" y="175" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    古き深淵の契約に
  </text>
  <text x="430" y="205" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    従い参上した。
  </text>

  <!-- 气泡 2 (主角震惊) -->
  <ellipse cx="170" cy="220" rx="90" ry="70" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <polygon points="200,285 240,320 220,275" fill="#FFFFFF"/>
  <text x="170" y="205" font-family="sans-serif" font-weight="bold" font-size="16" fill="#0F172A" text-anchor="middle">
    う、嘘だろ…！？
  </text>
  <text x="170" y="235" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    本当に召喚できたのか？
  </text>

  <!-- 气泡 3 (契约命令) -->
  <ellipse cx="300" cy="650" rx="120" ry="60" fill="#FFFFFF" stroke="#38BDF8" stroke-width="3"/>
  <text x="300" y="642" font-family="sans-serif" font-weight="bold" font-size="15" fill="#0F172A" text-anchor="middle">
    契の証を示せ、
  </text>
  <text x="300" y="668" font-family="sans-serif" font-weight="bold" font-size="16" fill="#0284C7" text-anchor="middle">
    我が新たなる主よ！
  </text>
</svg>
`;

function svgToDataUri(svg: string): string {
  // 简易安全 Base64 编码，适配移动端 Image 组件
  const cleaned = svg.trim().replace(/\n/g, ' ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

export const SAMPLE_MANGA_PAGES: MangaPage[] = [
  {
    id: 'page_1_school',
    title: '学园对决 · 羁绊篇',
    imageUri: svgToDataUri(panel1Svg),
    originalWidth: 600,
    originalHeight: 800,
    bubbles: [
      {
        id: 'p1_b1',
        box: { x: 350, y: 45, width: 180, height: 130 },
        direction: 'vertical',
        readingOrderIndex: 1,
        sourceText: '待て！お前、どこへ行く気だ？',
        targetText: '等等！你这家伙，打算去哪？',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.98,
        notes: '「行く気だ」意为打算走、想去。语气急促且带有阻拦质问意味。',
      },
      {
        id: 'p1_b2',
        box: { x: 65, y: 70, width: 190, height: 120 },
        direction: 'vertical',
        readingOrderIndex: 2,
        sourceText: 'フン、お前には関係ないだろう。',
        targetText: '哼，这和你没什么关系吧。',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.96,
        notes: '典型冷傲角色语调，「関係ない」表示与你无关。',
      },
      {
        id: 'p1_b3',
        box: { x: 295, y: 440, width: 235, height: 210 },
        direction: 'vertical',
        readingOrderIndex: 3,
        sourceText: 'そんな冷たいこと言うなよ…！俺達は仲間だろ！？',
        targetText: '别说这么冷淡的话啊…！我们不是伙伴吗！？',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#DC2626',
        confidence: 0.99,
        notes: '高潮热血句式，重音在「仲間（伙伴）」，带有反问语气。',
      },
      {
        id: 'p1_b4',
        box: { x: 65, y: 415, width: 150, height: 90 },
        direction: 'vertical',
        readingOrderIndex: 4,
        sourceText: 'あいつ…本気配だ。（逃げられない…）',
        targetText: '那家伙…是动真格的。（看来逃不掉了…）',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.92,
        notes: '内心独白用小括号标出，译为心理活动的暗叹。',
      },
    ],
  },
  {
    id: 'page_2_fantasy',
    title: '异界秘契 · 召唤篇',
    imageUri: svgToDataUri(panel2Svg),
    originalWidth: 600,
    originalHeight: 800,
    bubbles: [
      {
        id: 'p2_b1',
        box: { x: 345, y: 70, width: 170, height: 220 },
        direction: 'vertical',
        readingOrderIndex: 1,
        sourceText: '我が名はルナ。古き深淵の契約に従い参上した。',
        targetText: '吾名露娜。遵从古老深渊之契约，应召而来。',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.99,
        notes: '庄重的从魔契约文风，「参上した」意为奉命现身。',
      },
      {
        id: 'p2_b2',
        box: { x: 80, y: 150, width: 180, height: 140 },
        direction: 'horizontal',
        readingOrderIndex: 2,
        sourceText: 'う、嘘だろ…！？本当に召喚できたのか？',
        targetText: '不、骗人的吧…！？真的召唤成功了吗？',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.95,
        notes: '口吃结巴动效「う、嘘だろ」，表达难以置信的震惊。',
      },
      {
        id: 'p2_b3',
        box: { x: 180, y: 590, width: 240, height: 120 },
        direction: 'horizontal',
        readingOrderIndex: 3,
        sourceText: '契の証を示せ、我が新たなる主よ！',
        targetText: '出示契约之证吧，我的新主人啊！',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0284C7',
        confidence: 0.97,
        notes: '「契の証（契约信物）」，命令式语调。',
      },
    ],
  },
];
