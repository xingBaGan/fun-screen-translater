import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { DisplayMode, MangaPage, TextBubble } from '@/types/manga';
import { calculateOptimalFontSize } from '@/services/bubbleEngine';

interface Props {
  page: MangaPage;
  mode: DisplayMode;
  onSelectBubble: (bubble: TextBubble) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = Math.min(SCREEN_WIDTH - 24, 520);
const CANVAS_HEIGHT = (CANVAS_WIDTH / 600) * 800; // 保持 600:800 比例
const SCALE = CANVAS_WIDTH / 600;

export const MangaCanvas: React.FC<Props> = ({
  page,
  mode,
  onSelectBubble,
}) => {
  // 对比分屏滑块位置 (0.0 ~ 1.0)
  const [sliderPos, setSliderPos] = useState(0.5);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => mode === 'slider',
    onMoveShouldSetPanResponder: () => mode === 'slider',
    onPanResponderMove: (_, gestureState) => {
      const newPos = Math.max(0.05, Math.min(0.95, gestureState.moveX / CANVAS_WIDTH));
      setSliderPos(newPos);
    },
  });

  return (
    <View style={styles.container}>
      <View style={[styles.canvasBox, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }]}>
        {/* 底层原图 */}
        <Image
          source={{ uri: page.imageUri }}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          resizeMode="contain"
        />

        {/* 模式 A：原地消字与嵌字 (Replace Mode) */}
        {(mode === 'replace' || mode === 'slider') && (
          <View
            style={[
              StyleSheet.absoluteFill,
              mode === 'slider' && {
                width: CANVAS_WIDTH * sliderPos,
                overflow: 'hidden',
                borderRightWidth: 2,
                borderRightColor: '#0284C7',
              },
            ]}
          >
            {page.bubbles.map((bubble) => {
              const left = bubble.box.x * SCALE;
              const top = bubble.box.y * SCALE;
              const width = bubble.box.width * SCALE;
              const height = bubble.box.height * SCALE;
              const isVertical = bubble.direction === 'vertical';

              const { fontSize, lineHeight } = calculateOptimalFontSize(
                bubble.targetText,
                bubble.box,
                SCALE,
                isVertical
              );

              return (
                <TouchableOpacity
                  key={bubble.id}
                  activeOpacity={0.8}
                  onPress={() => onSelectBubble(bubble)}
                  style={[
                    styles.replaceBubblePatch,
                    {
                      left,
                      top,
                      width,
                      height,
                      backgroundColor: bubble.detectedBgColor || '#FFFFFF',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.replaceBubbleText,
                      {
                        fontSize,
                        lineHeight,
                        color: bubble.detectedTextColor || '#0F172A',
                      },
                    ]}
                  >
                    {bubble.targetText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 模式 B：气泡小点打点交互 (Dots Mode) */}
        {mode === 'dots' && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {page.bubbles.map((bubble) => {
              // 将小点锚定在气泡右上角
              const left = (bubble.box.x + bubble.box.width) * SCALE - 22;
              const top = bubble.box.y * SCALE - 4;

              return (
                <TouchableOpacity
                  key={bubble.id}
                  activeOpacity={0.7}
                  onPress={() => onSelectBubble(bubble)}
                  style={[styles.dotBadge, { left, top }]}
                >
                  <View style={styles.dotPulseRing} />
                  <Text style={styles.dotBadgeText}>
                    {bubble.readingOrderIndex}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 分屏滑块把手 (Slider Mode) */}
        {mode === 'slider' && (
          <View
            {...panResponder.panHandlers}
            style={[
              styles.sliderHandle,
              { left: CANVAS_WIDTH * sliderPos - 16, height: CANVAS_HEIGHT },
            ]}
          >
            <View style={styles.sliderKnob}>
              <Text style={styles.sliderKnobText}>◀ ▶</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  canvasBox: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  // 模式 A 样式：消除原字并贴上译文
  replaceBubblePatch: {
    position: 'absolute',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 23, 42, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  replaceBubbleText: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  // 模式 B 样式：气泡角标小点
  dotBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  dotPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.6)',
  },
  dotBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // 滑块把手
  sliderHandle: {
    position: 'absolute',
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderKnob: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sliderKnobText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
