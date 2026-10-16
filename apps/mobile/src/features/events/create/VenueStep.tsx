// Step 2: VenueMap (b2) filtered by the chosen sport + "nearby" list. One tap on a venue → next step.
import {
  isInServiceArea,
  VENUE_SURFACES,
  WARSAW_CENTER,
  type BBox,
  type VenueMapRow,
  type VenueSurface,
} from '@bojo/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState, ErrorState, selectionA11y, Skeleton, Text } from '@/components/ui';
import { useVenuesInBbox, VenueMap, type MapViewport, type VenueMapItem } from '@/features/venues';
import { Icon, SportIcon } from '@/icons';
import { formatVenueDistance } from '@/lib/format';
import { venueName } from '@/lib/venueName';
import { useThemedStyles, type Theme } from '@/theme';

import { useDeviceLocation } from '../deviceLocation';
import { haversineKm, sportName } from '../format';
import { nextStepPath, STEP_PATHS, useCreateDraft } from './draft';
import { StepHeader } from './StepHeader';

const LIST_MAX = 40;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    mapWrap: {
      borderRadius: t.radius.lg,
      overflow: 'hidden',
      borderWidth: t.layout.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceAlt,
    },
    map: { flex: 1 },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
    },
    list: {
      width: '100%',
      maxWidth: t.layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      minHeight: 64,
      borderBottomWidth: t.layout.hairline,
      borderBottomColor: t.colors.border,
    },
    rowSelected: { backgroundColor: t.colors.surfaceAlt },
    pressed: { backgroundColor: t.colors.surfaceAlt },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceAlt,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
  });

function isNamedSurface(s: string | null): s is Exclude<VenueSurface, 'other'> {
  return s !== null && s !== 'other' && (VENUE_SURFACES as readonly string[]).includes(s);
}

function bboxAround(center: { lat: number; lng: number }): BBox {
  return {
    minLat: center.lat - 0.025,
    maxLat: center.lat + 0.025,
    minLng: center.lng - 0.04,
    maxLng: center.lng + 0.04,
  };
}

function toMapItem(v: VenueMapRow): VenueMapItem {
  return {
    id: v.id,
    lat: v.lat,
    lng: v.lng,
    name: v.name,
    kind: v.kind,
    sportIds: v.sport_ids,
    upcomingEventsCount: v.upcoming_events_count,
    todayEventsCount: v.today_events_count,
  };
}

export function VenueStep() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'vocab', 'common']);
  const { height } = useWindowDimensions();
  const { draft, update, steps } = useCreateDraft();
  const { location } = useDeviceLocation({ request: true });
  const device = location && isInServiceArea(location.lat, location.lng) ? location : null;
  const [initialCenter] = useState(() => device ?? WARSAW_CENTER);
  const [bbox, setBbox] = useState<BBox>(() => bboxAround(initialCenter));
  const sportIds = draft.sportId ? [draft.sportId] : null;
  const venues = useVenuesInBbox(bbox, sportIds);

  if (!draft.sportId) return <Redirect href={STEP_PATHS.sport} />;

  const ref = device ?? {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
  const inView = (venues.data ?? []).filter(
    (v) =>
      v.lat >= bbox.minLat && v.lat <= bbox.maxLat && v.lng >= bbox.minLng && v.lng <= bbox.maxLng,
  );
  const nearby = inView
    .map((v) => ({ v, km: haversineKm(ref, v) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, LIST_MAX);

  const choose = (v: VenueMapRow) => {
    update({
      venue: {
        id: v.id,
        name: v.name,
        kind: v.kind,
        sportIds: v.sport_ids,
        districtKey: v.district_key,
      },
    });
    router.push(nextStepPath(steps, 'venue'));
  };
  const onSelectVenue = (id: string) => {
    const v = (venues.data ?? []).find((x) => x.id === id);
    if (v) choose(v);
  };
  const onViewportChange = (v: MapViewport) =>
    setBbox({ minLat: v.minLat, maxLat: v.maxLat, minLng: v.minLng, maxLng: v.maxLng });

  const mapHeight = Math.max(220, Math.min(380, Math.round(height * 0.36)));
  const sport = sportName(draft.sportId, t);

  const header = (
    <View>
      <StepHeader
        step="venue"
        title={t('events:create.venue.title')}
        subtitle={t('events:create.venue.subtitle', { sport })}
      />
      <View style={[styles.mapWrap, { height: mapHeight }]}>
        <VenueMap
          venues={(venues.data ?? []).map(toMapItem)}
          initialCenter={initialCenter}
          initialZoom={13}
          selectedVenueId={draft.venue?.id ?? null}
          onSelectVenue={onSelectVenue}
          onViewportChange={onViewportChange}
          userLocation={device}
          style={styles.map}
        />
      </View>
      <View style={styles.listHeader}>
        <Text variant="heading" accessibilityRole="header">
          {device ? t('events:create.venue.nearby') : t('events:create.venue.inView')}
        </Text>
        {venues.isFetching ? (
          <Text variant="caption" color="textMuted">
            {t('common:states.loading')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={nearby}
        keyExtractor={(item) => item.v.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item: { v, km } }) => {
          // Same name as on the map and the cards; unnamed venues carry their district, and the
          // second line (distance · surface · lights) tells similar rows apart.
          const name = venueName(
            {
              name: v.name,
              kind: v.kind,
              sportIds: v.sport_ids.length > 0 ? v.sport_ids : [draft.sportId],
              districtKey: v.district_key,
            },
            t,
          );
          const surface = isNamedSurface(v.surface) ? t(`vocab:surfaces.${v.surface}`) : null;
          const subtitle = [
            formatVenueDistance(Math.round(km * 10) / 10, t),
            v.name?.trim() ? t(`vocab:venueKinds.${v.kind}`) : null,
            surface,
            v.is_lit ? t('events:create.venue.lit') : null,
            v.upcoming_events_count > 0
              ? t('events:create.venue.events', { count: v.upcoming_events_count })
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const selected = draft.venue?.id === v.id;
          return (
            <Pressable
              onPress={() => choose(v)}
              {...selectionA11y('toggle', selected)}
              accessibilityLabel={`${name}, ${subtitle}`}
              style={({ pressed }) => [
                styles.row,
                selected ? styles.rowSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.rowIcon}>
                <SportIcon sportId={draft.sportId ?? 'multi'} size={20} />
              </View>
              <View style={styles.rowText}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {name}
                </Text>
                <Text variant="label" color="textMuted" numberOfLines={2}>
                  {subtitle}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="textMuted" />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          venues.isPending ? (
            <View>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={40} height={40} radius={20} />
                  <Skeleton width="60%" height={16} />
                </View>
              ))}
            </View>
          ) : venues.isError ? (
            <ErrorState error={venues.error} onRetry={() => void venues.refetch()} />
          ) : (
            <EmptyState
              icon="map"
              title={t('events:create.venue.emptyTitle', { sport })}
              message={t('events:create.venue.emptyMessage')}
            />
          )
        }
      />
    </View>
  );
}
