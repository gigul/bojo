import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui';
import { Icon } from '@/icons';
import { useReduceMotion, useTheme, useThemedStyles, type Theme } from '@/theme';

export type SwipeDirection = 'left' | 'right';

export interface SwipeDeckHandle {
  /** Animates the top card off-screen (buttons / keyboard), then calls onSwiped. */
  swipe: (direction: SwipeDirection) => void;
}

export interface SwipeDeckProps<T> {
  /** Queue; items[0] is the top card. Only the first two are rendered. */
  items: readonly T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, isTop: boolean) => ReactNode;
  /** Called after the card has left the screen. The parent must drop the item from `items`. */
  onSwiped: (item: T, direction: SwipeDirection) => void;
  likeLabel: string;
  passLabel: string;
  ref?: Ref<SwipeDeckHandle>;
}

interface CardHandle {
  fling: (direction: SwipeDirection) => void;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    deck: { flex: 1 },
    card: { ...StyleSheet.absoluteFill },
    content: { flex: 1 },
    stamp: {
      position: 'absolute',
      top: t.spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: t.spacing.lg,
      minHeight: 40,
      borderRadius: t.radius.pill,
    },
    like: { left: t.spacing.lg, backgroundColor: t.colors.primary },
    pass: {
      right: t.spacing.lg,
      backgroundColor: t.colors.surface,
      borderWidth: 1.5,
      borderColor: t.colors.text,
    },
  });

/**
 * Tinder-style deck (react-native-gesture-handler + reanimated): drag left = pass, right = want to
 * play, with rotation and "Skip" / "Want to play" stamps. Also driven imperatively (buttons,
 * keyboard). With reduce-motion on, cards change instantly without rotation.
 */
export function SwipeDeck<T>({
  items,
  keyOf,
  renderItem,
  onSwiped,
  likeLabel,
  passLabel,
  ref,
}: SwipeDeckProps<T>) {
  const styles = useThemedStyles(createStyles);
  const progress = useSharedValue(0);
  const topCard = useRef<CardHandle>(null);

  useImperativeHandle(ref, () => ({ swipe: (d: SwipeDirection) => topCard.current?.fling(d) }), []);

  const visible = items.slice(0, 2);
  return (
    <View style={styles.deck}>
      {visible.map((item, index) => {
        const isTop = index === 0;
        return (
          <SwipeCard
            key={keyOf(item)}
            isTop={isTop}
            progress={progress}
            cardRef={isTop ? topCard : undefined}
            likeLabel={likeLabel}
            passLabel={passLabel}
            onDone={(direction) => {
              progress.set(0);
              onSwiped(item, direction);
            }}
          >
            {renderItem(item, isTop)}
          </SwipeCard>
        );
      })}
    </View>
  );
}

interface SwipeCardProps {
  isTop: boolean;
  /** Shared drag progress of the top card (0..1) — scales the card underneath. */
  progress: SharedValue<number>;
  cardRef?: Ref<CardHandle>;
  onDone: (direction: SwipeDirection) => void;
  likeLabel: string;
  passLabel: string;
  children: ReactNode;
}

function SwipeCard({
  isTop,
  progress,
  cardRef,
  onDone,
  likeLabel,
  passLabel,
  children,
}: SwipeCardProps) {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const width = useSharedValue(400);
  const leaving = useSharedValue(false);
  const contentRef = useRef<View>(null);

  // Web: aria-hidden alone leaves the next card's buttons in the Tab order — make it inert.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = contentRef.current as unknown as HTMLElement | null;
    if (!node) return;
    if (isTop) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [isTop]);

  const finish = (direction: SwipeDirection) => onDone(direction);

  useImperativeHandle(cardRef, () => ({
    fling: (direction: SwipeDirection) => {
      if (leaving.get()) return;
      leaving.set(true);
      if (reduceMotion) {
        finish(direction);
        return;
      }
      const sign = direction === 'right' ? 1 : -1;
      progress.set(withTiming(1, { duration: 200 }));
      ty.set(withTiming(-24, { duration: 240 }));
      tx.set(
        withTiming(sign * width.get() * 1.4, { duration: 260 }, (finished) => {
          if (finished) scheduleOnRN(finish, direction);
        }),
      );
    },
  }));

  const pan = Gesture.Pan()
    .enabled(isTop)
    .minDistance(6)
    .onUpdate((e) => {
      if (leaving.get()) return;
      const threshold = Math.min(130, width.get() * 0.3);
      tx.set(e.translationX);
      ty.set(e.translationY * 0.15);
      progress.set(Math.min(1, Math.abs(e.translationX) / threshold));
    })
    .onEnd((e) => {
      if (leaving.get()) return;
      const threshold = Math.min(130, width.get() * 0.3);
      const dx = tx.get();
      const fast = Math.abs(e.velocityX) > 900 && Math.sign(e.velocityX) === Math.sign(dx);
      if (Math.abs(dx) > threshold || fast) {
        leaving.set(true);
        const sign = dx >= 0 ? 1 : -1;
        const direction: SwipeDirection = sign > 0 ? 'right' : 'left';
        if (reduceMotion) {
          scheduleOnRN(finish, direction);
          return;
        }
        progress.set(withTiming(1, { duration: 160 }));
        tx.set(
          withTiming(sign * width.get() * 1.4, { duration: 220 }, (finished) => {
            if (finished) scheduleOnRN(finish, direction);
          }),
        );
      } else {
        tx.set(withSpring(0, { damping: 18, stiffness: 220 }));
        ty.set(withSpring(0, { damping: 18, stiffness: 220 }));
        progress.set(withTiming(0, { duration: 180 }));
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (isTop) {
      const rotate = reduceMotion
        ? 0
        : interpolate(tx.get(), [-width.get(), 0, width.get()], [-10, 0, 10], Extrapolation.CLAMP);
      return {
        transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { rotate: `${rotate}deg` }],
      };
    }
    const p = progress.get();
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [10, 0]) },
        { scale: interpolate(p, [0, 1], [0.96, 1]) },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => {
    const threshold = Math.min(130, width.get() * 0.3);
    return {
      opacity: isTop ? interpolate(tx.get(), [12, threshold], [0, 1], Extrapolation.CLAMP) : 0,
    };
  });
  const passStyle = useAnimatedStyle(() => {
    const threshold = Math.min(130, width.get() * 0.3);
    return {
      opacity: isTop ? interpolate(tx.get(), [-threshold, -12], [1, 0], Extrapolation.CLAMP) : 0,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, { zIndex: isTop ? 2 : 1 }, cardStyle]}
        onLayout={(e) => width.set(e.nativeEvent.layout.width)}
        pointerEvents={isTop ? 'auto' : 'none'}
        aria-hidden={!isTop}
        importantForAccessibility={isTop ? 'auto' : 'no-hide-descendants'}
      >
        <View ref={contentRef} style={styles.content}>
          {children}
        </View>
        <Animated.View
          style={[styles.stamp, styles.like, likeStyle]}
          pointerEvents="none"
          aria-hidden
        >
          <Icon name="check" size={18} color={theme.colors.onPrimary} />
          <Text variant="bodyStrong" color="onPrimary">
            {likeLabel}
          </Text>
        </Animated.View>
        <Animated.View
          style={[styles.stamp, styles.pass, passStyle]}
          pointerEvents="none"
          aria-hidden
        >
          <Icon name="x" size={18} color={theme.colors.text} />
          <Text variant="bodyStrong">{passLabel}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
