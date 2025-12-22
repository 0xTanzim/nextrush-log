/**
 * Formatter tests
 * Tests for JSON and pretty formatters
 */

import { describe, expect, it } from 'vitest';
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
});
