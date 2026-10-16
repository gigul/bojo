// Venue attribute tags (lit / free / surface / indoor / hours). Unknown values are simply not shown —
// OSM coverage is partial (surface ~33 %, lit ~25 %), and we never invent data.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Chip, Text } from '@/components/ui';
import i18n from '@/i18n';
import { Icon, type IconName } from '@/icons';
import type { AnyT } from '@/lib/format';
import { useThemedStyles, type Theme } from '@/theme';

import { surfaceLabel } from '../model';

export interface VenueAttributes {
  surface: string | null;
  is_lit: boolean | null;
  is_free: boolean | null;
  is_indoor?: boolean | null;
  opening_hours?: string | null;
}

function attr(key: 'lit' | 'notLit' | 'free' | 'paid' | 'indoor' | 'outdoor'): string {
  return i18n.t(`venues:attributes.${key}`);
}

export interface VenueTag {
  key: string;
  label: string;
  icon: IconName;
}

/** `t` is only a memo key for the React Compiler (see lib/format AnyT). */
export function buildVenueTags(
  v: VenueAttributes,
  t: AnyT,
  opts: { full?: boolean } = {},
): VenueTag[] {
  const tags: VenueTag[] = [];
  if (v.is_lit === true) tags.push({ key: 'lit', label: attr('lit'), icon: 'moon' });
  if (v.is_lit === false && opts.full)
    tags.push({ key: 'lit', label: attr('notLit'), icon: 'moon' });
  if (v.is_free === true) tags.push({ key: 'free', label: attr('free'), icon: 'tag' });
  if (v.is_free === false) tags.push({ key: 'free', label: attr('paid'), icon: 'credit-card' });
  if (v.surface) tags.push({ key: 'surface', label: surfaceLabel(v.surface, t), icon: 'layers' });
  if (opts.full && v.is_indoor === true)
    tags.push({ key: 'indoor', label: attr('indoor'), icon: 'home' });
  if (opts.full && v.is_indoor === false)
    tags.push({ key: 'indoor', label: attr('outdoor'), icon: 'sun' });
  if (opts.full && v.opening_hours)
    tags.push({ key: 'hours', label: v.opening_hours, icon: 'clock' });
  return tags;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs + 2 },
    small: {
      minHeight: 22,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surfaceAlt,
      justifyContent: 'center',
    },
  });

/** Compact text-only tags for list rows / the preview card. */
export function SmallTags({ tags, style }: { tags: VenueTag[]; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(createStyles);
  if (tags.length === 0) return null;
  return (
    <View style={[styles.row, style]}>
      {tags.map((tag) => (
        <View key={tag.key} style={styles.small}>
          <Text variant="caption" color="textMuted" numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {tag.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Full attribute chips (venue page). */
export function AttributeChips({
  tags,
  style,
}: {
  tags: VenueTag[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  if (tags.length === 0) return null;
  return (
    <View style={[styles.row, style]}>
      {tags.map((tag) => (
        <Chip
          key={tag.key}
          label={tag.label}
          icon={({ color, size }) => <Icon name={tag.icon} size={size - 1} color={color} />}
        />
      ))}
    </View>
  );
}
