/**
 * Timestamp formatting utilities
 */

/**
 * Format a date as ISO 8601 timestamp
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date as readable timestamp (without T and Z)
 */
export function formatPrettyTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Get current timestamp as ISO string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Get high-resolution time if available, falling back to Date.now()
 */
export function getTime(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
