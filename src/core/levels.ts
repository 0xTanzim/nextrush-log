/**
 * Log level definitions and utilities
 */

import type { LogLevel } from '../types/index.js';

/** Numeric priority for each log level (higher = more severe) */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const;

/** All log levels in order of severity */
export const LOG_LEVELS: readonly LogLevel[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;

/**
 * Check if a log level should be output based on minimum level
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Compare two log levels
 * Returns negative if a < b, positive if a > b, zero if equal
 */
export function compareLevels(a: LogLevel, b: LogLevel): number {
  return LOG_LEVEL_PRIORITY[a] - LOG_LEVEL_PRIORITY[b];
}

/**
 * Check if a string is a valid log level
 */
export function isValidLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === 'string' && value in LOG_LEVEL_PRIORITY
  );
}

/**
 * Parse a string to a log level, with fallback
 */
export function parseLogLevel(
  value: string | undefined,
  fallback: LogLevel = 'info',
): LogLevel {
  if (value && isValidLogLevel(value)) {
    return value;
  }
  return fallback;
}
