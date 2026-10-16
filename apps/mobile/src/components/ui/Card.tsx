import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion, useThemedStyles, type Theme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  /** Makes the whole card one button — give it a summary `accessibilityLabel` (DESIGN.md). */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Inner padding 16 (default true). Set false for full-bleed photos. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    padded: { padding: t.spacing.lg },
    pressed: { opacity: 0.92 },
    pressedScale: { transform: [{ scale: 0.985 }] },
  });

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  style,
  testID,
}: CardProps) {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReduceMotion();

  if (!onPress) {
    return (
      <View
        style={[styles.base, padded ? styles.padded : null, style]}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        padded ? styles.padded : null,
        pressed ? styles.pressed : null,
        pressed && !reduceMotion ? styles.pressedScale : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
