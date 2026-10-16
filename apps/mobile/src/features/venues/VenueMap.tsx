// Native map (iOS: Apple Maps, Android: Google Maps — both ship in Expo Go). The ONLY file allowed to
// import react-native-maps (ESLint-enforced). Web: VenueMap.web.tsx (maplibre-gl). Signature: §2.4.
import { WARSAW_CENTER } from '@bojo/shared';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type LatLng as MapLatLng, type Region } from 'react-native-maps';

import { useReduceMotion, useTheme, useThemedStyles, type Theme } from '@/theme';

import { buildClusterIndex, clusterExpansionZoom, clusterItems } from './map/clusters';
import { MapAttribution } from './map/MapAttribution';
import { ClusterPin, UserDot, VenuePin } from './map/MapPins';
import { PickOverlay } from './map/PickOverlay';
import { useVenueMapHost, type VenueMapController } from './map/VenueMapHost';
import {
  bboxContains,
  clampZoom,
  innerBBox,
  latSpanForLngSpan,
  lngSpanForZoom,
  sameLatLng,
  venueA11yLabel,
  venuePictogram,
  zoomForLngSpan,
  type LatLng,
} from './model';
import type { MapViewport, VenueMapProps } from './VenueMap.types';

const VIEWPORT_DEBOUNCE_MS = 300;
const ANIMATION_MS = 400;
/** Custom marker bitmaps (Android) are re-captured for this long after (re)mount, then frozen. */
const TRACK_VIEW_MS = 800;
const LOCATE_ZOOM = 15;

interface Size {
  width: number;
  height: number;
}

function regionFor(center: LatLng, zoom: number, size: Size): Region {
  const longitudeDelta = lngSpanForZoom(clampZoom(zoom), size.width);
  return {
    latitude: center.lat,
    longitude: center.lng,
    longitudeDelta,
    latitudeDelta: latSpanForLngSpan(longitudeDelta, size.width, size.height, center.lat),
  };
}

function regionToViewport(r: Region, size: Size): MapViewport {
  return {
    minLng: r.longitude - r.longitudeDelta / 2,
    maxLng: r.longitude + r.longitudeDelta / 2,
    minLat: r.latitude - r.latitudeDelta / 2,
    maxLat: r.latitude + r.latitudeDelta / 2,
    zoom: zoomForLngSpan(r.longitudeDelta, size.width),
  };
}

const toCoord = (p: LatLng): MapLatLng => ({ latitude: p.lat, longitude: p.lng });

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.surfaceAlt },
  });

/**
 * Marker with a custom view. On Android the view is snapshotted to a bitmap: track changes briefly
 * after mount (SVG needs a frame to draw) and then freeze for performance. Visual changes remount it
 * via `key`, so the bitmap is always fresh.
 */
function PinMarker({
  coordinate,
  zIndex,
  onPress,
  accessibilityLabel,
  selected,
  children,
}: {
  coordinate: MapLatLng;
  zIndex: number;
  onPress?: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  children: ReactNode;
}) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), TRACK_VIEW_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={zIndex}
      tracksViewChanges={tracking}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {children}
    </Marker>
  );
}

export function VenueMap({
  venues,
  initialCenter = WARSAW_CENTER,
  initialZoom = 12,
  selectedVenueId = null,
  onSelectVenue,
  onViewportChange,
  userLocation = null,
  pickMode = false,
  onPickLocation,
  style,
}: VenueMapProps): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation('map');
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();

  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState<Size>(() => ({ width: window.width, height: window.height }));
  const [region, setRegion] = useState<Region>(() =>
    regionFor(initialCenter, initialZoom, { width: window.width, height: window.height }),
  );
  // Latest values for timers / imperative calls (written only in handlers and effects).
  const regionRef = useRef<Region>(region);
  const sizeRef = useRef<Size>(size);
  const onViewportRef = useRef(onViewportChange);
  const reduceMotionRef = useRef(reduceMotion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onViewportRef.current = onViewportChange;
    reduceMotionRef.current = reduceMotion;
  });
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const viewport = useMemo(() => regionToViewport(region, size), [region, size]);
  const index = useMemo(() => buildClusterIndex(venues), [venues]);
  const items = useMemo(
    () => clusterItems(index, viewport, viewport.zoom, selectedVenueId),
    [index, viewport, selectedVenueId],
  );

  function emitViewport(r: Region, immediate: boolean) {
    const v = regionToViewport(r, sizeRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate) {
      onViewportRef.current?.(v);
      return;
    }
    timerRef.current = setTimeout(() => onViewportRef.current?.(v), VIEWPORT_DEBOUNCE_MS);
  }

  function animateTo(center: LatLng, zoom: number) {
    const target = regionFor(center, zoom, sizeRef.current);
    mapRef.current?.animateToRegion(target, reduceMotionRef.current ? 1 : ANIMATION_MS);
  }

  function currentZoom(): number {
    return zoomForLngSpan(regionRef.current.longitudeDelta, sizeRef.current.width);
  }

  // Imperative camera API for the screen that hosts this map (Map tab: locate-me, list taps…).
  const makeController = useEffectEvent((): VenueMapController => ({
    flyTo: (target, zoom) => animateTo(target, zoom ?? currentZoom()),
    zoomBy: (delta) =>
      animateTo(
        { lat: regionRef.current.latitude, lng: regionRef.current.longitude },
        clampZoom(currentZoom() + delta),
      ),
  }));
  const { bottomInset, controls } = useVenueMapHost();
  useEffect(() => controls?.attach(makeController()), [controls]);

  // Centre on the device location when it first arrives / moves (local only, §8).
  const lastLocatedRef = useRef<LatLng | null>(null);
  const flyToUser = useEffectEvent((loc: LatLng) => {
    if (sameLatLng(lastLocatedRef.current, loc)) return;
    lastLocatedRef.current = loc;
    animateTo(loc, Math.max(currentZoom(), LOCATE_ZOOM));
  });
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;
  useEffect(() => {
    if (userLat === undefined || userLng === undefined) return;
    flyToUser({ lat: userLat, lng: userLng });
  }, [userLat, userLng]);

  // Bring a venue selected from outside (e.g. the list) into view.
  const revealSelected = useEffectEvent((id: string) => {
    const venue = index.byId.get(id);
    if (!venue) return;
    const v = regionToViewport(regionRef.current, sizeRef.current);
    if (bboxContains(innerBBox(v, 0.7), venue.lat, venue.lng)) return;
    animateTo({ lat: venue.lat, lng: venue.lng }, Math.max(currentZoom(), 14));
  });
  useEffect(() => {
    if (selectedVenueId) revealSelected(selectedVenueId);
  }, [selectedVenueId]);

  const attributionBottom =
    bottomInset + (pickMode ? 88 : 8) + (Platform.OS === 'ios' && !pickMode ? 22 : 0);

  return (
    <View
      style={[styles.root, style]}
      onLayout={(e) => {
        const next = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
        if (next.width > 0 && next.height > 0) {
          sizeRef.current = next;
          setSize(next);
        }
      }}
    >
      <MapView
        // A10: Android reads userInterfaceStyle only at creation → remount on theme change.
        key={Platform.OS === 'android' ? theme.scheme : 'map'}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        userInterfaceStyle={theme.scheme}
        mapPadding={{ top: 0, right: 0, left: 0, bottom: bottomInset }}
        onMapReady={() => emitViewport(regionRef.current, true)}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
          setRegion(r);
          emitViewport(r, false);
        }}
        toolbarEnabled={false}
        zoomControlEnabled={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsIndoors={false}
        pitchEnabled={false}
        rotateEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        loadingBackgroundColor={theme.colors.surfaceAlt}
        loadingIndicatorColor={theme.colors.textMuted}
      >
        {items.map((item) => {
          if (item.type === 'cluster') {
            return (
              <PinMarker
                key={`${item.key}:${item.count}:${item.hasToday ? 1 : 0}:${theme.scheme}`}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                zIndex={1}
                accessibilityLabel={
                  item.hasToday
                    ? `${t('marker.cluster', { count: item.count })}, ${t('marker.clusterWithEvents')}`
                    : t('marker.cluster', { count: item.count })
                }
                onPress={() =>
                  animateTo(
                    { lat: item.lat, lng: item.lng },
                    Math.max(clusterExpansionZoom(index, item.clusterId), currentZoom() + 1),
                  )
                }
              >
                <ClusterPin count={item.count} hasToday={item.hasToday} />
              </PinMarker>
            );
          }
          const v = item.venue;
          return (
            <PinMarker
              key={`${item.key}:${item.selected ? 1 : 0}:${v.upcomingEventsCount}:${v.todayEventsCount ?? 0}:${theme.scheme}`}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              zIndex={item.selected ? 3 : 2}
              selected={item.selected}
              accessibilityLabel={venueA11yLabel(v, t)}
              onPress={onSelectVenue ? () => onSelectVenue(v.id) : undefined}
            >
              <VenuePin
                pictogram={venuePictogram(v.sportIds, v.kind)}
                selected={item.selected}
                eventsCount={v.upcomingEventsCount}
                today={(v.todayEventsCount ?? 0) > 0}
              />
            </PinMarker>
          );
        })}
        {userLocation ? (
          <PinMarker
            key={`me:${theme.scheme}`}
            coordinate={toCoord(userLocation)}
            zIndex={0}
            accessibilityLabel={t('marker.me')}
          >
            <UserDot />
          </PinMarker>
        ) : null}
      </MapView>
      {pickMode ? (
        <PickOverlay
          bottomInset={bottomInset}
          onConfirm={() =>
            onPickLocation?.({
              lat: regionRef.current.latitude,
              lng: regionRef.current.longitude,
            })
          }
        />
      ) : null}
      <MapAttribution bottom={attributionBottom} />
    </View>
  );
}
