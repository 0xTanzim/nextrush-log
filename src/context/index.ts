/**
 * Async context propagation for automatic correlation ID and metadata tracking.
 *
 * Uses AsyncLocalStorage (Node.js/Bun/Deno) when available; falls back to an
 * explicit context stack (`./fallback-stack.js`) on runtimes with no
 * AsyncLocalStorage at all (real browsers, some edge runtimes) — see that module
 * for why a stack, not a single shared value, is required for correctness.
 *
 * @example
 * ```ts
 * import { runWithContext, getAsyncContext } from '@nextrush/log';
 *
 * // In middleware
 * await runWithContext({ correlationId: req.id, userId: req.user.id }, async () => {
 *   // All logs inside automatically get correlationId and userId
 *   await processRequest();
 * });
 * ```
 */

import {
    forceAsyncLocalStorageUnavailableForTesting,
    getAsyncLocalStorage,
} from './async-local-storage.js';
import {
    getFallbackContext,
    resetFallbackContextForTesting,
    runWithFallbackContext,
} from './fallback-stack.js';
import { type AsyncLogContext, mergeContext } from './types.js';
import type { LogContext } from '../types/index.js';

export type { AsyncLogContext } from './types.js';

/**
 * Run a function with async context.
 * Context is automatically available to all loggers within the callback.
 *
 * @example
 * ```ts
 * await runWithContext({ correlationId: 'req-123' }, async () => {
 *   log.info('This log has correlationId automatically');
 *   await someAsyncOperation();
 *   log.info('This one too!');
 * });
 * ```
 */
export function runWithContext<T>(
  context: AsyncLogContext,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  const als = getAsyncLocalStorage();

  if (als) {
    const mergedContext = mergeContext(als.getStore(), context);
    return als.run(mergedContext, callback);
  }

  return runWithFallbackContext(context, callback);
}

/**
 * Get the current async context.
 * Returns undefined if not within a runWithContext call.
 */
export function getAsyncContext(): AsyncLogContext | undefined {
  const als = getAsyncLocalStorage();
  return als ? als.getStore() : getFallbackContext();
}

/** Get the current correlation ID from async context. */
export function getContextCorrelationId(): string | undefined {
  return getAsyncContext()?.correlationId;
}

/** Get the current metadata from async context. */
export function getContextMetadata(): LogContext | undefined {
  return getAsyncContext()?.metadata;
}

/**
 * Check if async context is available.
 * Returns true if AsyncLocalStorage is available (Node.js/Bun/Deno).
 */
export function isAsyncContextAvailable(): boolean {
  return getAsyncLocalStorage() !== null;
}

/**
 * Create a middleware function for Express/Koa-style frameworks.
 * Automatically sets up async context for each request.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createContextMiddleware } from '@nextrush/log';
 *
 * const app = express();
 * app.use(createContextMiddleware((req) => ({
 *   correlationId: req.headers['x-request-id'] || crypto.randomUUID(),
 *   metadata: { userId: req.user?.id }
 * })));
 * ```
 */
export function createContextMiddleware<TReq = unknown>(
  getContext: (req: TReq) => AsyncLogContext,
): (req: TReq, res: unknown, next: () => void) => void {
  return (req: TReq, _res: unknown, next: () => void) => {
    const context = getContext(req);
    void runWithContext(context, () => {
      next();
    });
  };
}

/**
 * Test-only seam: force `isAsyncContextAvailable()` to report AsyncLocalStorage as
 * unavailable, forcing the fallback stack path deterministically on runtimes (like
 * the Node test environment) where real AsyncLocalStorage is always present. Not
 * exported from the package's public entry point.
 */
export function __forceAsyncContextFallbackForTesting(force: boolean): void {
  forceAsyncLocalStorageUnavailableForTesting(force);
}

/**
 * Test-only seam: clear all fallback-path bookkeeping. Not exported from the
 * package's public entry point.
 */
export function __resetAsyncContextFallbackForTesting(): void {
  resetFallbackContextForTesting();
}
