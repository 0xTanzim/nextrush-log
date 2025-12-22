/**
 * Filtered transport wrapper
 * Wraps a transport to filter entries by log level
 */

import { LOG_LEVEL_PRIORITY } from '../core/levels.js';
import type { LogEntry, LogLevel, LogTransport } from '../types/index.js';

/**
 * Create a filtered transport that only passes entries at or above a minimum level
 *
 * @example
 * ```ts
 * // Only send errors and fatals to error tracking service
 * const errorTransport = createFilteredTransport(
 *   (entry) => sendToErrorTracker(entry),
 *   'error'
 * );
 * ```
 */
export function createFilteredTransport(
  transport: LogTransport,
  minLevel: LogLevel,
): LogTransport {
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];

  return (entry: LogEntry): void | Promise<void> => {
    const entryPriority = LOG_LEVEL_PRIORITY[entry.level];

    if (entryPriority >= minPriority) {
      return transport(entry);
    }
  };
}

/**
 * Create a transport that filters entries by a custom predicate
 *
 * @example
 * ```ts
 * // Only log entries with a specific context
 * const apiTransport = createPredicateTransport(
 *   myTransport,
 *   (entry) => entry.context.startsWith('api:')
 * );
 * ```
 */
export function createPredicateTransport(
  transport: LogTransport,
  predicate: (entry: LogEntry) => boolean,
): LogTransport {
  return (entry: LogEntry): void | Promise<void> => {
    if (predicate(entry)) {
      return transport(entry);
    }
  };
}
