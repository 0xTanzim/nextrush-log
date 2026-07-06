/**
 * Flexible log-argument parsing, extracted from the Logger class (ARCH-1).
 *
 * Supports: (message), (error), (data), (message, data), (message, error), etc.
 * Kept as a pure function so it is independently testable and reusable by
 * `testing/index.ts`'s mock logger instead of diverging from production
 * parsing (see REPORT.md DEAD-2).
 */

import type { LogContext } from '../types/index.js';

export interface ParsedLogArgs {
  message: string;
  data: LogContext;
  error: Error | undefined;
}

/** Read an object's own value at `key` without invoking any throwing getter's effect on the caller. */
function readOwnPropertySafely(obj: object, key: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: (obj as Record<string, unknown>)[key] };
  } catch {
    return { ok: false };
  }
}

/**
 * Merge an object arg's own enumerable keys into `data`, tolerating throwing
 * getters (SAFE-4) instead of letting one poisoned property crash the whole
 * log call via `Object.assign`.
 */
function mergeDataSafely(data: LogContext, arg: LogContext): void {
  for (const key of Object.keys(arg)) {
    const read = readOwnPropertySafely(arg, key);
    if (read.ok) {
      data[key] = read.value;
    } else {
      data[key] = '[Unreadable Property]';
    }
  }
}

export function parseLogArgs(args: unknown[]): ParsedLogArgs {
  let message = '';
  const data: LogContext = {};
  let error: Error | undefined;

  for (const arg of args) {
    if (arg instanceof Error) {
      error = arg;
      if (!message) message = arg.message;
    } else if (typeof arg === 'string') {
      message = message ? `${message} ${arg}` : arg;
    } else if (arg !== null && typeof arg === 'object') {
      mergeDataSafely(data, arg as LogContext);
    } else if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
      const argStr = String(arg);
      message = message ? `${message} ${argStr}` : argStr;
    }
  }

  if (!message && Object.keys(data).length > 0) {
    message = 'Log data';
  }
  if (!message && error) {
    message = error.message;
  }
  if (!message) {
    message = 'Empty log';
  }

  return { message, data, error };
}
