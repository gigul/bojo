import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Skeleton, Text } from '@/components/ui';
import {
  sportName,
  successHaptic,
  useDeclineInvite,
  useEvent,
  useEventParticipants,
  useJoinEvent,
  useNow,
} from '@/features/events';
import { Icon, SportIcon } from '@/icons';
import { useLanguage } from '@/i18n';
import { formatEventWhen } from '@/lib/datetime';
import { getRpcErrorCode } from '@/lib/errors';
import { venueName as formatVenueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import type { ChatMessage } from '../api';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', marginVertical: t.spacing.xs },
    rowOwn: { justifyContent: 'flex-end' },
    card: {
      width: '82%',
      maxWidth: 360,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    body: { padding: t.spacing.lg, gap: t.spacing.xs },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    sportRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    venueText: { flexShrink: 1 },
    note: {
      marginTop: t.spacing.sm,
      paddingLeft: t.spacing.md,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.border,
    },
    footer: {
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.lg,
      gap: t.spacing.sm,
    },
    actions: { flexDirection: 'row', gap: t.spacing.sm },
    action: { flex: 1 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  });

/** `kind='event_invite'` message from propose_meeting: event summary + Принять / Отклонить. */
export function EventInviteCard({
  message,
  own,
  senderName,
}: {
  message: ChatMessage;
  own: boolean;
  senderName: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('chat');
  const language = useLanguage();
  const now = useNow();
  const payload = message.payload ?? {};
  const eventId = typeof payload.event_id === 'string' ? payload.event_id : null;
  const sportId = typeof payload.sport_id === 'string' ? payload.sport_id : '';
  const startsAt = typeof payload.starts_at === 'string' ? payload.starts_at : null;
  const venueName = typeof payload.venue_name === 'string' ? payload.venue_name : null;

  const event = useEvent(eventId);
  // The proposer sees the invitee as `invited` until they answer (declined → no longer listed).
  const participants = useEventParticipants(eventId, { enabled: own });
  const join = useJoinEvent();
  const decline = useDeclineInvite();
  const row = event.data;
  const when = startsAt ? formatEventWhen(row?.starts_at ?? startsAt, language) : '';
  const venue = row
    ? formatVenueName(
        {
          name: row.venue_name,
          kind: row.venue_kind,
          sportIds: [row.sport_id],
          districtKey: row.district_key,
        },
        t,
      )
    : formatVenueName({ name: venueName, kind: 'pitch', sportIds: [sportId] }, t);
  const sport = sportName(sportId, t);
  const started = row ? new Date(row.starts_at).getTime() <= now : false;

  let footer: ReactNode = null;
  if (event.isPending && eventId) {
    footer = <Skeleton width="60%" height={20} />;
  } else if (event.isError || !row) {
    footer = (
      <Status
        icon="slash"
        text={
          getRpcErrorCode(event.error) === 'not_found' ? t('invite.inactive') : t('invite.error')
        }
      />
    );
  } else if (row.status === 'cancelled') {
    footer = <Status icon="x-circle" text={t('invite.cancelled')} />;
  } else if (row.status === 'completed' || started) {
    footer = <Status icon="clock" text={t('invite.past')} />;
  } else if (own) {
    const pending = participants.data?.some((p) => p.status === 'invited') ?? true;
    footer =
      row.spots_taken >= 2 ? (
        <Status icon="check-circle" accent text={t('invite.accepted')} />
      ) : pending ? (
        <Status icon="clock" text={t('invite.waiting')} />
      ) : (
        <Status icon="slash" text={t('invite.declinedByOther')} />
      );
  } else if (row.my_status === 'going') {
    footer = <Status icon="check-circle" accent text={t('invite.youAccepted')} />;
  } else if (row.my_status === 'invited') {
    footer = (
      <View style={styles.actions}>
        <Button
          title={t('invite.accept')}
          onPress={() => eventId && join.mutate(eventId, { onSuccess: successHaptic })}
          loading={join.isPending}
          disabled={decline.isPending}
          style={styles.action}
        />
        <Button
          title={t('invite.decline')}
          variant="secondary"
          onPress={() => eventId && decline.mutate(eventId)}
          loading={decline.isPending}
          disabled={join.isPending}
          style={styles.action}
        />
      </View>
    );
  } else {
    footer = <Status icon="slash" text={t('invite.declined')} />;
  }

  const summary = t('invite.a11y', { name: senderName, sport, when, venue });

  return (
    <View style={[styles.row, own ? styles.rowOwn : null]}>
      <View style={styles.card}>
        <Pressable
          onPress={() =>
            eventId && router.push({ pathname: '/event/[id]', params: { id: eventId } })
          }
          disabled={!eventId || !row}
          accessibilityRole="button"
          accessibilityLabel={summary}
          accessibilityHint={t('invite.openHint')}
          style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
        >
          <View style={styles.kicker}>
            <Icon name="calendar" size={14} color="primaryText" />
            <Text variant="caption" color="textMuted">
              {own ? t('invite.kickerOwn') : t('invite.kicker', { name: senderName })}
            </Text>
          </View>
          <View style={styles.sportRow}>
            <SportIcon sportId={sportId} size={22} />
            <Text variant="bodyStrong">{sport}</Text>
          </View>
          <Text variant="title">{when}</Text>
          <View style={styles.venueRow}>
            <Icon name="map-pin" size={14} color="textMuted" />
            <Text color="textMuted" numberOfLines={2} style={styles.venueText}>
              {venue}
            </Text>
          </View>
          {message.body.trim() ? (
            <Text style={styles.note} selectable>
              {message.body}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.footer}>{footer}</View>
      </View>
    </View>
  );
}

function Status({
  icon,
  text,
  accent = false,
}: {
  icon: 'check-circle' | 'clock' | 'slash' | 'x-circle';
  text: string;
  accent?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Icon name={icon} size={16} color={accent ? 'primaryText' : 'textMuted'} />
      <Text variant="label" color={accent ? 'text' : 'textMuted'}>
        {text}
      </Text>
    </View>
  );
}
