/**
 * Async context propagation for automatic correlation ID and metadata tracking
 *
 * Uses AsyncLocalStorage (Node.js) or fallback for other runtimes to automatically
 * propagate context across async boundaries without manual passing.
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

import type { LogContext } from '../types/index.js';

/** Context data stored in async local storage */
export interface AsyncLogContext {
  correlationId?: string;
  metadata?: LogContext;
}

// Type for AsyncLocalStorage - we check at runtime if available
type AsyncLocalStorageType<T> = {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
  enterWith(store: T): void;
};

/** Singleton AsyncLocalStorage instance (Node.js only) */
let asyncLocalStorage: AsyncLocalStorageType<AsyncLogContext> | null = null;

/** Fallback context for non-Node environments */
let fallbackContext: AsyncLogContext | null = null;

/**
 * Initialize AsyncLocalStorage if available
 * Called lazily on first use
 */
function getAsyncLocalStorage(): AsyncLocalStorageType<AsyncLogContext> | null {
  if (asyncLocalStorage !== null) return asyncLocalStorage;

  try {
    // Dynamic import for Node.js async_hooks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncHooks = require('node:async_hooks');
    if (asyncHooks?.AsyncLocalStorage) {
      asyncLocalStorage = new asyncHooks.AsyncLocalStorage() as AsyncLocalStorageType<AsyncLogContext>;
      return asyncLocalStorage;
    }
  } catch {
    // AsyncLocalStorage not available (browser, edge, etc.)
  }

  return null;
}

/**
 * Run a function with async context
 * Context is automatically available to all loggers within the callback
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
    // Node.js with AsyncLocalStorage
    const existingContext = als.getStore();
    const newCorrelationId = context.correlationId ?? existingContext?.correlationId;
    const mergedContext: AsyncLogContext = {
      metadata: { ...existingContext?.metadata, ...context.metadata },
    };
    if (newCorrelationId !== undefined) {
      mergedContext.correlationId = newCorrelationId;
    }
    return als.run(mergedContext, callback);
  }

  // Fallback for non-Node environments
  const previousContext = fallbackContext;
  const newCorrelationId = context.correlationId ?? previousContext?.correlationId;
  const newFallbackContext: AsyncLogContext = {
    metadata: { ...previousContext?.metadata, ...context.metadata },
  };
  if (newCorrelationId !== undefined) {
    newFallbackContext.correlationId = newCorrelationId;
  }
  fallbackContext = newFallbackContext;

  try {
    const result = callback();
    if (result instanceof Promise) {
      return result.finally(() => {
        fallbackContext = previousContext;
      });
    }
    fallbackContext = previousContext;
    return result;
  } catch (error) {
    fallbackContext = previousContext;
    throw error;
  }
}

/**
 * Get the current async context
 * Returns undefined if not within a runWithContext call
 */
export function getAsyncContext(): AsyncLogContext | undefined {
  const als = getAsyncLocalStorage();

  if (als) {
    return als.getStore();
  }

  return fallbackContext ?? undefined;
}

/**
 * Get the current correlation ID from async context
 */
export function getContextCorrelationId(): string | undefined {
  return getAsyncContext()?.correlationId;
}

/**
 * Get the current metadata from async context
 */
export function getContextMetadata(): LogContext | undefined {
  return getAsyncContext()?.metadata;
}

/**
 * Check if async context is available
 * Returns true if AsyncLocalStorage is available (Node.js)
 */
export function isAsyncContextAvailable(): boolean {
  return getAsyncLocalStorage() !== null;
}

/**
 * Create a middleware function for Express/Koa-style frameworks
 * Automatically sets up async context for each request
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
export function createContextMiddleware<TReq = unknown, TRes = unknown>(
  getContext: (req: TReq) => AsyncLogContext,
): (req: TReq, res: TRes, next: () => void) => void {
  return (req: TReq, _res: TRes, next: () => void) => {
    const context = getContext(req);
    runWithContext(context, () => {
      next();
    });
  };
}
