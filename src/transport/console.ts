/**
 * Console transport
 * Outputs log entries to the console with appropriate formatting
 */

import { logBrowser, logBrowserCompact } from '../formatter/browser.js';
import { formatJSON } from '../formatter/json.js';
import { formatPrettyTerminal } from '../formatter/pretty.js';
import { getRuntime } from '../runtime/index.js';
import type { LogEntry, LogTransport } from '../types/index.js';
import { getConsoleMethod } from '../utils/console-method.js';

export interface ConsoleTransportOptions {
  /** Enable pretty formatting */
  pretty?: boolean;
  /** Enable colors in terminal */
  colors?: boolean;
}

/**
 * Create a console transport.
 *
 * @remarks
 * **Do NOT add this as a transport on a `Logger` instance** — the `Logger`
 * already calls {@link outputToConsole} unconditionally for every log call
 * (gated only by its `silent` option). Calling
 * `logger.addTransport(createConsoleTransport())` will print every line
 * TWICE (once from the logger's built-in console output, once from this
 * transport). See API-6 in REPORT.md.
 *
 * This factory exists only for advanced/manual use: building a custom
 * logging pipeline that does NOT go through the default `Logger` console
 * path (e.g. composing it directly with {@link createFilteredTransport} or
 * {@link createRateLimitedTransport} outside of a `Logger` instance). The
 * root cause (the `Logger`'s unconditional console call) is out of scope for
 * this fix; removing this export from the public barrel, if ever done, is a
 * decision for a later API-cleanup wave.
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
