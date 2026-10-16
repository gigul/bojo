import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '@/theme';

import { renderIconSlot, type IconSlot } from './iconSlot';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /** `primary` = the one lime main action per screen (default). */
  variant?: ButtonVariant;
  /** md = 44 pt, lg = 52 pt. */
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconSlot;
  iconPosition?: 'left' | 'right';
  /** Stretch to the container width. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function variantColors(t: Theme, variant: ButtonVariant) {
  const c = t.colors;
  switch (variant) {
    case 'primary':
      return { bg: c.primary, pressed: c.primaryPressed, fg: c.onPrimary };
    case 'secondary':
      return { bg: c.surfaceAlt, pressed: c.border, fg: c.text };
    case 'ghost':
      return { bg: 'transparent', pressed: c.surfaceAlt, fg: c.text };
    case 'danger':
      return { bg: c.danger, pressed: c.danger, fg: c.textInverse };
  }
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.pill,
      gap: t.spacing.sm,
    },
    md: { minHeight: t.minTouch, paddingHorizontal: 20 },
    lg: { minHeight: 52, paddingHorizontal: t.spacing.xl },
    fullWidth: { alignSelf: 'stretch' },
    disabled: { opacity: 0.4 },
    content: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    hidden: { opacity: 0 },
    spinner: { position: 'absolute' },
    lgLabel: { fontSize: 16 },
  });

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const colors = variantColors(theme, variant);
  const inactive = disabled || loading;
  const iconNode = renderIconSlot(icon, colors.fg, size === 'lg' ? 20 : 18);

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        { backgroundColor: pressed ? colors.pressed : colors.bg },
        variant === 'danger' && pressed ? { opacity: 0.85 } : null,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={[styles.content, loading ? styles.hidden : null]}>
        {iconPosition === 'left' ? iconNode : null}
        <Text
          variant="bodyStrong"
          color={colors.fg}
          numberOfLines={1}
          maxFontSizeMultiplier={1.6}
          style={size === 'lg' ? styles.lgLabel : null}
        >
          {title}
        </Text>
        {iconPosition === 'right' ? iconNode : null}
      </View>
      {loading ? <ActivityIndicator color={colors.fg} style={styles.spinner} /> : null}
    </Pressable>
  );
}
