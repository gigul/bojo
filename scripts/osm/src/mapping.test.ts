// node --test src/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { osmVenueId, uuidv5, lit } from './sql.ts';
import {
  exclusionReason,
  freeOf,
  litOf,
  sportsOf,
  surfaceClass,
  baseOf,
  poolLooksPublic,
} from './mapping.ts';
import { districtKeyFromName, DISTRICT_KEYS } from './build-districts.ts';
import { assembleRings, pointInPoly, distM, type Pt } from './geo.ts';

test('uuid v5 matches the RFC 4122 reference vector', () => {
  assert.equal(
    uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
    '2ed6657d-e927-568b-95e1-2665a8aea6a2',
  );
});

test('OSM venue ids are deterministic v5 uuids', () => {
  const a = osmVenueId('way', 123);
  assert.equal(a, osmVenueId('way', 123));
  assert.notEqual(a, osmVenueId('node', 123));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('SQL literal escaping', () => {
  assert.equal(lit("Orlik 'Stegny'"), "'Orlik ''Stegny'''");
  assert.equal(lit(null), 'null');
});

test('sport mapping', () => {
  const s = (
    base: Parameters<typeof sportsOf>[0],
    sport?: string,
    extra: Record<string, string> = {},
  ) =>
    sportsOf(base, { ...(sport ? { sport } : {}), ...extra })
      .map((x) => `${x.sport}${x.inferred ? '*' : ''}`)
      .sort();
  assert.deepEqual(s('pitch', 'soccer'), ['football']);
  assert.deepEqual(s('pitch', 'beachvolleyball'), ['volleyball']);
  assert.deepEqual(s('pitch', 'multi'), ['basketball*', 'football*', 'volleyball*']);
  assert.deepEqual(s('pitch', 'multi;basketball'), ['basketball', 'football*', 'volleyball*']);
  assert.deepEqual(s('pitch', 'athletics'), []); // jump pits are not running venues
  assert.deepEqual(s('pitch', 'american_football;rugby'), []);
  assert.deepEqual(s('centre', 'multi'), []); // multi on a centre says nothing concrete
  assert.deepEqual(s('centre', 'fitness;swimming'), ['swimming']); // gym part dropped
  assert.deepEqual(s('track'), ['running']);
  assert.deepEqual(s('track', 'athletics'), ['running']);
  assert.deepEqual(s('track', 'cycling'), []);
  assert.deepEqual(s('fitness', 'fitness'), ['workout']);
  assert.deepEqual(s('pool'), ['swimming']);
  assert.deepEqual(s('route', undefined, { route: 'fitness_trail' }), ['workout']);
});

test('attribute normalization', () => {
  assert.equal(surfaceClass({ surface: 'artificial_grass' }), 'artificial_turf');
  assert.equal(surfaceClass({ surface: 'rubber;asphalt' }), 'tartan');
  assert.equal(surfaceClass({ surface: 'dirt' }), 'other');
  assert.equal(surfaceClass({}), null);
  assert.equal(litOf({ lit: 'yes' }), true);
  assert.equal(litOf({ lit: 'Mo-Fr 16:00-22:00' }), true);
  assert.equal(litOf({ lit: 'disused' }), false);
  assert.equal(litOf({}), null);
  assert.equal(freeOf({ fee: 'no' }), true);
  assert.equal(freeOf({ fee: 'yes' }), false);
  assert.equal(freeOf({ fee: '20 PLN' }), false);
  assert.equal(freeOf({ charge: '10 PLN/h' }), false);
  assert.equal(freeOf({}), null);
});

test('exclusions', () => {
  assert.equal(exclusionReason('pitch', { access: 'private' }), 'access');
  assert.equal(exclusionReason('pitch', { access: 'customers' }), null);
  assert.equal(exclusionReason('pitch', { 'disused:leisure': 'pitch' }), 'lifecycle');
  assert.equal(exclusionReason('pitch', { opening_hours: 'closed' }), 'lifecycle');
  assert.equal(exclusionReason('pitch', { shop: 'sports' }), 'commercial');
  assert.equal(exclusionReason('fitness', { indoor: 'yes' }), 'indoor_fitness_station');
  assert.equal(exclusionReason('pool', { swimming_pool: 'wading' }), 'pool_type');
  assert.equal(exclusionReason(baseOf('way', { leisure: 'fitness_centre' }), {}), 'fitness_centre');
  assert.equal(poolLooksPublic({}), false);
  assert.equal(poolLooksPublic({ name: 'Pływalnia Inflancka' }), true);
});

test('district keys from OSM names', () => {
  assert.equal(districtKeyFromName('Praga-Południe'), 'praga_poludnie');
  assert.equal(districtKeyFromName('Białołęka'), 'bialoleka');
  assert.equal(districtKeyFromName('Śródmieście'), 'srodmiescie');
  assert.equal(districtKeyFromName('Żoliborz'), 'zoliborz');
  assert.equal(districtKeyFromName('Włochy'), 'wlochy');
  assert.equal(DISTRICT_KEYS.length, 18);
});

test('ring assembly + point in polygon', () => {
  const a: Pt[] = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];
  const b: Pt[] = [
    [0, 0],
    [0, 1],
    [1, 1],
  ].reverse() as Pt[]; // reversed segment must still join
  const rings = assembleRings([a, b]);
  assert.equal(rings.length, 1);
  const poly = {
    outers: rings,
    inners: [],
    bbox: [0, 0, 1, 1] as [number, number, number, number],
    area: 1,
  };
  assert.equal(pointInPoly([0.5, 0.5], poly), true);
  assert.equal(pointInPoly([1.5, 0.5], poly), false);
  assert.ok(Math.abs(distM([21, 52.2], [21, 52.201]) - 111.2) < 1);
});
