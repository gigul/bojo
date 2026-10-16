// One venue in the Map sheet list: pictogram, title, kind · distance, attribute tags, events badge.
import type { VenueMapRow } from '@bojo/shared';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, selectionA11y, Text } from '@/components/ui';
import { SportIcon } from '@/icons';
import { venueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import { eventsCountLabel, sportLabel, venuePictogram } from '../model';
import { buildVenueTags, SmallTags } from './VenueTags';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      minHeight: 64,
    },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    selected: { backgroundColor: t.colors.surfaceAlt },
    disc: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
    },
    discSelected: { backgroundColor: t.colors.surface },
    text: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    title: { flex: 1 },
    tags: { marginTop: t.spacing.xs },
  });

export interface VenueRowProps {
  venue: VenueMapRow;
  /** "350 м" from the user (only when their location is known). */
  distance: string | null;
  selected: boolean;
  onPress: (id: string) => void;
}

export const VenueRow = memo(function VenueRow({
  venue,
  distance,
  selected,
  onPress,
}: VenueRowProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['venues', 'vocab', 'map']);
  // Unnamed venues get their district: "Баскетбольная площадка · Мокотув" (rows stay distinct).
  const title = venueName(
    {
      name: venue.name,
      kind: venue.kind,
      sportIds: venue.sport_ids,
      districtKey: venue.district_key,
    },
    t,
  );
  const kind = t(`vocab:venueKinds.${venue.kind}`);
  const sports =
    venue.sport_ids.length > 1 ? venue.sport_ids.map((id) => sportLabel(id, t)).join(', ') : null;
  const subtitle = [distance, venue.name ? kind : null, sports].filter(Boolean).join(' · ');
  const tags = buildVenueTags(venue, t);
  const events = venue.upcoming_events_count;
  const a11y = [
    title,
    subtitle,
    ...tags.map((tag) => tag.label),
    events > 0 ? eventsCountLabel(events, t) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      {...selectionA11y('toggle', selected)}
      accessibilityLabel={a11y}
      accessibilityHint={t('map:preview.selectHint')}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.disc, selected ? styles.discSelected : null]}>
        <SportIcon sportId={venuePictogram(venue.sport_ids, venue.kind)} size={22} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {events > 0 ? <Badge label={eventsCountLabel(events, t)} tone="primary" /> : null}
        </View>
        {subtitle ? (
          <Text variant="label" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <SmallTags tags={tags} style={styles.tags} />
      </View>
    </Pressable>
  );
});
