// Venue page (b2): photo hero (or honest placeholder + "add photo"), title, kind · district, sports,
// attribute chips, access flags, upcoming events, actions (create event, suggest edit, add photo,
// report, directions) and the ODbL attribution for OSM data. Works for anonymous users.
import { OSM_COPYRIGHT_URL, type ReportTarget } from '@bojo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ListItem,
  Skeleton,
  Text,
} from '@/components/ui';
import { EventCard, useEventsFeed } from '@/features/events';
import { ReportSheet } from '@/features/safety';
import {
  AttributeChips,
  buildVenueTags,
  districtLabel,
  PhotoHero,
  sportLabel,
  toHeroPhotos,
  usePhotoUpload,
  useVenueDetail,
  useVenueFlags,
  useVenuePhotos,
  venuePictogram,
  venueTitle,
} from '@/features/venues';
import { Icon, SportIcon } from '@/icons';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { getRpcErrorCode } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { floatingShadow, useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    scroll: { paddingBottom: t.spacing.xxl },
    column: { width: '100%', maxWidth: t.layout.maxContentWidth, alignSelf: 'center' },
    body: { paddingHorizontal: t.layout.screenGutter, paddingTop: t.spacing.lg, gap: t.spacing.xl },
    head: { gap: t.spacing.xs },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.xs + 2,
      marginTop: t.spacing.sm,
    },
    section: { gap: t.spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs + 2 },
    notice: {
      flexDirection: 'row',
      gap: t.spacing.md,
      alignItems: 'flex-start',
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surfaceAlt,
    },
    noticeText: { flex: 1 },
    events: { gap: t.spacing.md },
    card: { paddingVertical: t.spacing.xs },
    divider: { height: t.layout.hairline, backgroundColor: t.colors.border, marginLeft: 56 },
    osm: { gap: t.spacing.xs },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.lg },
    footer: {
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.md,
      ...floatingShadow(t.scheme),
    },
    footerInner: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenGutter,
      alignSelf: 'center',
      paddingBottom: t.spacing.md,
    },
    skeleton: { gap: t.spacing.md, padding: t.layout.screenGutter },
  });

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="heading" accessibilityRole="header">
      {children}
    </Text>
  );
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function directionsUrl(lat: number, lng: number, label: string): string {
  const q = encodeURIComponent(label);
  if (Platform.OS === 'ios') return `http://maps.apple.com/?daddr=${lat},${lng}&q=${q}`;
  if (Platform.OS === 'android') return `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export default function VenueScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['venues', 'common', 'vocab']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const venueId = typeof id === 'string' ? id : '';
  const { userId } = useAuth();
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();

  const detail = useVenueDetail(venueId);
  const photosQuery = useVenuePhotos(venueId);
  const venue = detail.data;
  const flags = useVenueFlags(venue);
  const events = useEventsFeed(
    { venueId, dateRange: 'upcoming', limit: 10 },
    { enabled: Boolean(venueId) && venue !== undefined },
  );
  const photo = usePhotoUpload(venueId);
  const [report, setReport] = useState<{ type: ReportTarget; id: string } | null>(null);

  // is_mine / has_pending_edit_by_me depend on the session: refresh after sign-in / sign-out.
  const lastUserRef = useRef(userId);
  useEffect(() => {
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    void queryClient.invalidateQueries({ queryKey: qk.venue(venueId) });
    void queryClient.invalidateQueries({ queryKey: qk.venuePhotos(venueId) });
  }, [userId, venueId, queryClient]);

  const screenOptions = <Stack.Screen options={{ title: t('common:screens.venue') }} />;

  if (detail.isPending) {
    return (
      <View style={styles.root}>
        {screenOptions}
        <View style={styles.column}>
          <Skeleton width="100%" height={220} radius={0} />
          <View style={styles.skeleton}>
            <Skeleton width="70%" height={26} />
            <Skeleton width="45%" height={16} />
            <Skeleton width="90%" height={36} radius={18} />
          </View>
        </View>
      </View>
    );
  }

  if (detail.isError || !venue) {
    const notFound = getRpcErrorCode(detail.error) === 'not_found';
    return (
      <View style={styles.root}>
        {screenOptions}
        {notFound ? (
          <EmptyState
            icon="map-pin"
            title={t('detail.notFoundTitle')}
            message={t('detail.notFoundMessage')}
            action={{ label: t('detail.backToMap'), onPress: () => router.replace('/') }}
          />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </View>
    );
  }

  const title = venueTitle(venue.name, venue.kind, venue.sport_ids, t);
  const kind = t(`vocab:venueKinds.${venue.kind}`);
  const district = districtLabel(venue.district_key, t);
  const subtitle = [venue.name ? kind : null, district].filter(Boolean).join(' · ');
  const tags = buildVenueTags(venue, t, { full: true });
  const photos = toHeroPhotos(photosQuery.data ?? []);
  const upcoming = events.data ?? [];
  const isOsm = venue.source === 'osm';

  const createEvent = () => {
    if (!requireAuth(`/event/create?venueId=${venue.id}`)) return;
    router.push({ pathname: '/event/create', params: { venueId: venue.id } });
  };
  const suggestEdit = () => {
    if (!requireAuth(`/venue/${venue.id}/edit`)) return;
    router.push({ pathname: '/venue/[id]/edit', params: { id: venue.id } });
  };
  const openReport = (type: ReportTarget, targetId: string) => {
    if (!requireAuth()) return;
    setReport({ type, id: targetId });
  };

  return (
    <View style={styles.root}>
      {screenOptions}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <PhotoHero
            photos={photos}
            pictogram={venuePictogram(venue.sport_ids, venue.kind)}
            uploading={photo.uploading}
            onAddPhoto={() => void photo.pick()}
            onReportPhoto={(photoId) => openReport('venue_photo', photoId)}
          />

          <View style={styles.body}>
            <View style={styles.head}>
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text color="textMuted" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {venue.source === 'user' || venue.is_mock || venue.status !== 'active' ? (
                <View style={styles.badges}>
                  {venue.source === 'user' ? (
                    <Badge
                      label={venue.is_mine ? t('detail.mine') : t('detail.userAdded')}
                      icon="user-check"
                    />
                  ) : null}
                  {venue.status !== 'active' ? (
                    <Badge label={t('detail.pending')} tone="warning" icon="clock" />
                  ) : null}
                  {venue.is_mock ? <Badge label={t('detail.mock')} tone="warning" /> : null}
                </View>
              ) : null}
            </View>

            {venue.sport_ids.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle>{t('detail.sports')}</SectionTitle>
                <View style={styles.chips}>
                  {venue.sport_ids.map((sportId) => (
                    <Chip
                      key={sportId}
                      label={sportLabel(sportId, t)}
                      icon={({ color, size }) => (
                        <SportIcon sportId={sportId} size={size + 2} color={color} />
                      )}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionTitle>{t('detail.details')}</SectionTitle>
              {tags.length > 0 ? (
                <AttributeChips tags={tags} />
              ) : (
                <Text color="textMuted">{t('detail.noDetails')}</Text>
              )}
              {flags.map((flag) => (
                <View key={flag} style={styles.notice} accessibilityRole="text">
                  <Icon name="info" size={18} color="textMuted" />
                  <Text variant="label" style={styles.noticeText}>
                    {t(`flags.${flag}`)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <SectionTitle>{t('detail.upcoming')}</SectionTitle>
              {events.isPending ? (
                <Skeleton width="100%" height={88} radius={20} />
              ) : upcoming.length > 0 ? (
                <View style={styles.events}>
                  {upcoming.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      compact
                      onPress={() =>
                        router.push({ pathname: '/event/[id]', params: { id: event.id } })
                      }
                    />
                  ))}
                </View>
              ) : (
                <Text color="textMuted">
                  {t('detail.upcomingEmptyTitle')}. {t('detail.upcomingEmptyMessage')}
                </Text>
              )}
            </View>

            <Card padded={false} style={styles.card}>
              <ListItem
                title={t('detail.directions')}
                subtitle={venue.address ?? undefined}
                left={<Icon name="navigation" size={20} color="text" />}
                accessibilityHint={t('detail.directionsHint')}
                onPress={() => void Linking.openURL(directionsUrl(venue.lat, venue.lng, title))}
              />
              {venue.website ? (
                <>
                  <View style={styles.divider} />
                  <ListItem
                    title={t('detail.website')}
                    subtitle={venue.website.replace(/^https?:\/\//i, '')}
                    left={<Icon name="globe" size={20} color="text" />}
                    onPress={() => void Linking.openURL(withScheme(venue.website ?? ''))}
                  />
                </>
              ) : null}
              {venue.phone ? (
                <>
                  <View style={styles.divider} />
                  <ListItem
                    title={t('detail.phone')}
                    subtitle={venue.phone}
                    left={<Icon name="phone" size={20} color="text" />}
                    onPress={() =>
                      void Linking.openURL(`tel:${(venue.phone ?? '').replace(/\s+/g, '')}`)
                    }
                  />
                </>
              ) : null}
              <View style={styles.divider} />
              <ListItem
                title={t('detail.addPhoto')}
                left={<Icon name="camera" size={20} color="text" />}
                disabled={photo.uploading}
                onPress={() => void photo.pick()}
              />
              <View style={styles.divider} />
              <ListItem
                title={
                  venue.has_pending_edit_by_me ? t('detail.editPending') : t('detail.suggestEdit')
                }
                left={<Icon name="edit-3" size={20} color="text" />}
                right={
                  venue.has_pending_edit_by_me ? (
                    <Icon name="clock" size={18} color="textMuted" />
                  ) : undefined
                }
                onPress={suggestEdit}
              />
              <View style={styles.divider} />
              <ListItem
                title={t('detail.report')}
                left={<Icon name="flag" size={20} color="text" />}
                onPress={() => openReport('venue', venue.id)}
              />
            </Card>

            {isOsm ? (
              <View style={styles.osm}>
                <Text variant="caption" color="textMuted">
                  {t('detail.osmData')}
                </Text>
                <View style={styles.links}>
                  {venue.osm_type && venue.osm_id ? (
                    <Text
                      variant="caption"
                      color="primaryText"
                      accessibilityRole="link"
                      onPress={() =>
                        void Linking.openURL(
                          `https://www.openstreetmap.org/${venue.osm_type}/${venue.osm_id}`,
                        )
                      }
                    >
                      {t('detail.osmOpen')}
                    </Text>
                  ) : null}
                  <Text
                    variant="caption"
                    color="primaryText"
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL)}
                  >
                    {t('detail.osmLicense')}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.footer}>
        <View style={styles.footerInner}>
          <Button
            title={t('detail.createEvent')}
            onPress={createEvent}
            icon="plus"
            size="lg"
            fullWidth
          />
        </View>
      </SafeAreaView>

      <ReportSheet
        visible={report !== null}
        onClose={() => setReport(null)}
        targetType={report?.type ?? 'venue'}
        targetId={report?.id ?? venue.id}
      />
    </View>
  );
}
