// Match scoring — mirrors SQL public.match_candidates (ARCHITECTURE §5.4) with identical constants.
// NOTE: no relative value imports here so `node --test` can load this file directly.

export const MATCH_SCORING = {
  sportFloor: 0.25,
  levelFloor: 0.25,
  scheduleFloor: 0.4,
  distanceFloor: 0.2,
  distanceDecayKm: 5,
  unknownSchedule: 0.5,
  unknownDistance: 0.3,
  sameDistrictKm: 3,
  maxRadiusKm: 30,
  passCooldownDays: 14,
} as const;

/** Jaccard similarity |A∩B| / |A∪B| over sport ids. 0 when both are empty. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Mean over common sports of (1 − |ℓa − ℓb| / 4). 0 when there are no common sports. */
export function levelCloseness(pairs: readonly (readonly [number, number])[]): number {
  if (pairs.length === 0) return 0;
  let sum = 0;
  for (const [a, b] of pairs) sum += 1 - Math.abs(a - b) / 4;
  return sum / pairs.length;
}

/**
 * |SA∩SB| / min(|SA|,|SB|) over slot keys ("<weekday>:<day_part>", see availability.slotKey).
 * 0.5 (unknownSchedule) if either side has no slots.
 */
export function scheduleOverlap(a: readonly string[], b: readonly string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return MATCH_SCORING.unknownSchedule;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

/**
 * exp(−d / 5) with d = the server's distance BUCKET (distance_km_approx; never a continuous distance).
 * If the distance is unknown (either home location missing):
 * same district → exp(−3/5), otherwise 0.3.
 */
export function distanceFactor(km: number | null, sameDistrict: boolean): number {
  if (km != null && Number.isFinite(km))
    return Math.exp(-Math.max(0, km) / MATCH_SCORING.distanceDecayKm);
  if (sameDistrict) return Math.exp(-MATCH_SCORING.sameDistrictKm / MATCH_SCORING.distanceDecayKm);
  return MATCH_SCORING.unknownDistance;
}

export interface ScoreComponents {
  sport: number;
  level: number;
  schedule: number;
  distance: number;
}

/** score = (0.25+0.75·S)·(0.25+0.75·L)·(0.4+0.6·T)·(0.2+0.8·D) ∈ (0, 1]. */
export function matchScore({ sport, level, schedule, distance }: ScoreComponents): number {
  const f = (floor: number, x: number) => floor + (1 - floor) * clamp01(x);
  return (
    f(MATCH_SCORING.sportFloor, sport) *
    f(MATCH_SCORING.levelFloor, level) *
    f(MATCH_SCORING.scheduleFloor, schedule) *
    f(MATCH_SCORING.distanceFloor, distance)
  );
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
