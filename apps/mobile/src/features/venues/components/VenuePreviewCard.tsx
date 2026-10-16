// Floating card for the venue selected on the map: title, attributes, events, "Открыть".
import type { VenueMapRow } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Badge, Button, IconButton, Text } from '@/components/ui';
import { SportIcon } from '@/icons';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

import { districtLabel, eventsCountLabel, sportLabel, venuePictogram, venueTitle } from '../model';
import { buildVenueTags, SmallTags } from './VenueTags';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      paddingRight: t.spacing.sm,
      gap: t.spacing.md,
      ...floatingShadow(t.scheme),
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
    disc: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
    },
    text: { flex: 1, gap: 2, paddingTop: 2 },
    tags: { marginTop: t.spacing.xs + 2 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingRight: t.spacing.sm,
    },
    open: { flex: 1 },
  });

export function VenuePreviewCard({
  venue,
  distance,
  onOpen,
  onClose,
  style,
}: {
  venue: VenueMapRow;
  distance: string | null;
  onOpen: () => void;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['map', 'venues', 'vocab']);
  const title = venueTitle(venue.name, venue.kind, venue.sport_ids, t);
  // Unnamed venues are already titled by kind/sport — don't repeat it underneath.
  const sports =
    venue.name || venue.sport_ids.length > 1
      ? venue.sport_ids.map((id) => sportLabel(id, t)).join(', ')
      : null;
  const subtitle = [
    distance,
    venue.name ? t(`vocab:venueKinds.${venue.kind}`) : null,
    districtLabel(venue.district_key, t),
    sports,
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = buildVenueTags(venue, t);
  const events = venue.upcoming_events_count;

  return (
    <View style={[styles.card, style]} accessibilityLabel={t('map:preview.label', { title })}>
      <View style={styles.head}>
        <View style={styles.disc} aria-hidden>
          <SportIcon sportId={venuePictogram(venue.sport_ids, venue.kind)} size={26} />
        </View>
        <View style={styles.text}>
          <Text variant="heading" numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" color="textMuted" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <SmallTags tags={tags} style={styles.tags} />
        </View>
        <IconButton
          icon="x"
          onPress={onClose}
          accessibilityLabel={t('map:preview.close')}
          color="textMuted"
          iconSize={20}
        />
      </View>
      <View style={styles.footer}>
        {events > 0 ? (
          <Badge label={eventsCountLabel(events, t)} tone="neutral" icon="calendar" />
        ) : null}
        <Button
          title={t('map:preview.open')}
          onPress={onOpen}
          icon="arrow-right"
          iconPosition="right"
          accessibilityHint={t('map:preview.openHint')}
          style={styles.open}
        />
      </View>
    </View>
  );
}
