/**
 * Factory functions for creating loggers
 */

import type { LoggerOptions } from '../types/index.js';
import { Logger } from './logger.js';

/**
 * Create a new logger instance
 *
 * @example
 * ```ts
 * // Basic usage
 * const logger = createLogger('MyComponent');
 * logger.info('Hello world');
 * logger.debug({ userId: 123, action: 'click' });
 * logger.error('Failed to fetch', new Error('Network error'));
 *
 * // With options
 * const logger = createLogger('API', {
 *   correlationId: requestId,
 *   metadata: { service: 'user-service' },
 * });
 * ```
 */
export function createLogger(context: string, options?: LoggerOptions): Logger {
  return new Logger(context, options);
}

/**
 * Create a scoped logger for a module/feature
 * Alias for createLogger with clearer intent
 *
 * @example
 * ```ts
 * const log = scopedLogger('booking');
 * log.info('Booking created', { bookingId: '123' });
 * ```
 */
export function scopedLogger(scope: string, options?: LoggerOptions): Logger {
  return createLogger(scope, options);
}

/**
 * Default global logger instance
 * Use this for quick logging without creating a logger instance
 *
 * @example
 * ```ts
 * import { logger } from '@nextrush/log';
 * logger.info('Application started');
 * ```
 */
export const logger = createLogger('app');
