// Web map — the ONLY file allowed to import maplibre-gl (ESLint-enforced). Metro picks this file on web.
// A8/A9: maplibre-gl is loaded with a dynamic import() inside an effect, its worker is self-hosted from
// public/ (copied on postinstall), the CSS is imported here, and the attribution control stays on.
// Pins are React (react-native-web) components portalled into maplibre DOM markers; only the clusters /
// venues inside the viewport exist as DOM nodes, and React reconciles them by key on every moveend.
import 'maplibre-gl/dist/maplibre-gl.css';

import { DEFAULT_MAP_STYLES, OSM_COPYRIGHT_URL, WARSAW_CENTER } from '@bojo/shared';
import type { MapSourceDataEvent, Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { selectionA11y } from '@/components/ui';
import { useReduceMotion, useTheme, useThemedStyles, type Theme } from '@/theme';

import { buildClusterIndex, clusterExpansionZoom, clusterItems } from './map/clusters';
import { ClusterPin, UserDot, VenuePin } from './map/MapPins';
import { PickOverlay } from './map/PickOverlay';
import { useVenueMapHost, type VenueMapController } from './map/VenueMapHost';
import {
  bboxContains,
  clampZoom,
  innerBBox,
  MAX_ZOOM,
  MIN_ZOOM,
  sameLatLng,
  venueA11yLabel,
  venuePictogram,
  type LatLng,
} from './model';
import type { MapViewport, VenueMapProps } from './VenueMap.types';

type MapLibreModule = typeof import('maplibre-gl');

interface MapCtx {
  lib: MapLibreModule;
  map: MlMap;
}

/** A9: maplibre-gl v6 resolves its worker relative to import.meta.url, which is wrong in a Metro bundle. */
const WORKER_URL = '/maplibre-gl-worker.mjs';
const VIEWPORT_DEBOUNCE_MS = 300;
const ANIMATION_MS = 400;
const LOCATE_ZOOM = 15;
/** A click that ends a drag-pan which started on a pin must not select that pin. */
const DRAG_CLICK_GUARD_MS = 250;
const CSS_ID = 'bojo-venue-map-css';
const WIDE_MIN_PX = 600;
/** Height taken by the pickMode confirm button (16 + 52 + 16). */
const PICK_FOOTER_PX = 84;

const STYLE_URLS = {
  light: process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT || DEFAULT_MAP_STYLES.light,
  dark: process.env.EXPO_PUBLIC_MAP_STYLE_DARK || DEFAULT_MAP_STYLES.dark,
} as const;

const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a>';

function isDefaultStyle(url: string): boolean {
  return (Object.values(DEFAULT_MAP_STYLES) as string[]).includes(url);
}

/** Same credits as the default styles, so dropping theirs never loses an attribution. */
const USE_OWN_TILE_CREDIT = isDefaultStyle(STYLE_URLS.light) && isDefaultStyle(STYLE_URLS.dark);

/**
 * OpenFreeMap's TileJSON carries "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (English, and
 * OSM a second time next to our localised OSM line). With the default styles we drop the source
 * credit as soon as its metadata loads and show one clean line instead:
 * "© участники OpenStreetMap (ODbL) | OpenFreeMap © OpenMapTiles".
 * Must be registered BEFORE the attribution control so the control reads the cleared value.
 */
function dropSourceCredits(map: MlMap): void {
  map.on('sourcedata', (e: MapSourceDataEvent) => {
    if (e.sourceDataType !== 'metadata') return;
    const source = map.getSource(e.sourceId) as { attribution?: string } | undefined;
    if (source?.attribution) source.attribution = undefined;
  });
}

function readViewport(map: MlMap): MapViewport {
  const b = map.getBounds();
  return {
    minLng: b.getWest(),
    minLat: b.getSouth(),
    maxLng: b.getEast(),
    maxLat: b.getNorth(),
    zoom: map.getZoom(),
  };
}

function hidePoiLayers(map: MlMap): void {
  for (const layer of map.getStyle()?.layers ?? []) {
    if ('source-layer' in layer && layer['source-layer'] === 'poi') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Themed overrides for maplibre's own controls (zoom buttons, attribution) + the sheet inset. */
function controlsCss(t: Theme): string {
  const c = t.colors;
  const invert = t.scheme === 'dark' ? 'filter: invert(1) hue-rotate(180deg);' : '';
  const shadow = t.scheme === 'dark' ? 'none' : '0px 4px 12px rgba(18, 20, 17, 0.12)';
  return `
.bojo-venue-map .maplibregl-ctrl-bottom-right,
.bojo-venue-map .maplibregl-ctrl-bottom-left { bottom: var(--bojo-map-inset, 0px); }
.bojo-venue-map .maplibregl-ctrl-group {
  background: ${c.surface}; border-radius: ${t.radius.md}px; box-shadow: ${shadow};
  border: ${t.scheme === 'dark' ? `1px solid ${c.border}` : 'none'}; overflow: hidden;
}
.bojo-venue-map .maplibregl-ctrl-group button { width: 44px; height: 44px; }
.bojo-venue-map .maplibregl-ctrl-group button + button { border-top: 1px solid ${c.border}; }
.bojo-venue-map .maplibregl-ctrl-group button:not(:disabled):hover { background-color: ${c.surfaceAlt}; }
.bojo-venue-map .maplibregl-ctrl-icon { ${invert} }
.bojo-venue-map .maplibregl-ctrl.maplibregl-ctrl-attrib {
  background: ${c.surface}; color: ${c.textMuted}; font: 500 11px/16px system-ui, sans-serif;
  border-radius: ${t.radius.pill}px; margin: 0 8px 8px 0;
}
.bojo-venue-map .maplibregl-ctrl-attrib a { color: ${c.text}; }
.bojo-venue-map .maplibregl-ctrl-attrib-button { ${invert} background-color: ${c.surface}; border-radius: ${t.radius.pill}px; }
.bojo-venue-map .maplibregl-ctrl-attrib.maplibregl-compact-show { padding: 2px 28px 2px 10px; }
.bojo-venue-map canvas.maplibregl-canvas:focus-visible { outline: 2px solid ${c.primaryText}; outline-offset: -2px; }
.bojo-venue-map .bojo-map-marker { cursor: pointer; }
`;
}

/** Owns one maplibre DOM marker; React renders the pin into `element` through a portal. */
class DomMarker {
  readonly element: HTMLDivElement;
  private marker: MlMarker | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'bojo-map-marker';
  }

  attach(ctx: MapCtx, lng: number, lat: number): void {
    this.marker = new ctx.lib.Marker({ element: this.element, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(ctx.map);
  }

  setZIndex(z: number): void {
    this.element.style.zIndex = String(z);
  }

  detach(): void {
    this.marker?.remove();
    this.marker = null;
  }
}

/** Swallows the click that ends a drag-pan which started on a pin. */
class DragGuard {
  private lastDragEnd = 0;

  markDragEnd(): void {
    this.lastDragEnd = Date.now();
  }

  allowsClick(): boolean {
    return Date.now() - this.lastDragEnd > DRAG_CLICK_GUARD_MS;
  }
}

function WebMarker({
  ctx,
  lng,
  lat,
  zIndex,
  children,
}: {
  ctx: MapCtx;
  lng: number;
  lat: number;
  zIndex: number;
  children: ReactNode;
}) {
  const [dom] = useState(() => new DomMarker());
  useEffect(() => {
    dom.attach(ctx, lng, lat);
    return () => dom.detach();
  }, [dom, ctx, lng, lat]);
  useEffect(() => {
    dom.setZIndex(zIndex);
  }, [dom, zIndex]);
  return createPortal(children, dom.element);
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: t.colors.surfaceAlt,
    },
    hit: { borderRadius: 30 },
  });

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
  const { t } = useTranslation(['map', 'common']);
  const { bottomInset, controls } = useVenueMapHost();
  const reduceMotion = useReduceMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<MapCtx | null>(null);
  const [view, setView] = useState<MapViewport | null>(null);
  // Captured once: the map is created imperatively and then driven by the effects below.
  const [initial] = useState(() => ({
    center: initialCenter,
    zoom: clampZoom(initialZoom),
    scheme: theme.scheme,
    // One line: localised OSM credit (our venue data + the basemap data) | OpenFreeMap © OpenMapTiles.
    attribution: [
      `<a href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noopener">${escapeHtml(
        t('common:osm.attribution'),
      )}</a>`,
      ...(USE_OWN_TILE_CREDIT ? [OPENFREEMAP_ATTRIBUTION] : []),
    ],
    locale: {
      'Map.Title': t('map:a11y.map'),
      'NavigationControl.ZoomIn': t('map:zoomIn'),
      'NavigationControl.ZoomOut': t('map:zoomOut'),
      'AttributionControl.ToggleAttribution': t('map:attribution.button'),
    },
  }));

  const onViewportRef = useRef(onViewportChange);
  const reduceMotionRef = useRef(reduceMotion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragGuard] = useState(() => new DragGuard());
  useEffect(() => {
    onViewportRef.current = onViewportChange;
    reduceMotionRef.current = reduceMotion;
  });

  const emitViewport = useEffectEvent((map: MlMap, immediate: boolean) => {
    const v = readViewport(map);
    setView(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate) onViewportRef.current?.(v);
    else timerRef.current = setTimeout(() => onViewportRef.current?.(v), VIEWPORT_DEBOUNCE_MS);
  });

  // Create the map once, client-side only.
  useEffect(() => {
    let cancelled = false;
    let created: MlMap | null = null;
    import('maplibre-gl')
      .then((lib) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        lib.setWorkerUrl(WORKER_URL);
        const map = new lib.Map({
          container,
          style: STYLE_URLS[initial.scheme],
          center: [initial.center.lng, initial.center.lat],
          zoom: initial.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // Added below, after the source-credit hook (listener order matters).
          attributionControl: false,
          locale: initial.locale,
        });
        created = map;
        if (USE_OWN_TILE_CREDIT) dropSourceCredits(map);
        // Keep the control on (A9): OSM (basemap + our venue data) | OpenFreeMap © OpenMapTiles.
        map.addControl(
          new lib.AttributionControl({ compact: true, customAttribution: initial.attribution }),
          'bottom-right',
        );
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        // Zoom buttons for mouse users on wide screens; phones pinch (and keyboard users press +/−).
        if (container.clientWidth >= WIDE_MIN_PX) {
          map.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');
        }
        map.on('moveend', () => emitViewport(map, false));
        map.on('dragend', () => dragGuard.markDragEnd());
        // OpenFreeMap styles reference a few sprite images they don't ship (e.g. "wood-pattern").
        map.setMissingStyleImageResolver((imageId) => {
          if (!map.hasImage(imageId))
            map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array(4) });
        });
        map.on('error', (e) => {
          if (__DEV__) console.warn('[VenueMap.web]', e.error?.message ?? e);
        });
        // The camera is known right away: start loading venues without waiting for the basemap style.
        emitViewport(map, true);
        // Keep the basemap calm (DESIGN.md: clean, airy): no shop/bus POI icons competing with pins.
        // Re-applied on every style load (theme switch swaps the style).
        map.on('style.load', () => hidePoiLayers(map));
        setCtx({ lib, map });
      })
      .catch((e: unknown) => {
        if (__DEV__) console.warn('[VenueMap.web] maplibre failed to load', e);
      });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      created?.remove();
    };
  }, [initial, dragGuard]);

  // Theme: swap the basemap style (DOM markers survive setStyle).
  const appliedStyleRef = useRef<string>(STYLE_URLS[initial.scheme]);
  useEffect(() => {
    const next = STYLE_URLS[theme.scheme];
    if (!ctx || appliedStyleRef.current === next) return;
    appliedStyleRef.current = next;
    ctx.map.setStyle(next);
  }, [ctx, theme.scheme]);

  // Themed control CSS (one shared <style>, rewritten on theme change).
  useEffect(() => {
    let el = document.getElementById(CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = controlsCss(theme);
  }, [theme]);

  // Overlays of the hosting screen (e.g. the collapsed sheet): keep controls and the camera centre clear.
  useEffect(() => {
    // In pickMode the confirm button sits at the bottom: lift maplibre's controls above it.
    const controlsInset = bottomInset + (pickMode ? PICK_FOOTER_PX : 0);
    containerRef.current?.style.setProperty('--bojo-map-inset', `${controlsInset}px`);
    ctx?.map.setPadding({ top: 0, left: 0, right: 0, bottom: bottomInset });
  }, [ctx, bottomInset, pickMode]);

  function animateTo(map: MlMap, center: LatLng, zoom: number) {
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: clampZoom(zoom),
      duration: reduceMotionRef.current ? 0 : ANIMATION_MS,
    });
  }

  const makeController = useEffectEvent((map: MlMap): VenueMapController => ({
    flyTo: (target, zoom) => animateTo(map, target, zoom ?? map.getZoom()),
    zoomBy: (delta) => (delta > 0 ? map.zoomIn() : map.zoomOut()),
  }));
  useEffect(() => {
    if (!controls || !ctx) return;
    return controls.attach(makeController(ctx.map));
  }, [controls, ctx]);

  // Centre on the device location when it first arrives / moves (local only, §8).
  const lastLocatedRef = useRef<LatLng | null>(null);
  const flyToUser = useEffectEvent((map: MlMap, loc: LatLng) => {
    if (sameLatLng(lastLocatedRef.current, loc)) return;
    lastLocatedRef.current = loc;
    animateTo(map, loc, Math.max(map.getZoom(), LOCATE_ZOOM));
  });
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;
  useEffect(() => {
    if (!ctx || userLat === undefined || userLng === undefined) return;
    flyToUser(ctx.map, { lat: userLat, lng: userLng });
  }, [ctx, userLat, userLng]);

  const index = useMemo(() => buildClusterIndex(venues), [venues]);

  // Bring a venue selected from outside (e.g. the list) into view.
  const revealSelected = useEffectEvent((map: MlMap, id: string) => {
    const venue = index.byId.get(id);
    if (!venue) return;
    if (bboxContains(innerBBox(readViewport(map), 0.7), venue.lat, venue.lng)) return;
    animateTo(map, { lat: venue.lat, lng: venue.lng }, Math.max(map.getZoom(), 14));
  });
  useEffect(() => {
    if (ctx && selectedVenueId) revealSelected(ctx.map, selectedVenueId);
  }, [ctx, selectedVenueId]);

  const items = useMemo(
    () => (view ? clusterItems(index, view, view.zoom, selectedVenueId) : []),
    [index, view, selectedVenueId],
  );

  return (
    <View style={[styles.root, style]}>
      <div
        ref={containerRef}
        className="bojo-venue-map"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {ctx
        ? items.map((item) => {
            if (item.type === 'cluster') {
              const label = item.hasToday
                ? `${t('map:marker.cluster', { count: item.count })}, ${t('map:marker.clusterWithEvents')}`
                : t('map:marker.cluster', { count: item.count });
              return (
                <WebMarker key={item.key} ctx={ctx} lng={item.lng} lat={item.lat} zIndex={1}>
                  <Pressable
                    onPress={() => {
                      if (!dragGuard.allowsClick()) return;
                      animateTo(
                        ctx.map,
                        { lat: item.lat, lng: item.lng },
                        Math.max(
                          clusterExpansionZoom(index, item.clusterId),
                          ctx.map.getZoom() + 1,
                        ),
                      );
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    // Pins are pointer targets only: dozens of them (many off-screen) must not sit
                    // in the Tab order. Keyboard / screen-reader users get the sheet list.
                    tabIndex={-1}
                    style={styles.hit}
                  >
                    <ClusterPin count={item.count} hasToday={item.hasToday} />
                  </Pressable>
                </WebMarker>
              );
            }
            const v = item.venue;
            return (
              <WebMarker
                key={item.key}
                ctx={ctx}
                lng={v.lng}
                lat={v.lat}
                zIndex={item.selected ? 3 : 2}
              >
                <Pressable
                  onPress={() => {
                    if (dragGuard.allowsClick()) onSelectVenue?.(v.id);
                  }}
                  disabled={!onSelectVenue}
                  {...selectionA11y('toggle', item.selected)}
                  accessibilityLabel={venueA11yLabel(v, t)}
                  tabIndex={-1}
                  style={styles.hit}
                >
                  <VenuePin
                    pictogram={venuePictogram(v.sportIds, v.kind)}
                    selected={item.selected}
                    eventsCount={v.upcomingEventsCount}
                    today={(v.todayEventsCount ?? 0) > 0}
                  />
                </Pressable>
              </WebMarker>
            );
          })
        : null}
      {ctx && userLocation ? (
        <WebMarker ctx={ctx} lng={userLocation.lng} lat={userLocation.lat} zIndex={0}>
          <View role="img" aria-label={t('map:marker.me')}>
            <UserDot />
          </View>
        </WebMarker>
      ) : null}
      {pickMode ? (
        <PickOverlay
          bottomInset={bottomInset}
          onConfirm={() => {
            if (!ctx) return;
            const c = ctx.map.getCenter();
            onPickLocation?.({ lat: c.lat, lng: c.lng });
          }}
        />
      ) : null}
    </View>
  );
}
