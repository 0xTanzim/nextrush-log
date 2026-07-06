/**
 * Canonical console-method resolver.
 *
 * Previously duplicated in `transport/console.ts` and `formatter/browser.ts`
 * with a drifted return signature (`(message: string) => void` vs.
 * `(...args: unknown[]) => void`). Kept here as the single source of truth so
 * both the transport and formatter paths route each level through the same
 * console method (DEAD-2). The variadic signature is required because
 * `formatter/browser.ts` calls the resolved method with a format string plus
 * multiple style/message arguments, while `transport/console.ts` calls it
 * with a single formatted string — both are valid calls against
 * `(...args: unknown[]) => void`.
 */

import type { LogLevel } from '../types/index.js';

/**
 * Resolve the console method appropriate for a log level.
 *
 * `trace` maps to `console.log` (not `console.trace`) so it still appears
 * when a runtime's default console filter hides `debug`. `error` and `fatal`
 * both map to `console.error`.
 */
export function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
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
