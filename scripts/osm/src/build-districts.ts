// Warsaw dzielnice (admin_level 9) → SQL that lets PostGIS assemble the polygons:
//   ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(ST_BuildArea(ST_Collect(<member ways>)), tol)), 3))
// No osmtogeojson needed: we only emit the member way linestrings (out geom).
import type { FetchedQuery, OsmRelation } from './overpass.ts';
import { toPts } from './geo.ts';
import { coord, lit } from './sql.ts';

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

/** Same rule as packages/shared districtKeyFromName: strip diacritics, lowercase, '-' → '_'. */
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

export const SIMPLIFY_TOLERANCE_DEG = 0.0001; // ≈ 7–11 m in Warsaw

export interface DistrictsResult {
  areaCheck: string;
  statements: string[];
  matched: { key: string; relation: number; ways: number; points: number }[];
  missing: string[];
}

export function buildDistricts(q: FetchedQuery): DistrictsResult {
  const area = q.response.elements.find((e) => e.type === 'area');
  const areaCheck = area
    ? `area ${area.id} name=${area.tags?.name ?? '?'} admin_level=${area.tags?.admin_level ?? '?'}`
    : 'area element not echoed';
  if (area && (area.tags?.name !== 'Warszawa' || area.tags?.admin_level !== '6')) {
    throw new Error(`unexpected Overpass area: ${areaCheck}`);
  }

  const statements: string[] = [];
  const matched: DistrictsResult['matched'] = [];
  const seen = new Set<string>();
  const rels = q.response.elements
    .filter((e): e is OsmRelation => e.type === 'relation')
    .sort((a, b) => a.id - b.id);
  for (const r of rels) {
    const name = r.tags?.name ?? '';
    const key = districtKeyFromName(name);
    if (!(DISTRICT_KEYS as readonly string[]).includes(key) || seen.has(key)) continue;
    const lines: string[] = [];
    let points = 0;
    for (const m of r.members ?? []) {
      if (m.type !== 'way' || !m.geometry || !['outer', 'inner', ''].includes(m.role)) continue;
      const pts = toPts(m.geometry);
      if (pts.length < 2) continue;
      points += pts.length;
      lines.push(
        `'SRID=4326;LINESTRING(${pts.map(([x, y]) => `${coord(x)} ${coord(y)}`).join(',')})'::extensions.geometry`,
      );
    }
    if (!lines.length) continue;
    seen.add(key);
    matched.push({ key, relation: r.id, ways: lines.length, points });
    statements.push(
      `-- ${name} (relation ${r.id}, ${lines.length} member ways, ${points} points)\n` +
        `update public.districts d set boundary = g.geog\n` +
        `from (select extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(\n` +
        `        extensions.st_simplifypreservetopology(extensions.st_buildarea(extensions.st_collect(array[\n  ` +
        lines.join(',\n  ') +
        `\n        ])), ${SIMPLIFY_TOLERANCE_DEG})), 3))::extensions.geography(MultiPolygon,4326) as geog) g\n` +
        `where d.key = ${lit(key)} and g.geog is not null and not extensions.st_isempty(g.geog::extensions.geometry);\n`,
    );
  }
  const missing = DISTRICT_KEYS.filter((k) => !seen.has(k));
  return { areaCheck, statements, matched, missing };
}
