/**
 * Testing utilities for @nextrush/log
 *
 * Provides mock loggers and assertions for testing code that uses logging.
 *
 * @example
 * ```ts
 * import { createMockLogger, expectLogged } from '@nextrush/log/testing';
 *
 * const mockLog = createMockLogger();
 * myFunction(mockLog);
 *
 * expectLogged(mockLog, 'info', 'Expected message');
 * expect(mockLog.calls.error).toHaveLength(0);
 * ```
 */

import type { ILogger, LogContext, LogLevel, LogTransport, Timer } from '../types/index.js';

/** Recorded log call */
export interface LogCall {
  level: LogLevel;
  args: unknown[];
  message: string;
  data?: LogContext;
  error?: Error;
  timestamp: Date;
}

/** Mock logger with call tracking */
export interface MockLogger extends ILogger {
  /** All recorded log calls */
  calls: {
    all: LogCall[];
    trace: LogCall[];
    debug: LogCall[];
    info: LogCall[];
    warn: LogCall[];
    error: LogCall[];
    fatal: LogCall[];
  };
  /** Clear all recorded calls */
  clear(): void;
  /** Get last call at a specific level */
  lastCall(level?: LogLevel): LogCall | undefined;
  /** Check if a message was logged */
  wasLogged(level: LogLevel, message: string | RegExp): boolean;
  /** Assert that a message was logged (throws if not) */
  assertLogged(level: LogLevel, message: string | RegExp): void;
}

/**
 * Create a mock logger for testing
 * Records all log calls for assertion
 *
 * @example
 * ```ts
 * const mockLog = createMockLogger();
 *
 * // Use in code
 * myService.doSomething(mockLog);
 *
 * // Assert
 * expect(mockLog.calls.info).toHaveLength(1);
 * expect(mockLog.wasLogged('info', 'Operation completed')).toBe(true);
 * ```
 */
export function createMockLogger(context = 'mock'): MockLogger {
  const calls: MockLogger['calls'] = {
    all: [],
    trace: [],
    debug: [],
    info: [],
    warn: [],
    error: [],
    fatal: [],
  };

  function parseArgs(args: unknown[]): { message: string; data?: LogContext; error?: Error } {
    let message = '';
    let data: LogContext | undefined;
    let error: Error | undefined;

    for (const arg of args) {
      if (arg instanceof Error) {
        error = arg;
        if (!message) message = arg.message;
      } else if (typeof arg === 'string') {
        message = message ? `${message} ${arg}` : arg;
      } else if (arg !== null && typeof arg === 'object') {
        data = { ...data, ...(arg as LogContext) };
      }
    }

    const result: { message: string; data?: LogContext; error?: Error } = {
      message: message || 'Empty log',
    };
    if (data !== undefined) {
      result.data = data;
    }
    if (error !== undefined) {
      result.error = error;
    }
    return result;
  }

  function recordCall(level: LogLevel, args: unknown[]): void {
    const parsed = parseArgs(args);
    const call: LogCall = {
      level,
      args,
      message: parsed.message,
      timestamp: new Date(),
    };
    if (parsed.data !== undefined) {
      call.data = parsed.data;
    }
    if (parsed.error !== undefined) {
      call.error = parsed.error;
    }
    calls.all.push(call);
    calls[level].push(call);
  }

  const mockTimer: Timer = {
    elapsed: () => 0,
    end: () => 0,
  };

  const mockLogger: MockLogger = {
    calls,

    trace(...args: unknown[]) {
      recordCall('trace', args);
    },
    debug(...args: unknown[]) {
      recordCall('debug', args);
    },
    info(...args: unknown[]) {
      recordCall('info', args);
    },
    warn(...args: unknown[]) {
      recordCall('warn', args);
    },
    error(...args: unknown[]) {
      recordCall('error', args);
    },
    fatal(...args: unknown[]) {
      recordCall('fatal', args);
    },

    time() {
      return mockTimer;
    },

    child(additionalContext: string) {
      return createMockLogger(`${context}:${additionalContext}`);
    },

    withCorrelationId() {
      return this;
    },

    withMetadata() {
      return this;
    },

    addTransport() {
      // no-op
    },

    getContext() {
      return context;
    },

    getCorrelationId() {
      return undefined;
    },

    isLevelEnabled() {
      return true;
    },

    setLevel() {
      // no-op
    },

    async flush() {
      // no-op
    },

    dispose() {
      // no-op
    },

    clear() {
      calls.all.length = 0;
      calls.trace.length = 0;
      calls.debug.length = 0;
      calls.info.length = 0;
      calls.warn.length = 0;
      calls.error.length = 0;
      calls.fatal.length = 0;
    },

    lastCall(level?: LogLevel) {
      if (level) {
        return calls[level][calls[level].length - 1];
      }
      return calls.all[calls.all.length - 1];
    },

    wasLogged(level: LogLevel, message: string | RegExp) {
      return calls[level].some(call => {
        if (typeof message === 'string') {
          return call.message.includes(message);
        }
        return message.test(call.message);
      });
    },

    assertLogged(level: LogLevel, message: string | RegExp) {
      if (!this.wasLogged(level, message)) {
        const pattern = message instanceof RegExp ? message.toString() : `"${message}"`;
        throw new Error(
          `Expected ${level} log matching ${pattern}, but it was not logged.\n` +
          `Actual ${level} logs: ${JSON.stringify(calls[level].map(c => c.message))}`
        );
      }
    },
  };

  return mockLogger;
}

/**
 * Assert that a message was logged at the specified level
 * Convenience function for use with Jest/Vitest
 *
 * @example
 * ```ts
 * const mockLog = createMockLogger();
 * myFunction(mockLog);
 * expectLogged(mockLog, 'info', 'Operation completed');
 * ```
 */
export function expectLogged(
  logger: MockLogger,
  level: LogLevel,
  message: string | RegExp,
): void {
  logger.assertLogged(level, message);
}

/**
 * Assert that no errors were logged
 *
 * @example
 * ```ts
 * const mockLog = createMockLogger();
 * myFunction(mockLog);
 * expectNoErrors(mockLog);
 * ```
 */
export function expectNoErrors(logger: MockLogger): void {
  if (logger.calls.error.length > 0 || logger.calls.fatal.length > 0) {
    const errors = [...logger.calls.error, ...logger.calls.fatal];
    throw new Error(
      `Expected no error logs, but found ${errors.length}:\n` +
      errors.map(e => `  - ${e.level}: ${e.message}`).join('\n')
    );
  }
}

/**
 * Create a transport that records entries for testing
 *
 * @example
 * ```ts
 * const { transport, entries, clear } = createRecordingTransport();
 * log.addTransport(transport);
 *
 * myFunction();
 *
 * expect(entries).toHaveLength(1);
 * expect(entries[0].message).toBe('Expected');
 * ```
 */
export function createRecordingTransport(): {
  transport: LogTransport;
  entries: import('../types/index.js').LogEntry[];
  clear: () => void;
} {
  const entries: import('../types/index.js').LogEntry[] = [];

  const transport: LogTransport = (entry) => {
    entries.push(entry);
  };

  const clear = () => {
    entries.length = 0;
  };

  return { transport, entries, clear };
}
