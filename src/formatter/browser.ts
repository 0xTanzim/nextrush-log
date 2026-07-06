/**
 * Browser formatter for console output
 * Uses CSS styling for colorful browser console output
 */

import type { LogEntry } from '../types/index.js';
import { BROWSER_COLORS } from '../utils/colors.js';
import { getConsoleMethod } from '../utils/console-method.js';
import { LEVEL_ICONS } from '../utils/level-icons.js';

/**
 * Compact, readable browser output when pretty mode is off (e.g. production JSON still hard to read).
 * One line per log + structured data / errors on follow-up lines.
 */
export function logBrowserCompact(entry: LogEntry): void {
  const levelLabel = entry.level.toUpperCase();
  const line = `[${levelLabel}] [${entry.context}]${entry.correlationId ? ` (${entry.correlationId})` : ''} ${entry.message}`;
  const logFn = getConsoleMethod(entry.level);
  logFn(line);
  if (entry.data && Object.keys(entry.data).length > 0) {
    logFn('data:', entry.data);
  }
  if (entry.error) {
    console.error('error:', entry.error);
  }
  if (entry.performance) {
    console.log('performance:', entry.performance);
  }
}

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

  // Build format string and style arguments.
  // `entry.message` is attacker-controllable — it must NEVER be concatenated
  // into the format string (a message containing %c/%s/%d would shift or
  // corrupt the style args that follow). Instead the format string ends with
  // a plain %s placeholder resolved by the message passed as its own trailing
  // argument, so the browser's own format-specifier parsing can't be hijacked.
  let format = `%c${icon} [${label}] %c[${entry.context}]`;
  const styleArgs: string[] = [levelStyle, contextStyle];

  if (entry.correlationId) {
    format += ` %c(${entry.correlationId})`;
    styleArgs.push(dimStyle);
  }

  format += ' %c%s';
  styleArgs.push(messageStyle);

  // Select appropriate console method
  const consoleMethod = getConsoleMethod(entry.level);

  try {
    // Log the main formatted line — message passed as its own argument, never
    // interpolated into the format string.
    consoleMethod(format, ...styleArgs, entry.message);

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
