import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DisplayMode, MangaPage, TextBubble } from '@/types/manga';
import { calculateOptimalFontSize } from '@/services/bubbleEngine';

interface Props {
  page: MangaPage;
  mode: DisplayMode;
  onSelectBubble: (bubble: TextBubble) => void;
  onZoomChange?: (isZoomed: boolean) => void;
  onCanvasTap?: (coords: { x: number; y: number }) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.5;

export const MangaCanvas: React.FC<Props> = ({
  page,
  mode,
  onSelectBubble,
  onZoomChange,
  onCanvasTap,
}) => {
  // 画布容器可用宽度（默认 100% 横向平铺）
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);

  // 原始图片宽高状态
  const [imageSize, setImageSize] = useState({
    width: page.originalWidth || 600,
    height: page.originalHeight || 800,
  });

  // 对比分屏滑块位置 (0.05 ~ 0.95)
  const [sliderPos, setSliderPos] = useState(0.5);

  // 缩放与平移数值
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // 实时记录内部值以供手势无缝读取
  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  // 显示在界面控制栏的缩放比例 (100% ~ 450%)
  const [displayScale, setDisplayScale] = useState(1);

  // 标记当前是否正在拖动或缩放，防止误触发点击气泡
  const isInteracting = useRef(false);

  // 上次点击时间戳，用于双击手势
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  // 100% 横向平铺计算：
  // 宽度撑满容器 100%，高度根据图片实际高宽比自动计算展开
  const canvasWidth = containerWidth;
  const aspect =
    imageSize.width > 0 && imageSize.height > 0
      ? imageSize.height / imageSize.width
      : 4 / 3;
  const canvasHeight = Math.round(canvasWidth * aspect);

  // 气泡换算缩放系数
  const baseWidth =
    page.originalWidth && page.originalWidth > 0
      ? page.originalWidth
      : imageSize.width;
  const baseHeight =
    page.originalHeight && page.originalHeight > 0
      ? page.originalHeight
      : imageSize.height;

  const scaleX = canvasWidth / (baseWidth || 1);
  const scaleY = canvasHeight / (baseHeight || 1);

  // 计算平移合法范围约束
  const getBounds = useCallback(
    (s: number) => {
      const maxTx = Math.max(0, (canvasWidth * (s - 1)) / 2);
      const maxTy = Math.max(0, (canvasHeight * (s - 1)) / 2);
      return { maxTx, maxTy };
    },
    [canvasWidth, canvasHeight]
  );

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  // 重置缩放为 100% 默认横向平铺视图
  const resetZoom = useCallback(
    (animated = true) => {
      currentScale.current = 1.0;
      currentTranslateX.current = 0;
      currentTranslateY.current = 0;
      setDisplayScale(1.0);
      onZoomChange?.(false);

      if (animated) {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1.0,
            useNativeDriver: true,
            bounciness: 4,
          }),
          Animated.spring(translateXAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }),
        ]).start();
      } else {
        scaleAnim.setValue(1.0);
        translateXAnim.setValue(0);
        translateYAnim.setValue(0);
      }
    },
    [onZoomChange, scaleAnim, translateXAnim, translateYAnim]
  );

  // 缩放到指定倍率
  const zoomTo = useCallback(
    (targetScale: number, focusX?: number, focusY?: number) => {
      const boundedScale = clamp(targetScale, MIN_SCALE, MAX_SCALE);
      const { maxTx, maxTy } = getBounds(boundedScale);

      let targetTx = 0;
      let targetTy = 0;

      if (focusX !== undefined && focusY !== undefined && boundedScale > 1.0) {
        // 以双击点为中心偏移
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const offsetFromCenterX = centerX - focusX;
        const offsetFromCenterY = centerY - focusY;
        targetTx = clamp(offsetFromCenterX * (boundedScale - 1), -maxTx, maxTx);
        targetTy = clamp(offsetFromCenterY * (boundedScale - 1), -maxTy, maxTy);
      } else {
        targetTx = clamp(currentTranslateX.current, -maxTx, maxTx);
        targetTy = clamp(currentTranslateY.current, -maxTy, maxTy);
      }

      currentScale.current = boundedScale;
      currentTranslateX.current = targetTx;
      currentTranslateY.current = targetTy;
      setDisplayScale(boundedScale);
      onZoomChange?.(boundedScale > 1.05);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: boundedScale,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.spring(translateXAnim, {
          toValue: targetTx,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.spring(translateYAnim, {
          toValue: targetTy,
          useNativeDriver: true,
          bounciness: 4,
        }),
      ]).start();
    },
    [
      canvasWidth,
      canvasHeight,
      getBounds,
      onZoomChange,
      scaleAnim,
      translateXAnim,
      translateYAnim,
    ]
  );

  // 当切换漫画页或图片数据变更时，重新计算图片真实尺寸并重置缩放
  useEffect(() => {
    const defaultW = page.originalWidth || 600;
    const defaultH = page.originalHeight || 800;
    setImageSize({ width: defaultW, height: defaultH });

    if (page.imageUri && !page.imageUri.startsWith('data:image/svg')) {
      Image.getSize(
        page.imageUri,
        (realW, realH) => {
          if (realW > 0 && realH > 0) {
            setImageSize({ width: realW, height: realH });
          }
        },
        () => {}
      );
    }
    resetZoom(false);
  }, [page.id, page.imageUri, page.originalWidth, page.originalHeight, resetZoom]);

  // 手势中间状态缓存
  const gestureRef = useRef({
    isPinching: false,
    isPanning: false,
    startDistance: 0,
    startScale: 1,
    startCenter: { x: 0, y: 0 },
    startTx: 0,
    startTy: 0,
    lastTouch: { x: 0, y: 0 },
  });

  const getDistance = (t1: any, t2: any) =>
    Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);

  const getCenter = (t1: any, t2: any) => ({
    x: (t1.pageX + t2.pageX) / 2,
    y: (t1.pageY + t2.pageY) / 2,
  });

  // 主画布手势控制器（双指 Pinch 捏合缩放 + 放大下单指拖动画布平移）
  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // 双指触摸直接捕获
        return evt.nativeEvent.touches.length >= 2;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // 双指捏合手势
        if (evt.nativeEvent.touches.length >= 2) {
          return true;
        }
        // 当处于放大状态时，单指移动大于微小阈值时接管平移
        if (
          currentScale.current > 1.05 &&
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3)
        ) {
          return true;
        }
        return false;
      },
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          // 双指捏合开始
          gestureRef.current.isPinching = true;
          gestureRef.current.isPanning = false;
          gestureRef.current.startDistance = getDistance(touches[0], touches[1]);
          gestureRef.current.startScale = currentScale.current;
          gestureRef.current.startCenter = getCenter(touches[0], touches[1]);
          gestureRef.current.startTx = currentTranslateX.current;
          gestureRef.current.startTy = currentTranslateY.current;
          isInteracting.current = true;
          onZoomChange?.(true);
        } else if (touches.length === 1 && currentScale.current > 1.05) {
          // 放大状态下单指拖动开始
          gestureRef.current.isPinching = false;
          gestureRef.current.isPanning = true;
          gestureRef.current.lastTouch = {
            x: touches[0].pageX,
            y: touches[0].pageY,
          };
          isInteracting.current = true;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          // 双指捏合计算
          const dist = getDistance(touches[0], touches[1]);
          if (gestureRef.current.startDistance > 0) {
            const factor = dist / gestureRef.current.startDistance;
            const targetScale = clamp(
              gestureRef.current.startScale * factor,
              MIN_SCALE * 0.9,
              MAX_SCALE
            );

            const center = getCenter(touches[0], touches[1]);
            const centerDx = center.x - gestureRef.current.startCenter.x;
            const centerDy = center.y - gestureRef.current.startCenter.y;

            const { maxTx, maxTy } = getBounds(targetScale);
            const targetTx = clamp(
              gestureRef.current.startTx + centerDx,
              -maxTx,
              maxTx
            );
            const targetTy = clamp(
              gestureRef.current.startTy + centerDy,
              -maxTy,
              maxTy
            );

            currentScale.current = targetScale;
            currentTranslateX.current = targetTx;
            currentTranslateY.current = targetTy;

            scaleAnim.setValue(targetScale);
            translateXAnim.setValue(targetTx);
            translateYAnim.setValue(targetTy);
          }
        } else if (touches.length === 1 && currentScale.current > 1.05) {
          // 单指平移
          const dx = touches[0].pageX - gestureRef.current.lastTouch.x;
          const dy = touches[0].pageY - gestureRef.current.lastTouch.y;
          gestureRef.current.lastTouch = {
            x: touches[0].pageX,
            y: touches[0].pageY,
          };

          const { maxTx, maxTy } = getBounds(currentScale.current);
          const nextTx = clamp(currentTranslateX.current + dx, -maxTx, maxTx);
          const nextTy = clamp(currentTranslateY.current + dy, -maxTy, maxTy);

          currentTranslateX.current = nextTx;
          currentTranslateY.current = nextTy;

          translateXAnim.setValue(nextTx);
          translateYAnim.setValue(nextTy);
        }
      },
      onPanResponderRelease: () => {
        gestureRef.current.isPinching = false;
        gestureRef.current.isPanning = false;

        setTimeout(() => {
          isInteracting.current = false;
        }, 80);

        // 如果小于 1.05 则回弹至 100% 原始比例
        if (currentScale.current < 1.05) {
          resetZoom(true);
          return;
        }

        // 平移边界保护回弹
        const { maxTx, maxTy } = getBounds(currentScale.current);
        const clampedTx = clamp(currentTranslateX.current, -maxTx, maxTx);
        const clampedTy = clamp(currentTranslateY.current, -maxTy, maxTy);

        if (
          clampedTx !== currentTranslateX.current ||
          clampedTy !== currentTranslateY.current
        ) {
          Animated.parallel([
            Animated.spring(translateXAnim, {
              toValue: clampedTx,
              useNativeDriver: true,
              bounciness: 4,
            }),
            Animated.spring(translateYAnim, {
              toValue: clampedTy,
              useNativeDriver: true,
              bounciness: 4,
            }),
          ]).start();
          currentTranslateX.current = clampedTx;
          currentTranslateY.current = clampedTy;
        }

        setDisplayScale(currentScale.current);
        onZoomChange?.(currentScale.current > 1.05);
      },
      onPanResponderTerminate: () => {
        gestureRef.current.isPinching = false;
        gestureRef.current.isPanning = false;
        setTimeout(() => {
          isInteracting.current = false;
        }, 80);
        if (currentScale.current < 1.05) {
          resetZoom(true);
        }
      },
    })
  ).current;

  // 滑动对比把手专用 PanResponder
  const startSliderPosRef = useRef(0.5);
  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => mode === 'slider',
      onMoveShouldSetPanResponder: () => mode === 'slider',
      onPanResponderGrant: () => {
        startSliderPosRef.current = sliderPos;
        isInteracting.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        const effectiveWidth = canvasWidth * currentScale.current;
        const deltaRatio = gestureState.dx / effectiveWidth;
        const nextPos = clamp(startSliderPosRef.current + deltaRatio, 0.05, 0.95);
        setSliderPos(nextPos);
      },
      onPanResponderRelease: () => {
        setTimeout(() => {
          isInteracting.current = false;
        }, 80);
      },
      onPanResponderTerminate: () => {
        setTimeout(() => {
          isInteracting.current = false;
        }, 80);
      },
    })
  ).current;

  // 双击手势：未放大时双击放大至 2.2x，放大状态下双击还原回 100%
  const handleTouchEnd = (evt: any) => {
    if (isInteracting.current) return;
    const now = Date.now();
    const { locationX, locationY } = evt.nativeEvent;
    if (now - lastTapRef.current.time < 300) {
      if (currentScale.current > 1.15) {
        resetZoom(true);
      } else {
        zoomTo(2.2, locationX, locationY);
      }
      lastTapRef.current.time = 0;
    } else {
      lastTapRef.current = { time: now, x: locationX, y: locationY };
    }
  };

  const handleBubblePress = (bubble: TextBubble) => {
    if (isInteracting.current) return;
    onSelectBubble(bubble);
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const layoutWidth = e.nativeEvent.layout.width;
        if (layoutWidth > 0 && Math.abs(layoutWidth - containerWidth) > 1) {
          setContainerWidth(layoutWidth);
        }
      }}
    >
      {/* 漫画视口（默认 100% 横向平铺撑满，无左右黑边） */}
      <View
        style={[
          styles.viewport,
          { width: canvasWidth, height: canvasHeight },
        ]}
        {...zoomPanResponder.panHandlers}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View
          style={[
            styles.canvasContent,
            {
              width: canvasWidth,
              height: canvasHeight,
              transform: [
                { translateX: translateXAnim },
                { translateY: translateYAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* 底层原图：100% 比例横向平铺覆盖，支持点击未识别区域手动补全 */}
          <TouchableOpacity
            activeOpacity={1}
            disabled={!onCanvasTap}
            onPress={(e) => {
              if (isInteracting.current) return;
              const { locationX, locationY } = e.nativeEvent;
              const imgX = Math.round(locationX / scaleX);
              const imgY = Math.round(locationY / scaleY);
              onCanvasTap?.({ x: imgX, y: imgY });
            }}
          >
            <Image
              source={{ uri: page.imageUri }}
              style={{ width: canvasWidth, height: canvasHeight }}
              resizeMode="cover"
              onLoad={(e) => {
                const { width: loadedW, height: loadedH } = e.nativeEvent.source;
                if (
                  loadedW > 0 &&
                  loadedH > 0 &&
                  (!page.originalWidth || page.originalWidth === 600)
                ) {
                  setImageSize({ width: loadedW, height: loadedH });
                }
              }}
            />
          </TouchableOpacity>

          {/* 模式 A & 对比模式：原地消字与嵌字 (Replace Mode / Slider Mode) */}
          {(mode === 'replace' || mode === 'slider') && (
            <View
              style={[
                StyleSheet.absoluteFill,
                mode === 'slider' && {
                  width: canvasWidth * sliderPos,
                  overflow: 'hidden',
                  borderRightWidth: 2,
                  borderRightColor: '#0284C7',
                },
              ]}
            >
              {page.bubbles.map((bubble) => {
                const left = bubble.box.x * scaleX;
                const top = bubble.box.y * scaleY;
                const width = bubble.box.width * scaleX;
                const height = bubble.box.height * scaleY;
                const isVertical = bubble.direction === 'vertical';

                const { fontSize, lineHeight } = calculateOptimalFontSize(
                  bubble.targetText,
                  bubble.box,
                  scaleX,
                  isVertical,
                  bubble.textType || 'bubble'
                );

                const isTitle = bubble.textType === 'title';
                const isSfx = bubble.textType === 'sfx';
                const isFreeText = bubble.textType === 'free_text';

                return (
                  <TouchableOpacity
                    key={bubble.id}
                    activeOpacity={0.8}
                    onPress={() => handleBubblePress(bubble)}
                    style={[
                      styles.replaceBubblePatch,
                      {
                        left,
                        top,
                        width,
                        height,
                        backgroundColor: bubble.detectedBgColor || '#FFFFFF',
                      },
                      isTitle && styles.titlePatch,
                      isSfx && styles.sfxPatch,
                      isFreeText && styles.freeTextPatch,
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
                        isTitle && styles.titleText,
                        isSfx && styles.sfxText,
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
          {mode === 'dots' && (() => {
            // 质点位置计算与重叠防遮挡微调 (Centroid positioning with anti-overlap)
            const placedDots: { x: number; y: number }[] = [];

            return (
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {page.bubbles.map((bubble) => {
                  // 计算文本框几何质点 (Centroid)
                  let cx = (bubble.box.x + bubble.box.width / 2) * scaleX;
                  let cy = (bubble.box.y + bubble.box.height / 2) * scaleY;

                  // 若质点与已有小标距离过近 (< 22px)，微调偏移以防完全叠死
                  for (const p of placedDots) {
                    const dist = Math.hypot(cx - p.x, cy - p.y);
                    if (dist < 22) {
                      cx += 14;
                      cy += 14;
                    }
                  }
                  placedDots.push({ x: cx, y: cy });

                  const left = cx - 13;
                  const top = cy - 13;

                  const isTitle = bubble.textType === 'title';
                  const isSfx = bubble.textType === 'sfx';
                  const isFreeText = bubble.textType === 'free_text';

                  return (
                    <TouchableOpacity
                      key={bubble.id}
                      activeOpacity={0.7}
                      onPress={() => handleBubblePress(bubble)}
                      style={[
                        styles.dotBadge,
                        { left, top },
                        isTitle && styles.titleDotBadge,
                        isSfx && styles.sfxDotBadge,
                        isFreeText && styles.freeTextDotBadge,
                      ]}
                    >
                      <View
                        style={[
                          styles.dotPulseRing,
                          isTitle && styles.titlePulseRing,
                          isSfx && styles.sfxPulseRing,
                          isFreeText && styles.freeTextPulseRing,
                        ]}
                      />
                      <Text style={styles.dotBadgeText}>
                        {bubble.readingOrderIndex}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}

          {/* 分屏滑块把手 (Slider Mode) */}
          {mode === 'slider' && (
            <View
              {...sliderPanResponder.panHandlers}
              style={[
                styles.sliderHandle,
                {
                  left: canvasWidth * sliderPos - 16,
                  height: canvasHeight,
                },
              ]}
            >
              <View style={styles.sliderKnob}>
                <Text style={styles.sliderKnobText}>◀ ▶</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </View>

      {/* 右上角缩放浮动指示器 & 控制胶囊 */}
      {displayScale > 1.05 ? (
        <View style={styles.zoomControlCapsule}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => zoomTo(Math.max(MIN_SCALE, currentScale.current - 0.5))}
            hitSlop={6}
          >
            <Ionicons name="remove" size={15} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomPillCenter}
            onPress={() => resetZoom(true)}
            hitSlop={6}
          >
            <Text style={styles.zoomPercentText}>
              {Math.round(displayScale * 100)}%
            </Text>
            <Text style={styles.zoomResetHint}>复位100%</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => zoomTo(Math.min(MAX_SCALE, currentScale.current + 0.5))}
            hitSlop={6}
          >
            <Ionicons name="add" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.zoomGuideBadge}>
          <Ionicons name="finger-print-outline" size={12} color="#64748B" />
          <Text style={styles.zoomGuideText}>双指捏合缩放 · 双击放大</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // 漫画视口：默认 100% 横向平铺充满，超出部分在视口内裁剪，避免遮挡上下工具条
  viewport: {
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  canvasContent: {
    position: 'relative',
  },
  // 模式 A 样式：消除原字并贴上译文
  replaceBubblePatch: {
    position: 'absolute',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 23, 42, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  replaceBubbleText: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  titlePatch: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(234, 88, 12, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  titleText: {
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sfxPatch: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderStyle: 'dashed',
  },
  sfxText: {
    fontWeight: '800',
    fontStyle: 'italic',
  },
  freeTextPatch: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  // 模式 B 样式：气泡角标小点
  dotBadge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
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
  titleDotBadge: {
    backgroundColor: '#EA580C',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  sfxDotBadge: {
    backgroundColor: '#DC2626',
    borderStyle: 'dashed',
  },
  freeTextDotBadge: {
    backgroundColor: '#7C3AED',
  },
  dotPulseRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.6)',
  },
  titlePulseRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderColor: 'rgba(234, 88, 12, 0.7)',
  },
  sfxPulseRing: {
    borderColor: 'rgba(220, 38, 38, 0.7)',
  },
  freeTextPulseRing: {
    borderColor: 'rgba(124, 58, 237, 0.7)',
  },
  dotBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // 滑块把手
  sliderHandle: {
    position: 'absolute',
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sliderKnob: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
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
  // 缩放控制浮动胶囊 (放大状态)
  zoomControlCapsule: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 30,
  },
  zoomBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPillCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  zoomPercentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  zoomResetHint: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: -1,
  },
  // 默认比例提示小标 (100% 状态)
  zoomGuideBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 20,
  },
  zoomGuideText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
});
