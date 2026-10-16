// Display helpers for events. Like @/lib/format they take `t` (React Compiler re-runs them on a
// language switch) but resolve keys through the shared i18n instance with explicit namespaces.
import {
  DISTRICT_KEYS,
  isLevel,
  isSportId,
  SPORTS_BY_ID,
  type DistrictKey,
  type EventCardRow,
} from '@bojo/shared';

import i18n from '@/i18n';
import type { AnyT } from '@/lib/format';

/** "Футбол" — localised sport name (unknown ids are shown as-is). */
export function sportName(sportId: string | null | undefined, _t: AnyT): string {
  if (!sportId) return '';
  return isSportId(sportId) ? i18n.t(`vocab:sports.${sportId}`) : sportId;
}

/** The event's own title, or the sport name when the organizer left it empty. */
export function eventTitle(e: Pick<EventCardRow, 'title' | 'sport_id'>, t: AnyT): string {
  const own = e.title?.trim();
  return own ? own : sportName(e.sport_id, t);
}

/** "Любой уровень" / "Средний". */
export function levelLabel(level: number | null | undefined, _t: AnyT): string {
  if (level == null || !isLevel(level)) return i18n.t('vocab:levels.any');
  return i18n.t(`vocab:levels.${level}`);
}

/** ISO weekdays → "вт, чт" (short names, Monday first). */
export function weekdaysLabel(days: readonly number[] | null | undefined, _t: AnyT): string {
  if (!days || days.length === 0) return '';
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  return sorted
    .map((d) => i18n.t(`vocab:weekdaysShort.${d as 1 | 2 | 3 | 4 | 5 | 6 | 7}`).toLowerCase())
    .join(', ');
}

/** "Мокотув" — localised district name ('' for unknown / null keys). */
export function districtName(key: string | null | undefined, _t: AnyT): string {
  if (!key || !(DISTRICT_KEYS as readonly string[]).includes(key)) return '';
  return i18n.t(`vocab:districts.${key as DistrictKey}`);
}

/** Default players for a sport (sports.default_spots), 10 for unknown ids. */
export function defaultSpots(sportId: string | null | undefined): number {
  return sportId && isSportId(sportId) ? SPORTS_BY_ID[sportId].defaultSpots : 10;
}

/** Default duration for a sport (sports.default_duration_min), 90 for unknown ids. */
export function defaultDuration(sportId: string | null | undefined): number {
  return sportId && isSportId(sportId) ? SPORTS_BY_ID[sportId].defaultDurationMin : 90;
}

/** Straight-line distance in km (client-side only, never sent anywhere). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
