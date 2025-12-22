/**
 * Logger tests
 * Tests for the core Logger class and factory functions
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    compareLevels,
    createLogger,
    isValidLogLevel,
    LOG_LEVEL_PRIORITY,
    LOG_LEVELS,
    Logger,
    logger,
    parseLogLevel,
    scopedLogger,
    shouldLog,
} from '../src/core/index.js';
import type { LogEntry, LogTransport } from '../src/types/index.js';

const noop = (): void => { /* empty mock */ };

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(noop);
    vi.spyOn(console, 'debug').mockImplementation(noop);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging', () => {
    it('should create a logger with context', () => {
      const log = createLogger('TestContext');
      expect(log.getContext()).toBe('TestContext');
    });

    it('should log info messages', () => {
      const log = createLogger('Test', { pretty: false, silent: false });
      log.info('Hello world');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('Hello world');
      expect(output).toContain('Test');
      expect(output).toContain('info');
    });

    it('should log with structured data', () => {
      const log = createLogger('Test', { pretty: false });
      log.info('User action', { userId: 123, action: 'click' });

      const output = consoleSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.data?.['userId']).toBe(123);
      expect(parsed.data?.['action']).toBe('click');
    });

    it('should log errors with stack trace', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);
      const log = createLogger('Test', { pretty: false });
      const error = new Error('Test error');
      log.error('Something failed', error);

      const output = errorSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.error?.name).toBe('Error');
      expect(parsed.error?.message).toBe('Test error');
      expect(parsed.error?.stack).toBeDefined();
    });
  });

  describe('log levels', () => {
    it('should respect minimum log level', () => {
      const log = createLogger('Test', { minLevel: 'warn', pretty: false });

      log.debug('Debug message');
      log.info('Info message');
      log.warn('Warn message');

      // Only warn and above should be logged
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log all levels when set to trace', () => {
      const log = createLogger('Test', { minLevel: 'trace', pretty: false });

      log.trace('Trace');
      log.debug('Debug');
      log.info('Info');
      log.warn('Warn');
      log.error('Error');
      log.fatal('Fatal');

      expect(console.debug).toHaveBeenCalledTimes(2); // trace and debug
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(2); // error and fatal
    });

    it('should allow runtime level change', () => {
      const log = createLogger('Test', { minLevel: 'error', pretty: false });

      log.info('Should not appear');
      expect(console.info).not.toHaveBeenCalled();

      log.setLevel('info');
      log.info('Should appear');
      expect(console.info).toHaveBeenCalled();
    });

    it('should check if level is enabled', () => {
      const log = createLogger('Test', { minLevel: 'warn' });

      expect(log.isLevelEnabled('debug')).toBe(false);
      expect(log.isLevelEnabled('info')).toBe(false);
      expect(log.isLevelEnabled('warn')).toBe(true);
      expect(log.isLevelEnabled('error')).toBe(true);
    });
  });

  describe('flexible arguments', () => {
    it('should accept just a message', () => {
      const log = createLogger('Test', { pretty: false });
      log.info('Simple message');

      const output = consoleSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.message).toBe('Simple message');
    });

    it('should accept message and data', () => {
      const log = createLogger('Test', { pretty: false });
      log.info('With data', { userId: 'test123' });

      const output = consoleSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.message).toBe('With data');
      expect(parsed.data?.['userId']).toBe('test123');
    });

    it('should accept just an error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);
      const log = createLogger('Test', { pretty: false });
      log.error(new Error('Just an error'));

      const output = errorSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.message).toBe('Just an error');
      expect(parsed.error?.message).toBe('Just an error');
    });

    it('should accept message, data, and error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);
      const log = createLogger('Test', { pretty: false });
      log.error('Failed', { context: 'test' }, new Error('Underlying error'));

      const output = errorSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.message).toBe('Failed');
      expect(parsed.data?.['context']).toBe('test');
      expect(parsed.error?.message).toBe('Underlying error');
    });

    it('should handle multiple objects', () => {
      const log = createLogger('Test', { pretty: false });
      log.info('Multi', { a: 1 }, { b: 2 });

      const output = consoleSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.data?.['a']).toBe(1);
      expect(parsed.data?.['b']).toBe(2);
    });
  });

  describe('child loggers', () => {
    it('should create child logger with extended context', () => {
      const parent = createLogger('Parent');
      const child = parent.child('Child');

      expect(child.getContext()).toBe('Parent:Child');
    });

    it('should inherit parent options', () => {
      const parent = createLogger('Parent', { minLevel: 'warn' });
      const child = parent.child('Child');

      expect(child.isLevelEnabled('info')).toBe(false);
      expect(child.isLevelEnabled('warn')).toBe(true);
    });

    it('should allow option overrides', () => {
      const parent = createLogger('Parent', { minLevel: 'warn' });
      const child = parent.child('Child', { minLevel: 'debug' });

      expect(child.isLevelEnabled('debug')).toBe(true);
    });

    it('should create child with correlation ID', () => {
      const parent = createLogger('Parent');
      const child = parent.withCorrelationId('req-123');

      expect(child.getCorrelationId()).toBe('req-123');
    });

    it('should create child with metadata', () => {
      const parent = createLogger('Parent', { pretty: false });
      const child = parent.withMetadata({ service: 'api' });
      child.info('Test');

      const output = consoleSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.data?.['service']).toBe('api');
    });
  });

  describe('transports', () => {
    it('should call custom transports', () => {
      const transport = vi.fn();
      const log = createLogger('Test', {
        transports: [transport],
        pretty: false,
      });

      log.info('Test message');

      expect(transport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
          context: 'Test',
        }),
      );
    });

    it('should add transport dynamically', () => {
      const transport = vi.fn();
      const log = createLogger('Test', { pretty: false });

      log.addTransport(transport);
      log.info('After adding transport');

      expect(transport).toHaveBeenCalled();
    });

    it('should handle transport errors gracefully', () => {
      const failingTransport: LogTransport = () => {
        throw new Error('Transport failed');
      };
      const log = createLogger('Test', {
        transports: [failingTransport],
        pretty: false,
      });

      // Should not throw
      expect(() => { log.info('Test'); }).not.toThrow();
    });

    it('should handle async transport errors', () => {
      const asyncTransport: LogTransport = () => {
        return Promise.reject(new Error('Async transport failed'));
      };
      const log = createLogger('Test', {
        transports: [asyncTransport],
        pretty: false,
      });

      // Should not throw
      expect(() => { log.info('Test'); }).not.toThrow();
    });
  });

  describe('timing', () => {
    it('should measure elapsed time', async () => {
      const log = createLogger('Test', { minLevel: 'trace', pretty: false });
      const timer = log.time('operation');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThan(40);
      expect(elapsed).toBeLessThan(200);
    });

    it('should log duration on end', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      const log = createLogger('Test', { minLevel: 'debug', pretty: false });
      const timer = log.time('operation');

      await new Promise((resolve) => setTimeout(resolve, 50));
      timer.end('Operation completed');

      expect(debugSpy).toHaveBeenCalled();
      const output = debugSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output) as LogEntry;
      expect(parsed.performance?.duration).toBeGreaterThan(40);
    });

    it('should return duration from end()', async () => {
      const log = createLogger('Test', { minLevel: 'debug', pretty: false });
      const timer = log.time();

      await new Promise((resolve) => setTimeout(resolve, 50));
      const duration = timer.end();

      expect(duration).toBeGreaterThan(40);
    });
  });

  describe('silent mode', () => {
    it('should not output when silent', () => {
      const log = createLogger('Test', { silent: true });
      log.info('Silent message');

      expect(console.info).not.toHaveBeenCalled();
    });

    it('should still call transports when silent', () => {
      const transport = vi.fn().mockImplementation(noop);
      // Note: In silent mode, transports ARE still called
      // This is by design - silent mode only suppresses console output
      const log = createLogger('Test', {
        silent: true,
        transports: [transport],
        minLevel: 'trace',
      });

      log.info('Silent with transport');

      expect(console.info).not.toHaveBeenCalled();
      expect(transport).toHaveBeenCalled();
    });
  });
});

describe('log level utilities', () => {
  describe('LOG_LEVEL_PRIORITY', () => {
    it('should have correct ordering', () => {
      expect(LOG_LEVEL_PRIORITY.trace).toBeLessThan(LOG_LEVEL_PRIORITY.debug);
      expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
      expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
      expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
      expect(LOG_LEVEL_PRIORITY.error).toBeLessThan(LOG_LEVEL_PRIORITY.fatal);
    });
  });

  describe('LOG_LEVELS', () => {
    it('should contain all levels', () => {
      expect(LOG_LEVELS).toContain('trace');
      expect(LOG_LEVELS).toContain('debug');
      expect(LOG_LEVELS).toContain('info');
      expect(LOG_LEVELS).toContain('warn');
      expect(LOG_LEVELS).toContain('error');
      expect(LOG_LEVELS).toContain('fatal');
    });
  });

  describe('shouldLog', () => {
    it('should return true when level >= minLevel', () => {
      expect(shouldLog('error', 'info')).toBe(true);
      expect(shouldLog('warn', 'warn')).toBe(true);
      expect(shouldLog('fatal', 'trace')).toBe(true);
    });

    it('should return false when level < minLevel', () => {
      expect(shouldLog('debug', 'info')).toBe(false);
      expect(shouldLog('info', 'warn')).toBe(false);
      expect(shouldLog('trace', 'error')).toBe(false);
    });
  });

  describe('compareLevels', () => {
    it('should compare levels correctly', () => {
      expect(compareLevels('info', 'debug')).toBeGreaterThan(0);
      expect(compareLevels('debug', 'info')).toBeLessThan(0);
      expect(compareLevels('warn', 'warn')).toBe(0);
    });
  });

  describe('isValidLogLevel', () => {
    it('should validate correct levels', () => {
      expect(isValidLogLevel('trace')).toBe(true);
      expect(isValidLogLevel('debug')).toBe(true);
      expect(isValidLogLevel('info')).toBe(true);
      expect(isValidLogLevel('warn')).toBe(true);
      expect(isValidLogLevel('error')).toBe(true);
      expect(isValidLogLevel('fatal')).toBe(true);
    });

    it('should reject invalid levels', () => {
      expect(isValidLogLevel('invalid')).toBe(false);
      expect(isValidLogLevel('')).toBe(false);
      expect(isValidLogLevel(null)).toBe(false);
      expect(isValidLogLevel(123)).toBe(false);
    });
  });

  describe('parseLogLevel', () => {
    it('should parse valid levels', () => {
      expect(parseLogLevel('debug')).toBe('debug');
      expect(parseLogLevel('warn')).toBe('warn');
    });

    it('should return fallback for invalid levels', () => {
      expect(parseLogLevel('invalid')).toBe('info');
      expect(parseLogLevel(undefined)).toBe('info');
      expect(parseLogLevel('invalid', 'warn')).toBe('warn');
    });
  });
});

describe('factory functions', () => {
  it('createLogger should return Logger instance', () => {
    const log = createLogger('Test');
    expect(log).toBeInstanceOf(Logger);
  });

  it('scopedLogger should be alias for createLogger', () => {
    const log = scopedLogger('Test');
    expect(log).toBeInstanceOf(Logger);
    expect(log.getContext()).toBe('Test');
  });

  it('default logger should exist', () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getContext()).toBe('app');
  });
});
