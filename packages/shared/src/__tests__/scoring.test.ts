// Run with: npm test -w @bojo/shared   (== node --test src/__tests__/)
// Imports use explicit .ts extensions because Node's native type stripping requires them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_SCORING,
  distanceFactor,
  jaccard,
  levelCloseness,
  matchScore,
  scheduleOverlap,
} from '../scoring.ts';
import {
  DISTANCE_BUCKETS,
  approxDistanceKm,
  distanceLabelKind,
  isDistanceBucket,
} from '../distance.ts';

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

test('constants match ARCHITECTURE §9.3', () => {
  assert.deepEqual(MATCH_SCORING, {
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
  });
});

test('jaccard', () => {
  close(jaccard(['football', 'tennis'], ['tennis']), 0.5);
  close(jaccard(['football'], ['football']), 1);
  close(jaccard(['football'], ['tennis']), 0);
  close(jaccard([], []), 0);
  close(jaccard(['a', 'a', 'b'], ['b', 'c']), 1 / 3); // duplicates ignored
});

test('levelCloseness', () => {
  close(levelCloseness([[3, 3]]), 1);
  close(levelCloseness([[1, 5]]), 0);
  close(
    levelCloseness([
      [2, 3],
      [4, 4],
    ]),
    (0.75 + 1) / 2,
  );
  close(levelCloseness([]), 0);
});

test('scheduleOverlap', () => {
  close(scheduleOverlap(['1:evening', '2:evening'], ['1:evening']), 1);
  close(
    scheduleOverlap(
      ['1:evening', '2:evening', '3:morning', '4:morning'],
      ['1:evening', '5:morning'],
    ),
    0.5,
  );
  close(scheduleOverlap([], ['1:evening']), 0.5);
  close(scheduleOverlap(['1:evening'], []), 0.5);
  close(scheduleOverlap(['1:morning'], ['1:evening']), 0);
});

test('distanceFactor', () => {
  close(distanceFactor(0, false), 1);
  close(distanceFactor(5, false), Math.exp(-1));
  close(distanceFactor(null, true), Math.exp(-3 / 5));
  close(distanceFactor(null, false), 0.3);
  close(distanceFactor(5, true), Math.exp(-1)); // known distance wins over district
});

test('matchScore floors and range', () => {
  close(matchScore({ sport: 1, level: 1, schedule: 1, distance: 1 }), 1);
  close(matchScore({ sport: 0, level: 0, schedule: 0, distance: 0 }), 0.25 * 0.25 * 0.4 * 0.2);
  const s = matchScore({ sport: 0.5, level: 0.75, schedule: 0.5, distance: Math.exp(-1) });
  close(
    s,
    (0.25 + 0.75 * 0.5) * (0.25 + 0.75 * 0.75) * (0.4 + 0.6 * 0.5) * (0.2 + 0.8 * Math.exp(-1)),
  );
  assert.ok(s > 0 && s <= 1);
  // inputs are clamped to [0,1]
  close(matchScore({ sport: 2, level: -1, schedule: 1, distance: 1 }), 1 * 0.25 * 1 * 1);
});

test('approxDistanceKm buckets (same as SQL private.approx_distance_km)', () => {
  assert.equal(approxDistanceKm(null), null);
  assert.equal(approxDistanceKm(0), 3);
  assert.equal(approxDistanceKm(2.99), 3);
  assert.equal(approxDistanceKm(3), 5);
  assert.equal(approxDistanceKm(6.99), 5);
  assert.equal(approxDistanceKm(7), 10);
  assert.equal(approxDistanceKm(11.99), 10);
  assert.equal(approxDistanceKm(12), 15);
  assert.equal(approxDistanceKm(19.99), 15);
  assert.equal(approxDistanceKm(20), 25);
  assert.equal(approxDistanceKm(250), 25);
});

test('distance buckets and labels', () => {
  assert.deepEqual([...DISTANCE_BUCKETS], [3, 5, 10, 15, 25]);
  assert.equal(isDistanceBucket(3), true);
  assert.equal(isDistanceBucket(4), false);
  assert.equal(distanceLabelKind(3), 'lt3');
  assert.equal(distanceLabelKind(5), 'approx');
  assert.equal(distanceLabelKind(15), 'approx');
  assert.equal(distanceLabelKind(25), 'gte20');
});
