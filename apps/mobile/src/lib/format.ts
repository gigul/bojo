import { approxDistanceKm, distanceLabelKind, isDistanceBucket, type VenueKind } from '@bojo/shared';

import i18n from '@/i18n';

import { venueName } from './venueName';

/**
 * Any `t` from `useTranslation(...)`. It is required on purpose: the React Compiler memoises calls by
 * their arguments, and `t` changes identity on a language switch, so passing it re-runs the helper.
 * Lookups go through the shared i18n instance with explicit namespaces, so the namespace bound to
 * the caller's `t` does not matter.
 */
export type AnyT = (...args: never[]) => unknown;

/**
 * Venue name, or the localised kind ("Площадка", "Бассейн"…) for unnamed OSM venues.
 * Kept for the §2.6 contract; screens use `venueName` from `@/lib/venueName`, which also knows the
 * venue's sports and district ("Теннисный корт · Мокотув").
 */
export function venueDisplayName(name: string | null, kind: VenueKind, t: AnyT): string {
  return venueName({ name, kind }, t, { district: false });
}

/**
 * Another user's distance, already bucketed server-side (3/5/10/15/25 km between ~2 km cells):
 * "до 3 км", "~10 км", "20+ км". Server buckets are used as-is (never re-bucketed).
 */
export function formatApproxDistance(km: number | null, _t: AnyT): string {
  const bucket = isDistanceBucket(km) ? km : approxDistanceKm(km);
  if (bucket === null) return '';
  const kind = distanceLabelKind(bucket);
  if (kind === 'approx') return i18n.t('vocab:distance.approx', { km: bucket });
  return i18n.t(`vocab:distance.${kind}`);
}

/** Distance to a public venue (precise is fine, §8): "850 м", "2,4 км". */
export function formatVenueDistance(km: number | null, _t: AnyT): string {
  if (km === null || !Number.isFinite(km)) return '';
  if (km < 1)
    return i18n.t('vocab:distance.m', { m: Math.max(10, Math.round((km * 1000) / 10) * 10) });
  const value = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(km);
  return i18n.t('vocab:distance.km', { km: value });
}

/** Pace "m:ss" (append `vocab:units.perKm` in the UI). 330 → "5:30". */
export function formatPace(secPerKm: number): string {
  const total = Math.max(0, Math.round(secPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Free spots on an event (never negative). */
export function spotsLeft(row: {
  spots_total: number;
  spots_taken: number;
  spots_reserved: number;
}): number {
  return Math.max(0, row.spots_total - row.spots_taken - row.spots_reserved);
}

/** Up to two initials for avatar fallbacks: "Anna Kowalska" → "AK", "[DEV] Anna Kowalska" → "AK". */
export function initials(name: string): string {
  const parts = name
    .replace(/\[[^\]]*\]/g, ' ') // drop bracketed tags such as "[DEV]"
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? '');
  return letters.join('').toUpperCase();
}
