import {
  DEFAULT_ENDPOINTS,
  runQuery,
  type FetchedQuery,
  type OverpassOptions,
} from './overpass.ts';
import { DISTRICTS_QUERY, VENUE_QUERIES } from './queries.ts';

export interface FetchAllResult {
  venues: Record<string, FetchedQuery>;
  districts: FetchedQuery;
}

export function endpointsFromEnv(env: Record<string, string | undefined>): string[] {
  const primary = env.OVERPASS_URL?.trim();
  const fallbacks = (env.OVERPASS_FALLBACK_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = [...(primary ? [primary] : []), ...fallbacks, ...DEFAULT_ENDPOINTS];
  return [...new Set(list)];
}

/** Runs the 7 queries strictly sequentially (one request at a time; cache hits cost nothing). */
export async function fetchAll(opts: OverpassOptions): Promise<FetchAllResult> {
  const venues: Record<string, FetchedQuery> = {};
  for (const q of VENUE_QUERIES) {
    venues[q.name] = await runQuery(q.name, q.query, opts, q.requireNonEmpty);
  }
  const districts = await runQuery(
    DISTRICTS_QUERY.name,
    DISTRICTS_QUERY.query,
    opts,
    DISTRICTS_QUERY.requireNonEmpty,
  );
  return { venues, districts };
}
