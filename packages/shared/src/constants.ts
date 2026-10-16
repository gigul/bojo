// Domain constants (ARCHITECTURE §9.3). Server-side equivalents live in the SQL migrations.

export const TIMEZONE = 'Europe/Warsaw';
export const WARSAW_CENTER = { lat: 52.2297, lng: 21.0122 } as const;

/** Same box as SQL private.in_service_area(). */
export const SERVICE_AREA_BBOX = {
  minLat: 51.95,
  maxLat: 52.5,
  minLng: 20.7,
  maxLng: 21.45,
} as const;

export const EVENT_LIMITS = {
  minSpots: 2,
  maxSpots: 50,
  minDurationMin: 15,
  maxDurationMin: 480,
  maxDaysAhead: 60,
} as const;

export const SERIES_HORIZON_DAYS = 14;
export const SERIES_MAX_WEEKS = 26;
export const SERIES_DEFAULT_WEEKS = 8;
export const ATTENDANCE_WINDOW_HOURS = 72;
export const RELIABILITY_MIN_EVENTS = 3;

export const NOTIFY_RADIUS_KM = { min: 1, max: 30, default: 5 } as const;

export const TEXT_LIMITS = {
  displayName: 40,
  bio: 300,
  message: 2000,
  eventTitle: 80,
  eventDescription: 1000,
  venueName: 120,
} as const;

/** Server-side rate limits (per 24 h unless noted) — informational for the UI. */
export const RATE_LIMITS = {
  createEventPerDay: 10,
  addVenuePerDay: 5,
  suggestVenueEditPerDay: 20,
  addVenuePhotoPerDay: 20,
  submitReportPerDay: 20,
  swipePerDay: 300,
  /** set_home_location: the first change after onboarding is free, then one change per this many days. */
  homeLocationCooldownDays: 7,
  pushTokensPerUser: 5,
  messagesPerMinute: 20,
} as const;

/**
 * Normalized surface classes stored in venues.surface (docs/OSM_IMPORT.md "Покрытие"; raw OSM value stays in
 * osm_tags.surface). i18n keys: `vocab:surfaces.<class>`. add_venue / suggest_venue_edit accept these keys.
 */
export const VENUE_SURFACES = [
  'grass',
  'artificial_turf',
  'asphalt',
  'concrete',
  'clay',
  'hard',
  'tartan',
  'sand',
  'wood',
  'other',
] as const;
export type VenueSurface = (typeof VENUE_SURFACES)[number];

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export const DEFAULT_MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export function isInServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= SERVICE_AREA_BBOX.minLat &&
    lat <= SERVICE_AREA_BBOX.maxLat &&
    lng >= SERVICE_AREA_BBOX.minLng &&
    lng <= SERVICE_AREA_BBOX.maxLng
  );
}
