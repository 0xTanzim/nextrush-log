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

export { createBeaconTransport } from './beacon-transport.js';
export type { BeaconTransportOptions } from './beacon-transport.js';
export { isBrowser, isOnline, isServer } from './environment.js';
export { setupErrorCapture } from './error-capture.js';
export type { ErrorCaptureOptions } from './error-capture.js';
export { setupFlushOnUnload } from './lifecycle.js';
export { setupBrowserLogging } from './setup.js';
export type { BrowserSetupOptions } from './setup.js';

// Re-export core for convenience
export { createLogger, Logger } from '../core/index.js';
export type { LogEntry, LoggerOptions, LogLevel, LogTransport } from '../types/index.js';
