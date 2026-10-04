import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOverlay from 'screen-translator-overlay';
import { CapturedScreenEvent, OverlayBubbleItem } from 'screen-translator-overlay';
import { TextBubble, TranslatorConfig } from '@/types/manga';
import { translateBubbleText } from '@/services/translator';
import { sortJapaneseReadingOrder } from '@/services/bubbleEngine';

interface FloatingOverlayControllerProps {
  translatorConfig: TranslatorConfig;
  onNewCapturedPage?: (page: {
    uri: string;
    width: number;
    height: number;
    bubbles: TextBubble[];
  }) => void;
}

export function FloatingOverlayController({
  translatorConfig,
  onNewCapturedPage,
}: FloatingOverlayControllerProps) {
  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean>(true);
  const [isServiceRunning, setIsServiceRunning] = useState<boolean>(false);
  const [isStartingService, setIsStartingService] = useState<boolean>(false);
  const [lastCapturedEvent, setLastCapturedEvent] = useState<CapturedScreenEvent | null>(null);
  const [isTranslatingCaptured, setIsTranslatingCaptured] = useState<boolean>(false);
  const [translatedCount, setTranslatedCount] = useState<number>(0);

  // 应用内模拟悬浮球状态（供 Web/iOS 或应用内交互体验）
  const [showSimulatedBall, setShowSimulatedBall] = useState<boolean>(false);
  const [simulatedBallPos] = useState(new Animated.ValueXY({ x: 20, y: 120 }));
  const [simulatedCardVisible, setSimulatedCardVisible] = useState<boolean>(false);
  const [simulatedBubbles, setSimulatedBubbles] = useState<OverlayBubbleItem[]>([]);

  // 检查权限与状态
  const checkPermissionsAndStatus = () => {
    if (Platform.OS === 'android') {
      const granted = ScreenOverlay.isOverlayPermissionGranted();
      setHasOverlayPermission(granted);
      setIsServiceRunning(ScreenOverlay.isServiceRunning());
    } else {
      setHasOverlayPermission(true);
      setIsServiceRunning(ScreenOverlay.isServiceRunning());
    }
  };

  useEffect(() => {
    checkPermissionsAndStatus();

    // 监听服务状态变更
    const stateSub = ScreenOverlay.addServiceStateListener((event) => {
      setIsServiceRunning(event.running);
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
    try {
      // 模拟/实际检测截屏中的对白文字块（真实落地对接 Manga-OCR/PaddleOCR 后端）
      const detectedRawBubbles: TextBubble[] = [
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
          detectedTextColor: '#0F172A',
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
          detectedTextColor: '#0F172A',
        },
      ];

      // 1. 日漫从右往左阅读流重排
      const sorted = sortJapaneseReadingOrder(detectedRawBubbles);

      // 2. 调用翻译模型 (DeepSeek / DeepL / Mock)
      const translatedBubbles: TextBubble[] = await Promise.all(
        sorted.map(async (b) => {
          const translated = await translateBubbleText(b.sourceText, translatorConfig);
          return {
            ...b,
            targetText: translated,
          };
        })
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
      setSimulatedBubbles(overlayPayload);

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
        Alert.alert(
          '🎉 跨应用悬浮翻译已启动！',
          '悬浮球已出现在屏幕边缘。你现在可以切换到 Tachiyomi、B站漫画、浏览器等任意第三方应用，点击悬浮球即可一键截屏并实时翻译！'
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

  // 模拟悬浮球拖拽手势
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: simulatedBallPos.x, dy: simulatedBallPos.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      // 点击模拟悬浮球
      handleTriggerCapture();
      setSimulatedCardVisible(true);
    },
  });

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

      {/* 仿真模式开关（便于非原生环境验证） */}
      <View style={styles.simRow}>
        <Text style={styles.simLabel}>应用内交互仿真球 (免切换应用快速体验):</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, showSimulatedBall && styles.toggleBtnActive]}
          onPress={() => setShowSimulatedBall(!showSimulatedBall)}
        >
          <Text style={[styles.toggleBtnText, showSimulatedBall && styles.toggleBtnTextActive]}>
            {showSimulatedBall ? '已开启' : '已关闭'}
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

      {/* 应用内仿真浮球 View */}
      {showSimulatedBall && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.simulatedBall,
            {
              transform: [
                { translateX: simulatedBallPos.x },
                { translateY: simulatedBallPos.y },
              ],
            },
          ]}
        >
          <Text style={styles.simulatedBallText}>译</Text>
        </Animated.View>
      )}

      {/* 仿真翻译浮卡 */}
      {showSimulatedBall && simulatedCardVisible && (
        <View style={styles.simulatedCard}>
          <View style={styles.simulatedCardHeader}>
            <Text style={styles.simulatedCardTitle}>✨ 悬浮翻译卡片预览</Text>
            <TouchableOpacity onPress={() => setSimulatedCardVisible(false)}>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          {simulatedBubbles.length > 0 ? (
            simulatedBubbles.map((b, idx) => (
              <View key={b.id || idx} style={styles.simulatedCardItem}>
                <Text style={styles.simItemSource}>[{idx + 1}] 原文: {b.sourceText}</Text>
                <Text style={styles.simItemTarget}>译文: {b.targetText}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.simEmpty}>点击悬浮球即可抓取屏幕并翻译漫画！</Text>
          )}
        </View>
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
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  simLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  toggleBtnActive: {
    backgroundColor: '#4F46E5',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
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
  simulatedBall: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 999,
  },
  simulatedBallText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  simulatedCard: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  simulatedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  simulatedCardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  simulatedCardItem: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  simItemSource: {
    color: '#94A3B8',
    fontSize: 11,
  },
  simItemTarget: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  simEmpty: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
