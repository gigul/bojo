// Minimal ambient declarations for the Node built-ins this zero-dependency package uses, so that
// `tsc --noEmit` works without @types/node. Only the members actually used are declared.
declare module 'node:crypto' {
  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(): Uint8Array;
    digest(encoding: 'hex' | 'base64'): string;
  }
  export function createHash(algorithm: string): Hash;
}
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}
declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
  export function writeFile(path: string, data: string): Promise<void>;
  export function mkdir(path: string, opts?: { recursive?: boolean }): Promise<string | undefined>;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
}
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): Promise<void>;
}
declare module 'node:assert/strict' {
  interface StrictAssert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    match(value: string, re: RegExp, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
  }
  const assert: StrictAssert;
  export default assert;
}
interface ImportMeta {
  dirname: string;
  filename: string;
}
declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode: number | undefined;
  exit(code?: number): never;
  loadEnvFile(path?: string): void;
};
