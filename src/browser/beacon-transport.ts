/**
 * Beacon transport — reliable log delivery on page unload via navigator.sendBeacon.
 */

import type { LogEntry, LogTransport } from '../types/index.js';
import { isBrowser } from './environment.js';

export interface BeaconTransportOptions {
  /** Batch size before auto-flush (default: 10) */
  batchSize?: number;
}

/**
 * Create a transport that uses sendBeacon for reliable delivery.
 * Useful for ensuring logs are sent even when the page is closing.
 *
 * @example
 * ```ts
 * import { createLogger } from '@nextrush/log';
 * import { createBeaconTransport } from '@nextrush/log/browser';
 *
 * const { transport, flush } = createBeaconTransport('/api/logs');
 * const log = createLogger('MyApp');
 * log.addTransport(transport);
 *
 * // Flush on page unload
 * window.addEventListener('pagehide', flush);
 * ```
 */
export function createBeaconTransport(
  endpoint: string,
  options: BeaconTransportOptions = {},
): { transport: LogTransport; flush: () => void } {
  const { batchSize = 10 } = options;
  let pending: LogEntry[] = [];

  const send = (entries: LogEntry[]): boolean => {
    if (!isBrowser() || entries.length === 0) return false;
    try {
      const blob = new Blob([JSON.stringify(entries)], { type: 'application/json' });
      return navigator.sendBeacon(endpoint, blob);
    } catch {
      return false;
    }
  };

  const transport: LogTransport = (entry: LogEntry) => {
    pending.push(entry);
    if (pending.length >= batchSize) {
      send(pending);
      pending = [];
    }
  };

  const flush = (): void => {
    if (pending.length > 0) {
      send(pending);
      pending = [];
    }
  };

  return { transport, flush };
}
