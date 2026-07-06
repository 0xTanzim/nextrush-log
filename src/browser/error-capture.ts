/**
 * Global browser error capture (window.onerror, unhandled promise rejections).
 */

import type { Logger } from '../core/index.js';
import { isBrowser } from './environment.js';

export interface ErrorCaptureOptions {
  /** Capture window.onerror events (default: true) */
  captureErrors?: boolean;
  /** Capture unhandled promise rejections (default: true) */
  captureRejections?: boolean;
  /** Custom callback when error is captured */
  onError?: (error: Error, context: Record<string, unknown>) => void;
}

/**
 * Setup global error capture for browser.
 * Logs uncaught errors and unhandled promise rejections.
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
export function setupErrorCapture(logger: Logger, options: ErrorCaptureOptions = {}): () => void {
  if (!isBrowser()) {
    return () => { /* noop on server */ };
  }

  const { captureErrors = true, captureRejections = true, onError } = options;
  const handlers: (() => void)[] = [];

  if (captureErrors) {
    const errorHandler = (event: ErrorEvent): void => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown error');

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
      const error = reason instanceof Error ? reason : new Error(String(reason ?? 'Unhandled rejection'));

      const context: Record<string, unknown> = { type: 'unhandled_rejection' };

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
