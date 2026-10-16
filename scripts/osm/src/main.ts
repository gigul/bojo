// Entry point: node src/main.ts [--fetch-only] [--offline] [--refresh] [--force]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { endpointsFromEnv, fetchAll } from './fetch-all.ts';

const ROOT = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'));

const log = (m: string) => console.log(m);

const opts = {
  endpoints: endpointsFromEnv(process.env),
  contact: process.env.OVERPASS_CONTACT ?? '',
  cacheDir: join(ROOT, '.cache'),
  maxWaitMs: Number(process.env.OVERPASS_MAX_WAIT_MIN ?? '15') * 60000,
  refresh: args.has('--refresh'),
  offline: args.has('--offline'),
  log,
};

log(`Overpass endpoints: ${opts.endpoints.map((e) => new URL(e).host).join(', ')}`);
const fetched = await fetchAll(opts);
log('Fetch complete.');
if (args.has('--fetch-only')) process.exit(0);
const { build } = await import('./build.ts');
await build(fetched, { root: ROOT, force: args.has('--force'), log });
