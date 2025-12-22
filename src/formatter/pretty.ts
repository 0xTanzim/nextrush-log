/**
 * Pretty formatter for terminal output
 * Provides colorful, human-readable log output
 */

import type { LogEntry, LogLevel, SerializedError } from '../types/index.js';
import { ANSI, getColors } from '../utils/colors.js';
import { formatPrettyTimestamp } from '../utils/time.js';

/** Level-specific colors */
const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: ANSI.gray,
  debug: ANSI.cyan,
  info: ANSI.green,
  warn: ANSI.yellow,
  error: ANSI.red,
  fatal: ANSI.bgRed + ANSI.white,
};

/** Level icons for visual distinction */
const LEVEL_ICONS: Record<LogLevel, string> = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️ ',
  warn: '⚠️ ',
  error: '❌',
  fatal: '💀',
};

/**
 * Pad log level to consistent width
 */
function padLevel(level: LogLevel): string {
  return level.toUpperCase().padEnd(5);
}

/**
 * Format a log entry for terminal output
 */
export function formatPrettyTerminal(entry: LogEntry, useColors: boolean): string {
  const c = getColors(useColors);
  const levelColor = useColors ? LEVEL_COLORS[entry.level] : '';
  const icon = LEVEL_ICONS[entry.level];

  const parts: string[] = [];

  // Timestamp
  parts.push(`${c.gray}${formatPrettyTimestamp(new Date(entry.timestamp))}${c.reset}`);

  // Level with icon
  parts.push(`${levelColor}${c.bold}${icon} [${padLevel(entry.level)}]${c.reset}`);

  // Context
  parts.push(`${c.blue}[${entry.context}]${c.reset}`);

  // Correlation ID
  if (entry.correlationId) {
    parts.push(`${c.dim}(${entry.correlationId})${c.reset}`);
  }

  // Message
  parts.push(`${c.bold}${entry.message}${c.reset}`);

  let output = parts.join(' ');

  // Data
  if (entry.data && Object.keys(entry.data).length > 0) {
    output += '\n' + formatObjectPretty(entry.data, 2, useColors);
  }

  // Error
  if (entry.error) {
    output += '\n' + formatErrorPretty(entry.error, useColors);
  }

  // Performance
  if (entry.performance) {
    output += formatPerformancePretty(entry.performance, useColors);
  }

  return output;
}

/**
 * Format an object with pretty indentation and colors
 */
function formatObjectPretty(
  obj: Record<string, unknown>,
  indent: number,
  useColors: boolean,
): string {
  const c = getColors(useColors);
  const spaces = ' '.repeat(indent);

  return Object.entries(obj)
    .map(([key, value]) => {
      const coloredKey = `${c.cyan}${key}${c.reset}`;
      const coloredValue = formatValuePretty(value, useColors);
      return `${spaces}${coloredKey}: ${coloredValue}`;
    })
    .join('\n');
}

/**
 * Format a single value with colors
 */
function formatValuePretty(value: unknown, useColors: boolean): string {
  const c = getColors(useColors);

  if (value === null) return `${c.gray}null${c.reset}`;
  if (value === undefined) return `${c.gray}undefined${c.reset}`;

  const type = typeof value;

  if (type === 'string') return `${c.yellow}"${String(value)}"${c.reset}`;
  if (type === 'number') return `${c.magenta}${String(value)}${c.reset}`;
  if (type === 'boolean') return `${c.green}${String(value)}${c.reset}`;

  if (Array.isArray(value)) {
    if (value.length === 0) return `${c.dim}[]${c.reset}`;
    if (value.length <= 3) {
      return `[${value.map((v) => formatValuePretty(v, useColors)).join(', ')}]`;
    }
    return `${c.dim}[Array: ${value.length} items]${c.reset}`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${c.dim}{}${c.reset}`;
    if (keys.length <= 2) {
      const pairs = keys.map(
        (k) =>
          `${k}: ${formatValuePretty(obj[k], useColors)}`,
      );
      return `{ ${pairs.join(', ')} }`;
    }
    return `${c.dim}{Object: ${keys.length} keys}${c.reset}`;
  }

  // Primitives are safely stringifiable
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '[Unknown]';
}

/**
 * Format an error with stack trace
 */
function formatErrorPretty(error: SerializedError, useColors: boolean): string {
  const c = getColors(useColors);

  const lines: string[] = [];

  lines.push(`${c.red}${c.bold}Error: ${error.name}${c.reset}`);
  lines.push(`${c.red}  ${error.message}${c.reset}`);

  if (error.code !== undefined) {
    lines.push(`${c.dim}  Code: ${String(error.code)}${c.reset}`);
  }

  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(1, 6);
    lines.push(
      c.gray +
        stackLines.map((line) => '  ' + line.trim()).join('\n') +
        c.reset,
    );
  }

  if (error.cause && typeof error.cause === 'object' && 'name' in error.cause) {
    const cause = error.cause as { name: string; message: string };
    lines.push(`${c.dim}  Caused by: ${cause.name} - ${cause.message}${c.reset}`);
  }

  return lines.join('\n');
}

/**
 * Format performance metrics
 */
function formatPerformancePretty(
  perf: NonNullable<LogEntry['performance']>,
  useColors: boolean,
): string {
  const c = getColors(useColors);

  const parts: string[] = [];

  if (perf.duration !== undefined) {
    parts.push(`${perf.duration.toFixed(2)}ms`);
  }

  if (perf.memory !== undefined) {
    const mb = (perf.memory / 1024 / 1024).toFixed(2);
    parts.push(`💾 ${mb}MB`);
  }

  if (parts.length === 0) return '';

  return `\n${c.dim}⏱  ${parts.join(' | ')}${c.reset}`;
}
