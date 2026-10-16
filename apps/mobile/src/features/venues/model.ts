// Pure venue helpers shared by the map, the sheet list, the detail page and the forms (no React).
import {
  isDistrictKey,
  isSportId,
  SERVICE_AREA_BBOX,
  type BBox,
  type SportId,
  type VenueKind,
  type VenueMapRow,
} from '@bojo/shared';

import i18n from '@/i18n';
import type { AnyT } from '@/lib/format';
import { venueName } from '@/lib/venueName';

import type { VenueMapItem } from './VenueMap.types';

/**
 * `p_limit` sent to `venues_in_bbox` (the server caps it at 1000). A result of exactly this length
 * means the viewport holds more venues than we got → the map shows "zoom in to see all".
 */
export const VENUES_BBOX_LIMIT = 1000;

/** True when a `venues_in_bbox` result was cut at the limit. */
export function isVenuesTruncated(rows: readonly unknown[] | null | undefined): boolean {
  return (rows?.length ?? 0) >= VENUES_BBOX_LIMIT;
}

/** `venues_in_bbox` row → the map's item shape (§2.4). */
export function toVenueMapItem(row: VenueMapRow): VenueMapItem {
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    name: row.name,
    kind: row.kind,
    sportIds: row.sport_ids,
    upcomingEventsCount: row.upcoming_events_count,
    todayEventsCount: row.today_events_count,
  };
}

const KIND_PICTOGRAM: Partial<Record<VenueKind, SportId>> = {
  swimming_pool: 'swimming',
  fitness_station: 'workout',
  track: 'running',
  running_route: 'running',
};

/** Pictogram key for a venue: its only sport, `multi` for several (sport identity = pictogram, A1). */
export function venuePictogram(sportIds: readonly string[], kind: VenueKind): string {
  const [first] = sportIds;
  if (sportIds.length === 1 && first) return first;
  if (sportIds.length > 1) return 'multi';
  return KIND_PICTOGRAM[kind] ?? 'multi';
}

/**
 * Venue title without the district (the venue page / preview show the district next to it).
 * Same naming as everywhere else — see `venueName` in @/lib/venueName.
 */
export function venueTitle(
  name: string | null,
  kind: VenueKind,
  sportIds: readonly string[],
  t: AnyT,
): string {
  return venueName({ name, kind, sportIds }, t, { district: false });
}

/** Localised district name, or null. */
export function districtLabel(key: string | null, _t: AnyT): string | null {
  return isDistrictKey(key) ? i18n.t(`vocab:districts.${key}`) : null;
}

/** Localised sport name (unknown ids are returned as is). */
export function sportLabel(sportId: string, _t: AnyT): string {
  return isSportId(sportId) ? i18n.t(`vocab:sports.${sportId}`) : sportId;
}

/** Surface class (VENUE_SURFACES) → label; falls back to "other surface" / the raw value. */
export function surfaceLabel(surface: string, _t: AnyT): string {
  const key = `vocab:surfaces.${surface}`;
  if (i18n.exists(key)) return i18n.t(key as 'vocab:surfaces.grass');
  if (surface === 'other') return i18n.t('venues:attributes.surfaceOther');
  return surface;
}

/** "2 события" (plural-aware). */
export function eventsCountLabel(count: number, _t: AnyT): string {
  return i18n.t('venues:events', { count });
}

/** Screen-reader label for a venue pin / list row: "Футбольное поле, 2 события". */
export function venueA11yLabel(
  venue: Pick<VenueMapItem, 'name' | 'kind' | 'sportIds' | 'upcomingEventsCount'>,
  t: AnyT,
): string {
  const title = venueTitle(venue.name, venue.kind, venue.sportIds, t);
  return venue.upcomingEventsCount > 0
    ? `${title}, ${eventsCountLabel(venue.upcomingEventsCount, t)}`
    : title;
}

// ---------------------------------------------------------------------------
// Geo (degrees; the map never rotates or tilts)
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

/** Web-mercator tile size used for zoom levels (maplibre / supercluster convention). */
export const TILE_SIZE = 512;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Longitude span of a map `widthPx` wide at `zoom`. */
export function lngSpanForZoom(zoom: number, widthPx: number): number {
  return (360 * Math.max(widthPx, 1)) / (TILE_SIZE * 2 ** zoom);
}

/** Zoom of a map `widthPx` wide that shows `lngSpan` degrees. */
export function zoomForLngSpan(lngSpan: number, widthPx: number): number {
  return Math.log2((360 * Math.max(widthPx, 1)) / (TILE_SIZE * Math.max(lngSpan, 1e-9)));
}

/** Latitude span matching a longitude span for a `width × height` map around `lat`. */
export function latSpanForLngSpan(
  lngSpan: number,
  widthPx: number,
  heightPx: number,
  lat: number,
): number {
  return lngSpan * (Math.max(heightPx, 1) / Math.max(widthPx, 1)) * Math.cos((lat * Math.PI) / 180);
}

export function bboxCenter(b: BBox): LatLng {
  return { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 };
}

export function bboxContains(b: BBox, lat: number, lng: number): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** The box shrunk to its inner `fraction` (0.8 = 10 % margin on every side). */
export function innerBBox(b: BBox, fraction: number): BBox {
  const dx = ((b.maxLng - b.minLng) * (1 - fraction)) / 2;
  const dy = ((b.maxLat - b.minLat) * (1 - fraction)) / 2;
  return {
    minLng: b.minLng + dx,
    maxLng: b.maxLng - dx,
    minLat: b.minLat + dy,
    maxLat: b.maxLat - dy,
  };
}

/** The box grown by `fraction` of its size on every side. */
export function padBBox(b: BBox, fraction: number): BBox {
  const dx = (b.maxLng - b.minLng) * fraction;
  const dy = (b.maxLat - b.minLat) * fraction;
  return {
    minLng: Math.max(-180, b.minLng - dx),
    maxLng: Math.min(180, b.maxLng + dx),
    minLat: Math.max(-85, b.minLat - dy),
    maxLat: Math.min(85, b.maxLat + dy),
  };
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * Snaps a viewport outward onto a power-of-two grid (≈ ¼ of the span) so small pans and zooms reuse
 * the same React Query key instead of refetching on every gesture.
 */
export function snapBBox(b: BBox): BBox {
  const span = Math.max(b.maxLng - b.minLng, b.maxLat - b.minLat, 1e-4);
  const step = 2 ** Math.floor(Math.log2(span / 4));
  return {
    minLng: round6(Math.max(-180, Math.floor(b.minLng / step) * step)),
    minLat: round6(Math.max(-85, Math.floor(b.minLat / step) * step)),
    maxLng: round6(Math.min(180, Math.ceil(b.maxLng / step) * step)),
    maxLat: round6(Math.min(85, Math.ceil(b.maxLat / step) * step)),
  };
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Does the box overlap Bojo's service area (Warsaw)? */
export function bboxTouchesServiceArea(b: BBox): boolean {
  return !(
    b.maxLat < SERVICE_AREA_BBOX.minLat ||
    b.minLat > SERVICE_AREA_BBOX.maxLat ||
    b.maxLng < SERVICE_AREA_BBOX.minLng ||
    b.minLng > SERVICE_AREA_BBOX.maxLng
  );
}

/** Same-point check with ~1 m tolerance. */
export function sameLatLng(a: LatLng | null | undefined, b: LatLng | null | undefined): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}
