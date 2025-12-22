/**
 * JSON formatter for production environments
 * Outputs structured JSON log entries
 */

import type { LogEntry } from '../types/index.js';

/**
 * Format a log entry as JSON string
 * Handles serialization errors gracefully
 */
export function formatJSON(entry: LogEntry): string {
  try {
    return JSON.stringify(entry);
  } catch {
    // Fallback for edge cases where serialization fails
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      context: entry.context,
      message: entry.message,
      error: '[Serialization Error]',
      runtime: entry.runtime,
    });
  }
}

/**
 * Format a log entry as pretty-printed JSON
 * Useful for debugging while still maintaining JSON structure
 */
export function formatPrettyJSON(entry: LogEntry, indent = 2): string {
  try {
    return JSON.stringify(entry, null, indent);
  } catch {
    return JSON.stringify(
      {
        timestamp: entry.timestamp,
        level: entry.level,
        context: entry.context,
        message: entry.message,
        error: '[Serialization Error]',
        runtime: entry.runtime,
      },
      null,
      indent,
    );
  }
}
