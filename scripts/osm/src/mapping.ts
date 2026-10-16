// Normalization + exclusion rules from docs/OSM_IMPORT.md, mapped onto the Bojo schema
// (venue kind, venue_sports, surface class, is_lit, is_free, is_indoor, access, …). Pure functions.
//
// Sport ids / OSM values must match packages/shared/src/sports.ts and the `sports` seed
// (kept local because Node's type stripping cannot load the shared barrel's extensionless imports).

export type SportId =
  | 'football'
  | 'basketball'
  | 'volleyball'
  | 'tennis'
  | 'padel'
  | 'table_tennis'
  | 'swimming'
  | 'workout'
  | 'running';
export type VenueKind =
  | 'pitch'
  | 'sports_centre'
  | 'swimming_pool'
  | 'fitness_station'
  | 'track'
  | 'running_route'
  | 'other';

/** OSM sport=* value → our sport (docs/OSM_IMPORT.md table, §0 A4: beach volleyball → volleyball). */
export const OSM_SPORT_MAP: Readonly<Record<string, SportId>> = {
  soccer: 'football',
  football: 'football',
  futsal: 'football',
  beach_soccer: 'football',
  basketball: 'basketball',
  streetball: 'basketball',
  volleyball: 'volleyball',
  beachvolleyball: 'volleyball',
  beach_volleyball: 'volleyball',
  tennis: 'tennis',
  padel: 'padel',
  padel_tennis: 'padel',
  paddle_tennis: 'padel',
  table_tennis: 'table_tennis',
  swimming: 'swimming',
  fitness: 'workout',
  calisthenics: 'workout',
  street_workout: 'workout',
  crossfit: 'workout',
  running: 'running',
  athletics: 'running',
};
/** sport=multi → these, with venue_sports.inferred = true (§0 A4). */
export const MULTI_SPORTS: readonly SportId[] = ['football', 'basketball', 'volleyball'];

export const SURFACE_CLASSES = [
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
export type SurfaceClass = (typeof SURFACE_CLASSES)[number];
const SURFACE_MAP: Readonly<Record<string, SurfaceClass>> = {
  grass: 'grass',
  grass_paver: 'grass',
  artificial_turf: 'artificial_turf',
  artificial_grass: 'artificial_turf',
  astroturf: 'artificial_turf',
  asphalt: 'asphalt',
  concrete: 'concrete',
  'concrete:plates': 'concrete',
  paving_stones: 'concrete',
  sett: 'concrete',
  clay: 'clay',
  acrylic: 'hard',
  hard: 'hard',
  plastic: 'hard',
  plastic_tiles: 'hard',
  'plastic tiles': 'hard',
  tartan: 'tartan',
  rubber: 'tartan',
  polyurethane: 'tartan',
  epdm: 'tartan',
  sand: 'sand',
  wood: 'wood',
  parquet: 'wood',
  pvc: 'wood',
  vinyl: 'wood',
};

export type Tags = Record<string, string>;

export const EXCLUDED_ACCESS = new Set([
  'private',
  'no',
  'military',
  'staff',
  'employees',
  'delivery',
  'agricultural',
  'forestry',
  'emergency',
]);
export const RESTRICTED_ACCESS = new Set([
  'members',
  'students',
  'residents',
  'permit',
  'discouraged',
]);
const POOL_EXCLUDED_TYPES = new Set([
  'wading',
  'reflecting',
  'plunge',
  'hot_tub',
  'spa',
  'fountain',
  'paddling',
]);
const LIFECYCLE_PREFIX =
  /^(disused|abandoned|construction|proposed|demolished|removed|razed|destroyed|was):/;

export function splitValues(v: string | undefined): string[] {
  return (v ?? '')
    .split(';')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type Base =
  'pitch' | 'centre' | 'pool' | 'water_park' | 'fitness' | 'track' | 'route' | 'other';

export function baseOf(type: string, t: Tags): Base | 'gym' {
  const l = t.leisure;
  if (l === 'pitch') return 'pitch';
  if (l === 'sports_centre' || l === 'stadium' || l === 'sports_hall') return 'centre';
  if (l === 'swimming_pool') return 'pool';
  if (l === 'water_park') return 'water_park';
  if (l === 'fitness_station' || l === 'outdoor_fitness' || t.fitness_station) return 'fitness';
  if (l === 'track') return 'track';
  if (type === 'relation' && (t.route === 'running' || t.route === 'fitness_trail')) return 'route';
  if (l === 'fitness_centre') return 'gym';
  return 'other';
}

export const KIND_OF_BASE: Readonly<Record<Base, VenueKind>> = {
  pitch: 'pitch',
  centre: 'sports_centre',
  pool: 'swimming_pool',
  water_park: 'swimming_pool',
  fitness: 'fitness_station',
  track: 'track',
  route: 'running_route',
  other: 'other',
};

/** Hard exclusions that do not depend on sports. Returns a reason or null. */
export function exclusionReason(base: Base | 'gym', t: Tags): string | null {
  if (base === 'gym') return 'fitness_centre';
  const access = (t.access ?? '').toLowerCase();
  if (EXCLUDED_ACCESS.has(access)) return 'access';
  if (t.disused === 'yes' || t.abandoned === 'yes' || 'construction' in t || 'proposed' in t)
    return 'lifecycle';
  if (Object.keys(t).some((k) => LIFECYCLE_PREFIX.test(k))) return 'lifecycle';
  if (/^(closed|off)$/i.test((t.opening_hours ?? '').trim())) return 'lifecycle';
  if (t.shop || t.club || t.office || t.craft) return 'commercial';
  if (base === 'fitness' && (t.indoor === 'yes' || t.location === 'indoor'))
    return 'indoor_fitness_station';
  if (base === 'pool' && POOL_EXCLUDED_TYPES.has((t.swimming_pool ?? '').toLowerCase()))
    return 'pool_type';
  if (base === 'other' && !t.name) return 'unnamed_other';
  return null;
}

export interface SportPick {
  sport: SportId;
  inferred: boolean;
}

/** Maps sport=* (and the element's category) onto our 9 sports. */
export function sportsOf(base: Base, t: Tags): SportPick[] {
  const values = splitValues(t.sport);
  const explicit = new Set<SportId>();
  let multi = false;
  for (const v of values) {
    if (v === 'multi') {
      multi = true;
      continue;
    }
    const s = OSM_SPORT_MAP[v];
    if (!s) continue;
    // context rules
    if (base === 'pitch' && v === 'athletics') continue; // jump pits / throwing areas, not a place to run
    if ((base === 'centre' || base === 'other') && (v === 'fitness' || v === 'crossfit')) continue; // gyms
    if (base === 'fitness' || base === 'route' || base === 'track') continue; // decided by category below
    explicit.add(s);
  }
  if (base === 'pool' || base === 'water_park') explicit.add('swimming');
  if (base === 'fitness') explicit.add('workout');
  if (base === 'route') explicit.add(t.route === 'fitness_trail' ? 'workout' : 'running');
  if (base === 'track') {
    // tracks are for running unless tagged only with other sports (cycling, horse, motor, karting, …)
    if (values.length === 0 || values.some((v) => v === 'running' || v === 'athletics'))
      explicit.add('running');
  }
  const out: SportPick[] = [...explicit].map((sport) => ({ sport, inferred: false }));
  // sport=multi on a pitch = multi-purpose court; on a centre it says nothing concrete (sports come from children)
  if (multi && base === 'pitch') {
    for (const s of MULTI_SPORTS) if (!explicit.has(s)) out.push({ sport: s, inferred: true });
  }
  return out;
}

export function surfaceClass(t: Tags): SurfaceClass | null {
  const v = splitValues(t.surface)[0];
  if (!v) return null;
  return SURFACE_MAP[v] ?? 'other';
}

export function litOf(t: Tags): boolean | null {
  const v = (t.lit ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'no' || v === 'disused') return false;
  if (
    /^(yes|automatic|24\/7|sunset-sunrise|dusk-dawn|limited|interval|motion)$/.test(v) ||
    /\d/.test(v)
  )
    return true;
  return null;
}

/** fee=no/donation → free; fee=yes*, numeric fee or a `charge` tag → paid; else unknown. */
export function freeOf(t: Tags): boolean | null {
  const v = (t.fee ?? '').trim().toLowerCase();
  if (v === 'no' || v === 'donation') return true;
  if (v.startsWith('yes') || /\d/.test(v) || t.charge) return false;
  return null;
}

export function indoorOf(base: Base, t: Tags): boolean | null {
  const indoor = (t.indoor ?? '').toLowerCase();
  if (
    indoor === 'yes' ||
    indoor === 'room' ||
    indoor === 'area' ||
    t.location === 'indoor' ||
    t.covered === 'yes'
  )
    return true;
  if (base === 'pool' && t.swimming_pool === 'indoor') return true;
  if (base === 'centre' && t.leisure === 'sports_hall') return true;
  if (indoor === 'no' || t.location === 'outdoor' || t.covered === 'no') return false;
  if (base === 'pool' && t.swimming_pool === 'outdoor') return false;
  return null;
}

export function accessFlags(t: Tags): string[] {
  const a = (t.access ?? '').toLowerCase();
  if (a === 'customers') return ['customers_only'];
  if (RESTRICTED_ACCESS.has(a)) return ['restricted_access'];
  return [];
}

/** Pools without an access tag are kept only with signs of a public facility (else likely a garden pool). */
export function poolLooksPublic(t: Tags): boolean {
  return Boolean(
    t.name ||
    t.operator ||
    t.opening_hours ||
    t.fee ||
    t.website ||
    t['contact:website'] ||
    t.sport ||
    ['yes', 'public', 'permissive', 'customers', 'designated'].includes(
      (t.access ?? '').toLowerCase(),
    ),
  );
}

export function addressOf(t: Tags): string | null {
  const street = t['addr:street'] ?? t['addr:place'];
  const no = t['addr:housenumber'];
  if (!street) return null;
  const s = (no ? `${street} ${no}` : street).trim();
  return s.length ? s.slice(0, 200) : null;
}

export function nameOf(t: Tags): string | null {
  const n = (t.name ?? '').trim();
  return n ? n.slice(0, 120) : null;
}

export function websiteOf(t: Tags): string | null {
  const w = (t.website ?? t['contact:website'] ?? t.url ?? '').trim();
  return w ? w.slice(0, 500) : null;
}

export function phoneOf(t: Tags): string | null {
  const p = (t.phone ?? t['contact:phone'] ?? '').trim();
  return p ? p.slice(0, 100) : null;
}

export function openingHoursOf(t: Tags): string | null {
  const o = (t.opening_hours ?? '').trim();
  return o && o.length <= 255 ? o : null;
}
