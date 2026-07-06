/**
 * Quick, opinionated setup combining error capture, beacon transport, and
 * flush-on-unload behind one call.
 */

import { createLogger, type Logger } from '../core/index.js';
import { isProductionBuild } from '../runtime/index.js';
import { createBeaconTransport } from './beacon-transport.js';
import { type ErrorCaptureOptions, setupErrorCapture } from './error-capture.js';
import { isBrowser } from './environment.js';
import { setupFlushOnUnload } from './lifecycle.js';

export interface BrowserSetupOptions extends ErrorCaptureOptions {
  /** Logger context (default: 'app') */
  context?: string;
  /** Flush logs on page unload (default: true) */
  flushOnUnload?: boolean;
  /** Remote endpoint for beacon transport (optional) */
  endpoint?: string;
}

/**
 * Quick setup for browser logging with sensible defaults.
 *
 * @example
 * ```ts
 * import { setupBrowserLogging } from '@nextrush/log/browser';
 *
 * // Simple - just error capture
 * const { logger, cleanup } = setupBrowserLogging();
 *
 * // With remote endpoint
 * const { logger, cleanup } = setupBrowserLogging({ endpoint: '/api/logs' });
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

  const logger = createLogger(context, { pretty: !isProductionBuild() });
  const cleanups: (() => void)[] = [];

  if (captureErrors || captureRejections) {
    const errorOptions: ErrorCaptureOptions = { captureErrors, captureRejections };
    if (onError) {
      errorOptions.onError = onError;
    }
    cleanups.push(setupErrorCapture(logger, errorOptions));
  }

  if (endpoint) {
    const { transport, flush } = createBeaconTransport(endpoint);
    logger.addTransport(transport);

    if (flushOnUnload && isBrowser()) {
      window.addEventListener('pagehide', flush);
      cleanups.push(() => { window.removeEventListener('pagehide', flush); });
    }
  }

  if (flushOnUnload) {
    cleanups.push(setupFlushOnUnload(logger));
  }

  const cleanup = (): void => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  };

  return { logger, cleanup };
}
