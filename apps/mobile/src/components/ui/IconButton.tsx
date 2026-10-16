import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/icons';
import {
  floatingShadow,
  resolveColor,
  useTheme,
  useThemedStyles,
  type ColorValueOrToken,
  type Theme,
} from '@/theme';

import { IS_WEB } from './a11y';

export type IconButtonVariant = 'plain' | 'surface' | 'primary';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Required: icon-only controls must be labelled. */
  accessibilityLabel: string;
  /** plain = transparent (default); surface = floating card (map overlays); primary = lime. */
  variant?: IconButtonVariant;
  /** Icon colour (default `text`, `onPrimary` for primary). */
  color?: ColorValueOrToken;
  /** Icon glyph size (default 22). The touch target is always ≥ 44 pt. */
  iconSize?: number;
  disabled?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      width: t.minTouch,
      height: t.minTouch,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    surface: {
      backgroundColor: t.colors.surface,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      ...floatingShadow(t.scheme),
    },
    primary: { backgroundColor: t.colors.primary },
    disabled: { opacity: 0.4 },
  });

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  color,
  iconSize = 22,
  disabled = false,
  selected,
  accessibilityHint,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconColor = resolveColor(theme, color ?? (variant === 'primary' ? 'onPrimary' : 'text'));
  const pressedBg = variant === 'primary' ? theme.colors.primaryPressed : theme.colors.surfaceAlt;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      // react-native-web drops accessibilityState: a toggle icon button says "pressed" in ARIA.
      {...(IS_WEB && selected !== undefined ? { 'aria-pressed': selected } : null)}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' ? styles.surface : null,
        variant === 'primary' ? styles.primary : null,
        pressed ? { backgroundColor: pressedBg } : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}
