// Event screen body (ARCHITECTURE §2.2 event/[id]): header, live spots, venue, organizer, participants,
// description, series info and every action (join / leave / cancel / series / chat / attendance / report /
// invite accept-decline). Anonymous users see the public card + a sign-in CTA.
import { isInServiceArea, type ParticipantRow } from '@bojo/shared';
import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  SpotsBadge,
  Text,
} from '@/components/ui';
import { ReportSheet } from '@/features/safety';
import { Icon, SportIcon, type IconName } from '@/icons';
import { useLanguage } from '@/i18n';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { formatEventWhen, formatTimeRange } from '@/lib/datetime';
import { getRpcErrorCode } from '@/lib/errors';
import { formatVenueDistance } from '@/lib/format';
import { venueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import {
  useCancelEvent,
  useCancelSeries,
  useDeclineInvite,
  useEvent,
  useEventParticipants,
  useJoinEvent,
  useLeaveEvent,
  useRemoveParticipant,
} from './api';
import { successHaptic } from './components/CardJoinButton';
import { ConfirmSheet } from './components/ConfirmSheet';
import { LevelDots } from './components/LevelDots';
import { ParticipantsList } from './components/ParticipantsList';
import { useDeviceLocation } from './deviceLocation';
import { districtName, eventTitle, haversineKm, sportName, weekdaysLabel } from './format';
import { useNow } from './useNow';

type Confirm =
  | { kind: 'leave' }
  | { kind: 'cancel' }
  | { kind: 'series' }
  | { kind: 'remove'; participant: ParticipantRow }
  | null;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    scroll: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.lg,
    },
    hero: { gap: t.spacing.xs },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.md,
    },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.md,
      padding: t.spacing.lg,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surfaceAlt,
    },
    bannerText: { flex: 1, gap: 2 },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      minHeight: 56,
    },
    infoText: { flex: 1, minWidth: 0, gap: 2 },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    divider: { height: t.layout.hairline, backgroundColor: t.colors.border, marginLeft: 52 },
    dividerFull: { height: t.layout.hairline, backgroundColor: t.colors.border },
    struck: { textDecorationLine: 'line-through' },
    spots: { padding: t.spacing.lg, gap: t.spacing.md },
    spotsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.surfaceAlt,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    barFill: { backgroundColor: t.colors.text },
    barReserved: { backgroundColor: t.colors.textMuted },
    section: { gap: t.spacing.sm },
    organizer: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    organizerText: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tools: { gap: t.spacing.sm },
    bottomBar: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.md,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    bottomInner: {
      flex: 1,
      flexDirection: 'row',
      gap: t.spacing.sm,
      width: '100%',
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      alignSelf: 'center',
      marginHorizontal: 'auto',
    },
    grow: { flex: 1 },
    skeleton: { padding: t.layout.screenGutter, gap: t.spacing.md },
  });

function InfoRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <>
      <Icon name={icon} size={20} color="textMuted" />
      <View style={styles.infoText}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color="textMuted" /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.infoRow} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [styles.infoRow, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

function Banner({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message?: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={styles.banner}
      accessible
      accessibilityLabel={[title, message].filter(Boolean).join('. ')}
    >
      <Icon name={icon} size={20} color="text" />
      <View style={styles.bannerText}>
        <Text variant="bodyStrong">{title}</Text>
        {message ? <Text color="textMuted">{message}</Text> : null}
      </View>
    </View>
  );
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'common']);
  const language = useLanguage();
  const { session, userId } = useAuth();
  const requireAuth = useRequireAuth();
  const now = useNow();
  const { location } = useDeviceLocation({ request: false });

  const event = useEvent(eventId);
  const e = event.data;
  const participants = useEventParticipants(eventId, { enabled: Boolean(session && e) });
  const join = useJoinEvent();
  const leave = useLeaveEvent();
  const decline = useDeclineInvite();
  const cancel = useCancelEvent();
  const cancelSeries = useCancelSeries();
  const remove = useRemoveParticipant();

  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const header = (
    <Stack.Screen
      options={{
        title: t('common:screens.event'),
      }}
    />
  );

  if (event.isPending) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        <View style={styles.skeleton}>
          <Skeleton width={64} height={64} radius={32} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="55%" height={36} />
          <Skeleton width="100%" height={160} radius={20} />
          <Skeleton width="100%" height={96} radius={20} />
        </View>
      </SafeAreaView>
    );
  }
  if (event.isError || !e) {
    const notFound = getRpcErrorCode(event.error) === 'not_found';
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
        {header}
        {notFound ? (
          <EmptyState
            icon="calendar"
            title={t('events:detail.notFoundTitle')}
            message={t('events:detail.notFoundMessage')}
            action={{
              label: t('events:detail.toFeed'),
              onPress: () => router.navigate('/events'),
              variant: 'secondary',
            }}
          />
        ) : (
          <ErrorState error={event.error} onRetry={() => void event.refetch()} />
        )}
      </SafeAreaView>
    );
  }

  const sport = sportName(e.sport_id, t);
  const title = eventTitle(e, t);
  const startsMs = new Date(e.starts_at).getTime();
  const endsMs = new Date(e.ends_at).getTime();
  const started = startsMs <= now;
  const ended = endsMs <= now;
  const scheduled = e.status === 'scheduled';
  const upcoming = scheduled && !started;
  const going = e.my_status === 'going';
  const invited = e.my_status === 'invited' && !e.is_organizer;
  const present = e.spots_taken + e.spots_reserved;
  // District is on the subtitle line below the name, so the title omits it.
  const venue = venueName({ name: e.venue_name, kind: e.venue_kind, sportIds: [e.sport_id] }, t, {
    district: false,
  });
  const point = location && isInServiceArea(location.lat, location.lng) ? location : null;
  const distanceKm = point ? haversineKm(point, { lat: e.venue_lat, lng: e.venue_lng }) : null;
  const venueSubtitle = [
    e.venue_address,
    districtName(e.district_key, t),
    distanceKm != null ? formatVenueDistance(Math.round(distanceKm * 10) / 10, t) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const seriesDays = weekdaysLabel(e.series_weekdays, t);

  const doJoin = () => {
    if (!requireAuth(`/event/${e.id}`)) return;
    join.mutate(e.id, { onSuccess: successHaptic });
  };
  const openChat = () => {
    if (e.conversation_id) {
      router.push({ pathname: '/chat/[id]', params: { id: e.conversation_id } });
    }
  };
  const closeConfirm = () => {
    setConfirm(null);
    setReason('');
  };

  // --- sticky actions -----------------------------------------------------------------------
  let actions: ReactNode = null;
  if (!session) {
    if (upcoming) {
      actions = (
        <Button
          title={t('events:detail.signInToJoin')}
          size="lg"
          fullWidth
          onPress={() => requireAuth(`/event/${e.id}`)}
          style={styles.grow}
        />
      );
    }
  } else if (invited && upcoming) {
    actions = (
      <>
        <Button
          title={t('events:detail.accept')}
          size="lg"
          onPress={doJoin}
          loading={join.isPending}
          disabled={decline.isPending || e.spots_left <= 0}
          style={styles.grow}
        />
        <Button
          title={t('events:detail.decline')}
          size="lg"
          variant="secondary"
          onPress={() => decline.mutate(e.id)}
          loading={decline.isPending}
          disabled={join.isPending}
          style={styles.grow}
        />
      </>
    );
  } else if (going || e.is_organizer) {
    actions = (
      <>
        {e.conversation_id ? (
          <Button
            title={t('events:detail.chat')}
            icon="message-circle"
            size="lg"
            onPress={openChat}
            style={styles.grow}
          />
        ) : null}
        {going && !e.is_organizer && upcoming ? (
          <Button
            title={t('events:detail.leave')}
            size="lg"
            variant="secondary"
            onPress={() => setConfirm({ kind: 'leave' })}
            style={e.conversation_id ? null : styles.grow}
          />
        ) : null}
      </>
    );
  } else if (e.can_join) {
    actions = (
      <Button
        title={t('events:detail.join')}
        size="lg"
        fullWidth
        onPress={doJoin}
        loading={join.isPending}
        style={styles.grow}
      />
    );
  } else if (upcoming && e.spots_left <= 0) {
    actions = (
      <Button
        title={t('events:detail.full')}
        size="lg"
        fullWidth
        disabled
        onPress={() => undefined}
        style={styles.grow}
      />
    );
  }

  // --- banners ------------------------------------------------------------------------------
  let banner: ReactNode = null;
  if (e.status === 'cancelled') {
    banner = (
      <Banner
        icon="x-circle"
        title={t('events:detail.cancelledTitle')}
        message={
          e.cancel_reason ? t('events:detail.cancelReason', { reason: e.cancel_reason }) : null
        }
      />
    );
  } else if (e.status === 'completed' || ended) {
    banner = <Banner icon="flag" title={t('events:detail.completedTitle')} />;
  } else if (started) {
    banner = <Banner icon="play-circle" title={t('events:detail.startedTitle')} />;
  } else if (e.my_status === 'removed') {
    banner = (
      <Banner
        icon="slash"
        title={t('events:detail.removedTitle')}
        message={t('events:detail.removedMessage')}
      />
    );
  } else if (invited) {
    banner = (
      <Banner
        icon="mail"
        title={t('events:detail.invitedTitle', { name: e.organizer_name ?? '' })}
        message={t('events:detail.invitedMessage')}
      />
    );
  }

  const organizerTools =
    e.is_organizer && (e.attendance_open || upcoming || (scheduled && !ended)) ? (
      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {t('events:detail.manage')}
        </Text>
        <View style={styles.tools}>
          {e.attendance_open ? (
            <Button
              title={t('events:detail.attendance')}
              icon="check-square"
              variant="secondary"
              fullWidth
              onPress={() =>
                router.push({ pathname: '/event/[id]/attendance', params: { id: e.id } })
              }
            />
          ) : null}
          {scheduled && !ended ? (
            <Button
              title={t('events:detail.cancel')}
              icon="x-circle"
              variant="secondary"
              fullWidth
              onPress={() => setConfirm({ kind: 'cancel' })}
            />
          ) : null}
          {e.series_id && scheduled ? (
            <Button
              title={t('events:detail.cancelSeries')}
              icon="repeat"
              variant="ghost"
              fullWidth
              onPress={() => setConfirm({ kind: 'series' })}
            />
          ) : null}
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <SportIcon sportId={e.sport_id} size={34} accessibilityLabel={sport} />
          </View>
          <View style={styles.kickerRow}>
            <Text variant="label" color="textMuted">
              {title === sport ? sport : `${sport} · ${title}`}
            </Text>
            {e.visibility === 'private' ? (
              <Badge label={t('events:detail.private')} icon="lock" />
            ) : null}
          </View>
          <Text
            variant="display"
            accessibilityRole="header"
            color={e.status === 'cancelled' ? 'textMuted' : 'text'}
            style={e.status === 'cancelled' ? styles.struck : null}
          >
            {formatEventWhen(e.starts_at, language)}
          </Text>
          <Text color="textMuted">
            {formatTimeRange(e.starts_at, e.ends_at, language)}
            {seriesDays ? ` · ${t('events:detail.weekly', { days: seriesDays })}` : ''}
          </Text>
        </View>

        {banner}

        <Card padded={false}>
          <View style={styles.spots}>
            <View style={styles.spotsTop}>
              <Text variant="heading">
                {t('events:detail.present', { count: present, total: e.spots_total })}
              </Text>
              {scheduled ? (
                <SpotsBadge spotsLeft={e.spots_left} spotsTotal={e.spots_total} />
              ) : null}
            </View>
            <View style={styles.bar} aria-hidden>
              <View style={[styles.barFill, { flex: e.spots_taken }]} />
              <View style={[styles.barReserved, { flex: e.spots_reserved }]} />
              <View style={{ flex: Math.max(0, e.spots_left) }} />
            </View>
            {e.spots_reserved > 0 ? (
              <Text variant="label" color="textMuted">
                {t('events:detail.reserved', { count: e.spots_reserved })}
              </Text>
            ) : null}
            <LevelDots level={e.level} color="text" />
          </View>
          <View style={styles.dividerFull} />
          <InfoRow
            icon="map-pin"
            title={venue}
            subtitle={venueSubtitle || undefined}
            onPress={() => router.push({ pathname: '/venue/[id]', params: { id: e.venue_id } })}
          />
          {e.series_id && seriesDays ? (
            <>
              <View style={styles.divider} />
              <InfoRow
                icon="repeat"
                title={t('events:detail.seriesTitle', { days: seriesDays })}
                subtitle={t('events:detail.seriesSubtitle')}
              />
            </>
          ) : null}
        </Card>

        {e.organizer_id ? (
          <View style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('events:detail.organizer')}
            </Text>
            <Pressable
              onPress={() =>
                e.organizer_id &&
                router.push({ pathname: '/person/[id]', params: { id: e.organizer_id } })
              }
              accessibilityRole="button"
              accessibilityLabel={[
                e.organizer_name,
                e.organizer_is_verified ? t('events:detail.verified') : null,
                e.organizer_reliability != null
                  ? t('events:detail.reliability', { value: e.organizer_reliability })
                  : null,
              ]
                .filter(Boolean)
                .join(', ')}
              style={({ pressed }) => [styles.organizer, pressed ? { opacity: 0.7 } : null]}
            >
              <Avatar name={e.organizer_name ?? ''} path={e.organizer_avatar_path} size={48} />
              <View style={styles.organizerText}>
                <View style={styles.nameRow}>
                  <Text variant="bodyStrong">
                    {e.is_organizer
                      ? t('events:detail.you', { name: e.organizer_name ?? '' })
                      : e.organizer_name}
                  </Text>
                  {e.organizer_is_verified ? (
                    <Icon name="check-circle" size={16} color="primaryText" />
                  ) : null}
                </View>
                <Text variant="label" color="textMuted">
                  {e.organizer_reliability != null
                    ? t('events:detail.reliability', { value: e.organizer_reliability })
                    : t('events:detail.reliabilityNew')}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="textMuted" />
            </Pressable>
          </View>
        ) : null}

        {e.description ? (
          <View style={styles.section}>
            <Text variant="heading" accessibilityRole="header">
              {t('events:detail.about')}
            </Text>
            <Text selectable>{e.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            {t('events:detail.participants', { count: e.spots_taken })}
          </Text>
          {session ? (
            participants.isError ? (
              <ErrorState error={participants.error} onRetry={() => void participants.refetch()} />
            ) : (
              <ParticipantsList
                rows={participants.data}
                loading={participants.isPending}
                canRemove={e.is_organizer && upcoming}
                meId={userId}
                onRemove={(p) => setConfirm({ kind: 'remove', participant: p })}
              />
            )
          ) : (
            <Text color="textMuted">{t('events:detail.participantsSignIn')}</Text>
          )}
        </View>

        {organizerTools}

        {session && !e.is_organizer ? (
          <Button
            title={t('events:detail.report')}
            icon="flag"
            variant="ghost"
            onPress={() => setReportOpen(true)}
          />
        ) : null}
      </ScrollView>

      {actions ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomInner}>{actions}</View>
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirm?.kind === 'leave'}
        title={t('events:confirm.leaveTitle')}
        message={t('events:confirm.leaveMessage')}
        confirmLabel={t('events:confirm.leaveConfirm')}
        loading={leave.isPending}
        onClose={closeConfirm}
        onConfirm={() => leave.mutate(e.id, { onSettled: closeConfirm })}
      />
      <ConfirmSheet
        visible={confirm?.kind === 'cancel'}
        title={t('events:confirm.cancelTitle')}
        message={t('events:confirm.cancelMessage')}
        confirmLabel={t('events:confirm.cancelConfirm')}
        danger
        loading={cancel.isPending}
        onClose={closeConfirm}
        onConfirm={() =>
          cancel.mutate(
            { eventId: e.id, reason, conversationId: e.conversation_id },
            { onSettled: closeConfirm },
          )
        }
        input={{
          label: t('events:confirm.reasonLabel'),
          placeholder: t('events:confirm.reasonPlaceholder'),
          value: reason,
          onChange: setReason,
          maxLength: 300,
        }}
      />
      <ConfirmSheet
        visible={confirm?.kind === 'series'}
        title={t('events:confirm.seriesTitle')}
        message={t('events:confirm.seriesMessage')}
        confirmLabel={t('events:confirm.seriesConfirm')}
        danger
        loading={cancelSeries.isPending}
        onClose={closeConfirm}
        onConfirm={() =>
          e.series_id &&
          cancelSeries.mutate({ seriesId: e.series_id, eventId: e.id }, { onSettled: closeConfirm })
        }
      />
      <ConfirmSheet
        visible={confirm?.kind === 'remove'}
        title={t('events:confirm.removeTitle', {
          name: confirm?.kind === 'remove' ? confirm.participant.display_name : '',
        })}
        message={t('events:confirm.removeMessage')}
        confirmLabel={t('events:confirm.removeConfirm')}
        danger
        loading={remove.isPending}
        onClose={closeConfirm}
        onConfirm={() =>
          confirm?.kind === 'remove' &&
          remove.mutate(
            { eventId: e.id, userId: confirm.participant.user_id },
            { onSettled: closeConfirm },
          )
        }
      />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="event"
        targetId={e.id}
      />
    </SafeAreaView>
  );
}
