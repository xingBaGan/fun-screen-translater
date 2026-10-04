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

// 页面 3：精选日漫封面（包含巨型变形艺术标题、手绘拟声词、振假名、反白标语）
const panel3Svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <linearGradient id="coverBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FDF4FF"/>
      <stop offset="40%" stop-color="#FCE7F3"/>
      <stop offset="70%" stop-color="#DDD6FE"/>
      <stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F43F5E"/>
      <stop offset="50%" stop-color="#A855F7"/>
      <stop offset="100%" stop-color="#84CC16"/>
    </linearGradient>
  </defs>

  <rect width="600" height="800" fill="url(#coverBg)"/>

  <!-- 角色与场景剪影 -->
  <path d="M 120 450 Q 180 260 270 270 Q 320 330 350 480 Z" fill="#F472B6" opacity="0.4"/>
  <path d="M 280 430 Q 350 200 450 210 Q 510 260 520 480 Z" fill="#C084FC" opacity="0.45"/>

  <!-- 门框与动作 -->
  <rect x="420" y="80" width="130" height="380" fill="#FEF3C7" stroke="#78350F" stroke-width="3" opacity="0.8"/>
  <line x1="420" y1="80" x2="420" y2="460" stroke="#78350F" stroke-width="4"/>

  <!-- 门内手绘拟声词 ポフッ -->
  <text x="460" y="180" font-family="sans-serif" font-weight="900" font-size="28" fill="#F43F5E" transform="rotate(12 460 180)">
    ポフッ
  </text>

  <!-- 动作抓门拟声词 ガッ -->
  <text x="390" y="440" font-family="sans-serif" font-weight="900" font-size="44" fill="#38BDF8" stroke="#FFFFFF" stroke-width="2" transform="rotate(-8 390 440)">
    ガッ
  </text>

  <!-- 气泡 1 (右上角) -->
  <ellipse cx="475" cy="160" rx="50" ry="85" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <text x="475" y="145" font-family="sans-serif" font-weight="bold" font-size="14" fill="#0F172A" text-anchor="middle">
    こんにちはぁ
  </text>
  <text x="475" y="170" font-family="sans-serif" font-weight="bold" font-size="14" fill="#0F172A" text-anchor="middle">
    ～♪
  </text>

  <!-- 气泡 2 (中央椭圆 幸せですか？) -->
  <ellipse cx="305" cy="235" rx="50" ry="110" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <text x="305" y="215" font-family="sans-serif" font-weight="bold" font-size="15" fill="#BE185D" text-anchor="middle">
    今
  </text>
  <text x="305" y="240" font-family="sans-serif" font-weight="bold" font-size="16" fill="#BE185D" text-anchor="middle">
    幸せですか？
  </text>

  <!-- 气泡 3 (门边小对话) -->
  <ellipse cx="480" cy="280" rx="40" ry="60" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
  <text x="480" y="275" font-family="sans-serif" font-weight="bold" font-size="12" fill="#0F172A" text-anchor="middle">
    はーい
  </text>
  <text x="480" y="295" font-family="sans-serif" font-weight="bold" font-size="12" fill="#0F172A" text-anchor="middle">
    今出ます～
  </text>

  <!-- 宣传语 (左侧旁白) -->
  <rect x="100" y="240" width="180" height="90" rx="10" fill="#FFFFFF" fill-opacity="0.92" stroke="#DB2777" stroke-width="2"/>
  <text x="190" y="275" font-family="sans-serif" font-weight="bold" font-size="13" fill="#BE185D" text-anchor="middle">
    迷えるアナタに
  </text>
  <text x="190" y="305" font-family="sans-serif" font-weight="bold" font-size="15" fill="#DB2777" text-anchor="middle">
    快楽の勧め…♥
  </text>

  <!-- 底部封面巨幅变形艺术主标题 訪問姦誘 -->
  <rect x="180" y="530" width="360" height="150" rx="16" fill="#1E1B4B" fill-opacity="0.85" stroke="#F43F5E" stroke-width="3"/>
  
  <!-- 振假名 -->
  <text x="360" y="565" font-family="sans-serif" font-weight="bold" font-size="13" fill="#FDE047" text-anchor="middle" letter-spacing="4">
    ほうもんかんゆう
  </text>

  <!-- 巨幅艺术字 -->
  <text x="360" y="625" font-family="sans-serif" font-weight="900" font-size="52" fill="url(#titleGrad)" stroke="#FFFFFF" stroke-width="2" text-anchor="middle" letter-spacing="6">
    訪問姦誘
  </text>

  <!-- 反白黑底副标语 -->
  <rect x="290" y="635" width="140" height="35" rx="6" fill="#0F172A" stroke="#E2E8F0" stroke-width="1.5"/>
  <text x="360" y="658" font-family="sans-serif" font-weight="bold" font-size="10" fill="#FFFFFF" text-anchor="middle">
    淫猥母子新シリーズご開帳♥
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
  {
    id: 'page_3_cover',
    title: '精选封面 · 艺术字与音效',
    imageUri: svgToDataUri(panel3Svg),
    originalWidth: 600,
    originalHeight: 800,
    bubbles: [
      {
        id: 'p3_b1',
        box: { x: 420, y: 70, width: 110, height: 180 },
        direction: 'vertical',
        textType: 'bubble',
        readingOrderIndex: 1,
        sourceText: 'こんにちはぁ～♪',
        targetText: '你好呀～♪',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.98,
        notes: '右上方门框内打招呼口吻，质点居中。',
      },
      {
        id: 'p3_b2',
        box: { x: 255, y: 120, width: 100, height: 230 },
        direction: 'vertical',
        textType: 'bubble',
        readingOrderIndex: 2,
        sourceText: '今 幸せですか？',
        targetText: '你现在幸福吗？',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#BE185D',
        confidence: 0.99,
        notes: '画面中央核心竖排对白气泡，小标精准锚定在长气泡质点中心 (X:305, Y:235)。',
      },
      {
        id: 'p3_b3',
        box: { x: 440, y: 220, width: 80, height: 120 },
        direction: 'vertical',
        textType: 'bubble',
        readingOrderIndex: 3,
        sourceText: 'はーい 今出ます～',
        targetText: '好—的，马上就来～',
        detectedBgColor: '#FFFFFF',
        detectedTextColor: '#0F172A',
        confidence: 0.95,
        notes: '门内回复对白气泡。',
      },
      {
        id: 'p3_b4',
        box: { x: 430, y: 125, width: 65, height: 95 },
        direction: 'vertical',
        textType: 'sfx',
        readingOrderIndex: 4,
        sourceText: 'ポフッ',
        targetText: '扑通',
        detectedBgColor: 'rgba(255, 255, 255, 0.9)',
        detectedTextColor: '#EF4444',
        confidence: 0.94,
        notes: '门缝手绘动效音效词，AI 视觉深度捕获。',
      },
      {
        id: 'p3_b5',
        box: { x: 320, y: 400, width: 140, height: 75 },
        direction: 'horizontal',
        textType: 'sfx',
        readingOrderIndex: 5,
        sourceText: 'ガッ',
        targetText: '咔！',
        detectedBgColor: 'rgba(255, 255, 255, 0.9)',
        detectedTextColor: '#DC2626',
        confidence: 0.96,
        notes: '握住门把手手移动态拟声词，闪电风格手绘大字。',
      },
      {
        id: 'p3_b6',
        box: { x: 105, y: 245, width: 175, height: 90 },
        direction: 'horizontal',
        textType: 'free_text',
        readingOrderIndex: 6,
        sourceText: '迷えるアナタに 快楽の勧め…♥',
        targetText: '致迷茫的你 快乐的邀约…♥',
        detectedBgColor: 'rgba(255, 255, 255, 0.95)',
        detectedTextColor: '#DB2777',
        confidence: 0.97,
        notes: '画面左侧艺术宣传语嵌字。',
      },
      {
        id: 'p3_b7',
        box: { x: 180, y: 530, width: 360, height: 150 },
        direction: 'horizontal',
        textType: 'title',
        readingOrderIndex: 7,
        sourceText: '訪問姦誘',
        furiganaCleanedText: 'ほうもんかんゆう',
        targetText: '上门诱惑',
        detectedBgColor: '#1E1B4B',
        detectedTextColor: '#EA580C',
        confidence: 0.98,
        notes: '封面巨幅变形艺术主标题！包含振假名注音「ほうもんかんゆう」，质点居中显示醒目金橙色标记。',
      },
      {
        id: 'p3_b8',
        box: { x: 290, y: 635, width: 140, height: 35 },
        direction: 'horizontal',
        textType: 'free_text',
        readingOrderIndex: 8,
        sourceText: '淫猥母子新シリーズご開帳♥',
        targetText: '淫猥母子新系列大开幕♥',
        detectedBgColor: '#0F172A',
        detectedTextColor: '#FFFFFF',
        confidence: 0.93,
        notes: '标题下方反相黑底白字副标题标语。',
      },
    ],
  },
];
