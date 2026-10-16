import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { Text } from './Text';

export interface AvatarStackPerson {
  id?: string;
  name: string;
  path?: string | null;
}

export interface AvatarStackProps {
  people: readonly AvatarStackPerson[];
  /** Total count when more people exist than are passed. Default `people.length`. */
  total?: number;
  /** Max avatars before "+N" (default 4, DESIGN.md). */
  max?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Overlapping avatars of people going: up to `max` + "+N". One spoken label for the group. */
export function AvatarStack({ people, total, max = 4, size = 28, style }: AvatarStackProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const count = Math.max(total ?? people.length, people.length);
  const shown = people.slice(0, max);
  const extra = count - shown.length;
  const overlap = Math.round(size * 0.3);

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('people.a11y', { count })}
    >
      {shown.map((p, i) => (
        <Avatar
          key={p.id ?? `${p.name}-${i}`}
          name={p.name}
          path={p.path}
          size={size}
          ring
          style={i > 0 ? { marginLeft: -overlap } : null}
        />
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              height: size,
              minWidth: size,
              borderRadius: size / 2,
              marginLeft: shown.length > 0 ? -overlap : 0,
              backgroundColor: theme.colors.surfaceAlt,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          <Text variant="caption" color="textMuted" maxFontSizeMultiplier={1.3}>
            {t('people.more', { count: extra })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  more: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 2 },
});
