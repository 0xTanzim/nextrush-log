/**
 * Canonical per-level icons, shared by the pretty (terminal) and browser
 * formatters (DEAD-2 — previously duplicated in both files).
 *
 * Terminal rendering note: some emoji (ℹ️, ⚠️) render one column narrower than
 * others in most terminal fonts because they end in a variation selector.
 * `formatter/pretty.ts` compensates with its own trailing-space padding when
 * rendering to a fixed-width terminal; that padding is a terminal-specific
 * presentation concern and is intentionally NOT baked into this shared map,
 * since the browser formatter renders icons as DOM text with no such need.
 */

import type { LogLevel } from '../types/index.js';

export const LEVEL_ICONS: Record<LogLevel, string> = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  fatal: '💀',
};
