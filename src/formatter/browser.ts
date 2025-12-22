/**
 * Browser formatter for console output
 * Uses CSS styling for colorful browser console output
 */

import type { LogEntry, LogLevel } from '../types/index.js';
import { BROWSER_COLORS } from '../utils/colors.js';

/** Level icons for visual distinction */
const LEVEL_ICONS: Record<LogLevel, string> = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  fatal: '💀',
};

/**
 * Log an entry to the browser console with CSS styling
 */
export function logBrowser(entry: LogEntry): void {
  const levelStyle = BROWSER_COLORS[entry.level];
  const contextStyle = 'color: #2196f3; font-weight: bold';
  const messageStyle = 'color: inherit; font-weight: bold';
  const dimStyle = 'color: #9e9e9e';

  const icon = LEVEL_ICONS[entry.level];
  const label = entry.level.toUpperCase();

  // Build format string and style arguments
  let format = `%c${icon} [${label}] %c[${entry.context}]`;
  const styleArgs: string[] = [levelStyle, contextStyle];

  if (entry.correlationId) {
    format += ` %c(${entry.correlationId})`;
    styleArgs.push(dimStyle);
  }

  format += ` %c${entry.message}`;
  styleArgs.push(messageStyle);

  // Select appropriate console method
  const consoleMethod = getConsoleMethod(entry.level);

  try {
    // Log the main formatted line
    consoleMethod(format, ...styleArgs);

    // Log additional data as expandable objects
    if (entry.data && Object.keys(entry.data).length > 0) {
      console.groupCollapsed('%cData', 'color: #00bcd4; font-weight: normal');
      console.dir(entry.data);
      console.groupEnd();
    }

    // Log error details
    if (entry.error) {
      console.groupCollapsed(
        '%cError Details',
        'color: #f44336; font-weight: normal',
      );
      console.error(entry.error);
      console.groupEnd();
    }

    // Log performance metrics
    if (entry.performance) {
      console.log('%c⏱ Performance:', 'color: #9e9e9e', entry.performance);
    }
  } catch {
    // Fallback if console methods fail
    console.log(
      `[${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`,
    );
  }
}

/**
 * Get the appropriate console method for a log level
 */
function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'trace':
      return console.debug.bind(console);
    case 'debug':
      return console.debug.bind(console);
    case 'info':
      return console.info.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
    case 'fatal':
      return console.error.bind(console);
    default:
      return console.log.bind(console);
  }
}
