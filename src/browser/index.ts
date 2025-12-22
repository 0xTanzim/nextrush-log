/**
 * Browser-specific utilities for @nextrush/log
 *
 * NOTE: The main `createLogger` from '@nextrush/log' already works in browsers!
 * This module provides additional browser-specific features:
 * - Global error capture (window.onerror, unhandled rejections)
 * - Beacon transport for reliable delivery on page unload
 * - Environment detection utilities
 *
 * @example
 * ```ts
 * // Main logger works everywhere - browser, Node, edge, etc.
 * import { createLogger } from '@nextrush/log';
 * const log = createLogger('MyApp');
 * log.info('Works in browser!');
 *
 * // For browser-specific features:
 * import { setupErrorCapture } from '@nextrush/log/browser';
 * setupErrorCapture(log); // Captures window.onerror
 * ```
 */

import { createLogger, Logger } from '../core/index.js';
import type { LogEntry, LogTransport } from '../types/index.js';

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if running on server (SSR/RSC)
 */
export function isServer(): boolean {
  return !isBrowser();
}

/**
 * Check if navigator is online
 */
export function isOnline(): boolean {
  return isBrowser() && navigator.onLine;
}

// ============================================================================
// Error Capture
// ============================================================================

export interface ErrorCaptureOptions {
  /** Capture window.onerror events (default: true) */
  captureErrors?: boolean;
  /** Capture unhandled promise rejections (default: true) */
  captureRejections?: boolean;
  /** Custom callback when error is captured */
  onError?: (error: Error, context: Record<string, unknown>) => void;
}

/**
 * Setup global error capture for browser
 * Logs uncaught errors and unhandled promise rejections
 *
 * @example
 * ```ts
 * import { createLogger } from '@nextrush/log';
 * import { setupErrorCapture } from '@nextrush/log/browser';
 *
 * const log = createLogger('MyApp');
 * const cleanup = setupErrorCapture(log);
 *
 * // Later, to remove handlers:
 * cleanup();
 * ```
 */
export function setupErrorCapture(
  logger: Logger,
  options: ErrorCaptureOptions = {},
): () => void {
  if (!isBrowser()) {
    return () => { /* noop on server */ };
  }

  const {
    captureErrors = true,
    captureRejections = true,
    onError,
  } = options;

  const handlers: (() => void)[] = [];

  if (captureErrors) {
    const errorHandler = (event: ErrorEvent): void => {
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Unknown error');

      const context: Record<string, unknown> = {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'uncaught_error',
      };

      logger.error('Uncaught error', context, error);
      onError?.(error, context);
    };

    window.addEventListener('error', errorHandler);
    handlers.push(() => { window.removeEventListener('error', errorHandler); });
  }

  if (captureRejections) {
    const rejectionHandler = (event: PromiseRejectionEvent): void => {
      const reason: unknown = event.reason;
      const error = reason instanceof Error
        ? reason
        : new Error(String(reason ?? 'Unhandled rejection'));

      const context: Record<string, unknown> = {
        type: 'unhandled_rejection',
      };

      logger.error('Unhandled promise rejection', context, error);
      onError?.(error, context);
    };

    window.addEventListener('unhandledrejection', rejectionHandler);
    handlers.push(() => { window.removeEventListener('unhandledrejection', rejectionHandler); });
  }

  return () => {
    for (const cleanup of handlers) {
      cleanup();
    }
  };
}

// ============================================================================
// Beacon Transport (for reliable delivery on page unload)
// ============================================================================

/**
 * Create a transport that uses sendBeacon for reliable delivery
 * Useful for ensuring logs are sent even when page is closing
 *
 * @example
 * ```ts
 * import { createLogger } from '@nextrush/log';
 * import { createBeaconTransport } from '@nextrush/log/browser';
 *
 * const { transport, flush } = createBeaconTransport('/api/logs');
 * const log = createLogger('MyApp');
 * log.addTransport(transport);
 *
 * // Flush on page unload
 * window.addEventListener('pagehide', flush);
 * ```
 */
export function createBeaconTransport(endpoint: string, options: {
  /** Batch size before auto-flush (default: 10) */
  batchSize?: number;
} = {}): {
  transport: LogTransport;
  flush: () => void;
} {
  const { batchSize = 10 } = options;
  let pending: LogEntry[] = [];

  const send = (entries: LogEntry[]): boolean => {
    if (!isBrowser() || entries.length === 0) return false;
    try {
      const blob = new Blob([JSON.stringify(entries)], { type: 'application/json' });
      return navigator.sendBeacon(endpoint, blob);
    } catch {
      return false;
    }
  };

  const transport: LogTransport = (entry: LogEntry) => {
    pending.push(entry);
    if (pending.length >= batchSize) {
      send(pending);
      pending = [];
    }
  };

  const flush = (): void => {
    if (pending.length > 0) {
      send(pending);
      pending = [];
    }
  };

  return { transport, flush };
}

// ============================================================================
// Lifecycle Helpers
// ============================================================================

/**
 * Setup flush on page unload
 * Ensures logs are sent before page closes
 *
 * @example
 * ```ts
 * import { createLogger } from '@nextrush/log';
 * import { setupFlushOnUnload } from '@nextrush/log/browser';
 *
 * const log = createLogger('MyApp');
 * const cleanup = setupFlushOnUnload(log);
 * ```
 */
export function setupFlushOnUnload(logger: Logger): () => void {
  if (!isBrowser()) {
    return () => { /* noop */ };
  }

  const flushHandler = (): void => {
    void logger.flush();
  };

  window.addEventListener('pagehide', flushHandler);
  window.addEventListener('beforeunload', flushHandler);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void logger.flush();
    }
  });

  return () => {
    window.removeEventListener('pagehide', flushHandler);
    window.removeEventListener('beforeunload', flushHandler);
  };
}

// ============================================================================
// Simple Setup (combines common patterns)
// ============================================================================

export interface BrowserSetupOptions extends ErrorCaptureOptions {
  /** Logger context (default: 'app') */
  context?: string;
  /** Flush logs on page unload (default: true) */
  flushOnUnload?: boolean;
  /** Remote endpoint for beacon transport (optional) */
  endpoint?: string;
}

/**
 * Quick setup for browser logging with sensible defaults
 *
 * @example
 * ```ts
 * import { setupBrowserLogging } from '@nextrush/log/browser';
 *
 * // Simple - just error capture
 * const { logger, cleanup } = setupBrowserLogging();
 *
 * // With remote endpoint
 * const { logger, cleanup } = setupBrowserLogging({
 *   endpoint: '/api/logs',
 * });
 *
 * logger.info('Hello from browser!');
 * ```
 */
export function setupBrowserLogging(options: BrowserSetupOptions = {}): {
  logger: Logger;
  cleanup: () => void;
} {
  const {
    context = 'app',
    captureErrors = true,
    captureRejections = true,
    flushOnUnload = true,
    endpoint,
    onError,
  } = options;

  // Detect environment for pretty printing
  let isProd = false;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- process.env may not exist in browser
  if (typeof process !== 'undefined' && process.env) {
    isProd = process.env['NODE_ENV'] === 'production';
  }

  const logger = createLogger(context, { pretty: !isProd });
  const cleanups: (() => void)[] = [];

  // Setup error capture
  if (captureErrors || captureRejections) {
    const errorOptions: ErrorCaptureOptions = {
      captureErrors,
      captureRejections,
    };
    if (onError) {
      errorOptions.onError = onError;
    }
    const cleanup = setupErrorCapture(logger, errorOptions);
    cleanups.push(cleanup);
  }

  // Setup beacon transport if endpoint provided
  if (endpoint) {
    const { transport, flush } = createBeaconTransport(endpoint);
    logger.addTransport(transport);

    if (flushOnUnload && isBrowser()) {
      window.addEventListener('pagehide', flush);
      cleanups.push(() => { window.removeEventListener('pagehide', flush); });
    }
  }

  // Setup flush on unload
  if (flushOnUnload) {
    const cleanup = setupFlushOnUnload(logger);
    cleanups.push(cleanup);
  }

  const cleanup = (): void => {
    for (const fn of cleanups) {
      try { fn(); } catch { /* ignore */ }
    }
  };

  return { logger, cleanup };
}

// ============================================================================
// Re-export core for convenience
// ============================================================================

export { createLogger, Logger } from '../core/index.js';
export type { LogEntry, LoggerOptions, LogLevel, LogTransport } from '../types/index.js';
