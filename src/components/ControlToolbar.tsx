import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DisplayMode } from '@/types/manga';

interface Props {
  mode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  pageTitles: string[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onPickImage: () => void;
  onOpenSettings: () => void;
  onScanVision?: () => void;
  isScanningVision?: boolean;
  onTranslatePage?: () => void;
  isTranslatingPage?: boolean;
}

export const ControlToolbar: React.FC<Props> = ({
  mode,
  onModeChange,
  pageTitles,
  currentPageIndex,
  onSelectPage,
  onPickImage,
  onOpenSettings,
  onScanVision,
  isScanningVision,
  onTranslatePage,
  isTranslatingPage,
}) => {
  const insets = useSafeAreaInsets();
  // 底部安全边距：适配 Android 虚拟按键（3键导航）、手势条及 iOS Home Indicator
  const bottomPadding = Math.max(
    insets.bottom + 10,
    Platform.OS === 'android' ? 28 : 12
  );

  const modes: { key: DisplayMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'original', label: '原图', icon: 'image-outline' },
    { key: 'replace', label: '消字嵌字', icon: 'color-wand-outline' },
    { key: 'dots', label: '小点交互', icon: 'radio-button-on-outline' },
    { key: 'slider', label: '滑动对比', icon: 'git-compare-outline' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      {/* 顶部控制栏：漫画样例与功能按钮 */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sampleScroll}
        >
          {pageTitles.map((title, idx) => {
            const active = idx === currentPageIndex;
            return (
              <TouchableOpacity
                key={title}
                onPress={() => onSelectPage(idx)}
                style={[styles.sampleChip, active && styles.sampleChipActive]}
              >
                <Text
                  style={[
                    styles.sampleChipText,
                    active && styles.sampleChipTextActive,
                  ]}
                >
                  {title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actionIcons}>
          {onTranslatePage && (
            <TouchableOpacity
              style={[
                styles.translateButton,
                isTranslatingPage && styles.translateButtonDisabled,
              ]}
              onPress={onTranslatePage}
              disabled={isTranslatingPage}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isTranslatingPage ? 'reload' : 'language-outline'}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.translateButtonText}>
                {isTranslatingPage ? '翻译中' : 'AI翻译'}
              </Text>
            </TouchableOpacity>
          )}
          {onScanVision && (
            <TouchableOpacity
              style={[styles.visionButton, isScanningVision && styles.visionButtonDisabled]}
              onPress={onScanVision}
              disabled={isScanningVision}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isScanningVision ? 'reload' : 'sparkles'}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.visionButtonText}>
                {isScanningVision ? '扫描中' : 'AI补全'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPickImage}
            hitSlop={8}
          >
            <Ionicons name="images-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onOpenSettings}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 底部核心模式切换栏 (Segmented Tabs) */}
      <View style={styles.bottomTabs}>
        {modes.map((item) => {
          const isSelected = mode === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onModeChange(item.key)}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={isSelected ? '#0284C7' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  isSelected && styles.tabButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sampleScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  sampleChipActive: {
    backgroundColor: '#0F172A',
  },
  sampleChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  sampleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    gap: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  translateButtonDisabled: {
    opacity: 0.6,
  },
  translateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  visionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EA580C',
    gap: 4,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  visionButtonDisabled: {
    opacity: 0.6,
  },
  visionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
});
