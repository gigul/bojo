import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/icons';
import { useTheme, type Theme } from '@/theme';

import { IS_WEB, VisuallyHidden } from './a11y';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function toneColors(t: Theme, tone: BadgeTone): { bg: string; fg: string } {
  const c = t.colors;
  switch (tone) {
    case 'neutral':
      return { bg: c.surfaceAlt, fg: c.text };
    case 'primary':
      return { bg: c.primary, fg: c.onPrimary };
    case 'success':
      return { bg: c.success, fg: c.textInverse };
    case 'warning':
      return { bg: c.warning, fg: c.textInverse };
    case 'danger':
      return { bg: c.danger, fg: c.textInverse };
  }
}

/** Small status pill. Every tone pair is ≥ 4.5:1 in both themes. */
export function Badge({ label, tone = 'neutral', icon, accessibilityLabel, style }: BadgeProps) {
  const theme = useTheme();
  const { bg, fg } = toneColors(theme, tone);
  return (
    <View
      style={[styles.base, { backgroundColor: bg, borderRadius: theme.radius.pill }, style]}
      // Web: no aria-label on a role-less element — the spoken text is a visually hidden node.
      accessible={!IS_WEB && Boolean(accessibilityLabel)}
      accessibilityLabel={IS_WEB ? undefined : accessibilityLabel}
    >
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text
        variant="label"
        color={fg}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        aria-hidden={IS_WEB && accessibilityLabel ? true : undefined}
      >
        {label}
      </Text>
      {accessibilityLabel ? <VisuallyHidden>{accessibilityLabel}</VisuallyHidden> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});
