/**
 * ANSI color codes and utilities for terminal output
 */

/** ANSI escape codes for terminal formatting */
export const ANSI = {
  // Reset
  reset: '\x1b[0m',

  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/** No-op colors for when color output is disabled */
export const NO_COLORS: Record<keyof typeof ANSI, string> = Object.fromEntries(
  Object.keys(ANSI).map((key) => [key, '']),
) as Record<keyof typeof ANSI, string>;

/** Get color codes based on whether colors are enabled */
export function getColors(enabled: boolean): typeof ANSI {
  return enabled ? ANSI : (NO_COLORS as typeof ANSI);
}

/** Browser CSS color styles for console */
export const BROWSER_COLORS = {
  trace: 'color: #9e9e9e',
  debug: 'color: #00bcd4',
  info: 'color: #4caf50',
  warn: 'color: #ff9800; font-weight: bold',
  error: 'color: #f44336; font-weight: bold',
  fatal:
    'color: #fff; background: #f44336; font-weight: bold; padding: 2px 6px; border-radius: 2px',
} as const;
