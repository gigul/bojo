// @bojo/shared — the typed contract between the DB (supabase/) and the clients.
// Consumed as TypeScript source (no build step), zero runtime dependencies, erasable TS only.
// Relative imports are extensionless (Metro + tsc `bundler` resolution).

// `Database` = generated types + narrowed jsonb RPC outputs (database.ts); use it for createClient<Database>.
export type { Database } from './database';
export type { Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.types';
export { Constants } from './database.types';
export * from './rpc.types';
export * from './enums';
export * from './sports';
export * from './levels';
export * from './availability';
export * from './districts';
export * from './constants';
export * from './errors';
export * from './storage';
export * from './distance';
export * from './scoring';
export * from './notifications';
