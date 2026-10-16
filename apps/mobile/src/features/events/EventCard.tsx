// EventCard (ARCHITECTURE §2.4, DESIGN.md): readable without opening — sport pictogram + name, time BIG,
// venue + distance, who is going (≤4 avatars + "+N"), lime "ещё 3", level, and "Иду" right on the card.
import type { EventCardRow } from '@bojo/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvatarStack, Badge, Card, SpotsBadge, Text } from '@/components/ui';
import { Icon, SportIcon } from '@/icons';
import { useLanguage } from '@/i18n';
import { formatEventWhen, formatTime } from '@/lib/datetime';
import { formatVenueDistance } from '@/lib/format';
import { venueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import { CardJoinButton } from './components/CardJoinButton';
import { LevelDots } from './components/LevelDots';
import { eventTitle, levelLabel, sportName } from './format';

export interface EventCardProps {
  event: EventCardRow;
  onPress?: () => void;
  compact?: boolean;
  /**
   * The list groups cards by day and its section header already names the day: show only "08:00".
   * (Additive to the §2.4 signature; the spoken summary always keeps the full day + time.)
   */
  timeOnly?: boolean;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    main: { padding: t.spacing.lg, paddingBottom: t.spacing.md, gap: t.spacing.sm },
    mainCompact: { padding: t.spacing.md, paddingBottom: t.spacing.sm, gap: t.spacing.xs },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapCompact: { width: 36, height: 36, borderRadius: 18 },
    head: { flex: 1, minWidth: 0, gap: 2 },
    // Time + status badge share a wrapping row: when they don't fit side by side the badge moves
    // to the next line — the time itself is never cut ("Sob, 17 paź, 08…").
    whenRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: t.spacing.sm,
      rowGap: t.spacing.xs,
    },
    when: { flexGrow: 1, flexShrink: 0, maxWidth: '100%' },
    venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 56 },
    venueRowCompact: { paddingLeft: 48 },
    venueText: { flexShrink: 1 },
    struck: { textDecorationLine: 'line-through' },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
    },
    footerCompact: { paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm },
    footerInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    footerText: { flexShrink: 1 },
    levelRow: { paddingLeft: 56 },
    levelRowCompact: { paddingLeft: 48 },
  });

export function EventCard({
  event,
  onPress,
  compact = false,
  timeOnly = false,
}: EventCardProps): JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('events');
  const language = useLanguage();

  const sport = sportName(event.sport_id, t);
  const title = eventTitle(event, t);
  const subtitle = title === sport ? sport : `${sport} · ${title}`;
  const when = formatEventWhen(event.starts_at, language);
  const shownWhen = timeOnly ? formatTime(event.starts_at, language) : when;
  const venue = venueName(
    {
      name: event.venue_name,
      kind: event.venue_kind,
      sportIds: [event.sport_id],
      districtKey: event.district_key,
    },
    t,
  );
  const distance = formatVenueDistance(event.distance_km, t);
  const present = event.spots_taken + event.spots_reserved;
  const level = levelLabel(event.level, t);
  const cancelled = event.status === 'cancelled';
  const completed = event.status === 'completed';

  const statusBadge = cancelled ? (
    <Badge label={t('status.cancelled')} tone="danger" />
  ) : completed ? (
    <Badge label={t('status.completed')} tone="neutral" />
  ) : event.my_status === 'invited' ? (
    <Badge label={t('status.invited')} tone="neutral" icon="mail" />
  ) : (
    <SpotsBadge spotsLeft={event.spots_left} spotsTotal={event.spots_total} />
  );

  const summary = [
    subtitle,
    when,
    venue,
    distance,
    cancelled
      ? t('status.cancelled')
      : t('card.a11ySpots', { count: event.spots_left, total: event.spots_total }),
    level,
  ]
    .filter(Boolean)
    .join(', ');

  const people = (event.participants_preview ?? []).map((p) => ({
    id: p.user_id,
    name: p.display_name,
    path: p.avatar_path,
  }));

  return (
    <Card padded={false}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={summary}
        accessibilityHint={onPress ? t('card.openHint') : undefined}
        style={({ pressed }) => [
          styles.main,
          compact ? styles.mainCompact : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.top}>
          <View style={[styles.iconWrap, compact ? styles.iconWrapCompact : null]}>
            <SportIcon sportId={event.sport_id} size={compact ? 20 : 24} />
          </View>
          <View style={styles.head}>
            <View style={styles.whenRow}>
              <Text
                variant={compact ? 'heading' : 'title'}
                numberOfLines={2}
                color={cancelled ? 'textMuted' : 'text'}
                style={[styles.when, cancelled ? styles.struck : null]}
              >
                {shownWhen}
              </Text>
              {statusBadge}
            </View>
            <Text variant="bodyStrong" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>
        <View style={[styles.venueRow, compact ? styles.venueRowCompact : null]}>
          <Icon name="map-pin" size={14} color="textMuted" />
          <Text color="textMuted" numberOfLines={2} style={styles.venueText}>
            {venue}
          </Text>
          {distance ? (
            <Text variant="label" color="textMuted">
              · {distance}
            </Text>
          ) : null}
        </View>
        <LevelDots level={event.level} style={compact ? styles.levelRowCompact : styles.levelRow} />
      </Pressable>

      <View style={[styles.footer, compact ? styles.footerCompact : null]}>
        {/* Pointer convenience only: screen readers use the summary button above. */}
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessible={false}
          focusable={false}
          tabIndex={-1}
          aria-hidden
          style={styles.footerInfo}
        >
          {people.length > 0 ? (
            <AvatarStack
              people={people}
              total={event.spots_taken}
              max={4}
              size={compact ? 24 : 28}
            />
          ) : (
            <Icon name="users" size={18} color="textMuted" />
          )}
          <Text variant="label" numberOfLines={1} style={styles.footerText}>
            {t('card.present', { count: present, total: event.spots_total })}
          </Text>
        </Pressable>
        <CardJoinButton event={event} />
      </View>
    </Card>
  );
}
