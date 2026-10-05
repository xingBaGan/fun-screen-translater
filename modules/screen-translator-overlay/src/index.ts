import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import {
  CapturedScreenEvent,
  ServiceStateEvent,
  OverlayBubbleItem,
  RecognizeImageResult,
  Subscription,
} from './ScreenTranslatorOverlay.types';

export * from './ScreenTranslatorOverlay.types';

let NativeModule: any = null;
try {
  if (Platform.OS === 'android') {
    NativeModule = requireNativeModule('ScreenTranslatorOverlay');
  }
} catch {
  // 运行在 Expo Go、Web 或 iOS 模拟环境，NativeModule 尚未编译接入
  NativeModule = null;
}

// 模拟事件发射器（用于 Web/iOS 或 Expo Go 预览环境）
const mockCaptureListeners = new Set<(event: CapturedScreenEvent) => void>();
const mockStateListeners = new Set<(event: ServiceStateEvent) => void>();
let mockServiceRunning = false;

/**
 * 判断当前设备系统是否原生支持跨应用悬浮窗与屏幕捕获（仅 Android 支持）
 */
export function isSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  return NativeModule != null;
}

/**
 * 检查是否已授予 Android【在其他应用上层显示】悬浮窗权限 (SYSTEM_ALERT_WINDOW)
 */
export function isOverlayPermissionGranted(): boolean {
  if (!NativeModule) return true; // 非 Android 或模拟模式默认通过
  try {
    return Boolean(NativeModule.isOverlayPermissionGranted());
  } catch {
    return false;
  }
}

/**
 * 请求授予悬浮窗权限（会自动跳转到 Android 系统【显示在其他应用上层】设置页面）
 */
export function requestOverlayPermission(): boolean {
  if (!NativeModule) return true;
  try {
    return Boolean(NativeModule.requestOverlayPermission());
  } catch {
    return false;
  }
}

/**
 * 检查跨应用悬浮服务与 MediaProjection 屏幕捕获是否正在运行
 */
export function isServiceRunning(): boolean {
  if (!NativeModule) return mockServiceRunning;
  try {
    return Boolean(NativeModule.isServiceRunning());
  } catch {
    return false;
  }
}

/**
 * 启动跨应用悬浮翻译服务
 * 1. 自动校验系统悬浮窗权限（未授予则提示去设置）
 * 2. 调起 Android 系统 MediaProjection 屏幕截屏/录制安全确认弹窗
 * 3. 授权通过后在屏幕侧边挂载高灵敏度悬浮球
 */
export async function startOverlayService(): Promise<boolean> {
  if (!NativeModule) {
    mockServiceRunning = true;
    mockStateListeners.forEach((listener) => listener({ running: true }));
    return true;
  }

  return await NativeModule.startOverlayService();
}

/**
 * 停止悬浮服务，清理 WindowManager 悬浮球与后台 MediaProjection
 */
export function stopOverlayService(): boolean {
  if (!NativeModule) {
    mockServiceRunning = false;
    mockStateListeners.forEach((listener) => listener({ running: false }));
    return true;
  }

  try {
    return Boolean(NativeModule.stopOverlayService());
  } catch {
    return false;
  }
}

/**
 * 手动/程序触发一次屏幕截屏
 */
export function captureScreen(): boolean {
  if (!NativeModule) {
    // 模拟捕获事件
    setTimeout(() => {
      const mockEvent: CapturedScreenEvent = {
        uri: 'mock_captured_screen',
        width: 1080,
        height: 2400,
        timestamp: Date.now(),
      };
      mockCaptureListeners.forEach((l) => l(mockEvent));
    }, 300);
    return true;
  }

  try {
    return Boolean(NativeModule.captureScreen());
  } catch {
    return false;
  }
}

/**
 * 将 OCR 与模型翻译得到的气泡结果同步到第三方应用上方的悬浮卡片/原地覆盖层
 */
export function updateTranslationResult(bubbles: OverlayBubbleItem[]): boolean {
  const jsonStr = JSON.stringify(bubbles);
  if (!NativeModule) {
    return true;
  }

  try {
    return Boolean(NativeModule.updateTranslationResult(jsonStr));
  } catch {
    return false;
  }
}

/**
 * 调用端侧 Google ML Kit 离线识别指定本地图片的文字与气泡位置 (包含对白气泡、画面标题、旁白、拟声词)
 */
export async function recognizeImage(
  imageUri: string,
  lang: string = 'ja'
): Promise<RecognizeImageResult> {
  if (!NativeModule || typeof NativeModule.recognizeImage !== 'function') {
    console.warn(
      '[ScreenOverlay] 原生 recognizeImage 方法未在当前运行的 APK 中找到。请运行 "npx expo run:android" 编译最新原生代码。'
    );
    return {
      width: 0,
      height: 0,
      bubbles: [],
      error: 'NATIVE_REBUILD_REQUIRED',
    };
  }

  try {
    const res = await NativeModule.recognizeImage(imageUri, lang);
    if (Array.isArray(res)) {
      return { width: 0, height: 0, bubbles: res };
    }
    return {
      width: res?.width || 0,
      height: res?.height || 0,
      bubbles: res?.bubbles || [],
    };
  } catch (err: any) {
    console.warn('[ScreenOverlay] recognizeImage 执行失败:', err);
    return {
      width: 0,
      height: 0,
      bubbles: [],
      error: err?.message || 'OCR_ERROR',
    };
  }
}

/**
 * 局部区域高精度 OCR 识别 (针对用户在画布点击未识别区域的人机协同点按交互)
 */
export async function recognizeRegion(
  imageUri: string,
  cx: number,
  cy: number,
  radiusW?: number,
  radiusH?: number,
  lang: string = 'ja'
): Promise<OverlayBubbleItem | null> {
  if (!NativeModule || typeof NativeModule.recognizeRegion !== 'function') {
    return null;
  }
  try {
    const res = await NativeModule.recognizeRegion(imageUri, cx, cy, radiusW, radiusH, lang);
    return res || null;
  } catch (err: any) {
    console.warn('[ScreenOverlay] recognizeRegion 执行异常:', err);
    return null;
  }
}

/**
 * 监听悬浮球点击或屏幕捕获完成事件
 * 当在第三方应用（如 Tachiyomi、B站漫画、Kindle等）上轻触悬浮球时，会触发该事件并回传截屏图片 Uri 与尺寸
 */
export function addScreenCaptureListener(
  listener: (event: CapturedScreenEvent) => void
): Subscription {
  if (!NativeModule) {
    mockCaptureListeners.add(listener);
    return {
      remove: () => {
        mockCaptureListeners.delete(listener);
      },
    };
  }

  return NativeModule.addListener('onScreenCaptured', listener);
}

/**
 * 监听前台悬浮服务的启动/关闭状态变更
 */
export function addServiceStateListener(
  listener: (event: ServiceStateEvent) => void
): Subscription {
  if (!NativeModule) {
    mockStateListeners.add(listener);
    return {
      remove: () => {
        mockStateListeners.delete(listener);
      },
    };
  }

  return NativeModule.addListener('onServiceStateChanged', listener);
}

const inMemoryStorage = new Map<string, string>();

/**
 * 读取本地持久化字符串配置（Android 端基于系统原生 SharedPreferences，Web 端基于 localStorage）
 */
export function getStringSetting(key: string, defaultValue: string = ''): string {
  if (NativeModule && typeof NativeModule.getStringSetting === 'function') {
    try {
      const val = NativeModule.getStringSetting(key, defaultValue);
      if (val !== undefined && val !== null) {
        return String(val);
      }
    } catch (err) {
      console.warn('[ScreenOverlay] 读取原生 SharedPreferences 失败:', err);
    }
  }

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      // ignore
    }
  }

  return inMemoryStorage.has(key) ? inMemoryStorage.get(key)! : defaultValue;
}

/**
 * 写入本地持久化字符串配置（Android 端基于系统原生 SharedPreferences，Web 端基于 localStorage）
 */
export function setStringSetting(key: string, value: string): boolean {
  inMemoryStorage.set(key, value);

  if (NativeModule && typeof NativeModule.setStringSetting === 'function') {
    try {
      return Boolean(NativeModule.setStringSetting(key, value));
    } catch (err) {
      console.warn('[ScreenOverlay] 写入原生 SharedPreferences 失败:', err);
    }
  }

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // ignore
    }
  }

  return true;
}

