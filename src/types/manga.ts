export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ComicTextType = 'bubble' | 'free_text' | 'title' | 'sfx';

export interface TextBubble {
  id: string;
  box: BoundingBox;
  direction: 'vertical' | 'horizontal';
  readingOrderIndex: number;
  sourceText: string;
  furiganaCleanedText?: string;
  targetText: string;
  detectedBgColor: string;
  detectedTextColor?: string;
  confidence?: number;
  textType?: ComicTextType;
  fontSize?: number;
  notes?: string;
}

export interface MangaPage {
  id: string;
  title: string;
  imageUri: string;
  originalWidth: number;
  originalHeight: number;
  bubbles: TextBubble[];
}

export type DisplayMode = 'replace' | 'dots' | 'slider' | 'original';

export interface TranslatorConfig {
  provider: 'mock' | 'deepseek' | 'openai' | 'deepl' | 'sakura' | 'gemini';
  apiKey: string;
  apiEndpoint: string;
  model: string;
}
