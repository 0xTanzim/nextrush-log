/**
 * Page-lifecycle helpers — flushing logs before the page unloads.
 */

import type { Logger } from '../core/index.js';
import { isBrowser } from './environment.js';

/**
 * Setup flush on page unload. Ensures logs are sent before the page closes.
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
