// Minimal ambient types for the Node built-ins used by the tests, so `tsc --noEmit` passes without
// @types/node (this package has zero dependencies). Only what the tests use.
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): Promise<void>;
}
declare module 'node:assert/strict' {
  interface StrictAssert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
  }
  const assert: StrictAssert;
  export default assert;
}
