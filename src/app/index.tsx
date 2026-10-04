import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SAMPLE_MANGA_PAGES } from '@/data/sampleManga';
import { DisplayMode, MangaPage, TextBubble, TranslatorConfig } from '@/types/manga';
import { MangaCanvas } from '@/components/MangaCanvas';
import { ControlToolbar } from '@/components/ControlToolbar';
import { BubbleDetailModal } from '@/components/BubbleDetailModal';
import { SettingsModal } from '@/components/SettingsModal';
import { FloatingOverlayController } from '@/components/FloatingOverlayController';

export default function MangaTranslatorScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0
  );

  const [pages, setPages] = useState<MangaPage[]>(SAMPLE_MANGA_PAGES);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [mode, setMode] = useState<DisplayMode>('replace');
  const [selectedBubble, setSelectedBubble] = useState<TextBubble | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'overlay'>('overlay');

  const [translatorConfig, setTranslatorConfig] = useState<TranslatorConfig>({
    provider: 'mock',
    apiKey: '',
    apiEndpoint: '',
    model: 'deepseek-chat',
  });

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
        const customPage: MangaPage = {
          id: `custom_${Date.now()}`,
          title: '自定义相册导入',
          imageUri: asset.uri,
          originalWidth: asset.width || 600,
          originalHeight: asset.height || 800,
          bubbles: [
            {
              id: 'c_b1',
              box: { x: 50, y: 80, width: 220, height: 140 },
              direction: 'horizontal',
              readingOrderIndex: 1,
              sourceText: '新导入漫画样本',
              targetText: '新导入漫画自动识别与嵌字测试',
              detectedBgColor: '#FFFFFF',
              detectedTextColor: '#0F172A',
              notes: '从本地相册导入的漫画图片，演示打点与原位消字效果。',
            },
          ],
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

  const getModeTip = () => {
    switch (mode) {
      case 'replace':
        return '💡 模式 A【原位消字嵌字】：自动采样气泡底色擦除原文，动态计算字号填入译文。';
      case 'dots':
        return '💡 模式 B【气泡小点打点】：不破坏原图，在气泡右上角生成小标，点击就近弹窗。';
      case 'slider':
        return '💡 【滑动对比】：左右拖拽中间滑块，实时查看生肉原图与汉化嵌字前后对比。';
      case 'original':
        return '💡 【生肉原图】：显示未处理的原版漫画画面。';
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
          >
            <MangaCanvas
              page={currentPage}
              mode={mode}
              onSelectBubble={handleSelectBubble}
            />
          </ScrollView>

          {/* 底部控制工具栏 */}
          <ControlToolbar
            mode={mode}
            onModeChange={setMode}
            pageTitles={pages.map((p) => p.title)}
            currentPageIndex={currentPageIndex}
            onSelectPage={setCurrentPageIndex}
            onPickImage={handlePickImage}
            onOpenSettings={() => setIsSettingsVisible(true)}
          />
        </>
      )}

      {/* 气泡详情/字典浮层 */}
      <BubbleDetailModal
        bubble={selectedBubble}
        visible={isDetailVisible}
        onClose={() => setIsDetailVisible(false)}
      />

      {/* 设置浮层 */}
      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        config={translatorConfig}
        onSaveConfig={setTranslatorConfig}
      />
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
    alignItems: 'center',
    paddingBottom: 16,
  },
});
