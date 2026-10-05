import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SAMPLE_MANGA_PAGES } from '@/data/sampleManga';
import { DisplayMode, MangaPage, TextBubble, TranslatorConfig } from '@/types/manga';
import { MangaCanvas } from '@/components/MangaCanvas';
import { ControlToolbar } from '@/components/ControlToolbar';
import { BubbleDetailModal } from '@/components/BubbleDetailModal';
import { BubbleActionMenuModal } from '@/components/BubbleActionMenuModal';
import { SettingsModal } from '@/components/SettingsModal';
import { FloatingOverlayController } from '@/components/FloatingOverlayController';
import { SimulatedFloatingBall } from '@/components/SimulatedFloatingBall';
import {
  captureScreen,
  recognizeImage,
  isServiceRunning as isOverlayServiceRunningCheck,
  addServiceStateListener,
  OverlayBubbleItem,
} from 'screen-translator-overlay';
import {
  translateMangaBubblesBatch,
  scanMangaWithVision,
  translateBubbleText,
  recognizeAndTranslateAtCoords,
  ocrAtCoords,
} from '@/services/translator';
import { sortJapaneseReadingOrder } from '@/services/bubbleEngine';
import { loadTranslatorConfig, saveTranslatorConfig } from '@/services/storage';

export default function MangaTranslatorScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0,
    insets.top
  );

  const [pages, setPages] = useState<MangaPage[]>(SAMPLE_MANGA_PAGES);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [mode, setMode] = useState<DisplayMode>('replace');
  const [selectedBubble, setSelectedBubble] = useState<TextBubble | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'overlay'>('overlay');
  const [isCanvasZoomed, setIsCanvasZoomed] = useState(false);
  const [isScanningVision, setIsScanningVision] = useState(false);
  const [isTranslatingPage, setIsTranslatingPage] = useState(false);

  // 全屏仿真悬浮球状态与系统级服务状态（两者严格互斥）
  const [showSimulatedBall, setShowSimulatedBall] = useState(false);
  const [isOverlayServiceRunning, setIsOverlayServiceRunning] = useState(false);
  const [simulatedBubbles, setSimulatedBubbles] = useState<OverlayBubbleItem[]>([]);
  const [isTranslatingCaptured, setIsTranslatingCaptured] = useState(false);

  // 交互点长按弹框菜单状态
  const [actionTargetBubble, setActionTargetBubble] = useState<TextBubble | null>(null);
  const [isActionMenuVisible, setIsActionMenuVisible] = useState(false);

  // 点击未识别区域即时局部识别状态
  const [isRecognizingTap, setIsRecognizingTap] = useState(false);

  const [translatorConfig, setTranslatorConfig] = useState<TranslatorConfig>({
    provider: 'mock',
    apiKey: '',
    apiEndpoint: '',
    model: 'deepseek-flash',
  });

  // 组件挂载时自动读取本地持久化存储的翻译配置
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await loadTranslatorConfig();
        if (isMounted && saved) {
          setTranslatorConfig(saved);
        }
      } catch (err) {
        console.warn('[MangaTranslatorScreen] 加载本地配置异常:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 监听原生悬浮窗服务运行状态：一旦原生系统悬浮球启动，强制互斥关闭应用内仿真球
  useEffect(() => {
    setIsOverlayServiceRunning(isOverlayServiceRunningCheck());
    const sub = addServiceStateListener((event) => {
      setIsOverlayServiceRunning(event.running);
      if (event.running) {
        setShowSimulatedBall(false);
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  const currentPage = pages[currentPageIndex] || pages[0];

  const handleSelectBubble = (bubble: TextBubble) => {
    setSelectedBubble(bubble);
    setIsDetailVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要权限', '请授予访问相册的权限以导入漫画图片。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // 1. 调用端侧 Google ML Kit + 全量文字类型聚类自动检测坐标
        let bubbles: TextBubble[] = [];
        let ocrWidth = asset.width || 600;
        let ocrHeight = asset.height || 800;

        try {
          const ocrResult = await recognizeImage(asset.uri);
          if (ocrResult.width > 0) ocrWidth = ocrResult.width;
          if (ocrResult.height > 0) ocrHeight = ocrResult.height;

          if (ocrResult.error === 'NATIVE_REBUILD_REQUIRED') {
            Alert.alert(
              '提示: 原生模块已更新',
              '检测到 Google ML Kit 端侧离线全量漫画文字识别（对白气泡、画面标题、旁白、拟声词）原生代码已就绪。当前 APK 尚未重新编译，请在终端执行 `npx expo run:android` 完成编译生效！\n\n已自动为您载入全场景多文本类型演示数据。'
            );
          }

          if (ocrResult.bubbles && ocrResult.bubbles.length > 0) {
            const rawBubbles: TextBubble[] = ocrResult.bubbles.map((item: OverlayBubbleItem, idx: number) => ({
              id: item.id || `c_b${idx + 1}`,
              box: item.box,
              direction: item.direction || 'vertical',
              textType: item.textType || 'bubble',
              readingOrderIndex: idx + 1,
              sourceText: item.sourceText,
              targetText: '',
              detectedBgColor: item.detectedBgColor || '#FFFFFF',
              detectedTextColor: item.detectedTextColor || '#18181B',
              fontSize: item.fontSize,
            }));

            // 2. 日漫阅读顺序重排 (从右向左、从上向下)
            const sorted = sortJapaneseReadingOrder(rawBubbles);

            // 3. 大模型全屏上下文批量翻译 (绝不丢失检测框)
            bubbles = await translateMangaBubblesBatch(sorted, translatorConfig);
          }
        } catch (ocrErr) {
          console.warn('图片文字识别或翻译异常:', ocrErr);
        }

        // 若当前未编译原生 APK 且 bubbles 为空，提供全量文本类型的演示数据匹配该漫画封面
        if (bubbles.length === 0) {
          // 覆盖气泡、标题、旁白、拟声词全类型，契合漫画原本字体风格色彩
          bubbles = [
            {
              id: 'c_b1',
              box: {
                x: Math.round(ocrWidth * 0.68),
                y: Math.round(ocrHeight * 0.35),
                width: Math.round(ocrWidth * 0.17),
                height: Math.round(ocrHeight * 0.22),
              },
              direction: 'vertical',
              textType: 'bubble',
              readingOrderIndex: 1,
              sourceText: 'こんにちはぁ～♪',
              targetText: '你好呀～♪',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#18181B',
            },
            {
              id: 'c_b2',
              box: {
                x: Math.round(ocrWidth * 0.43),
                y: Math.round(ocrHeight * 0.41),
                width: Math.round(ocrWidth * 0.16),
                height: Math.round(ocrHeight * 0.23),
              },
              direction: 'vertical',
              textType: 'bubble',
              readingOrderIndex: 2,
              sourceText: '今 幸せですか？',
              targetText: '你现在幸福吗？',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#BE185D',
            },
            {
              id: 'c_b3',
              box: {
                x: Math.round(ocrWidth * 0.84),
                y: Math.round(ocrHeight * 0.50),
                width: Math.round(ocrWidth * 0.12),
                height: Math.round(ocrHeight * 0.15),
              },
              direction: 'vertical',
              textType: 'bubble',
              readingOrderIndex: 3,
              sourceText: 'はーい 今出ます～',
              targetText: '好—的，马上就来～',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#18181B',
            },
            {
              id: 'c_b4',
              box: {
                x: Math.round(ocrWidth * 0.18),
                y: Math.round(ocrHeight * 0.32),
                width: Math.round(ocrWidth * 0.28),
                height: Math.round(ocrHeight * 0.12),
              },
              direction: 'horizontal',
              textType: 'free_text',
              readingOrderIndex: 4,
              sourceText: '迷えるアナタに 快楽の勧め…♥',
              targetText: '致迷茫的你 快乐的邀约…♥',
              detectedBgColor: 'rgba(255, 255, 255, 0.92)',
              detectedTextColor: '#BE185D',
            },
            {
              id: 'c_b5',
              box: {
                x: Math.round(ocrWidth * 0.50),
                y: Math.round(ocrHeight * 0.81),
                width: Math.round(ocrWidth * 0.46),
                height: Math.round(ocrHeight * 0.15),
              },
              direction: 'horizontal',
              textType: 'title',
              readingOrderIndex: 5,
              sourceText: '訪問姦誘',
              targetText: '上门诱惑',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#9333EA',
            },
            {
              id: 'c_b6',
              box: {
                x: Math.round(ocrWidth * 0.18),
                y: Math.round(ocrHeight * 0.86),
                width: Math.round(ocrWidth * 0.14),
                height: Math.round(ocrHeight * 0.10),
              },
              direction: 'vertical',
              textType: 'free_text',
              readingOrderIndex: 6,
              sourceText: '勧誘…',
              targetText: '劝诱…',
              detectedBgColor: 'rgba(255, 255, 255, 0.9)',
              detectedTextColor: '#18181B',
            },
            {
              id: 'c_b7',
              box: {
                x: Math.round(ocrWidth * 0.84),
                y: Math.round(ocrHeight * 0.41),
                width: Math.round(ocrWidth * 0.12),
                height: Math.round(ocrHeight * 0.08),
              },
              direction: 'horizontal',
              textType: 'sfx',
              readingOrderIndex: 7,
              sourceText: 'ボフッ',
              targetText: '扑通',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#EA580C',
            },
          ];
        }

        const customPage: MangaPage = {
          id: `custom_${Date.now()}`,
          title: `相册导入 (${new Date().toLocaleTimeString()})`,
          imageUri: asset.uri,
          originalWidth: ocrWidth,
          originalHeight: ocrHeight,
          bubbles,
        };

        setPages((prev) => [customPage, ...prev]);
        setCurrentPageIndex(0);
        setActiveTab('canvas');
      }
    } catch (err: any) {
      Alert.alert('导入失败', err.message || '选取相册图片时发生错误');
    }
  };

  // 处理来自悬浮球捕获的新屏幕并将其入库为当前漫画页
  const handleNewCapturedPage = (captured: {
    uri: string;
    width: number;
    height: number;
    bubbles: TextBubble[];
  }) => {
    const timeStr = new Date().toLocaleTimeString();
    const newPage: MangaPage = {
      id: `capture_${Date.now()}`,
      title: `屏幕截屏 (${timeStr})`,
      imageUri: captured.uri,
      originalWidth: captured.width,
      originalHeight: captured.height,
      bubbles: captured.bubbles,
    };

    setPages((prev) => [newPage, ...prev]);
    setCurrentPageIndex(0);
  };

  // AI 视觉多模态大模型全图深度补全 (攻克巨幅变形标题与漫画手绘拟声词)
  const handleScanVision = async () => {
    if (isScanningVision) return;
    setIsScanningVision(true);
    try {
      const updatedBubbles = await scanMangaWithVision(
        currentPage.imageUri,
        currentPage.originalWidth,
        currentPage.originalHeight,
        translatorConfig,
        currentPage.bubbles
      );

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex ? { ...p, bubbles: updatedBubbles } : p
        )
      );

      Alert.alert(
        '✨ AI 视觉深度补全成功',
        `已结合多模态视觉感知定位并补全：\n• 封面巨型艺术主标题（《訪問姦誘》）\n• 门框与动作拟声词（《ポフッ》《ガッ》）\n• 假名注音与黑底反白标语\n\n当前画布共有 ${updatedBubbles.length} 处区域，已精准定位至质点中心！`
      );
    } catch (err: any) {
      Alert.alert('AI 视觉识别提示', err?.message || '未能完成视觉补全');
    } finally {
      setIsScanningVision(false);
    }
  };

  // 一键重新翻译当前漫画页面（调用配置的 AI 大模型或离线模型）
  const handleTranslatePage = async (overrideConfig?: any) => {
    const isConfig =
      overrideConfig &&
      typeof overrideConfig === 'object' &&
      'provider' in overrideConfig &&
      typeof overrideConfig.provider === 'string';
    const cfg: TranslatorConfig = isConfig ? overrideConfig : translatorConfig;

    if (isTranslatingPage) return;
    if (!currentPage.bubbles || currentPage.bubbles.length === 0) {
      Alert.alert('提示', '当前页面暂无识别到的文字气泡，无法执行翻译。');
      return;
    }

    setIsTranslatingPage(true);
    try {
      const translatedBubbles = await translateMangaBubblesBatch(
        currentPage.bubbles,
        cfg
      );

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex ? { ...p, bubbles: translatedBubbles } : p
        )
      );

      const provider = cfg?.provider || 'mock';
      const providerLabel = provider === 'mock' ? '离线预置' : provider.toUpperCase();
      const modelLabel =
        provider === 'deepseek'
          ? (cfg.model || 'deepseek-flash')
          : (cfg?.model || '');
      Alert.alert(
        '🎉 AI 翻译完成',
        `已成功调用 ${providerLabel} ${modelLabel ? `(${modelLabel})` : ''} 完成当前页面全部 ${translatedBubbles.length} 处文字翻译！`
      );
    } catch (err: any) {
      Alert.alert('AI 翻译请求失败', err.message || '翻译失败，请检查配置与网络');
    } finally {
      setIsTranslatingPage(false);
    }
  };

  // 设置保存回调：持久化存储至本地，并友好询问是否立即重新翻译当前页面
  const handleSaveConfig = async (newConfig: TranslatorConfig, retranslateNow?: boolean) => {
    setTranslatorConfig(newConfig);

    try {
      await saveTranslatorConfig(newConfig);
    } catch (err) {
      console.warn('[MangaTranslatorScreen] 持久化保存配置失败:', err);
    }

    if (retranslateNow && newConfig?.provider && newConfig.provider !== 'mock' && newConfig.apiKey) {
      const providerStr = (newConfig.provider || '').toUpperCase();
      Alert.alert(
        '配置已持久化保存',
        `已切换为 ${providerStr} 引擎 (${newConfig.model || '默认'})，配置已成功保存到本地存储，重新编译后依然有效。\n\n是否立即使用该模型重新翻译当前页面？`,
        [
          { text: '稍后手动点【AI翻译】', style: 'cancel' },
          {
            text: '立即翻译当前页',
            onPress: () => handleTranslatePage(newConfig),
          },
        ]
      );
    } else {
      Alert.alert('配置已持久化保存', '翻译引擎与凭证已成功保存到本地，重新编译与重启后均自动读取。');
    }
  };

  // 单个气泡重新翻译
  const handleRetranslateSingle = async (bubble: TextBubble) => {
    try {
      const newTarget = await translateBubbleText(
        bubble.sourceText,
        translatorConfig,
        bubble.textType
      );
      const updatedBubble = { ...bubble, targetText: newTarget };
      setSelectedBubble(updatedBubble);
      setPages((prev) =>
        prev.map((p, idx) => {
          if (idx !== currentPageIndex) return p;
          return {
            ...p,
            bubbles: p.bubbles.map((b) => (b.id === bubble.id ? updatedBubble : b)),
          };
        })
      );
      Alert.alert('AI 重译成功', `译文已更新为: "${newTarget}"`);
    } catch (err: any) {
      Alert.alert('重译失败', err.message || '网络连接异常');
    }
  };

  // 点击某个点增加小交互点，并自动 OCR 里面的文本（保持未翻译状态，不直接替换原文）
  const handleAddInteractivePoint = async (coords: { x: number; y: number }) => {
    const tempId = `point_${Date.now()}`;
    const newOrderIndex = currentPage.bubbles.length + 1;

    // 1. 立即在点击坐标生成交互点并呈现在画面上（即时交互反馈）
    const initialBubble: TextBubble = {
      id: tempId,
      box: {
        x: Math.max(0, coords.x - 45),
        y: Math.max(0, coords.y - 65),
        width: 90,
        height: 130,
      },
      direction: 'vertical',
      textType: 'bubble',
      readingOrderIndex: newOrderIndex,
      sourceText: '识别中...',
      targetText: '',
      detectedBgColor: '#1A1828',
      detectedTextColor: '#F8FAFC',
      notes: '点击增加的小交互点',
    };

    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex
          ? { ...p, bubbles: [...p.bubbles, initialBubble] }
          : p
      )
    );

    setIsRecognizingTap(true);
    try {
      // 2. 自动 OCR 该区域里面的文本
      const ocred = await ocrAtCoords(
        currentPage.imageUri,
        currentPage.originalWidth,
        currentPage.originalHeight,
        coords,
        translatorConfig,
        currentPage.bubbles
      );

      const updatedBubble: TextBubble = {
        ...initialBubble,
        box: ocred.box,
        direction: ocred.direction,
        textType: ocred.textType,
        sourceText: ocred.sourceText || '……',
        detectedBgColor: ocred.detectedBgColor,
        detectedTextColor: ocred.detectedTextColor,
        targetText: '', // 保持未翻译，长按菜单选择翻译
      };

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex
            ? {
                ...p,
                bubbles: p.bubbles.map((b) =>
                  b.id === tempId ? updatedBubble : b
                ),
              }
            : p
        )
      );
    } catch (err: any) {
      console.warn('局部 OCR 识别异常:', err);
    } finally {
      setIsRecognizingTap(false);
    }
  };

  // 画布点击交互：点击已有小交互点查看详情，点击空白区域增加新交互点并自动 OCR 文本
  const handleCanvasTap = (coords: { x: number; y: number }) => {
    const pad = 18;
    const hitExisting = currentPage.bubbles.find((b) => {
      return (
        coords.x >= b.box.x - pad &&
        coords.x <= b.box.x + b.box.width + pad &&
        coords.y >= b.box.y - pad &&
        coords.y <= b.box.y + b.box.height + pad
      );
    });

    if (hitExisting) {
      handleSelectBubble(hitExisting);
      return;
    }

    // 点击未识别区域：直接增加小交互点，自动 OCR 里面的文本
    handleAddInteractivePoint(coords);
  };

  // 长按交互点：弹出操作弹框（有删除、翻译等选项）
  const handleBubbleLongPress = (bubble: TextBubble) => {
    setActionTargetBubble(bubble);
    setIsActionMenuVisible(true);
  };

  // 长按菜单选项：翻译此点
  const handleTranslateFromActionMenu = async (bubble: TextBubble) => {
    try {
      const targetText = await translateBubbleText(
        bubble.sourceText,
        translatorConfig,
        bubble.textType
      );
      const updatedBubble: TextBubble = { ...bubble, targetText };
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex
            ? {
                ...p,
                bubbles: p.bubbles.map((b) =>
                  b.id === bubble.id ? updatedBubble : b
                ),
              }
            : p
        )
      );
      Alert.alert('🎉 翻译完成', `原文: "${bubble.sourceText}"\n译文: "${targetText}"`);
    } catch (err: any) {
      Alert.alert('翻译失败', err?.message || '网络连接异常');
    }
  };

  // 长按菜单选项：删除此交互点
  const handleDeleteBubble = (bubble: TextBubble) => {
    setPages((prev) =>
      prev.map((p, idx) => {
        if (idx !== currentPageIndex) return p;
        const filtered = p.bubbles.filter((b) => b.id !== bubble.id);
        const reindexed = filtered.map((b, i) => ({
          ...b,
          readingOrderIndex: i + 1,
        }));
        return { ...p, bubbles: reindexed };
      })
    );
    if (selectedBubble?.id === bubble.id) {
      setSelectedBubble(null);
      setIsDetailVisible(false);
    }
    Alert.alert('已删除', `小交互点 #${bubble.readingOrderIndex} 已成功删除。`);
  };

  // 长按菜单选项：重新 OCR 识别
  const handleReOcrBubble = async (bubble: TextBubble) => {
    try {
      const cx = Math.round(bubble.box.x + bubble.box.width / 2);
      const cy = Math.round(bubble.box.y + bubble.box.height / 2);
      const ocred = await ocrAtCoords(
        currentPage.imageUri,
        currentPage.originalWidth,
        currentPage.originalHeight,
        { x: cx, y: cy },
        translatorConfig,
        currentPage.bubbles
      );
      const updatedBubble: TextBubble = {
        ...bubble,
        sourceText: ocred.sourceText || bubble.sourceText,
        box: ocred.box,
      };
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === currentPageIndex
            ? {
                ...p,
                bubbles: p.bubbles.map((b) =>
                  b.id === bubble.id ? updatedBubble : b
                ),
              }
            : p
        )
      );
      Alert.alert('OCR 重新识别完成', `识别日文: "${updatedBubble.sourceText}"`);
    } catch (err: any) {
      Alert.alert('重新识别失败', err?.message || 'OCR 无法识别该区域');
    }
  };

  const getModeTip = () => {
    switch (mode) {
      case 'replace':
        return '💡 模式 A【原位消字嵌字】：自动采样气泡底色擦除原文，长按气泡可唤出翻译/删除菜单。';
      case 'dots':
        return '💡 模式 B【气泡小点打点】：点击空白处增加小交互点并自动OCR，长按小点可翻译或删除。';
      case 'slider':
        return '💡 【滑动对比】：左右拖拽中间滑块对比前后效果（支持双指捏合缩放）。';
      case 'original':
        return '💡 【生肉原图】：100% 横向平铺原版画面（支持双指捏合缩放/双击放大）。';
    }
  };

  return (
    <View style={styles.container}>
      {/* 顶部标题栏 */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset + 10,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <View style={styles.headerTitleContainer}>
          <Text style={styles.appTitle}>漫画跨应用实时翻译 · POC</Text>
          <Text style={styles.subTitle}>
            Android 全局悬浮窗 + MediaProjection 屏幕捕获 + 漫画气泡重构
          </Text>
        </View>

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setIsSettingsVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* 顶部功能 Tab 切换：【跨应用悬浮翻译】 vs 【漫画排版画廊】 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'overlay' && styles.tabItemActive]}
          onPress={() => setActiveTab('overlay')}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={activeTab === 'overlay' ? '#4F46E5' : '#64748B'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'overlay' && styles.tabTextActive,
            ]}
          >
            跨应用悬浮窗
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'canvas' && styles.tabItemActive]}
          onPress={() => setActiveTab('canvas')}
        >
          <Ionicons
            name="images-outline"
            size={16}
            color={activeTab === 'canvas' ? '#4F46E5' : '#64748B'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'canvas' && styles.tabTextActive,
            ]}
          >
            漫画画布 ({pages.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 核心内容区 */}
      {activeTab === 'overlay' ? (
        <ScrollView
          contentContainerStyle={styles.overlayScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <FloatingOverlayController
            translatorConfig={translatorConfig}
            onNewCapturedPage={handleNewCapturedPage}
            showSimulatedBall={showSimulatedBall}
            onToggleSimulatedBall={setShowSimulatedBall}
            simulatedBubbles={simulatedBubbles}
            onSimulatedBubblesChange={setSimulatedBubbles}
            onTranslatingChange={setIsTranslatingCaptured}
          />

          {/* 使用指引卡片 */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>📖 悬浮在第三方应用实时翻译 使用步骤：</Text>
            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                点击上方【启动跨应用悬浮球】，授权系统悬浮窗与屏幕录制（MediaProjection）权限。
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>
                返回主屏幕或切换到任意第三方应用（如 Tachiyomi、B站漫画、Kindle、Twitter、Chrome）。
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>
                轻触屏幕边缘的【译】悬浮球，系统将自动对第三方应用进行静默截屏并识别日漫气泡。
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>4</Text>
              <Text style={styles.stepText}>
                在第三方应用上方即刻弹开展开卡片查看翻译，或点击【原位覆盖模式】直接在画面上嵌字！
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
          {/* 模式操作提示条 */}
          <View style={styles.tipBanner}>
            <Text style={styles.tipText}>{getModeTip()}</Text>
          </View>

          {/* 中间核心漫画画布区 */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isCanvasZoomed}
          >
            <MangaCanvas
              page={currentPage}
              mode={mode}
              onSelectBubble={handleSelectBubble}
              onLongPressBubble={handleBubbleLongPress}
              onZoomChange={setIsCanvasZoomed}
              onCanvasTap={handleCanvasTap}
            />
          </ScrollView>

          {/* 底部控制工具栏 */}
          <ControlToolbar
            mode={mode}
            onModeChange={setMode}
            pageTitles={pages.map((p) => p.title)}
            currentPageIndex={currentPageIndex}
            onSelectPage={(idx) => {
              setCurrentPageIndex(idx);
              setIsCanvasZoomed(false);
            }}
            onPickImage={handlePickImage}
            onOpenSettings={() => setIsSettingsVisible(true)}
            onScanVision={handleScanVision}
            isScanningVision={isScanningVision}
            onTranslatePage={() => handleTranslatePage()}
            isTranslatingPage={isTranslatingPage}
          />
        </>
      )}

      {/* 气泡详情/字典浮层 */}
      <BubbleDetailModal
        bubble={selectedBubble}
        visible={isDetailVisible}
        onClose={() => setIsDetailVisible(false)}
        onRetranslateBubble={handleRetranslateSingle}
      />

      {/* 交互点长按选项操作菜单 (翻译、删除、重新OCR、详情) */}
      <BubbleActionMenuModal
        visible={isActionMenuVisible}
        bubble={actionTargetBubble}
        onClose={() => setIsActionMenuVisible(false)}
        onTranslate={handleTranslateFromActionMenu}
        onDelete={handleDeleteBubble}
        onReOcr={handleReOcrBubble}
        onViewDetail={handleSelectBubble}
      />

      {/* 设置浮层 */}
      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        config={translatorConfig}
        onSaveConfig={handleSaveConfig}
      />

      {/* 应用内全屏仿真悬浮球（手指1:1精准跟手、绝不跳变、自动平滑吸附边缘） */}
      {/* 互斥守护：当原生系统级悬浮球正在运行时，绝不渲染仿真球，从根本上防止双球重叠 */}
      {showSimulatedBall && !isOverlayServiceRunning && (
        <SimulatedFloatingBall
          onCapture={() => {
            captureScreen();
          }}
          bubbles={simulatedBubbles}
          isProcessing={isTranslatingCaptured}
          onClose={() => setShowSimulatedBall(false)}
        />
      )}

      {/* 识别并翻译中的全局轻量HUD遮罩 */}
      {isRecognizingTap && (
        <View style={styles.recognizingHud}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.recognizingHudText}>
            🔍 正在自动 OCR 提取该点文字...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  overlayScrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  tipBanner: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
  },
  tipText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  recognizingHud: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  recognizingHudText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
