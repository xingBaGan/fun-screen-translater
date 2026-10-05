import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOverlay from 'screen-translator-overlay';
import { CapturedScreenEvent, OverlayBubbleItem } from 'screen-translator-overlay';
import { TextBubble, TranslatorConfig } from '@/types/manga';
import { translateBubbleText, translateMangaBubblesBatch } from '@/services/translator';
import { sortJapaneseReadingOrder } from '@/services/bubbleEngine';
import { loadTranslatorConfig } from '@/services/storage';

import { SimulatedFloatingBall } from './SimulatedFloatingBall';

interface FloatingOverlayControllerProps {
  translatorConfig: TranslatorConfig;
  onNewCapturedPage?: (page: {
    uri: string;
    width: number;
    height: number;
    bubbles: TextBubble[];
  }) => void;
  showSimulatedBall?: boolean;
  onToggleSimulatedBall?: (show: boolean) => void;
  simulatedBubbles?: OverlayBubbleItem[];
  onSimulatedBubblesChange?: (bubbles: OverlayBubbleItem[]) => void;
  onTranslatingChange?: (translating: boolean) => void;
}

export function FloatingOverlayController({
  translatorConfig,
  onNewCapturedPage,
  showSimulatedBall: showSimulatedBallProp,
  onToggleSimulatedBall,
  simulatedBubbles: simulatedBubblesProp,
  onSimulatedBubblesChange,
  onTranslatingChange,
}: FloatingOverlayControllerProps) {
  const configRef = useRef(translatorConfig);
  useEffect(() => {
    configRef.current = translatorConfig;
  }, [translatorConfig]);

  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean>(true);
  const [isServiceRunning, setIsServiceRunning] = useState<boolean>(false);
  const [isStartingService, setIsStartingService] = useState<boolean>(false);
  const [lastCapturedEvent, setLastCapturedEvent] = useState<CapturedScreenEvent | null>(null);
  const [isTranslatingCaptured, setIsTranslatingCaptured] = useState<boolean>(false);
  const [translatedCount, setTranslatedCount] = useState<number>(0);

  // 应用内模拟悬浮球状态（供 Web/iOS 或应用内交互体验）
  const [internalShowSimulatedBall, setInternalShowSimulatedBall] = useState<boolean>(false);
  const [internalSimulatedBubbles, setInternalSimulatedBubbles] = useState<OverlayBubbleItem[]>([]);

  const showSimulatedBall =
    showSimulatedBallProp !== undefined ? showSimulatedBallProp : internalShowSimulatedBall;
  const simulatedBubbles =
    simulatedBubblesProp !== undefined ? simulatedBubblesProp : internalSimulatedBubbles;

  const handleToggleSimulatedBall = (val: boolean) => {
    if (onToggleSimulatedBall) {
      onToggleSimulatedBall(val);
    } else {
      setInternalShowSimulatedBall(val);
    }
  };

  // 互斥切换应用内仿真悬浮球（若系统级悬浮球正在运行，提醒用户或互斥关闭）
  const handleToggleSimulatedBallWithMutex = () => {
    if (isServiceRunning) {
      Alert.alert(
        '悬浮球互斥提示',
        '系统级跨应用悬浮球正在运行中（可在其他 App 上方使用）。若要切换为应用内仿真球，需要先停止系统悬浮服务，是否停止？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '停止系统悬浮并启用仿真球',
            style: 'destructive',
            onPress: () => {
              handleStopService();
              handleToggleSimulatedBall(true);
            },
          },
        ]
      );
      return;
    }
    handleToggleSimulatedBall(!showSimulatedBall);
  };

  // 检查权限与状态
  const checkPermissionsAndStatus = () => {
    const running = ScreenOverlay.isServiceRunning();
    setIsServiceRunning(running);
    if (running) {
      // 若原生服务已在运行，确保关闭应用内仿真球，防止双球重叠
      handleToggleSimulatedBall(false);
    }

    if (Platform.OS === 'android') {
      const granted = ScreenOverlay.isOverlayPermissionGranted();
      setHasOverlayPermission(granted);
    } else {
      setHasOverlayPermission(true);
    }
  };

  useEffect(() => {
    checkPermissionsAndStatus();

    // 监听服务状态变更：系统悬浮服务开启时，自动互斥关闭应用内仿真球
    const stateSub = ScreenOverlay.addServiceStateListener((event) => {
      setIsServiceRunning(event.running);
      if (event.running) {
        handleToggleSimulatedBall(false);
      }
    });

    // 监听全局屏幕截屏事件（无论在第三方应用还是当前应用点击悬浮球触发）
    const captureSub = ScreenOverlay.addScreenCaptureListener(async (event) => {
      setLastCapturedEvent(event);
      await handleScreenCaptured(event);
    });

    return () => {
      stateSub.remove();
      captureSub.remove();
    };
  }, [translatorConfig]);

  // 处理屏幕捕获后的 OCR 与机器翻译管线
  const handleScreenCaptured = async (event: CapturedScreenEvent) => {
    setIsTranslatingCaptured(true);
    onTranslatingChange?.(true);
    try {
      let detectedRawBubbles: TextBubble[] = [];

      if (event.detectedBubbles && event.detectedBubbles.length > 0) {
        // 使用 Android 端侧 Google ML Kit 离线识别与气泡聚类所得的真实对白块与坐标
        detectedRawBubbles = event.detectedBubbles.map((item, idx) => ({
          id: item.id || `cap_b_${idx + 1}`,
          box: {
            x: item.box.x,
            y: item.box.y,
            width: item.box.width,
            height: item.box.height,
          },
          direction: item.direction || 'vertical',
          textType: item.textType || 'bubble',
          readingOrderIndex: idx + 1,
          sourceText: item.sourceText,
          targetText: '',
          detectedBgColor: item.detectedBgColor || '#FFFFFF',
          detectedTextColor: item.detectedTextColor || '#18181B',
          fontSize: item.fontSize,
        }));
      } else if (!ScreenOverlay.isSupported()) {
        // 模拟/预览环境兜底数据
        detectedRawBubbles = [
          {
            id: `cap_b1_${Date.now()}`,
            box: {
              x: Math.round(event.width * 0.55),
              y: Math.round(event.height * 0.18),
              width: Math.round(event.width * 0.32),
              height: Math.round(event.height * 0.14),
            },
            direction: 'vertical',
            readingOrderIndex: 1,
            sourceText: 'お前…本気で言っているのか？',
            targetText: '',
            detectedBgColor: '#FFFFFF',
            detectedTextColor: '#18181B',
          },
          {
            id: `cap_b2_${Date.now()}`,
            box: {
              x: Math.round(event.width * 0.12),
              y: Math.round(event.height * 0.45),
              width: Math.round(event.width * 0.38),
              height: Math.round(event.height * 0.12),
            },
            direction: 'vertical',
            readingOrderIndex: 2,
            sourceText: 'ああ、絶対に諦めたりしないさ！',
            targetText: '',
            detectedBgColor: '#FFFFFF',
            detectedTextColor: '#18181B',
          },
        ];
      }

      if (detectedRawBubbles.length === 0) {
        ScreenOverlay.updateTranslationResult([]);
        setTranslatedCount(0);
        return;
      }

      // 1. 日漫从右往左、从上往下阅读流重排 (RTL)
      const sorted = sortJapaneseReadingOrder(detectedRawBubbles);

      // 2. 调用全屏多对白上下文大模型批量翻译 (整屏单次 API 请求，保留角色对白语境)
      let effectiveConfig = configRef.current || translatorConfig;
      if (effectiveConfig.provider === 'mock' || !effectiveConfig.apiKey) {
        try {
          const persisted = await loadTranslatorConfig();
          if (persisted && persisted.provider !== 'mock' && persisted.apiKey) {
            effectiveConfig = persisted;
          }
        } catch {
          // ignore
        }
      }

      const translatedBubbles: TextBubble[] = await translateMangaBubblesBatch(
        sorted,
        effectiveConfig
      );

      setTranslatedCount(translatedBubbles.length);

      // 3. 将翻译结果推送到 Android 系统悬浮窗（悬浮在第三方应用上即时展示）
      const overlayPayload: OverlayBubbleItem[] = translatedBubbles.map((b) => ({
        id: b.id,
        box: b.box,
        sourceText: b.sourceText,
        targetText: b.targetText,
        detectedBgColor: b.detectedBgColor,
        detectedTextColor: b.detectedTextColor,
      }));

      ScreenOverlay.updateTranslationResult(overlayPayload);
      setInternalSimulatedBubbles(overlayPayload);
      onSimulatedBubblesChange?.(overlayPayload);

      // 4. 同步至应用内详情查看
      if (onNewCapturedPage) {
        onNewCapturedPage({
          uri: event.uri,
          width: event.width,
          height: event.height,
          bubbles: translatedBubbles,
        });
      }
    } catch (err: any) {
      Alert.alert('屏幕翻译处理异常', err.message || '翻译管线运行失败');
    } finally {
      setIsTranslatingCaptured(false);
      onTranslatingChange?.(false);
    }
  };

  // 请求悬浮窗权限
  const handleRequestPermission = () => {
    if (Platform.OS !== 'android') {
      Alert.alert('跨应用悬浮说明', 'iOS/Web 系统受沙盒限制无法直接悬浮在其他第三方 App 之上，请使用应用内仿真模式调试。');
      return;
    }
    const granted = ScreenOverlay.requestOverlayPermission();
    if (granted) {
      setHasOverlayPermission(true);
      Alert.alert('权限已就绪', '已获得在其他应用上层显示的权限。');
    } else {
      Alert.alert(
        '请在系统设置中授权',
        '已打开系统设置，请找到本应用并开启【允许在其他应用上层显示】开关后返回。'
      );
    }
  };

  // 启动悬浮翻译服务
  const handleStartService = async () => {
    // 启动原生前先自动互斥关闭应用内仿真球
    handleToggleSimulatedBall(false);
    setIsStartingService(true);
    try {
      if (Platform.OS === 'android') {
        if (!hasOverlayPermission) {
          handleRequestPermission();
          setIsStartingService(false);
          return;
        }
      }

      const success = await ScreenOverlay.startOverlayService();
      if (success) {
        setIsServiceRunning(true);
        handleToggleSimulatedBall(false);
        Alert.alert(
          '🎉 跨应用悬浮翻译已启动！',
          '悬浮球已出现在屏幕边缘（应用内仿真球已自动互斥隐藏）。你现在可以切换到 Tachiyomi、B站漫画、浏览器等任意第三方应用，点击悬浮球即可一键截屏并实时翻译！'
        );
      }
    } catch (err: any) {
      Alert.alert('启动失败', err.message || '未获得屏幕录制/悬浮窗权限');
    } finally {
      setIsStartingService(false);
    }
  };

  // 停止悬浮服务
  const handleStopService = () => {
    ScreenOverlay.stopOverlayService();
    setIsServiceRunning(false);
  };

  // 手动测试截屏
  const handleTriggerCapture = () => {
    ScreenOverlay.captureScreen();
  };

  return (
    <View style={styles.container}>
      {/* 顶部标题与状态 */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="layers-outline" size={20} color="#4F46E5" />
          <Text style={styles.titleText}>跨应用全局悬浮翻译控制器</Text>
        </View>
        <View style={[styles.statusBadge, isServiceRunning ? styles.badgeActive : styles.badgeInactive]}>
          <View style={[styles.statusDot, isServiceRunning ? styles.dotActive : styles.dotInactive]} />
          <Text style={[styles.statusBadgeText, isServiceRunning ? styles.textActive : styles.textInactive]}>
            {isServiceRunning ? '运行中' : '已停止'}
          </Text>
        </View>
      </View>

      <Text style={styles.subtitleText}>
        通过 Android 系统悬浮窗与 MediaProjection，悬浮在任何第三方漫画阅读器或浏览器上方，实时捕获屏幕并原位翻译。
      </Text>

      {/* 权限检测与指引 */}
      <View style={styles.permissionCard}>
        <View style={styles.permissionItem}>
          <Ionicons
            name={hasOverlayPermission ? 'checkmark-circle' : 'close-circle'}
            size={18}
            color={hasOverlayPermission ? '#10B981' : '#EF4444'}
          />
          <Text style={styles.permissionLabel}>
            悬浮窗权限 (SYSTEM_ALERT_WINDOW):
          </Text>
          <Text style={styles.permissionValue}>
            {hasOverlayPermission ? '已授予' : '未授权'}
          </Text>
          {!hasOverlayPermission && (
            <TouchableOpacity style={styles.btnSmall} onPress={handleRequestPermission}>
              <Text style={styles.btnSmallText}>去授权</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.permissionItem}>
          <Ionicons
            name={isServiceRunning ? 'checkmark-circle' : 'time-outline'}
            size={18}
            color={isServiceRunning ? '#10B981' : '#64748B'}
          />
          <Text style={styles.permissionLabel}>
            屏幕截屏服务 (MediaProjection):
          </Text>
          <Text style={styles.permissionValue}>
            {isServiceRunning ? '就绪' : '未启动'}
          </Text>
        </View>
      </View>

      {/* 主控制按钮群 */}
      <View style={styles.actionsRow}>
        {!isServiceRunning ? (
          <TouchableOpacity
            style={[styles.btnPrimary, isStartingService && styles.btnDisabled]}
            onPress={handleStartService}
            disabled={isStartingService}
          >
            {isStartingService ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>启动跨应用悬浮球</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnDanger} onPress={handleStopService}>
            <Ionicons name="stop" size={18} color="#FFFFFF" />
            <Text style={styles.btnDangerText}>停止悬浮服务</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btnSecondary, isTranslatingCaptured && styles.btnDisabled]}
          onPress={handleTriggerCapture}
          disabled={isTranslatingCaptured}
        >
          {isTranslatingCaptured ? (
            <ActivityIndicator color="#4F46E5" size="small" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={18} color="#4F46E5" />
              <Text style={styles.btnSecondaryText}>测试立即截屏</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 仿真模式开关（便于非原生环境验证，与系统级悬浮球严格互斥） */}
      <View style={styles.simRow}>
        <View style={styles.simLabelCol}>
          <Text style={styles.simLabel}>应用内交互仿真球 (免切换应用快速体验):</Text>
          {isServiceRunning && (
            <Text style={styles.simDisabledTip}>
              ⚠️ 系统级悬浮球运行中，仿真球已自动避让关闭
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            showSimulatedBall && !isServiceRunning && styles.toggleBtnActive,
            isServiceRunning && styles.toggleBtnDisabled,
          ]}
          onPress={handleToggleSimulatedBallWithMutex}
        >
          <Text
            style={[
              styles.toggleBtnText,
              showSimulatedBall && !isServiceRunning && styles.toggleBtnTextActive,
              isServiceRunning && styles.toggleBtnTextDisabled,
            ]}
          >
            {isServiceRunning ? '已互斥避让' : (showSimulatedBall ? '已开启' : '已关闭')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 最新截屏翻译监控反馈 */}
      {lastCapturedEvent && (
        <View style={styles.eventInfoBox}>
          <View style={styles.eventInfoTitleRow}>
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text style={styles.eventInfoTitle}>最新捕获屏幕数据</Text>
            {isTranslatingCaptured && (
              <Text style={styles.translatingTag}>AI 分析翻译中...</Text>
            )}
          </View>
          <Text style={styles.eventText}>
            📐 屏幕分辨率: {lastCapturedEvent.width} × {lastCapturedEvent.height}
          </Text>
          <Text style={styles.eventText} numberOfLines={1}>
            📁 缓存文件: {lastCapturedEvent.uri}
          </Text>
          <Text style={styles.eventText}>
            💬 识别对白块: {translatedCount} 个 (已实时回传浮窗)
          </Text>
        </View>
      )}

      {/* 若未由外部容器接管渲染，则在此处降级挂载全局仿真悬浮球（与原生系统悬浮严格互斥） */}
      {showSimulatedBallProp === undefined && showSimulatedBall && !isServiceRunning && (
        <SimulatedFloatingBall
          onCapture={handleTriggerCapture}
          bubbles={simulatedBubbles}
          isProcessing={isTranslatingCaptured}
          onClose={() => handleToggleSimulatedBall(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  badgeActive: {
    backgroundColor: '#DCFCE7',
  },
  badgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  dotInactive: {
    backgroundColor: '#94A3B8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textActive: {
    color: '#15803D',
  },
  textInactive: {
    color: '#64748B',
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  permissionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  permissionLabel: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  permissionValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  btnSmall: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  btnSmallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  btnSecondaryText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 6,
  },
  simLabelCol: {
    flex: 1,
    paddingRight: 8,
  },
  simLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  simDisabledTip: {
    fontSize: 11,
    color: '#D97706',
    marginTop: 2,
    fontWeight: '500',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  toggleBtnActive: {
    backgroundColor: '#4F46E5',
  },
  toggleBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  toggleBtnTextDisabled: {
    color: '#94A3B8',
  },
  eventInfoBox: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 4,
  },
  eventInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },
  translatingTag: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  eventText: {
    fontSize: 12,
    color: '#78350F',
  },
});
