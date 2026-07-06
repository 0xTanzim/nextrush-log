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
 * This is the MINIMAL public surface (see REPORT.md API-1..4): internal
 * plumbing (serialization/redaction/runtime/formatting helpers), redundant
 * logger-acquisition aliases, and overlapping config/transport variants
 * have been removed. Everything here is something an application actually
 * needs to import.
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

export type { AsyncLogContext } from './context/index.js';
export type { GlobalLoggerConfig, Logger } from './core/index.js';
export type { NamespaceRateLimits, RateLimitOptions, RateLimitStats } from './transport/index.js';

import { createLogger } from './core/index.js';
export { addGlobalTransport, configure, createLogger, disableLogging } from './core/index.js';

/**
 * Default logger instance for the simplest usage.
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
export const log = createLogger('app');

export { createBatchTransport, createFilteredTransport, createRateLimitedTransport } from './transport/index.js';

// AsyncLocalStorage-based context propagation, with a safe fallback where ALS is unavailable.
export { createContextMiddleware, getAsyncContext, runWithContext } from './context/index.js';
