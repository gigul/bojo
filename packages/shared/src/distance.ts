// Approximate cross-user distance buckets — identical to SQL private.approx_distance_km (ARCHITECTURE §8,
// privacy hardening migration 20261015000021). The server measures between ~2 km coarse cells of both homes
// and returns only one of DISTANCE_BUCKETS; clients must never re-bucket those values.
// NOTE: no relative value imports here so `node --test` can load this file directly.

/** Every value `distance_km_approx` can take. */
export const DISTANCE_BUCKETS = [3, 5, 10, 15, 25] as const;
export type DistanceBucket = (typeof DISTANCE_BUCKETS)[number];

export function isDistanceBucket(n: unknown): n is DistanceBucket {
  return typeof n === 'number' && (DISTANCE_BUCKETS as readonly number[]).includes(n);
}

/**
 * Bucket a distance in km: null → null; < 3 → 3; < 7 → 5; < 12 → 10; < 20 → 15; else 25.
 * (Not idempotent — 3 maps to 5 — so use isDistanceBucket() for values that already are buckets.)
 */
export function approxDistanceKm(km: number | null | undefined): DistanceBucket | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 3) return 3;
  if (km < 7) return 5;
  if (km < 12) return 10;
  if (km < 20) return 15;
  return 25;
}

export type DistanceLabelKind = 'lt3' | 'approx' | 'gte20';

/** i18n key suffix in `vocab:distance.*` — "до 3 км" (lt3), "~N км" (approx), "20+ км" (gte20). */
export function distanceLabelKind(bucket: number): DistanceLabelKind {
  if (bucket <= 3) return 'lt3';
  if (bucket >= 20) return 'gte20';
  return 'approx';
}
