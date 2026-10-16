import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IS_WEB, Text, VisuallyHidden } from '@/components/ui';
import { useTheme, type ColorValueOrToken } from '@/theme';

import { levelLabel } from '../format';

export interface LevelDotsProps {
  level: number | null;
  /** Show the text label next to the dots (default true). */
  showLabel?: boolean;
  color?: ColorValueOrToken;
  style?: StyleProp<ViewStyle>;
}

/** Level as text + 5 dots (meaning is never carried by colour alone, DESIGN.md). */
export function LevelDots({ level, showLabel = true, color = 'textMuted', style }: LevelDotsProps) {
  const theme = useTheme();
  const { t } = useTranslation('events');
  const label = levelLabel(level, t);
  return (
    // Native: one element with the level as its label. Web: the visible text (or a visually hidden
    // one) is read — no aria-label on a role-less element.
    <View
      style={[styles.row, style]}
      accessible={!IS_WEB}
      accessibilityLabel={IS_WEB ? undefined : label}
    >
      {level != null ? (
        <View style={styles.dots} aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i <= level ? theme.colors.text : theme.colors.border },
              ]}
            />
          ))}
        </View>
      ) : null}
      {showLabel ? (
        <Text variant="label" color={color} numberOfLines={1}>
          {label}
        </Text>
      ) : (
        <VisuallyHidden>{label}</VisuallyHidden>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
