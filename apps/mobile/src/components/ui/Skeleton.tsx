import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion, useTheme } from '@/theme';

export interface SkeletonProps {
  width: DimensionValue;
  height: DimensionValue;
  /** Default theme `radius.sm`. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Loading placeholder with a gentle pulse (static when reduce motion is on). Hidden from screen readers. */
export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      aria-hidden
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}
