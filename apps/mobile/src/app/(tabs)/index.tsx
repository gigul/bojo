// Map tab (b2): full-screen venue map, sport filter chips, locate-me / add-venue buttons, a snap sheet
// with the venues in view (sorted by distance to the map centre) and today's events, and a preview
// card for the selected venue. Works fully for anonymous users; only "add venue" needs an account.
import {
  WARSAW_CENTER,
  type EventCardRow,
  type EventsFeedParams,
  type SportId,
  type VenueMapRow,
} from '@bojo/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListItem,
  Segmented,
  Skeleton,
  Text,
  useToast,
  webOnly,
} from '@/components/ui';
import { EventCard, useEventsFeed } from '@/features/events';
import {
  bboxCenter,
  bboxContains,
  bboxTouchesServiceArea,
  distanceKm,
  isVenuesTruncated,
  MapSheet,
  padBBox,
  SportFilterBar,
  toVenueMapItem,
  useVenueMapControls,
  useVenuesInBbox,
  VenueMap,
  VenueMapHost,
  VenuePreviewCard,
  VenueRow,
  type LatLng,
  type MapViewport,
  type SheetSnap,
} from '@/features/venues';
import { Icon } from '@/icons';
import { useRequireAuth } from '@/lib/auth';
import { formatVenueDistance } from '@/lib/format';
import { getCurrentLocation, roundCoord } from '@/lib/location';
import { floatingShadow, useTheme, useThemedStyles, type Theme } from '@/theme';

type SheetTab = 'venues' | 'today';

/**
 * First-frame guess of the collapsed sheet (handle 26 + segmented 50 + padding 12). The real value
 * is measured by the sheet (it grows with the font scale).
 */
const COLLAPSED_FALLBACK = 88;
const LOCATE_ZOOM = 15;
const WARSAW_ZOOM = 11.5;
const TODAY_LIMIT = 100;
const TODAY_RADIUS_KM = 30;
/** "Nothing today" → the next games, so the sheet never dead-ends. */
const NEXT_LIMIT = 30;
const NEXT_SHOWN = 8;
const IS_WEB = Platform.OS === 'web';

interface VisibleVenue {
  row: VenueMapRow;
  km: number;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background, overflow: 'hidden' },
    // Web renders the map LAST in the DOM (keyboard order: controls → sheet → map); z-order keeps
    // it underneath.
    mapLayer: { ...StyleSheet.absoluteFill, zIndex: 0 },
    top: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: t.spacing.sm,
      zIndex: 3,
    },
    underBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: t.spacing.lg,
      marginTop: t.spacing.sm,
    },
    statusSlot: { flex: 1, alignItems: 'flex-start' },
    fabs: { gap: t.spacing.sm, marginLeft: t.spacing.sm, alignItems: 'flex-end' },
    createButton: floatingShadow(t.scheme),
    skipLink: {
      position: 'absolute',
      top: t.spacing.sm,
      left: t.spacing.lg,
      zIndex: 10,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.pill,
      justifyContent: 'center',
      backgroundColor: t.colors.text,
    },
    nextHeader: {
      paddingHorizontal: t.layout.screenGutter,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
      gap: 2,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: t.minTouch,
      paddingHorizontal: t.spacing.md + 2,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      borderWidth: t.scheme === 'dark' ? t.layout.hairline : 0,
      borderColor: t.colors.border,
      ...floatingShadow(t.scheme),
    },
    pillPressed: { backgroundColor: t.colors.surfaceAlt },
    previewWrap: {
      position: 'absolute',
      left: t.spacing.md,
      right: t.spacing.md,
      alignItems: 'center',
      zIndex: 3,
    },
    preview: { width: '100%', maxWidth: t.layout.maxContentWidth - t.spacing.lg },

    list: { paddingBottom: t.spacing.xxl },
    note: { paddingHorizontal: t.layout.screenGutter, paddingVertical: t.spacing.md },
    skeletonRow: {
      flexDirection: 'row',
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenGutter,
      paddingVertical: t.spacing.md,
    },
    skeletonText: { flex: 1, gap: t.spacing.sm, paddingTop: 4 },
    event: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.xs + 2 },
    empty: { flexGrow: 0, paddingVertical: t.spacing.xl },
  });

function ListSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityLabel={undefined} aria-busy>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.skeletonText}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MapTabScreen() {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation(['map', 'venues', 'common']);
  const toast = useToast();
  const requireAuth = useRequireAuth();
  const controls = useVenueMapControls();

  const [height, setHeight] = useState(0);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [sportIds, setSportIds] = useState<SportId[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>('collapsed');
  // The main screen leads with today's games ("с кем и где поиграть сегодня").
  const [tab, setTab] = useState<SheetTab>('today');
  const [collapsedHeight, setCollapsedHeight] = useState(COLLAPSED_FALLBACK);

  const query = useVenuesInBbox(viewport, sportIds.length > 0 ? sportIds : null);
  const rows = query.data;
  const items = (rows ?? []).map(toVenueMapItem);
  const truncated = isVenuesTruncated(rows);
  const center: LatLng = viewport ? bboxCenter(viewport) : WARSAW_CENTER;
  const outside = viewport !== null && !bboxTouchesServiceArea(viewport);

  const visible: VisibleVenue[] = viewport
    ? (rows ?? [])
        .filter((r) => bboxContains(viewport, r.lat, r.lng))
        .map((row) => ({ row, km: distanceKm(center, row) }))
        .sort((a, b) => a.km - b.km)
    : [];
  const selected = selectedId ? (rows?.find((r) => r.id === selectedId) ?? null) : null;

  // Today's events, filtered to the visible area on the client. The map centre is NOT sent (the
  // card would show a distance from it); only the user's own rounded location, when they shared it,
  // so distances read "from you" (§8: rounded events_feed args are the one allowed use).
  const feedParams: EventsFeedParams = userLocation
    ? {
        dateRange: 'today',
        lat: roundCoord(userLocation.lat),
        lng: roundCoord(userLocation.lng),
        radiusKm: TODAY_RADIUS_KM,
        sportIds: sportIds.length > 0 ? sportIds : undefined,
        limit: TODAY_LIMIT,
      }
    : {
        dateRange: 'today',
        sportIds: sportIds.length > 0 ? sportIds : undefined,
        limit: TODAY_LIMIT,
      };
  const today = useEventsFeed(feedParams);
  const inView = (e: EventCardRow) =>
    viewport !== null && bboxContains(padBBox(viewport, 0.1), e.venue_lat, e.venue_lng);
  const todayEvents: EventCardRow[] = viewport ? (today.data ?? []).filter(inView) : [];

  // Nothing today here → the next games (in view first, else anywhere in the city).
  const noneToday = today.isSuccess && viewport !== null && todayEvents.length === 0;
  const next = useEventsFeed(
    { ...feedParams, dateRange: 'upcoming', limit: NEXT_LIMIT },
    { enabled: noneToday },
  );
  const nextAll = (next.data ?? []).filter((e) => e.status === 'scheduled');
  const nextInView = nextAll.filter(inView);
  const nextEvents = (nextInView.length > 0 ? nextInView : nextAll).slice(0, NEXT_SHOWN);

  const distanceFromUser = (row: { lat: number; lng: number }) =>
    userLocation ? formatVenueDistance(distanceKm(userLocation, row), t) : null;

  const select = (id: string) => {
    setSelectedId(id);
    setSnap('collapsed');
  };

  const openVenue = (id: string) => router.push({ pathname: '/venue/[id]', params: { id } });

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    const loc = await getCurrentLocation();
    setLocating(false);
    if (!loc) {
      toast.show(t('map:locationDenied'));
      return;
    }
    setUserLocation(loc);
    controls.flyTo(loc, LOCATE_ZOOM);
  };

  const addVenue = () => {
    const lat = String(roundCoord(center.lat, 5));
    const lng = String(roundCoord(center.lng, 5));
    if (!requireAuth(`/venue/new?lat=${lat}&lng=${lng}`)) return;
    router.push({ pathname: '/venue/new', params: { lat, lng } });
  };

  const createEvent = () => {
    if (!requireAuth('/event/create')) return;
    router.push('/event/create');
  };

  const changeSports = (ids: SportId[]) => {
    setSportIds(ids);
    setSelectedId(null);
  };

  // Web skip link: past the filter chips straight into the sheet list.
  const skipToList = () => {
    setSnap('half');
    setTimeout(() => {
      if (typeof document === 'undefined') return;
      const list = document.getElementById('map-sheet-list');
      const target =
        list?.querySelector<HTMLElement>('[tabindex="0"]') ??
        document
          .getElementById('map-sheet')
          ?.querySelector<HTMLElement>('[role="tab"][tabindex="0"]');
      target?.focus();
    }, 80);
  };

  const openEvent = (id: string) => router.push({ pathname: '/event/[id]', params: { id } });

  const venuesCount = rows === undefined ? '…' : `${visible.length}${truncated ? '+' : ''}`;
  const todayCount = today.data === undefined || !viewport ? '' : ` · ${todayEvents.length}`;

  let status: ReactNode = null;
  if (query.isFetching) {
    status = (
      <View
        style={styles.pill}
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('map:loading')}
      >
        <ActivityIndicator size="small" color={theme.colors.textMuted} />
        <Text variant="label">{t('map:loading')}</Text>
      </View>
    );
  } else if (truncated) {
    status = (
      <Pressable
        onPress={() => controls.zoomBy(1)}
        accessibilityRole="button"
        accessibilityLabel={t('map:zoomInToSeeAll')}
        accessibilityHint={t('map:zoomInHint')}
        style={({ pressed }) => [styles.pill, pressed ? styles.pillPressed : null]}
      >
        <Icon name="zoom-in" size={16} color="text" />
        <Text variant="label">{t('map:zoomInToSeeAll')}</Text>
      </Pressable>
    );
  }

  const venuesList = (() => {
    if (outside) {
      return (
        <EmptyState
          icon="map"
          title={t('map:sheet.outsideTitle')}
          message={t('map:sheet.outsideMessage')}
          action={{
            label: t('map:sheet.backToWarsaw'),
            onPress: () => controls.flyTo(WARSAW_CENTER, WARSAW_ZOOM),
            variant: 'secondary',
          }}
          style={styles.empty}
        />
      );
    }
    if (rows === undefined && query.isError) {
      return (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} style={styles.empty} />
      );
    }
    if (rows === undefined || viewport === null) return <ListSkeleton />;
    if (visible.length === 0) {
      return sportIds.length > 0 ? (
        <EmptyState
          icon="filter"
          title={t('map:sheet.emptyFilteredTitle')}
          message={t('map:sheet.emptyFilteredMessage')}
          action={{
            label: t('map:sheet.clearFilter'),
            onPress: () => changeSports([]),
            variant: 'secondary',
          }}
          style={styles.empty}
        />
      ) : (
        <EmptyState
          icon="map-pin"
          title={t('map:sheet.emptyTitle')}
          message={t('map:sheet.emptyMessage')}
          action={{ label: t('map:addVenue'), onPress: addVenue, variant: 'secondary' }}
          style={styles.empty}
        />
      );
    }
    return (
      <FlatList
        data={visible}
        keyExtractor={(item) => item.row.id}
        renderItem={({ item }) => (
          <VenueRow
            venue={item.row}
            distance={distanceFromUser(item.row)}
            selected={item.row.id === selectedId}
            onPress={select}
          />
        )}
        initialNumToRender={10}
        windowSize={7}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        // "Add venue" lives with the venues, not as a map button (the map's main action is a game).
        ListHeaderComponent={
          <ListItem
            title={t('map:sheet.addVenueRow')}
            left={<Icon name="plus-circle" size={22} color="text" />}
            onPress={addVenue}
            accessibilityLabel={t('map:addVenue')}
          />
        }
        ListFooterComponent={
          truncated ? (
            <Text variant="caption" color="textMuted" style={styles.note}>
              {t('map:sheet.truncatedNote')}
            </Text>
          ) : null
        }
      />
    );
  })();

  const todayList = (() => {
    if (today.isPending) return <ListSkeleton />;
    if (today.isError) {
      return (
        <ErrorState error={today.error} onRetry={() => void today.refetch()} style={styles.empty} />
      );
    }
    if (todayEvents.length === 0) {
      if (next.isPending && noneToday) return <ListSkeleton />;
      if (nextEvents.length === 0) {
        return (
          <EmptyState
            icon="calendar"
            title={t('map:sheet.todayEmptyTitle')}
            message={t('map:sheet.todayEmptyMessage')}
            action={{
              label: t('map:sheet.createEvent'),
              onPress: createEvent,
              variant: 'secondary',
            }}
            style={styles.empty}
          />
        );
      }
      // No dead end: today is empty here, so show the next games ("Завтра 07:00 …").
      return (
        <FlatList
          data={nextEvents}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={
            <View style={styles.nextHeader}>
              <Text variant="heading" accessibilityRole="header">
                {nextInView.length > 0 ? t('map:sheet.nextTitle') : t('map:sheet.nextCityTitle')}
              </Text>
              <Text variant="label" color="textMuted">
                {t('map:sheet.nextMessage')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.event}>
              <EventCard event={item} compact onPress={() => openEvent(item.id)} />
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      );
    }
    return (
      <FlatList
        data={todayEvents}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.event}>
            <EventCard event={item} compact onPress={() => openEvent(item.id)} />
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    );
  })();

  const mapLayer = (
    <VenueMapHost bottomInset={collapsedHeight} controls={controls}>
      <VenueMap
        venues={items}
        selectedVenueId={selectedId}
        onSelectVenue={select}
        onViewportChange={setViewport}
        userLocation={userLocation}
        style={StyleSheet.absoluteFill}
      />
    </VenueMapHost>
  );

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {/* Native keeps the map first (VoiceOver/TalkBack order by layout); web puts it last. */}
      {IS_WEB ? null : mapLayer}

      {IS_WEB ? (
        <Pressable
          onPress={skipToList}
          accessibilityRole="button"
          {...webOnly({ dataSet: { skipLink: 'true' } })}
          style={styles.skipLink}
        >
          <Text variant="bodyStrong" color="textInverse">
            {t('map:skipToList')}
          </Text>
        </Pressable>
      ) : null}

      <SafeAreaView edges={['top', 'left', 'right']} style={styles.top} pointerEvents="box-none">
        <SportFilterBar selected={sportIds} onChange={changeSports} />
        <View style={styles.underBar} pointerEvents="box-none">
          <View style={styles.statusSlot} pointerEvents="box-none">
            {status}
          </View>
          <View style={styles.fabs} pointerEvents="box-none">
            <Button
              title={t('map:createGame')}
              icon="plus"
              onPress={createEvent}
              accessibilityHint={t('map:createGameHint')}
              style={styles.createButton}
            />
            <IconButton
              icon="navigation"
              variant="surface"
              onPress={() => void locate()}
              disabled={locating}
              accessibilityLabel={t('map:locateMe')}
              accessibilityHint={t('map:locateMeHint')}
            />
          </View>
        </View>
      </SafeAreaView>

      {selected && snap === 'collapsed' ? (
        <View
          style={[styles.previewWrap, { bottom: collapsedHeight + theme.spacing.md }]}
          pointerEvents="box-none"
        >
          <VenuePreviewCard
            venue={selected}
            distance={distanceFromUser(selected)}
            onOpen={() => openVenue(selected.id)}
            onClose={() => setSelectedId(null)}
            style={styles.preview}
          />
        </View>
      ) : null}

      {height > 0 ? (
        <MapSheet
          containerHeight={height}
          collapsedHeight={collapsedHeight}
          onHeaderLayout={setCollapsedHeight}
          snap={snap}
          onSnapChange={setSnap}
          toggleLabel={snap === 'half' ? t('map:sheet.collapse') : t('map:sheet.expand')}
          header={
            <Segmented<SheetTab>
              semantics="tabs"
              options={[
                { value: 'today', label: `${t('map:sheet.todayTab')}${todayCount}` },
                { value: 'venues', label: `${t('map:sheet.venuesTab')} · ${venuesCount}` },
              ]}
              value={tab}
              onChange={(value) => {
                setTab(value);
                setSnap('half');
              }}
              accessibilityLabel={t('map:sheet.tabsLabel')}
            />
          }
        >
          {tab === 'venues' ? venuesList : todayList}
        </MapSheet>
      ) : null}

      {IS_WEB ? <View style={styles.mapLayer}>{mapLayer}</View> : null}
    </View>
  );
}
