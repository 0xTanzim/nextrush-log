/** Shared context types for the async-context module. */

import type { LogContext } from '../types/index.js';

/** Context data stored in async local storage. */
export interface AsyncLogContext {
  correlationId?: string;
  metadata?: LogContext;
}

/**
 * Merge a new context into an existing one: correlationId is inherited unless
 * explicitly overridden, metadata is shallow-merged (new keys win).
 */
export function mergeContext(
  previous: AsyncLogContext | undefined,
  next: AsyncLogContext,
): AsyncLogContext {
  const correlationId = next.correlationId ?? previous?.correlationId;
  const merged: AsyncLogContext = {
    metadata: { ...previous?.metadata, ...next.metadata },
  };
  if (correlationId !== undefined) {
    merged.correlationId = correlationId;
  }
  return merged;
}
