/**
 * Rate limiting transport wrapper
 *
 * Prevents log flooding by limiting the number of logs per time window.
 * Uses token bucket algorithm for smooth rate limiting with burst allowance.
 *
 * @example
 * ```ts
 * import { createRateLimitedTransport } from '@nextrush/log';
 *
 * const { transport, getStats } = createRateLimitedTransport(myTransport, {
 *   maxLogsPerSecond: 100,
 *   burstAllowance: 50,
 * });
 *
 * logger.addTransport(transport);
 * ```
 */

import type { LogEntry, LogLevel, LogTransport } from '../types/index.js';

/** Rate limiter configuration */
export interface RateLimitOptions {
  /** Maximum logs per second (default: 100) */
  maxLogsPerSecond?: number;
  /** Extra logs allowed for bursts (default: 50) */
  burstAllowance?: number;
  /** Callback when logs are dropped */
  onDrop?: (entry: LogEntry, stats: RateLimitStats) => void;
  /** Log levels that bypass rate limiting (default: ['error', 'fatal']) */
  bypassLevels?: LogLevel[];
}

/** Rate limiting statistics */
export interface RateLimitStats {
  /** Total logs processed */
  totalProcessed: number;
  /** Total logs dropped due to rate limiting */
  totalDropped: number;
  /** Current token count */
  currentTokens: number;
  /** Maximum tokens */
  maxTokens: number;
}

/**
 * Create a rate-limited transport wrapper
 * Uses token bucket algorithm for smooth rate limiting
 *
 * @example
 * ```ts
 * const { transport, getStats, reset } = createRateLimitedTransport(
 *   originalTransport,
 *   { maxLogsPerSecond: 100, burstAllowance: 50 }
 * );
 *
 * logger.addTransport(transport);
 *
 * // Check stats periodically
 * setInterval(() => {
 *   const stats = getStats();
 *   if (stats.totalDropped > 0) {
 *     console.warn(`Dropped ${stats.totalDropped} logs due to rate limiting`);
 *   }
 * }, 60000);
 * ```
 */
export function createRateLimitedTransport(
  innerTransport: LogTransport,
  options: RateLimitOptions = {},
): {
  transport: LogTransport;
  getStats: () => RateLimitStats;
  reset: () => void;
} {
  const {
    maxLogsPerSecond = 100,
    burstAllowance = 50,
    onDrop,
    bypassLevels = ['error', 'fatal'],
  } = options;

  const maxTokens = maxLogsPerSecond + burstAllowance;
  const refillRate = maxLogsPerSecond / 1000; // tokens per ms

  let tokens = maxTokens;
  let lastRefill = Date.now();
  let totalProcessed = 0;
  let totalDropped = 0;

  function refillTokens(): void {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = elapsed * refillRate;
    tokens = Math.min(maxTokens, tokens + newTokens);
    lastRefill = now;
  }

  function getStats(): RateLimitStats {
    return {
      totalProcessed,
      totalDropped,
      currentTokens: Math.floor(tokens),
      maxTokens,
    };
  }

  function reset(): void {
    tokens = maxTokens;
    lastRefill = Date.now();
    totalProcessed = 0;
    totalDropped = 0;
  }

  const transport: LogTransport = (entry: LogEntry) => {
    // Bypass rate limiting for critical levels
    if (bypassLevels.includes(entry.level)) {
      totalProcessed++;
      return innerTransport(entry);
    }

    refillTokens();

    if (tokens >= 1) {
      tokens -= 1;
      totalProcessed++;
      return innerTransport(entry);
    }

    // Rate limited - drop the log
    totalDropped++;
    onDrop?.(entry, getStats());
  };

  return { transport, getStats, reset };
}

/** Per-namespace rate limit configuration */
export interface NamespaceRateLimits {
  [namespace: string]: {
    maxLogsPerSecond: number;
    burstAllowance?: number;
  };
}

/**
 * Create a transport with per-namespace rate limiting
 *
 * @example
 * ```ts
 * const transport = createNamespaceRateLimitedTransport(myTransport, {
 *   'api:*': { maxLogsPerSecond: 100 },
 *   'db:*': { maxLogsPerSecond: 50 },
 *   '*': { maxLogsPerSecond: 200 }, // default
 * });
 * ```
 */
export function createNamespaceRateLimitedTransport(
  innerTransport: LogTransport,
  limits: NamespaceRateLimits,
): LogTransport {
  const limiters = new Map<string, ReturnType<typeof createRateLimitedTransport>>();

  function matchNamespace(context: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === context) return true;

    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(context);
  }

  function getLimiter(context: string): ReturnType<typeof createRateLimitedTransport> | null {
    // Check cache
    const cached = limiters.get(context);
    if (cached) return cached;

    // Find matching pattern
    for (const pattern of Object.keys(limits)) {
      if (matchNamespace(context, pattern)) {
        const config = limits[pattern];
        if (!config) continue;
        const options: RateLimitOptions = {
          maxLogsPerSecond: config.maxLogsPerSecond,
        };
        if (config.burstAllowance !== undefined) {
          options.burstAllowance = config.burstAllowance;
        }
        const limiter = createRateLimitedTransport(innerTransport, options);
        limiters.set(context, limiter);
        return limiter;
      }
    }

    return null;
  }

  return (entry: LogEntry) => {
    const limiter = getLimiter(entry.context);
    if (limiter) {
      return limiter.transport(entry);
    }
    // No rate limit configured - pass through
    return innerTransport(entry);
  };
}
