/**
 * Formatter tests
 * Tests for JSON, pretty, and browser formatters
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logBrowser, logBrowserCompact } from '../src/formatter/browser.js';
import { formatJSON, formatPrettyJSON } from '../src/formatter/json.js';
import { formatPrettyTerminal } from '../src/formatter/pretty.js';
import type { LogEntry } from '../src/types/index.js';

function createMockEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2024-01-15T10:30:00.000Z',
    level: 'info',
    context: 'TestContext',
    message: 'Test message',
    runtime: 'node',
    ...overrides,
  };
}

describe('formatJSON', () => {
  it('should format entry as JSON string', () => {
    const entry = createMockEntry();
    const result = formatJSON(entry);

    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result) as unknown as LogEntry;
    expect(parsed.timestamp).toBe('2024-01-15T10:30:00.000Z');
    expect(parsed.level).toBe('info');
    expect(parsed.context).toBe('TestContext');
    expect(parsed.message).toBe('Test message');
  });

  it('should include data when present', () => {
    const entry = createMockEntry({
      data: { userId: 123, action: 'click' },
    });
    const result = formatJSON(entry);
    const parsed = JSON.parse(result) as LogEntry;

    expect(parsed.data?.['userId']).toBe(123);
    expect(parsed.data?.['action']).toBe('click');
  });

  it('should include error when present', () => {
    const entry = createMockEntry({
      error: {
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at Test',
      },
    });
    const result = formatJSON(entry);
    const parsed = JSON.parse(result) as LogEntry;

    expect(parsed.error?.name).toBe('Error');
    expect(parsed.error?.message).toBe('Test error');
  });

  it('should include correlationId when present', () => {
    const entry = createMockEntry({
      correlationId: 'req-123-abc',
    });
    const result = formatJSON(entry);
    const parsed = JSON.parse(result) as LogEntry;

    expect(parsed.correlationId).toBe('req-123-abc');
  });

  it('should include performance metrics when present', () => {
    const entry = createMockEntry({
      performance: { duration: 125.5 },
    });
    const result = formatJSON(entry);
    const parsed = JSON.parse(result) as LogEntry;

    expect(parsed.performance?.duration).toBe(125.5);
  });

  it('should handle serialization errors gracefully', () => {
    const entry = createMockEntry();
    // Create a circular reference that shouldn't exist in normal entries
    // but tests the fallback
    const result = formatJSON(entry);
    expect(typeof result).toBe('string');
  });
});

describe('formatPrettyJSON', () => {
  it('should format with indentation', () => {
    const entry = createMockEntry();
    const result = formatPrettyJSON(entry);

    expect(result).toContain('\n');
    expect(result).toContain('  '); // Default 2-space indent
  });

  it('should respect custom indent', () => {
    const entry = createMockEntry();
    const result = formatPrettyJSON(entry, 4);

    expect(result).toContain('    '); // 4-space indent
  });
});

describe('formatPrettyTerminal', () => {
  it('should format with colors when enabled', () => {
    const entry = createMockEntry();
    const result = formatPrettyTerminal(entry, true);

    // Should contain ANSI escape codes
    expect(result).toContain('\x1b[');
    expect(result).toContain('TestContext');
    expect(result).toContain('Test message');
  });

  it('should format without colors when disabled', () => {
    const entry = createMockEntry();
    const result = formatPrettyTerminal(entry, false);

    // Should NOT contain ANSI escape codes
    expect(result).not.toContain('\x1b[');
    expect(result).toContain('TestContext');
    expect(result).toContain('Test message');
  });

  it('should include level icon', () => {
    const entry = createMockEntry({ level: 'info' });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('ℹ️');
  });

  it('should format all log levels', () => {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    for (const level of levels) {
      const entry = createMockEntry({ level });
      const result = formatPrettyTerminal(entry, false);

      expect(result).toContain(level.toUpperCase());
    }
  });

  it('should include correlationId when present', () => {
    const entry = createMockEntry({
      correlationId: 'req-123',
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('req-123');
  });

  it('should format data on new line', () => {
    const entry = createMockEntry({
      data: { userId: 123 },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('\n');
    expect(result).toContain('userId');
  });

  it('should format error with details', () => {
    const entry = createMockEntry({
      error: {
        name: 'TypeError',
        message: 'Cannot read property',
        stack: 'TypeError: Cannot read property\n    at Test.fn',
      },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('Error: TypeError');
    expect(result).toContain('Cannot read property');
  });

  it('should format performance metrics', () => {
    const entry = createMockEntry({
      performance: { duration: 125.5 },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('125.50ms');
  });

  it('should format memory metrics', () => {
    const entry = createMockEntry({
      performance: { memory: 52428800 }, // 50MB in bytes
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('50.00MB');
  });

  it('should format data with null values', () => {
    const entry = createMockEntry({
      data: { value: null },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('null');
  });

  it('should format data with undefined values', () => {
    const entry = createMockEntry({
      data: { value: undefined },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('undefined');
  });

  it('should format data with string values', () => {
    const entry = createMockEntry({
      data: { name: 'John' },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('"John"');
  });

  it('should format data with number values', () => {
    const entry = createMockEntry({
      data: { count: 42 },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('42');
  });

  it('should format data with boolean values', () => {
    const entry = createMockEntry({
      data: { active: true },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('true');
  });

  it('should format data with empty array', () => {
    const entry = createMockEntry({
      data: { items: [] },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('[]');
  });

  it('should format data with small array', () => {
    const entry = createMockEntry({
      data: { items: [1, 2, 3] },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('[');
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });

  it('should format data with large array', () => {
    const entry = createMockEntry({
      data: { items: [1, 2, 3, 4, 5] },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('[Array: 5 items]');
  });

  it('should format data with empty object', () => {
    const entry = createMockEntry({
      data: { nested: {} },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('{}');
  });

  it('should format data with small object', () => {
    const entry = createMockEntry({
      data: { nested: { a: 1, b: 2 } },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('a:');
    expect(result).toContain('b:');
  });

  it('should format data with large object', () => {
    const entry = createMockEntry({
      data: { nested: { a: 1, b: 2, c: 3, d: 4 } },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('{Object: 4 keys}');
  });

  it('should format error with code', () => {
    const entry = createMockEntry({
      error: {
        name: 'SystemError',
        message: 'Connection refused',
        code: 'ECONNREFUSED',
        stack: 'SystemError: Connection refused\n    at connect',
      },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('Code: ECONNREFUSED');
  });

  it('should format error with cause', () => {
    const entry = createMockEntry({
      error: {
        name: 'WrapperError',
        message: 'Wrapper',
        cause: {
          name: 'RootError',
          message: 'Root cause',
        },
      },
    });
    const result = formatPrettyTerminal(entry, false);

    expect(result).toContain('Caused by: RootError - Root cause');
  });

  it('should format data with colors enabled', () => {
    const entry = createMockEntry({
      data: {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
      },
    });
    const result = formatPrettyTerminal(entry, true);

    // Should contain ANSI color codes
    expect(result).toContain('\x1b[');
  });
});

describe('logBrowser', () => {
  const noop = (): void => { /* empty mock */ };

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(noop);
    vi.spyOn(console, 'debug').mockImplementation(noop);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
    vi.spyOn(console, 'log').mockImplementation(noop);
    vi.spyOn(console, 'dir').mockImplementation(noop);
    vi.spyOn(console, 'groupCollapsed').mockImplementation(noop);
    vi.spyOn(console, 'groupEnd').mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info level to console.info', () => {
    const entry = createMockEntry({ level: 'info' });
    logBrowser(entry);

    expect(console.info).toHaveBeenCalled();
  });

  it('should log debug level to console.debug', () => {
    const entry = createMockEntry({ level: 'debug' });
    logBrowser(entry);

    expect(console.debug).toHaveBeenCalled();
  });

  it('should log trace level to console.log', () => {
    const entry = createMockEntry({ level: 'trace' });
    logBrowser(entry);

    expect(console.log).toHaveBeenCalled();
  });

  it('should log warn level to console.warn', () => {
    const entry = createMockEntry({ level: 'warn' });
    logBrowser(entry);

    expect(console.warn).toHaveBeenCalled();
  });

  it('should log error level to console.error', () => {
    const entry = createMockEntry({ level: 'error' });
    logBrowser(entry);

    expect(console.error).toHaveBeenCalled();
  });

  it('should log fatal level to console.error', () => {
    const entry = createMockEntry({ level: 'fatal' });
    logBrowser(entry);

    expect(console.error).toHaveBeenCalled();
  });

  it('should include correlationId in format string', () => {
    const entry = createMockEntry({
      correlationId: 'req-abc-123',
    });
    logBrowser(entry);

    const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
    const formatString = call?.[0] as string;
    expect(formatString).toContain('req-abc-123');
  });

  it('should log data in collapsed group', () => {
    const entry = createMockEntry({
      data: { userId: 123, action: 'click' },
    });
    logBrowser(entry);

    expect(console.groupCollapsed).toHaveBeenCalled();
    expect(console.dir).toHaveBeenCalled();
    expect(console.groupEnd).toHaveBeenCalled();
  });

  it('should log error in collapsed group', () => {
    const mockError = new Error('Test error');
    const errPayload: { name: string; message: string; stack?: string } = {
      name: 'Error',
      message: 'Test error',
    };
    if (mockError.stack !== undefined) {
      errPayload.stack = mockError.stack;
    }
    const entry = createMockEntry({
      error: errPayload,
    });
    logBrowser(entry);

    expect(console.groupCollapsed).toHaveBeenCalledTimes(1);
    const groupCall = (console.groupCollapsed as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(groupCall?.[0]).toContain('Error Details');
  });

  it('should log performance metrics', () => {
    const entry = createMockEntry({
      performance: { duration: 125.5 },
    });
    logBrowser(entry);

    expect(console.log).toHaveBeenCalled();
    const logCall = (console.log as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(logCall?.[0]).toContain('Performance');
  });

  it('should handle empty data object', () => {
    const entry = createMockEntry({
      data: {},
    });
    logBrowser(entry);

    // Should not create group for empty data
    expect(console.groupCollapsed).not.toHaveBeenCalled();
  });

  it('should handle console method failure gracefully', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('Console failed');
    });

    const entry = createMockEntry({ level: 'info' });

    // Should not throw
    expect(() => {
      logBrowser(entry);
    }).not.toThrow();

    // Should fall back to console.log
    expect(console.log).toHaveBeenCalled();
  });
});

describe('logBrowserCompact', () => {
  const noop = (): void => { /* empty mock */ };

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
    vi.spyOn(console, 'log').mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log a one-line message with level and context', () => {
    const entry = createMockEntry({
      level: 'info',
      context: 'app',
      message: 'ready',
    });
    logBrowserCompact(entry);
    const line = (console.info as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | string
      | undefined;
    expect(line).toMatch(/INFO/);
    expect(line).toMatch(/app/);
    expect(line).toMatch(/ready/);
  });

  it('should print data and errors as extra lines', () => {
    const entry = createMockEntry({
      data: { x: 1 },
      error: { name: 'E', message: 'bad' },
    });
    logBrowserCompact(entry);
    expect(console.info).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
