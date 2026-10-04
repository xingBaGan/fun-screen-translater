import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextBubble } from '@/types/manga';

interface Props {
  bubble: TextBubble | null;
  visible: boolean;
  onClose: () => void;
  onRetranslateBubble?: (bubble: TextBubble) => Promise<void>;
}

export const BubbleDetailModal: React.FC<Props> = ({
  bubble,
  visible,
  onClose,
  onRetranslateBubble,
}) => {
  const [isRetranslating, setIsRetranslating] = React.useState(false);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(
    insets.bottom + 16,
    Platform.OS === 'android' ? 32 : 24
  );

  if (!bubble) return null;

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
          {/* 顶栏信息 */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>
                  #{bubble.readingOrderIndex}
                </Text>
              </View>
              <View style={styles.directionBadge}>
                <Text style={styles.directionBadgeText}>
                  {bubble.textType === 'title'
                    ? '🏷️ 画面标题'
                    : bubble.textType === 'sfx'
                    ? '💥 拟声词'
                    : bubble.textType === 'free_text'
                    ? '📝 旁白嵌字'
                    : '💬 对白气泡'}
                </Text>
              </View>
              <View style={styles.directionBadge}>
                <Text style={styles.directionBadgeText}>
                  {bubble.direction === 'vertical' ? '竖排' : '横排'}
                </Text>
              </View>
              {bubble.confidence && (
                <Text style={styles.confidenceText}>
                  置信度 {(bubble.confidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close-circle" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* 中文译文 (高亮) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>中文翻译 (目标语言)</Text>
            <View style={styles.targetBox}>
              <Text style={styles.targetText}>{bubble.targetText}</Text>
            </View>
          </View>

          {/* 日文原文 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>日文原文 (OCR 提取)</Text>
            <View style={styles.sourceBox}>
              <Text style={styles.sourceText}>{bubble.sourceText}</Text>
            </View>
          </View>

          {/* 语境解析 / 译注 */}
          {bubble.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>生词与语境解析</Text>
              <View style={styles.notesBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#0284C7"
                  style={styles.notesIcon}
                />
                <Text style={styles.notesText}>{bubble.notes}</Text>
              </View>
            </View>
          )}

          {/* 底部操作区 */}
          <View style={styles.actionRow}>
            {onRetranslateBubble && (
              <TouchableOpacity
                style={[styles.actionButton, styles.retranslateButton]}
                disabled={isRetranslating}
                onPress={async () => {
                  if (isRetranslating) return;
                  setIsRetranslating(true);
                  try {
                    await onRetranslateBubble(bubble);
                  } finally {
                    setIsRetranslating(false);
                  }
                }}
              >
                <Ionicons
                  name={isRetranslating ? 'reload' : 'sparkles-outline'}
                  size={18}
                  color="#0284C7"
                />
                <Text style={styles.actionButtonText}>
                  {isRetranslating ? '翻译中...' : 'AI重新翻译'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                alert(`朗读原文: ${bubble.sourceText}`);
              }}
            >
              <Ionicons name="volume-high-outline" size={18} color="#0284C7" />
              <Text style={styles.actionButtonText}>朗读原文</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>完成</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  directionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  directionBadgeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  confidenceText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  targetBox: {
    backgroundColor: '#F0F9FF',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
  },
  targetText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 24,
  },
  sourceBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sourceText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 10,
  },
  notesIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    gap: 4,
  },
  retranslateButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionButtonText: {
    color: '#0284C7',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
