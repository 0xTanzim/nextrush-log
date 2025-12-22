/**
 * Transport tests
 * Tests for batch transport, filtered transport, and console transport
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createBatchTransport,
    createConsoleTransport,
    createFilteredTransport,
    createPredicateTransport,
} from '../src/transport/index.js';
import type { LogEntry } from '../src/types/index.js';

function createMockEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    context: 'Test',
    message: 'Test message',
    runtime: 'node',
    ...overrides,
  };
}

describe('createBatchTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch entries and flush on batchSize', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined);
    const { transport, destroy } = createBatchTransport(flushFn, {
      batchSize: 3,
    });

    void transport(createMockEntry({ message: '1' }));
    void transport(createMockEntry({ message: '2' }));

    expect(flushFn).not.toHaveBeenCalled();

    void transport(createMockEntry({ message: '3' }));

    await vi.runAllTimersAsync();
    expect(flushFn).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ message: '1' }),
        expect.objectContaining({ message: '2' }),
        expect.objectContaining({ message: '3' }),
      ]),
    );

    destroy();
  });

  it('should flush on interval', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined);
    const { transport, destroy } = createBatchTransport(flushFn, {
      batchSize: 10,
      flushInterval: 1000,
    });

    void transport(createMockEntry({ message: '1' }));
    void transport(createMockEntry({ message: '2' }));

    expect(flushFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(flushFn).toHaveBeenCalledTimes(1);
    expect(flushFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ message: '1' }),
        expect.objectContaining({ message: '2' }),
      ]),
    );

    destroy();
  });

  it('should allow manual flush', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined);
    const { transport, flush, destroy } = createBatchTransport(flushFn, {
      batchSize: 100,
      flushInterval: 10000,
    });

    void transport(createMockEntry({ message: '1' }));
    void transport(createMockEntry({ message: '2' }));

    await flush();

    expect(flushFn).toHaveBeenCalledTimes(1);
    destroy();
  });

  it('should retry on flush failure', async () => {
    let attempts = 0;
    const flushFn = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Flush failed'));
      }
      return Promise.resolve();
    });

    const { transport, flush, destroy } = createBatchTransport(flushFn, {
      batchSize: 100,
      maxRetries: 3,
    });

    void transport(createMockEntry());

    // Use real timers for this test since retry uses real sleep
    vi.useRealTimers();
    await flush();

    expect(flushFn).toHaveBeenCalledTimes(3);
    destroy();
    vi.useFakeTimers();
  });

  it('should call onError after all retries fail', async () => {
    const onError = vi.fn();
    const flushFn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const { transport, flush, destroy } = createBatchTransport(flushFn, {
      batchSize: 100,
      maxRetries: 2,
      onError,
    });

    void transport(createMockEntry());

    // Use real timers for this test since retry uses real sleep
    vi.useRealTimers();
    await flush();

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Array),
    );
    destroy();
    vi.useFakeTimers();
  });

  it('should clean up on destroy', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined);
    const { transport, destroy } = createBatchTransport(flushFn, {
      batchSize: 100,
      flushInterval: 1000,
    });

    void transport(createMockEntry());
    destroy();

    await vi.advanceTimersByTimeAsync(2000);

    // Should not have flushed after destroy
    expect(flushFn).not.toHaveBeenCalled();
  });

  it('should not accept entries after destroy', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined);
    const { transport, destroy, flush } = createBatchTransport(flushFn, {
      batchSize: 2,
    });

    destroy();
    void transport(createMockEntry());
    void transport(createMockEntry());

    await flush();

    expect(flushFn).not.toHaveBeenCalled();
  });
});

describe('createFilteredTransport', () => {
  it('should filter by minimum level', () => {
    const innerTransport = vi.fn();
    const filtered = createFilteredTransport(innerTransport, 'warn');

    filtered(createMockEntry({ level: 'debug' }));
    filtered(createMockEntry({ level: 'info' }));
    expect(innerTransport).not.toHaveBeenCalled();

    filtered(createMockEntry({ level: 'warn' }));
    expect(innerTransport).toHaveBeenCalledTimes(1);

    filtered(createMockEntry({ level: 'error' }));
    expect(innerTransport).toHaveBeenCalledTimes(2);

    filtered(createMockEntry({ level: 'fatal' }));
    expect(innerTransport).toHaveBeenCalledTimes(3);
  });

  it('should pass all levels when minLevel is trace', () => {
    const innerTransport = vi.fn();
    const filtered = createFilteredTransport(innerTransport, 'trace');

    filtered(createMockEntry({ level: 'trace' }));
    filtered(createMockEntry({ level: 'debug' }));
    filtered(createMockEntry({ level: 'info' }));

    expect(innerTransport).toHaveBeenCalledTimes(3);
  });
});

describe('createPredicateTransport', () => {
  it('should filter by custom predicate', () => {
    const innerTransport = vi.fn();
    const filtered = createPredicateTransport(
      innerTransport,
      (entry) => entry.context.startsWith('api:'),
    );

    filtered(createMockEntry({ context: 'api:users' }));
    expect(innerTransport).toHaveBeenCalledTimes(1);

    filtered(createMockEntry({ context: 'db:query' }));
    expect(innerTransport).toHaveBeenCalledTimes(1);

    filtered(createMockEntry({ context: 'api:orders' }));
    expect(innerTransport).toHaveBeenCalledTimes(2);
  });

  it('should filter by data content', () => {
    const innerTransport = vi.fn();
    const filtered = createPredicateTransport(
      innerTransport,
      (entry) => entry.data?.['important'] === true,
    );

    filtered(createMockEntry({ data: { important: true } }));
    expect(innerTransport).toHaveBeenCalledTimes(1);

    filtered(createMockEntry({ data: { important: false } }));
    expect(innerTransport).toHaveBeenCalledTimes(1);

    filtered(createMockEntry({ data: {} }));
    expect(innerTransport).toHaveBeenCalledTimes(1);
  });
});

describe('createConsoleTransport', () => {
  const noop = (): void => { /* empty mock */ };

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(noop);
    vi.spyOn(console, 'debug').mockImplementation(noop);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output to console', () => {
    const transport = createConsoleTransport({ pretty: false });
    transport(createMockEntry({ level: 'info', message: 'Test' }));

    expect(console.info).toHaveBeenCalled();
  });

  it('should use correct console method for each level', () => {
    const transport = createConsoleTransport({ pretty: false });

    transport(createMockEntry({ level: 'debug' }));
    expect(console.debug).toHaveBeenCalled();

    transport(createMockEntry({ level: 'info' }));
    expect(console.info).toHaveBeenCalled();

    transport(createMockEntry({ level: 'warn' }));
    expect(console.warn).toHaveBeenCalled();

    transport(createMockEntry({ level: 'error' }));
    expect(console.error).toHaveBeenCalled();
  });
});
