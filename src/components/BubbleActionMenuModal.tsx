import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextBubble } from '@/types/manga';

interface Props {
  visible: boolean;
  bubble: TextBubble | null;
  onClose: () => void;
  onTranslate: (bubble: TextBubble) => Promise<void> | void;
  onDelete: (bubble: TextBubble) => void;
  onReOcr?: (bubble: TextBubble) => Promise<void> | void;
  onViewDetail?: (bubble: TextBubble) => void;
}

export const BubbleActionMenuModal: React.FC<Props> = ({
  visible,
  bubble,
  onClose,
  onTranslate,
  onDelete,
  onReOcr,
  onViewDetail,
}) => {
  const insets = useSafeAreaInsets();
  const [isTranslating, setIsTranslating] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  const bottomPadding = Math.max(
    insets.bottom + 16,
    Platform.OS === 'android' ? 32 : 24
  );

  if (!bubble) return null;

  const isTranslated = !!bubble.targetText?.trim();

  const handleTranslatePress = async () => {
    setIsTranslating(true);
    try {
      await onTranslate(bubble);
      onClose();
    } finally {
      setIsTranslating(false);
    }
  };

  const handleReOcrPress = async () => {
    if (!onReOcr) return;
    setIsOcrProcessing(true);
    try {
      await onReOcr(bubble);
      onClose();
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleDeletePress = () => {
    onDelete(bubble);
    onClose();
  };

  const handleDetailPress = () => {
    onClose();
    onViewDetail?.(bubble);
  };

  const getTypeLabel = () => {
    switch (bubble.textType) {
      case 'title':
        return '🏷️ 画面艺术标题';
      case 'sfx':
        return '⚡ 漫画拟声词';
      case 'free_text':
        return '📝 画面旁白/独白';
      default:
        return '💬 角色对白气泡';
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { paddingBottom: bottomPadding }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* 顶部标题栏 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.orderBadge, !isTranslated && styles.untranslatedBadge]}>
                <Text style={styles.orderBadgeText}>#{bubble.readingOrderIndex}</Text>
              </View>
              <View>
                <Text style={styles.title}>小交互点操作选项</Text>
                <Text style={styles.subtitle}>{getTypeLabel()}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 文本预览卡片 */}
          <View style={styles.previewBox}>
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>🇯🇵 OCR 识别日文：</Text>
              <Text style={styles.previewSourceText} numberOfLines={3}>
                {bubble.sourceText || '(未识别到文字)'}
              </Text>
            </View>

            <View style={styles.previewDivider} />

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>🇨🇳 汉化译文：</Text>
              {isTranslated ? (
                <Text style={styles.previewTargetText} numberOfLines={3}>
                  {bubble.targetText}
                </Text>
              ) : (
                <Text style={styles.previewEmptyTarget}>
                  （尚未翻译，点击下方【AI 翻译】即可生成）
                </Text>
              )}
            </View>
          </View>

          {/* 核心操作按钮列表 */}
          <View style={styles.actionsContainer}>
            {/* 1. 翻译选项 */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={handleTranslatePress}
              disabled={isTranslating}
              activeOpacity={0.8}
            >
              {isTranslating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {isTranslated ? '🌐 AI 重新翻译此点' : '🌐 AI 翻译此点'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 2. 重新 OCR 选项 */}
            {onReOcr && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={handleReOcrPress}
                disabled={isOcrProcessing}
                activeOpacity={0.8}
              >
                {isOcrProcessing ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={18} color="#4F46E5" />
                    <Text style={styles.secondaryBtnText}>🔍 重新 OCR 识别</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* 3. 查看详情/编辑 */}
            {onViewDetail && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={handleDetailPress}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={18} color="#475569" />
                <Text style={styles.neutralBtnText}>📋 查看详细字典与编辑</Text>
              </TouchableOpacity>
            )}

            {/* 4. 删除选项 */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.dangerBtn]}
              onPress={handleDeletePress}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.dangerBtnText}>🗑️ 删除此小交互点</Text>
            </TouchableOpacity>

            {/* 5. 取消 */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  untranslatedBadge: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 18,
  },
  previewSection: {
    gap: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  previewSourceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 21,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  previewTargetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5',
    lineHeight: 21,
  },
  previewEmptyTarget: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  actionsContainer: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secondaryBtnText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  neutralBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
