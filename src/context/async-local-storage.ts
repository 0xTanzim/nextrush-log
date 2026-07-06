/**
 * Loads Node's AsyncLocalStorage when available, and nothing else.
 *
 * Uses `createRequire(import.meta.url)` rather than a bare `require(...)` call: in
 * real ESM, `require` is not defined at module scope, so a bare `require` throws
 * unconditionally and every ESM-Node process silently fell back to the (unsafe)
 * global-context path even though `node:async_hooks` was genuinely available.
 * `createRequire` resolves and loads the builtin synchronously in both real ESM and
 * tsup's CJS build output (where `import.meta.url` is shimmed), and still
 * throws/fails on runtimes that have neither (browsers, some edge runtimes) —
 * which is the correct signal for the caller to fall back.
 */

import type { AsyncLogContext } from './types.js';

/** Minimal AsyncLocalStorage surface this module depends on. */
export interface AsyncLocalStorageType<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
  enterWith(store: T): void;
}

let asyncLocalStorage: AsyncLocalStorageType<AsyncLogContext> | null = null;
let alsLoadAttempted = false;

/**
 * Test-only override: when `true`, always report ALS as unavailable, forcing the
 * fallback stack path regardless of the real runtime. Used by tests to exercise
 * the fallback path deterministically on Node, where real AsyncLocalStorage is
 * always available. Not part of the package's public API.
 */
let forcedFallbackForTesting = false;

function createNodeRequire(): NodeJS.Require {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRequire } = require('node:module') as typeof import('node:module');
  return createRequire(import.meta.url);
}

function loadAsyncLocalStorage(): AsyncLocalStorageType<AsyncLogContext> | null {
  try {
    const nodeRequire = createNodeRequire();
    const asyncHooks = nodeRequire('node:async_hooks') as {
      AsyncLocalStorage: new () => AsyncLocalStorageType<AsyncLogContext>;
    };
    return new asyncHooks.AsyncLocalStorage();
  } catch {
    // AsyncLocalStorage genuinely unavailable (browser, edge runtime without
    // Node compat, etc.) — caller falls back to the context stack.
    return null;
  }
}

/** Returns the (lazily-loaded, cached) AsyncLocalStorage instance, or `null` if unavailable. */
export function getAsyncLocalStorage(): AsyncLocalStorageType<AsyncLogContext> | null {
  if (forcedFallbackForTesting) return null;
  if (asyncLocalStorage !== null) return asyncLocalStorage;
  if (alsLoadAttempted) return null;

  alsLoadAttempted = true;
  asyncLocalStorage = loadAsyncLocalStorage();
  return asyncLocalStorage;
}

/** Test-only seam — see `forcedFallbackForTesting` above. */
export function forceAsyncLocalStorageUnavailableForTesting(force: boolean): void {
  forcedFallbackForTesting = force;
}
