// Must equal the `public.sports` seed in supabase/migrations/20261015000003_reference.sql.
// ARCHITECTURE §9.3 + §0 A2 (icon = pictogram key = sport id) + §0 A4 / docs/OSM_IMPORT.md (osm values).

export const SPORT_IDS = [
  'football',
  'basketball',
  'volleyball',
  'tennis',
  'padel',
  'table_tennis',
  'swimming',
  'workout',
  'running',
] as const;
export type SportId = (typeof SPORT_IDS)[number];

export interface SportDef {
  id: SportId;
  sortOrder: number;
  /** Pictogram key for <SportIcon>; equals the sport id (§0 A2). */
  icon: SportId;
  defaultSpots: number;
  defaultDurationMin: number;
  isTeam: boolean;
  /** OSM `sport=*` values mapped onto this sport by the importer. */
  osmValues: readonly string[];
}

export const SPORTS: readonly SportDef[] = [
  {
    id: 'football',
    sortOrder: 1,
    icon: 'football',
    defaultSpots: 10,
    defaultDurationMin: 90,
    isTeam: true,
    osmValues: ['soccer', 'football', 'futsal', 'beach_soccer'],
  },
  {
    id: 'basketball',
    sortOrder: 2,
    icon: 'basketball',
    defaultSpots: 10,
    defaultDurationMin: 90,
    isTeam: true,
    osmValues: ['basketball', 'streetball'],
  },
  {
    id: 'volleyball',
    sortOrder: 3,
    icon: 'volleyball',
    defaultSpots: 12,
    defaultDurationMin: 90,
    isTeam: true,
    osmValues: ['volleyball', 'beachvolleyball', 'beach_volleyball'],
  },
  {
    id: 'tennis',
    sortOrder: 4,
    icon: 'tennis',
    defaultSpots: 2,
    defaultDurationMin: 60,
    isTeam: false,
    osmValues: ['tennis'],
  },
  {
    id: 'padel',
    sortOrder: 5,
    icon: 'padel',
    defaultSpots: 4,
    defaultDurationMin: 90,
    isTeam: false,
    osmValues: ['padel', 'padel_tennis', 'paddle_tennis'],
  },
  {
    id: 'table_tennis',
    sortOrder: 6,
    icon: 'table_tennis',
    defaultSpots: 2,
    defaultDurationMin: 60,
    isTeam: false,
    osmValues: ['table_tennis'],
  },
  {
    id: 'swimming',
    sortOrder: 7,
    icon: 'swimming',
    defaultSpots: 4,
    defaultDurationMin: 60,
    isTeam: false,
    osmValues: ['swimming'],
  },
  {
    id: 'workout',
    sortOrder: 8,
    icon: 'workout',
    defaultSpots: 4,
    defaultDurationMin: 60,
    isTeam: false,
    osmValues: ['fitness', 'calisthenics', 'street_workout', 'crossfit'],
  },
  {
    id: 'running',
    sortOrder: 9,
    icon: 'running',
    defaultSpots: 6,
    defaultDurationMin: 60,
    isTeam: false,
    osmValues: ['running', 'athletics'],
  },
];

export const SPORTS_BY_ID: Readonly<Record<SportId, SportDef>> = Object.fromEntries(
  SPORTS.map((s) => [s.id, s]),
) as Record<SportId, SportDef>;

export function isSportId(x: unknown): x is SportId {
  return typeof x === 'string' && (SPORT_IDS as readonly string[]).includes(x);
}
