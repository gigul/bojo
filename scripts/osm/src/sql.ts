// SQL literal helpers + deterministic UUID v5 (RFC 4122, SHA-1) via node:crypto.
import { createHash } from 'node:crypto';

/** ARCHITECTURE §10: uuidv5('osm/<type>/<id>', '5f8f2a3c-7d1e-4b6a-9c2d-0e4f6a8b1c3d'). */
export const OSM_UUID_NAMESPACE = '5f8f2a3c-7d1e-4b6a-9c2d-0e4f6a8b1c3d';

export function uuidv5(name: string, namespace: string): string {
  const ns = namespace.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(ns)) throw new Error(`bad namespace uuid ${namespace}`);
  const nsBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) nsBytes[i] = parseInt(ns.slice(i * 2, i * 2 + 2), 16);
  const nameBytes = new TextEncoder().encode(name);
  const buf = new Uint8Array(16 + nameBytes.length);
  buf.set(nsBytes, 0);
  buf.set(nameBytes, 16);
  const h = createHash('sha1').update(buf).digest();
  const b = h.slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x50; // version 5
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function osmVenueId(type: string, id: number): string {
  return uuidv5(`osm/${type}/${id}`, OSM_UUID_NAMESPACE);
}

/** Standard-conforming SQL string literal (or NULL). Strips NUL and other C0 controls except tab/newline. */
export function lit(v: string | null | undefined): string {
  if (v == null) return 'null';
  // eslint-disable-next-line no-control-regex
  const clean = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  return `'${clean.replace(/'/g, "''")}'`;
}

export function bool(v: boolean | null | undefined): string {
  return v == null ? 'null' : v ? 'true' : 'false';
}

export function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`non-finite number ${v}`);
  return String(v);
}

export function coord(v: number): string {
  return v.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}
