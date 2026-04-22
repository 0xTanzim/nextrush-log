/**
 * Console transport
 * Outputs log entries to the console with appropriate formatting
 */

import { logBrowser, logBrowserCompact } from '../formatter/browser.js';
import { formatJSON } from '../formatter/json.js';
import { formatPrettyTerminal } from '../formatter/pretty.js';
import { getRuntime } from '../runtime/index.js';
import type { LogEntry, LogLevel, LogTransport } from '../types/index.js';

export interface ConsoleTransportOptions {
  /** Enable pretty formatting */
  pretty?: boolean;
  /** Enable colors in terminal */
  colors?: boolean;
}

/**
 * Create a console transport
 */
export function createConsoleTransport(
  options: ConsoleTransportOptions = {},
): LogTransport {
  const runtime = getRuntime();
  const { pretty = false, colors = runtime.supportsColors } = options;

  return (entry: LogEntry): void => {
    outputToConsole(entry, pretty, colors, runtime.isBrowser);
  };
}

/**
 * Output a log entry to the console
 */
export function outputToConsole(
  entry: LogEntry,
  pretty: boolean,
  colors: boolean,
  isBrowser: boolean,
): void {
  if (isBrowser) {
    if (pretty) {
      logBrowser(entry);
      return;
    }
    logBrowserCompact(entry);
    return;
  }

  // Terminal/Server: format appropriately
  const formatted = pretty
    ? formatPrettyTerminal(entry, colors)
    : formatJSON(entry);

  // Select console method based on level
  const logFn = getConsoleMethod(entry.level);
  logFn(formatted);
}

/**
 * Get the appropriate console method for a log level
 */
function getConsoleMethod(level: LogLevel): (message: string) => void {
  switch (level) {
    case 'trace':
      return console.log.bind(console);
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
