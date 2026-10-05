import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OverlayBubbleItem } from 'screen-translator-overlay';

interface SimulatedFloatingBallProps {
  onCapture: () => void;
  bubbles: OverlayBubbleItem[];
  isProcessing?: boolean;
  onClose?: () => void;
}

export function SimulatedFloatingBall({
  onCapture,
  bubbles,
  isProcessing = false,
  onClose,
}: SimulatedFloatingBallProps) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  const ballSize = 52;
  const minTop = insets.top + 10;
  const maxBottom = SCREEN_HEIGHT - insets.bottom - ballSize - 20;

  // 悬浮球绝对坐标（初始置于屏幕右侧中部）
  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - ballSize - 12,
      y: SCREEN_HEIGHT * 0.35,
    })
  ).current;

  const isDraggingRef = useRef(false);
  const [cardVisible, setCardVisible] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 轻微抖动容差过滤
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
        // 关键核心：将当前动画位置提取至 offset，并将当前 value 归零
        // 这样在移动时 dx/dy 才能与原本位置无缝衔接，绝不发生瞬间跳变或手指脱节
        pan.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDraggingRef.current = true;
        }
        pan.setValue({
          x: gestureState.dx,
          y: gestureState.dy,
        });
      },
      onPanResponderRelease: (_, gestureState) => {
        // 释放手势时合并 offset，锁定当前落点
        pan.flattenOffset();

        if (!isDraggingRef.current) {
          // 点击事件：触发截屏翻译并弹出结果卡片
          onCapture();
          setCardVisible(true);
        } else {
          // 拖拽松开：自动平滑吸附到离手指最近的屏幕边缘（左边缘或右边缘）
          const currentX = (pan.x as any)._value ?? (SCREEN_WIDTH - ballSize - 12);
          const currentY = (pan.y as any)._value ?? (SCREEN_HEIGHT * 0.35);

          const targetX =
            currentX + ballSize / 2 < SCREEN_WIDTH / 2
              ? 12
              : SCREEN_WIDTH - ballSize - 12;

          // 限制 Y 轴不要滑出状态栏或底部导航栏
          const clampedY = Math.max(minTop, Math.min(maxBottom, currentY));

          Animated.spring(pan, {
            toValue: { x: targetX, y: clampedY },
            friction: 7,
            tension: 40,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 仿真悬浮球 View */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.ball,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
      >
        <Text style={styles.ballText}>{isProcessing ? '⏳' : '译'}</Text>
      </Animated.View>

      {/* 仿真翻译浮卡 */}
      {cardVisible && (
        <View style={[styles.cardContainer, { top: insets.top + 80 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="sparkles" size={16} color="#38BDF8" />
              <Text style={styles.cardTitle}>屏幕漫画实时翻译卡片</Text>
            </View>
            <TouchableOpacity
              onPress={() => setCardVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
            {bubbles && bubbles.length > 0 ? (
              bubbles.map((b, idx) => (
                <View key={b.id || idx} style={styles.bubbleItem}>
                  <Text style={styles.itemSource}>
                    [{idx + 1}] 原文: {b.sourceText}
                  </Text>
                  <Text style={styles.itemTarget}>译文: {b.targetText}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  轻触屏幕悬浮球即可抓取当前画面并实时翻译！
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.cardFooter}>
            {onClose ? (
              <TouchableOpacity
                style={styles.btnCloseBall}
                onPress={onClose}
              >
                <Ionicons name="eye-off-outline" size={14} color="#94A3B8" />
                <Text style={styles.btnCloseBallText}>关闭仿真球</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity
              style={styles.btnRetake}
              onPress={() => {
                onCapture();
              }}
            >
              <Ionicons name="camera-outline" size={14} color="#38BDF8" />
              <Text style={styles.btnRetakeText}>重新抓取</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 9999,
  },
  ballText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxHeight: 380,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 9998,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cardScroll: {
    maxHeight: 240,
  },
  bubbleItem: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemSource: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  itemTarget: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  btnCloseBall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  btnCloseBallText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  btnRetake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  btnRetakeText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
});
