import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading slot (Avatar, Icon, SportIcon…). */
  left?: ReactNode;
  /** Trailing slot. Pressable rows without `right` get a chevron; pass `null` to hide it. */
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.sm + 2,
      paddingHorizontal: t.spacing.lg,
    },
    text: { flex: 1, gap: 2 },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    disabled: { opacity: 0.4 },
  });

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ListItemProps) {
  const styles = useThemedStyles(createStyles);
  const trailing =
    right !== undefined ? (
      right
    ) : onPress ? (
      <Icon name="chevron-right" size={20} color="textMuted" />
    ) : null;
  const content = (
    <>
      {left}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, style]}
        accessible
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
