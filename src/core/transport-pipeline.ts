/**
 * Transport execution pipeline, extracted from the Logger class (ARCH-1).
 *
 * Runs an entry through a list of transports, isolating each transport's
 * failure from the others and from the caller (SAFE-9: errors are currently
 * swallowed by design — this preserves that documented default — while
 * removing the duplicated global/instance loop bodies).
 */

import type { LogEntry, LogTransport } from '../types/index.js';

function runTransport(entry: LogEntry, transport: LogTransport): void {
  try {
    const result = transport(entry);
    if (result instanceof Promise) {
      result.catch(() => {
        /* Silently ignore — see SAFE-9 in REPORT.md for the documented tradeoff. */
      });
    }
  } catch {
    // Silently ignore transport errors to prevent logging loops.
  }
}

/** Execute an entry through global transports first, then instance transports. */
export function executeTransports(
  entry: LogEntry,
  globalTransports: readonly LogTransport[],
  instanceTransports: readonly LogTransport[],
): void {
  for (const transport of globalTransports) {
    runTransport(entry, transport);
  }
  for (const transport of instanceTransports) {
    runTransport(entry, transport);
  }
}
