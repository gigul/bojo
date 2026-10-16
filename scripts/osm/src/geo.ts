// Small planar geometry helpers (lon/lat degrees; fine at city scale). Zero dependencies.
import type { LatLon, OsmRelation, OsmWay } from './overpass.ts';

export type Pt = [number, number]; // [lon, lat]
export type Ring = Pt[];
export interface Poly {
  outers: Ring[];
  inners: Ring[];
  bbox: [number, number, number, number];
  area: number;
}

const key = (p: Pt) => `${p[0]},${p[1]}`;

export function toPts(g: (LatLon | null)[] | undefined): Pt[] {
  return (g ?? []).filter((x): x is LatLon => !!x).map((x) => [x.lon, x.lat]);
}

/** Joins open way segments end-to-end into closed rings (OSM multipolygon assembly). */
export function assembleRings(segments: Pt[][]): Ring[] {
  const pool = segments.filter((s) => s.length >= 2).map((s) => [...s]);
  const rings: Ring[] = [];
  while (pool.length) {
    let cur = pool.shift()!;
    let guard = 0;
    while (key(cur[0]!) !== key(cur[cur.length - 1]!) && guard++ < 10000) {
      const end = key(cur[cur.length - 1]!);
      const idx = pool.findIndex((s) => key(s[0]!) === end || key(s[s.length - 1]!) === end);
      if (idx < 0) break;
      const seg = pool.splice(idx, 1)[0]!;
      const oriented = key(seg[0]!) === end ? seg : [...seg].reverse();
      cur = cur.concat(oriented.slice(1));
    }
    if (cur.length >= 4 && key(cur[0]!) === key(cur[cur.length - 1]!)) rings.push(cur);
  }
  return rings;
}

export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    a += (r[j]![0] + r[i]![0]) * (r[j]![1] - r[i]![1]);
  return Math.abs(a / 2);
}

export function pointInRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!;
    const [xj, yj] = r[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function bboxOf(rings: Ring[]): [number, number, number, number] {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      a = Math.min(a, x);
      b = Math.min(b, y);
      c = Math.max(c, x);
      d = Math.max(d, y);
    }
  return [a, b, c, d];
}

export function polyFromWay(w: OsmWay): Poly | null {
  const pts = toPts(w.geometry);
  if (pts.length < 4 || key(pts[0]!) !== key(pts[pts.length - 1]!)) return null;
  return { outers: [pts], inners: [], bbox: bboxOf([pts]), area: ringArea(pts) };
}

export function polyFromRelation(r: OsmRelation): Poly | null {
  const outerSegs: Pt[][] = [];
  const innerSegs: Pt[][] = [];
  for (const m of r.members ?? []) {
    if (m.type !== 'way' || !m.geometry) continue;
    (m.role === 'inner' ? innerSegs : outerSegs).push(toPts(m.geometry));
  }
  const outers = assembleRings(outerSegs);
  if (!outers.length) return null;
  const inners = assembleRings(innerSegs);
  const area =
    outers.reduce((s, x) => s + ringArea(x), 0) - inners.reduce((s, x) => s + ringArea(x), 0);
  return { outers, inners, bbox: bboxOf(outers), area };
}

export function pointInPoly(p: Pt, poly: Poly): boolean {
  const [a, b, c, d] = poly.bbox;
  if (p[0] < a || p[0] > c || p[1] < b || p[1] > d) return false;
  if (!poly.outers.some((r) => pointInRing(p, r))) return false;
  return !poly.inners.some((r) => pointInRing(p, r));
}

/** Haversine distance in metres. */
export function distM(a: Pt, b: Pt): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
