// 18 Warsaw dzielnice (ARCHITECTURE §9.4). Must equal the `public.districts` seed.
// Centres are approximate; used only as a fallback when an OSM boundary is missing.

export const DISTRICT_KEYS = [
  'bemowo',
  'bialoleka',
  'bielany',
  'mokotow',
  'ochota',
  'praga_poludnie',
  'praga_polnoc',
  'rembertow',
  'srodmiescie',
  'targowek',
  'ursus',
  'ursynow',
  'wawer',
  'wesola',
  'wilanow',
  'wlochy',
  'wola',
  'zoliborz',
] as const;
export type DistrictKey = (typeof DISTRICT_KEYS)[number];

export interface DistrictDef {
  key: DistrictKey;
  /** Official Polish name. */
  name: string;
  center: { lat: number; lng: number };
  /** Alphabetical by Polish name (Polish collation). */
  sortOrder: number;
}

export const DISTRICTS: readonly DistrictDef[] = [
  { key: 'bemowo', name: 'Bemowo', center: { lat: 52.2546, lng: 20.911 }, sortOrder: 1 },
  { key: 'bialoleka', name: 'Białołęka', center: { lat: 52.3205, lng: 20.9667 }, sortOrder: 2 },
  { key: 'bielany', name: 'Bielany', center: { lat: 52.2853, lng: 20.944 }, sortOrder: 3 },
  { key: 'mokotow', name: 'Mokotów', center: { lat: 52.1934, lng: 21.0347 }, sortOrder: 4 },
  { key: 'ochota', name: 'Ochota', center: { lat: 52.212, lng: 20.9727 }, sortOrder: 5 },
  {
    key: 'praga_poludnie',
    name: 'Praga-Południe',
    center: { lat: 52.2394, lng: 21.0838 },
    sortOrder: 6,
  },
  { key: 'praga_polnoc', name: 'Praga-Północ', center: { lat: 52.258, lng: 21.035 }, sortOrder: 7 },
  { key: 'rembertow', name: 'Rembertów', center: { lat: 52.2589, lng: 21.1573 }, sortOrder: 8 },
  { key: 'srodmiescie', name: 'Śródmieście', center: { lat: 52.2319, lng: 21.0067 }, sortOrder: 9 },
  { key: 'targowek', name: 'Targówek', center: { lat: 52.29, lng: 21.05 }, sortOrder: 10 },
  { key: 'ursus', name: 'Ursus', center: { lat: 52.1958, lng: 20.8838 }, sortOrder: 11 },
  { key: 'ursynow', name: 'Ursynów', center: { lat: 52.1508, lng: 21.0503 }, sortOrder: 12 },
  { key: 'wawer', name: 'Wawer', center: { lat: 52.1964, lng: 21.1772 }, sortOrder: 13 },
  { key: 'wesola', name: 'Wesoła', center: { lat: 52.237, lng: 21.224 }, sortOrder: 14 },
  { key: 'wilanow', name: 'Wilanów', center: { lat: 52.165, lng: 21.088 }, sortOrder: 15 },
  { key: 'wlochy', name: 'Włochy', center: { lat: 52.19, lng: 20.93 }, sortOrder: 16 },
  { key: 'wola', name: 'Wola', center: { lat: 52.235, lng: 20.967 }, sortOrder: 17 },
  { key: 'zoliborz', name: 'Żoliborz', center: { lat: 52.269, lng: 20.985 }, sortOrder: 18 },
];

export const DISTRICTS_BY_KEY: Readonly<Record<DistrictKey, DistrictDef>> = Object.fromEntries(
  DISTRICTS.map((d) => [d.key, d]),
) as Record<DistrictKey, DistrictDef>;

export function isDistrictKey(x: unknown): x is DistrictKey {
  return typeof x === 'string' && (DISTRICT_KEYS as readonly string[]).includes(x);
}

/** Key derivation from OSM names: strip diacritics, lowercase, '-' → '_' (ł is not decomposable). */
export function districtKeyFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, '_');
}
