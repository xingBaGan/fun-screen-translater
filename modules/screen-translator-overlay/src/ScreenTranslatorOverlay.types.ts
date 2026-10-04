export interface CapturedScreenEvent {
  uri: string;
  width: number;
  height: number;
  timestamp: number;
}

export interface ServiceStateEvent {
  running: boolean;
}

export interface OverlayBubbleItem {
  id: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  sourceText: string;
  targetText: string;
  detectedBgColor?: string;
  detectedTextColor?: string;
}

export interface Subscription {
  remove: () => void;
}
