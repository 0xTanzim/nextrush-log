/**
 * @nextrush/log - Universal, zero-dependency, production-grade logger
 *
 * A logging library designed for modern JavaScript runtimes:
 * - 🌍 Universal: Works in Node.js, Bun, Deno, Edge runtimes, and browsers
 * - 🎨 Pretty output in development, structured JSON in production
 * - 🔒 Security: Automatic redaction of sensitive data
 * - 🔄 Circular reference handling
 * - 📊 Performance tracking with timing utilities
 * - 🏷️ Correlation IDs for request tracing
 * - 📦 Flexible argument handling
 * - 🎯 Log levels: trace, debug, info, warn, error, fatal
 * - 🔌 Pluggable transports for custom log destinations
 * - ⚡ Zero dependencies, tree-shakeable
 *
 * @example
 * ```ts
 * // Simplest usage - just import and use
 * import { log } from '@nextrush/log';
 * log.info('Hello world');
 * log.error('Something failed', new Error('Oops'));
 *
 * // With context
 * import { createLogger } from '@nextrush/log';
 * const logger = createLogger('MyService');
 * logger.info('Server started', { port: 3000 });
 *
 * // Performance timing
 * const timer = logger.time('api-call');
 * await fetch('/api/data');
 * timer.end('API call completed');
 *
 * // Child loggers with correlation IDs
 * const requestLogger = logger.withCorrelationId('req-123');
 * requestLogger.info('Processing request');
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  BatchTransport,
  BatchTransportOptions,
  ILogger,
  LogContext,
  LogEntry,
  LoggerOptions,
  LogLevel,
  LogTransport,
  PerformanceMetrics,
  RuntimeEnvironment,
  RuntimeInfo,
  SerializedError,
  Timer
} from './types/index.js';

// ============================================================================
// Core Exports
// ============================================================================

export {
  addGlobalTransport,
  clearGlobalTransports,
  compareLevels,
  configure,
  configureFromEnv,
  createLogger,
  disableLogging,
  disableNamespaces,
  enableLogging,
  enableNamespaces,
  getGlobalConfig,
  isNamespaceEnabled,
  isValidLogLevel,
  LOG_LEVEL_PRIORITY,
  LOG_LEVELS,
  Logger,
  logger,
  onConfigChange,
  parseLogLevel,
  resetGlobalConfig,
  scopedLogger,
  setGlobalLevel,
  shouldLog
} from './core/index.js';

export type { GlobalLoggerConfig } from './core/index.js';

// ============================================================================
// Simple Default Export - Easiest DX
// ============================================================================

import { logger as defaultLogger } from './core/index.js';

/**
 * Default logger instance for the simplest usage
 *
 * @example
 * ```ts
 * import { log } from '@nextrush/log';
 *
 * log.info('Hello world');
 * log.error('Failed', new Error('Oops'));
 * log.debug('Debug info', { userId: 123 });
 * ```
 */
export const log = defaultLogger;

// ============================================================================
// Transport Exports
// ============================================================================

export {
  createBatchTransport,
  createConsoleTransport,
  createFilteredTransport, createNamespaceRateLimitedTransport, createPredicateTransport,
  createRateLimitedTransport
} from './transport/index.js';

export type {
  NamespaceRateLimits, RateLimitOptions,
  RateLimitStats
} from './transport/index.js';

// ============================================================================
// Formatter Exports
// ============================================================================

export {
  formatJSON,
  formatPrettyJSON,
  formatPrettyTerminal
} from './formatter/index.js';

// ============================================================================
// Serializer Exports
// ============================================================================

export {
  containsSensitivePattern,
  DEFAULT_SENSITIVE_KEYS,
  isError,
  mergeSensitiveKeys,
  redactSensitiveValues,
  safeSerialize,
  sanitizeContext,
  serializeError,
  shouldRedact
} from './serializer/index.js';

// ============================================================================
// Runtime Exports
// ============================================================================

export {
  detectRuntime,
  getEnvVar,
  getProcessId,
  getRuntime,
  isProductionBuild
} from './runtime/index.js';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  formatPrettyTimestamp,
  formatTimestamp,
  getTime
} from './utils/index.js';

// ============================================================================
// Context Exports (AsyncLocalStorage-based context propagation)
// ============================================================================

export {
  createContextMiddleware,
  getAsyncContext,
  getContextCorrelationId,
  getContextMetadata,
  isAsyncContextAvailable,
  runWithContext
} from './context/index.js';

export type { AsyncLogContext } from './context/index.js';
