// Overpass API client: endpoint fallback, /status slot check, backoff, Retry-After, partial-result
// detection, staleness check, on-disk cache. Rules: docs/OSM_IMPORT.md "Эндпоинты и заголовки".
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const USER_AGENT_BASE = 'bojo-osm-import/0.1 (dev)';

export const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

export interface OsmElementBase {
  type: 'node' | 'way' | 'relation' | 'area';
  id: number;
  tags?: Record<string, string>;
}
export interface LatLon {
  lat: number;
  lon: number;
}
export interface OsmNode extends OsmElementBase {
  type: 'node';
  lat: number;
  lon: number;
}
export interface OsmWay extends OsmElementBase {
  type: 'way';
  center?: LatLon;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: (LatLon | null)[];
  nodes?: number[];
}
export interface OsmRelationMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: (LatLon | null)[];
  lat?: number;
  lon?: number;
}
export interface OsmRelation extends OsmElementBase {
  type: 'relation';
  center?: LatLon;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  members?: OsmRelationMember[];
}
export interface OsmArea extends OsmElementBase {
  type: 'area';
}
export type OsmElement = OsmNode | OsmWay | OsmRelation | OsmArea;

export interface OverpassResponse {
  version?: number;
  generator?: string;
  osm3s?: { timestamp_osm_base?: string; timestamp_areas_base?: string; copyright?: string };
  remark?: string;
  elements: OsmElement[];
}

export interface FetchedQuery {
  name: string;
  query: string;
  queryHash: string;
  endpoint: string;
  fetchedAt: string;
  response: OverpassResponse;
  fromCache: boolean;
}

export interface OverpassOptions {
  endpoints: string[];
  contact: string;
  cacheDir: string;
  maxWaitMs: number;
  refresh: boolean;
  offline: boolean;
  /** Validation hook: return an error message to treat a 200 response as a failure. */
  log: (msg: string) => void;
}

export function userAgent(contact: string): string {
  const c = contact.trim();
  return c ? `bojo-osm-import/0.1 (dev; ${c})` : USER_AGENT_BASE;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let lastRequestAt = 0;
const MIN_GAP_MS = 5000; // etiquette: one request at a time, 5 s pause between requests

function statusUrl(endpoint: string): string {
  return endpoint.replace(/\/interpreter\/?$/, '/status');
}

/** Reads /api/status and waits for a free slot (bounded). Mirrors without /status are skipped. */
async function waitForSlot(
  endpoint: string,
  ua: string,
  log: (m: string) => void,
  deadline: number,
): Promise<void> {
  for (let i = 0; i < 6; i++) {
    let text: string;
    try {
      const r = await fetch(statusUrl(endpoint), {
        headers: { 'User-Agent': ua },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return; // mirror does not expose /status
      text = await r.text();
    } catch {
      return;
    }
    if (/(\d+) slots? available now/.test(text) && !/^0 slots/m.test(text)) return;
    if (!/Slot available after/i.test(text)) return;
    const times = [...text.matchAll(/Slot available after: (\S+), in (\d+) seconds/g)].map((m) =>
      Number(m[2]),
    );
    const wait = Math.min(Math.max(...(times.length ? times : [10])), 120) * 1000 + 1000;
    if (Date.now() + wait > deadline) return;
    log(`  ${new URL(endpoint).host}: no free slot, waiting ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
}

export class OverpassError extends Error {}

function validate(name: string, resp: OverpassResponse, requireNonEmpty: boolean): string | null {
  if (!resp || !Array.isArray(resp.elements)) return 'response has no elements array';
  if (resp.remark && /runtime error|timed out|out of memory/i.test(resp.remark)) {
    return `partial result (remark: ${resp.remark.slice(0, 160)})`;
  }
  const ts = resp.osm3s?.timestamp_osm_base;
  if (!ts) return 'missing osm3s.timestamp_osm_base';
  const ageDays = (Date.now() - Date.parse(ts)) / 86400000;
  if (!(ageDays <= 14))
    return `stale data: timestamp_osm_base ${ts} is ${ageDays.toFixed(1)} days old`;
  if (requireNonEmpty && resp.elements.length === 0)
    return `empty result for ${name} (mirror without Warsaw area?)`;
  return null;
}

export async function runQuery(
  name: string,
  query: string,
  opts: OverpassOptions,
  requireNonEmpty = true,
): Promise<FetchedQuery> {
  const queryHash = sha256(query);
  const cacheFile = join(opts.cacheDir, `${name}-${queryHash.slice(0, 12)}.json`);
  if (!opts.refresh && existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as FetchedQuery;
    opts.log(
      `  ${name}: cache hit (${cached.response.elements.length} elements, fetched ${cached.fetchedAt} from ${cached.endpoint})`,
    );
    return { ...cached, fromCache: true };
  }
  if (opts.offline) throw new OverpassError(`${name}: --offline and no cache file ${cacheFile}`);

  const ua = userAgent(opts.contact);
  const deadline = Date.now() + opts.maxWaitMs;
  const errors: string[] = [];
  let round = 0;
  while (true) {
    for (const endpoint of opts.endpoints) {
      const host = new URL(endpoint).host;
      const gap = lastRequestAt + MIN_GAP_MS - Date.now();
      if (gap > 0) await sleep(gap);
      await waitForSlot(endpoint, ua, opts.log, deadline);
      lastRequestAt = Date.now();
      const t0 = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': ua,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(240000),
        });
        lastRequestAt = Date.now();
        if (res.status === 429) {
          const ra = Number(res.headers.get('retry-after') ?? '30');
          const wait = Math.min(Number.isFinite(ra) ? ra : 30, 120) * 1000;
          errors.push(`${host}: 429 (retry-after ${wait / 1000}s)`);
          opts.log(`  ${name}: ${host} → 429, waiting ${wait / 1000} s`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) {
          const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 160);
          errors.push(`${host}: HTTP ${res.status} ${body}`);
          opts.log(`  ${name}: ${host} → HTTP ${res.status}`);
          continue;
        }
        const text = await res.text();
        let json: OverpassResponse;
        try {
          json = JSON.parse(text) as OverpassResponse;
        } catch {
          errors.push(`${host}: non-JSON body ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
          opts.log(`  ${name}: ${host} → non-JSON response`);
          continue;
        }
        const problem = validate(name, json, requireNonEmpty);
        if (problem) {
          errors.push(`${host}: ${problem}`);
          opts.log(`  ${name}: ${host} → rejected: ${problem}`);
          continue;
        }
        const fetched: FetchedQuery = {
          name,
          query,
          queryHash,
          endpoint,
          fetchedAt: new Date().toISOString(),
          response: json,
          fromCache: false,
        };
        await mkdir(opts.cacheDir, { recursive: true });
        await writeFile(cacheFile, JSON.stringify(fetched));
        opts.log(
          `  ${name}: ${host} → ${json.elements.length} elements in ${((Date.now() - t0) / 1000).toFixed(1)} s ` +
            `(osm_base ${json.osm3s?.timestamp_osm_base})`,
        );
        return fetched;
      } catch (e) {
        lastRequestAt = Date.now();
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        errors.push(`${host}: ${msg}`);
        opts.log(`  ${name}: ${host} → ${msg}`);
      }
    }
    round++;
    const backoff = Math.min(30000 * 2 ** (round - 1), 240000);
    if (Date.now() + backoff > deadline) {
      throw new OverpassError(
        `${name}: all endpoints failed after ${round} round(s):\n    ${errors.slice(-12).join('\n    ')}`,
      );
    }
    opts.log(`  ${name}: all endpoints failed (round ${round}); backing off ${backoff / 1000} s`);
    await sleep(backoff);
  }
}
