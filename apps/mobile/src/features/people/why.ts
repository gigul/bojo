// "Why this person fits" — derived only from the server's score components and shared data
// (no extra location detail is ever revealed).

export type WhyKey =
  | 'sameLevel'
  | 'closeLevel'
  | 'nearby'
  | 'sameDistrict'
  | 'sameSchedule'
  | 'similarSchedule'
  | 'commonSports'
  | 'sameSports'
  | 'sameGoal';

export interface WhyReason {
  key: WhyKey;
  count?: number;
}

export interface WhyInput {
  /** 0..1, mean level closeness over common sports (score_level). */
  levelCloseness: number | null;
  /** Server-bucketed distance (`distance_km_approx`). */
  distanceKm: number | null;
  sameDistrict: boolean;
  commonSlotsCount: number;
  /** score_schedule when known. */
  scheduleScore?: number | null;
  commonSportsCount: number;
  /** score_sport ≥ ~1 → exactly the same sports. */
  sportScore?: number | null;
  sameGoal: boolean;
}

const NEARBY_KM = 3;

/** Up to `max` reasons, most useful first. */
export function whyReasons(input: WhyInput, max = 3): WhyReason[] {
  const out: WhyReason[] = [];
  if (input.levelCloseness !== null) {
    if (input.levelCloseness >= 0.999) out.push({ key: 'sameLevel' });
    else if (input.levelCloseness >= 0.75) out.push({ key: 'closeLevel' });
  }
  if (input.distanceKm !== null && input.distanceKm <= NEARBY_KM) out.push({ key: 'nearby' });
  else if (input.sameDistrict) out.push({ key: 'sameDistrict' });
  if (input.commonSlotsCount > 0) {
    if (input.scheduleScore != null && input.scheduleScore >= 0.999) out.push({ key: 'sameSchedule' });
    else out.push({ key: 'similarSchedule' });
  }
  if (input.commonSportsCount >= 2) out.push({ key: 'commonSports', count: input.commonSportsCount });
  else if (input.sportScore != null && input.sportScore >= 0.999) out.push({ key: 'sameSports' });
  if (input.sameGoal) out.push({ key: 'sameGoal' });
  return out.slice(0, max);
}
