/**
 * Batch transport
 * Buffers log entries and flushes them in batches for efficiency
 */

import type {
    BatchTransport,
    BatchTransportOptions,
    LogEntry,
    LogTransport,
} from '../types/index.js';

/** Default batch transport options */
const DEFAULT_OPTIONS: Required<BatchTransportOptions> = {
  batchSize: 10,
  flushInterval: 5000,
  maxRetries: 3,
  onError: () => {
    // Silent by default
  },
};

/** Maximum buffer size to prevent memory leaks under persistent failures */
const MAX_BUFFER_MULTIPLIER = 3;

/**
 * Create a batch transport that buffers entries and flushes them periodically
 *
 * @example
 * ```ts
 * const { transport, flush, destroy } = createBatchTransport(
 *   async (entries) => {
 *     await fetch('/api/logs', {
 *       method: 'POST',
 *       body: JSON.stringify(entries),
 *     });
 *   },
 *   { batchSize: 10, flushInterval: 5000 }
 * );
 *
 * // Add to logger
 * logger.addTransport(transport);
 *
 * // Force flush on shutdown
 * process.on('beforeExit', () => {
 *   flush();
 *   destroy();
 * });
 * ```
 */
export function createBatchTransport(
  flushFn: (entries: LogEntry[]) => Promise<void>,
  options: BatchTransportOptions = {},
): BatchTransport {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { batchSize, flushInterval, maxRetries, onError } = config;

  let buffer: LogEntry[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;
  let flushPromise: Promise<void> | null = null;

  /**
   * Perform the flush operation with retry logic
   */
  const doFlush = async (): Promise<void> => {
    if (buffer.length === 0 || isDestroyed) return;

    const toFlush = buffer;
    buffer = [];

    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await flushFn(toFlush);
        return;
      } catch (error) {
        lastError = error;

        // Exponential backoff for retries
        if (attempt < maxRetries - 1) {
          await sleep(Math.pow(2, attempt) * 100);
        }
      }
    }

    // All retries failed
    onError(lastError, toFlush);

    // Re-add entries to buffer with absolute max size to prevent memory leaks
    const maxBufferSize = batchSize * MAX_BUFFER_MULTIPLIER;
    const entriesToKeep = toFlush.slice(-batchSize);
    buffer = [...entriesToKeep, ...buffer].slice(-maxBufferSize);
  };

  /**
   * Schedule a flush after the interval
   */
  const scheduleFlush = (): void => {
    if (timeoutId || isDestroyed) return;

    timeoutId = setTimeout(() => {
      timeoutId = null;
      flushPromise = doFlush();
    }, flushInterval);
  };

  /**
   * Clear the scheduled flush timer
   */
  const clearScheduledFlush = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  /**
   * The transport function
   */
  const transport: LogTransport = (entry: LogEntry): void => {
    if (isDestroyed) return;

    buffer.push(entry);

    if (buffer.length >= batchSize) {
      clearScheduledFlush();
      flushPromise = doFlush();
    } else {
      scheduleFlush();
    }
  };

  /**
   * Force flush all buffered entries
   */
  const flush = async (): Promise<void> => {
    clearScheduledFlush();

    // Wait for any in-progress flush
    if (flushPromise) {
      await flushPromise;
    }

    // Flush remaining buffer
    await doFlush();
  };

  /**
   * Clean up resources
   */
  const destroy = (): void => {
    isDestroyed = true;
    clearScheduledFlush();
    buffer = [];
  };

  return { transport, flush, destroy };
}

/**
 * Simple sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
