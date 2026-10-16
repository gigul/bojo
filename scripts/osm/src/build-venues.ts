// Turns raw Overpass elements into Bojo venue rows, following docs/OSM_IMPORT.md:
// normalization, exclusions, container grouping ("places, not features"), fitness-equipment clustering
// (40 m), point/polygon de-duplication (30 m), school-grounds flag. Never invents data: every row and every
// attribute comes from OSM tags; derived bookkeeping lives under `bojo:*` keys in osm_tags.
import type { FetchedQuery, OsmElement, OsmRelation, OsmWay } from './overpass.ts';
import { distM, pointInPoly, polyFromRelation, polyFromWay, type Poly, type Pt } from './geo.ts';
import {
  KIND_OF_BASE,
  accessFlags,
  addressOf,
  baseOf,
  exclusionReason,
  freeOf,
  indoorOf,
  litOf,
  nameOf,
  openingHoursOf,
  phoneOf,
  poolLooksPublic,
  sportsOf,
  surfaceClass,
  websiteOf,
  type Base,
  type SportId,
  type SportPick,
  type Tags,
  type VenueKind,
} from './mapping.ts';

const SERVICE_BBOX = { minLat: 51.95, maxLat: 52.5, minLng: 20.7, maxLng: 21.45 };
const FITNESS_CLUSTER_M = 40;
const POINT_POLY_DUP_M = 30;

interface Candidate {
  key: string;
  type: 'node' | 'way' | 'relation';
  id: number;
  tags: Tags;
  base: Base | 'gym';
  pt: Pt | null;
  excluded: string | null;
  sports: Map<SportId, boolean>; // sport → inferred
  flags: Set<string>;
  grouped: string[];
  parent: string | null;
  mergedInto: string | null;
}

export interface VenueRow {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string | null;
  kind: VenueKind;
  lat: number;
  lng: number;
  address: string | null;
  surface: string | null;
  isLit: boolean | null;
  isFree: boolean | null;
  isIndoor: boolean | null;
  access: string | null;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  hidden: boolean;
  sports: SportPick[];
  osmTags: Record<string, unknown>;
}

export interface VenueStats {
  rawElements: Record<string, number>;
  uniqueElements: number;
  excluded: Record<string, number>;
  groupedIntoContainers: number;
  fitnessClustersMerged: number;
  pointPolygonDuplicates: number;
  noMappedSport: number;
  rows: number;
  hidden: number;
  byKind: Record<string, number>;
  bySport: Record<string, number>;
  bySportInferredOnly: Record<string, number>;
  tagQuality: Record<string, string>;
  flags: Record<string, number>;
}

const inc = (m: Record<string, number>, k: string, n = 1) => {
  m[k] = (m[k] ?? 0) + n;
};
const keyOf = (e: { type: string; id: number }) => `${e.type}/${e.id}`;

function pointOf(e: OsmElement): Pt | null {
  if (e.type === 'node') return [e.lon, e.lat];
  if ((e.type === 'way' || e.type === 'relation') && e.center) return [e.center.lon, e.center.lat];
  return null;
}

type ContainerKind = 'centre' | 'fitness_area' | 'education';
interface Container {
  key: string;
  kind: ContainerKind;
  poly: Poly;
}

function containerKind(t: Tags): ContainerKind | null {
  const l = t.leisure;
  if (l === 'sports_centre' || l === 'stadium' || l === 'water_park') return 'centre';
  if (l === 'fitness_station' || l === 'outdoor_fitness') return 'fitness_area';
  if (t.amenity === 'school' || t.amenity === 'college' || t.amenity === 'university')
    return 'education';
  return null;
}

export function buildVenues(venueQueries: Record<string, FetchedQuery>): {
  rows: VenueRow[];
  stats: VenueStats;
} {
  const stats: VenueStats = {
    rawElements: {},
    uniqueElements: 0,
    excluded: {},
    groupedIntoContainers: 0,
    fitnessClustersMerged: 0,
    pointPolygonDuplicates: 0,
    noMappedSport: 0,
    rows: 0,
    hidden: 0,
    byKind: {},
    bySport: {},
    bySportInferredOnly: {},
    tagQuality: {},
    flags: {},
  };

  // 1) unique candidates from the category queries
  const cands = new Map<string, Candidate>();
  for (const name of ['pitches', 'swimming', 'workout', 'running', 'sports_centres']) {
    const q = venueQueries[name];
    if (!q) throw new Error(`missing query result ${name}`);
    stats.rawElements[name] = q.response.elements.length;
    for (const e of q.response.elements) {
      if (e.type === 'area') continue;
      const k = keyOf(e);
      if (cands.has(k)) continue;
      const tags = (e.tags ?? {}) as Tags;
      const base = baseOf(e.type, tags);
      const pt = pointOf(e);
      let excluded = exclusionReason(base, tags);
      if (!excluded && !pt) excluded = 'no_geometry';
      if (
        !excluded &&
        pt &&
        (pt[1] < SERVICE_BBOX.minLat ||
          pt[1] > SERVICE_BBOX.maxLat ||
          pt[0] < SERVICE_BBOX.minLng ||
          pt[0] > SERVICE_BBOX.maxLng)
      )
        excluded = 'outside_service_area';
      const sports = new Map<SportId, boolean>();
      if (base !== 'gym') for (const s of sportsOf(base, tags)) sports.set(s.sport, s.inferred);
      cands.set(k, {
        key: k,
        type: e.type,
        id: e.id,
        tags,
        base,
        pt,
        excluded,
        sports,
        flags: new Set(accessFlags(tags)),
        grouped: [],
        parent: null,
        mergedInto: null,
      });
    }
  }
  stats.uniqueElements = cands.size;

  // 2) container polygons
  const containers: Container[] = [];
  const containersQ = venueQueries.containers;
  if (!containersQ) throw new Error('missing query result containers');
  stats.rawElements.containers = containersQ.response.elements.length;
  for (const e of containersQ.response.elements) {
    if (e.type !== 'way' && e.type !== 'relation') continue;
    const kind = containerKind((e.tags ?? {}) as Tags);
    if (!kind) continue;
    const poly = e.type === 'way' ? polyFromWay(e as OsmWay) : polyFromRelation(e as OsmRelation);
    if (poly && poly.area > 0) containers.push({ key: keyOf(e), kind, poly });
  }
  const sportContainers = containers
    .filter((c) => c.kind !== 'education')
    .sort((a, b) => a.poly.area - b.poly.area);
  const education = containers.filter((c) => c.kind === 'education');

  // 3) school grounds + direct parent (smallest compatible container that is itself a candidate)
  for (const c of cands.values()) {
    if (!c.pt || c.base === 'gym' || c.base === 'route') continue;
    if (education.some((ed) => pointInPoly(c.pt!, ed.poly))) c.flags.add('on_school_grounds');
    for (const ct of sportContainers) {
      if (ct.key === c.key) continue;
      if (ct.kind === 'fitness_area' && c.base !== 'fitness') continue;
      if (!cands.has(ct.key)) continue;
      if (!pointInPoly(c.pt, ct.poly)) continue;
      c.parent = ct.key;
      break; // smallest first
    }
  }
  const rootOf = (c: Candidate): Candidate => {
    let cur = c;
    const seen = new Set<string>();
    while (cur.parent && !seen.has(cur.key)) {
      seen.add(cur.key);
      const p = cands.get(cur.parent);
      if (!p) break;
      cur = p;
    }
    return cur;
  };

  // 4) container-level exclusions propagate to untagged children (e.g. a private club's courts)
  for (const c of cands.values()) {
    if (c.excluded || !c.parent) continue;
    const root = rootOf(c);
    if (root.excluded === 'access' && !c.tags.access) c.excluded = 'access_via_container';
    if (root.flags.has('restricted_access') && !c.tags.access) c.flags.add('restricted_access');
    if (root.flags.has('customers_only') && !c.tags.access) c.flags.add('customers_only');
  }

  // 5) pools without access: keep only with public signals or inside a sports container
  for (const c of cands.values()) {
    if (c.excluded || c.base !== 'pool' || c.tags.access) continue;
    if (!poolLooksPublic(c.tags) && !c.parent) c.excluded = 'pool_probably_private';
  }

  // 6) group children into their (non-excluded) root container
  const childrenOf = new Map<string, Candidate[]>();
  for (const c of cands.values()) {
    if (c.excluded || !c.parent) continue;
    const root = rootOf(c);
    if (root === c || root.excluded) {
      c.parent = null;
      continue;
    }
    if (!childrenOf.has(root.key)) childrenOf.set(root.key, []);
    childrenOf.get(root.key)!.push(c);
  }
  const aggregated = new Map<
    string,
    {
      surface: string | null;
      lit: boolean | null;
      free: boolean | null;
      indoor: boolean | null;
      childName: string | null;
    }
  >();
  for (const [rootKey, kids] of childrenOf) {
    const root = cands.get(rootKey)!;
    for (const k of kids) {
      for (const [s, inferred] of k.sports) {
        const prev = root.sports.get(s);
        root.sports.set(s, prev === undefined ? inferred : prev && inferred);
      }
      for (const f of k.flags) if (f === 'on_school_grounds') root.flags.add(f);
      root.grouped.push(k.key);
      k.mergedInto = root.key;
      stats.groupedIntoContainers++;
    }
    const agree = <T>(vals: (T | null)[]): T | null => {
      const known = vals.filter((v): v is T => v !== null);
      return known.length && known.every((v) => v === known[0]) ? known[0]! : null;
    };
    const lits = kids.map((k) => litOf(k.tags));
    const childNames = [
      ...new Set(kids.map((k) => nameOf(k.tags)).filter((n): n is string => !!n)),
    ];
    aggregated.set(rootKey, {
      surface: agree(kids.map((k) => surfaceClass(k.tags))),
      lit: lits.some((v) => v === true) ? true : agree(lits),
      free: agree(kids.map((k) => freeOf(k.tags))),
      indoor: agree(kids.map((k) => indoorOf(k.base as Base, k.tags))),
      childName: childNames.length === 1 ? childNames[0]! : null,
    });
  }

  // 7) free-standing fitness equipment nodes within 40 m → one place
  const freeFitness = [...cands.values()].filter(
    (c) => !c.excluded && !c.mergedInto && c.base === 'fitness' && c.type === 'node' && c.pt,
  );
  const seen = new Set<string>();
  for (const start of freeFitness.sort((a, b) => a.id - b.id)) {
    if (seen.has(start.key)) continue;
    const cluster: Candidate[] = [];
    const queue = [start];
    seen.add(start.key);
    while (queue.length) {
      const cur = queue.shift()!;
      cluster.push(cur);
      for (const o of freeFitness) {
        if (!seen.has(o.key) && distM(cur.pt!, o.pt!) <= FITNESS_CLUSTER_M) {
          seen.add(o.key);
          queue.push(o);
        }
      }
    }
    if (cluster.length < 2) continue;
    cluster.sort((a, b) => a.id - b.id);
    const rep = cluster[0]!;
    rep.pt = [
      cluster.reduce((s, c) => s + c.pt![0], 0) / cluster.length,
      cluster.reduce((s, c) => s + c.pt![1], 0) / cluster.length,
    ];
    for (const o of cluster.slice(1)) {
      o.mergedInto = rep.key;
      rep.grouped.push(o.key);
      for (const f of o.flags) rep.flags.add(f);
      stats.fitnessClustersMerged++;
    }
    const names = [...new Set(cluster.map((k) => nameOf(k.tags)).filter((n): n is string => !!n))];
    const lits = cluster.map((k) => litOf(k.tags));
    aggregated.set(rep.key, {
      surface: null,
      free: null,
      indoor: null,
      lit: lits.some((v) => v === true) ? true : null,
      childName: names.length === 1 ? names[0]! : null,
    });
  }

  // 8) a pitch node ≤30 m from a pitch way/relation centre with a shared sport = duplicate
  const polyPitches = [...cands.values()].filter(
    (c) => !c.excluded && !c.mergedInto && c.base === 'pitch' && c.type !== 'node' && c.pt,
  );
  for (const n of cands.values()) {
    if (n.excluded || n.mergedInto || n.base !== 'pitch' || n.type !== 'node' || !n.pt) continue;
    const dup = polyPitches.find(
      (p) =>
        distM(n.pt!, p.pt!) <= POINT_POLY_DUP_M &&
        [...n.sports.keys()].some((s) => p.sports.has(s)),
    );
    if (dup) {
      n.mergedInto = dup.key;
      dup.grouped.push(n.key);
      stats.pointPolygonDuplicates++;
    }
  }

  // 9) final rows
  const rows: VenueRow[] = [];
  for (const c of cands.values()) {
    if (c.excluded) {
      inc(stats.excluded, c.excluded);
      continue;
    }
    if (c.mergedInto) continue;
    if (c.sports.size === 0) {
      stats.noMappedSport++;
      continue;
    }
    const t = c.tags;
    const agg = aggregated.get(c.key);
    const base = c.base as Base;
    const hidden = c.flags.has('restricted_access');
    const sports: SportPick[] = [...c.sports]
      .map(([sport, inferred]) => ({ sport, inferred }))
      .sort((a, b) => a.sport.localeCompare(b.sport));
    const osmTags: Record<string, unknown> = { ...t };
    if (c.flags.size) osmTags['bojo:flags'] = [...c.flags].sort();
    if (c.grouped.length) osmTags['bojo:grouped'] = [...c.grouped].sort();
    rows.push({
      id: '', // filled by caller (uuid v5)
      osmType: c.type,
      osmId: c.id,
      name: nameOf(t) ?? agg?.childName ?? null,
      kind: KIND_OF_BASE[base],
      lat: c.pt![1],
      lng: c.pt![0],
      address: addressOf(t),
      surface: surfaceClass(t) ?? agg?.surface ?? null,
      isLit: litOf(t) ?? agg?.lit ?? null,
      isFree: freeOf(t) ?? agg?.free ?? null,
      isIndoor: indoorOf(base, t) ?? agg?.indoor ?? null,
      access: t.access ? t.access.slice(0, 60) : null,
      openingHours: openingHoursOf(t),
      website: websiteOf(t),
      phone: phoneOf(t),
      hidden,
      sports,
      osmTags,
    });
  }
  rows.sort((a, b) =>
    a.osmType === b.osmType ? a.osmId - b.osmId : a.osmType.localeCompare(b.osmType),
  );

  // stats
  stats.rows = rows.length;
  const pct = (n: number) => `${n} (${rows.length ? Math.round((100 * n) / rows.length) : 0}%)`;
  for (const r of rows) {
    inc(stats.byKind, r.kind);
    if (r.hidden) stats.hidden++;
    for (const s of r.sports) {
      inc(stats.bySport, s.sport);
      if (s.inferred) inc(stats.bySportInferredOnly, s.sport);
    }
    for (const f of (r.osmTags['bojo:flags'] as string[] | undefined) ?? []) inc(stats.flags, f);
  }
  stats.tagQuality = {
    name: pct(rows.filter((r) => r.name).length),
    surface: pct(rows.filter((r) => r.surface).length),
    lit_known: pct(rows.filter((r) => r.isLit !== null).length),
    fee_known: pct(rows.filter((r) => r.isFree !== null).length),
    indoor_known: pct(rows.filter((r) => r.isIndoor !== null).length),
    opening_hours: pct(rows.filter((r) => r.openingHours).length),
    address: pct(rows.filter((r) => r.address).length),
    website: pct(rows.filter((r) => r.website).length),
    access_tag: pct(rows.filter((r) => r.access).length),
  };
  return { rows, stats };
}
