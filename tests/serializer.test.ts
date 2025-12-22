/**
 * Serializer tests
 * Tests for safe serialization, redaction, and special type handling
 */

import { describe, expect, it } from 'vitest';
import {
  createSerializationOptions,
  DEFAULT_SENSITIVE_KEYS,
  mergeSensitiveKeys,
  safeSerialize,
  serializeError,
  shouldRedact,
} from '../src/serializer/index.js';

describe('safeSerialize', () => {
  const defaultOptions = createSerializationOptions();

  describe('primitives', () => {
    it('should handle null', () => {
      expect(safeSerialize(null, defaultOptions)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(safeSerialize(undefined, defaultOptions)).toBeUndefined();
    });

    it('should handle strings', () => {
      expect(safeSerialize('hello', defaultOptions)).toBe('hello');
    });

    it('should truncate long strings', () => {
      const options = createSerializationOptions({ maxStringLength: 10 });
      const result = safeSerialize('this is a very long string', options);
      expect(result).toContain('... [truncated');
      expect(result).toContain('chars]');
    });

    it('should handle numbers', () => {
      expect(safeSerialize(42, defaultOptions)).toBe(42);
      expect(safeSerialize(3.14, defaultOptions)).toBe(3.14);
      expect(safeSerialize(-100, defaultOptions)).toBe(-100);
    });

    it('should handle special numbers', () => {
      expect(safeSerialize(NaN, defaultOptions)).toBe('NaN');
      expect(safeSerialize(Infinity, defaultOptions)).toBe('Infinity');
      expect(safeSerialize(-Infinity, defaultOptions)).toBe('-Infinity');
    });

    it('should handle booleans', () => {
      expect(safeSerialize(true, defaultOptions)).toBe(true);
      expect(safeSerialize(false, defaultOptions)).toBe(false);
    });

    it('should handle bigint', () => {
      expect(safeSerialize(BigInt(123), defaultOptions)).toBe('123n');
    });

    it('should handle symbols', () => {
      const sym = Symbol('test');
      expect(safeSerialize(sym, defaultOptions)).toBe('Symbol(test)');
    });

    it('should handle functions', () => {
      function myFunc(): void { /* empty function for test */ }
      expect(safeSerialize(myFunc, defaultOptions)).toBe('[Function: myFunc]');
    });

    it('should handle anonymous functions', () => {
      const anonymousFn: () => void = function() { /* empty */ };
      expect(safeSerialize(anonymousFn, defaultOptions)).toBe(
        '[Function: anonymousFn]',
      );
    });
  });

  describe('objects', () => {
    it('should handle plain objects', () => {
      const obj = { a: 1, b: 'hello' };
      expect(safeSerialize(obj, defaultOptions)).toEqual({ a: 1, b: 'hello' });
    });

    it('should handle nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      expect(safeSerialize(obj, defaultOptions)).toEqual({ a: { b: { c: 1 } } });
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(safeSerialize(date, defaultOptions)).toBe(
        '2024-01-15T10:30:00.000Z',
      );
    });

    it('should handle invalid Date', () => {
      const date = new Date('invalid');
      expect(safeSerialize(date, defaultOptions)).toBe('Invalid Date');
    });

    it('should handle RegExp', () => {
      const regex = /test/gi;
      expect(safeSerialize(regex, defaultOptions)).toBe('/test/gi');
    });

    it('should handle URL', () => {
      const url = new URL('https://example.com/path?query=1');
      expect(safeSerialize(url, defaultOptions)).toBe(
        'https://example.com/path?query=1',
      );
    });
  });

  describe('collections', () => {
    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      expect(safeSerialize(arr, defaultOptions)).toEqual([1, 2, 3]);
    });

    it('should truncate large arrays', () => {
      const options = createSerializationOptions({ maxArrayLength: 3 });
      const arr = [1, 2, 3, 4, 5];
      const result = safeSerialize(arr, options) as unknown[];
      expect(result).toHaveLength(4);
      expect(result[3]).toContain('more items');
    });

    it('should handle Map', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      const result = safeSerialize(map, defaultOptions) as Record<
        string,
        unknown
      >;
      expect(result['__type']).toBe('Map');
      expect(result['entries']).toEqual({ a: 1, b: 2 });
    });

    it('should handle Set', () => {
      const set = new Set([1, 2, 3]);
      const result = safeSerialize(set, defaultOptions) as Record<
        string,
        unknown
      >;
      expect(result['__type']).toBe('Set');
      expect(result['items']).toEqual([1, 2, 3]);
    });

    it('should handle WeakMap', () => {
      const wm = new WeakMap();
      expect(safeSerialize(wm, defaultOptions)).toBe('[WeakMap]');
    });

    it('should handle WeakSet', () => {
      const ws = new WeakSet();
      expect(safeSerialize(ws, defaultOptions)).toBe('[WeakSet]');
    });
  });

  describe('circular references', () => {
    it('should detect and handle circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj['self'] = obj;

      const result = safeSerialize(obj, defaultOptions) as Record<
        string,
        unknown
      >;
      expect(result['a']).toBe(1);
      expect(result['self']).toBe('[Circular Reference]');
    });

    it('should detect circular references in nested objects', () => {
      const obj: Record<string, unknown> = { a: { b: {} } };
      (obj['a'] as Record<string, unknown>)['b'] = obj;

      const result = safeSerialize(obj, defaultOptions) as Record<
        string,
        unknown
      >;
      expect((result['a'] as Record<string, unknown>)['b']).toBe(
        '[Circular Reference]',
      );
    });

    it('should detect circular references in arrays', () => {
      const arr: unknown[] = [1, 2];
      arr.push(arr);

      const result = safeSerialize(arr, defaultOptions) as unknown[];
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe('[Circular Reference]');
    });
  });

  describe('depth limiting', () => {
    it('should respect maxDepth option', () => {
      const options = createSerializationOptions({ maxDepth: 2 });
      const obj = { a: { b: { c: { d: 1 } } } };

      const result = safeSerialize(obj, options) as Record<string, unknown>;
      expect(result['a']).toBeDefined();
      expect((result['a'] as Record<string, unknown>)['b']).toBe('[Max Depth Reached]');
    });
  });

  describe('special types', () => {
    it('should handle ArrayBuffer', () => {
      const buffer = new ArrayBuffer(16);
      expect(safeSerialize(buffer, defaultOptions)).toBe(
        '[ArrayBuffer: 16 bytes]',
      );
    });

    it('should handle TypedArrays', () => {
      const uint8 = new Uint8Array(8);
      expect(safeSerialize(uint8, defaultOptions)).toBe(
        '[Uint8Array: 8 bytes]',
      );
    });

    it('should handle Promise', () => {
      const promise = Promise.resolve(42);
      expect(safeSerialize(promise, defaultOptions)).toBe('[Promise]');
    });
  });
});

describe('serializeError', () => {
  const defaultOptions = createSerializationOptions();

  it('should serialize basic Error', () => {
    const error = new Error('Test error');
    const result = serializeError(error, defaultOptions);

    expect(result.name).toBe('Error');
    expect(result.message).toBe('Test error');
    expect(result.stack).toBeDefined();
  });

  it('should serialize TypeError', () => {
    const error = new TypeError('Type mismatch');
    const result = serializeError(error, defaultOptions);

    expect(result.name).toBe('TypeError');
    expect(result.message).toBe('Type mismatch');
  });

  it('should serialize error with cause', () => {
    const cause = new Error('Root cause');
    const error = new Error('Wrapper error', { cause });
    const result = serializeError(error, defaultOptions);

    expect(result.message).toBe('Wrapper error');
    expect(result.cause).toBeDefined();
    expect((result.cause as Record<string, unknown>)['message']).toBe('Root cause');
  });

  it('should serialize error with custom properties', () => {
    const error = new Error('API Error') as Error & { code: string };
    error.code = 'ERR_API_FAILED';
    const result = serializeError(error, defaultOptions);

    expect(result.code).toBe('ERR_API_FAILED');
  });
});

describe('redaction', () => {
  it('should identify sensitive keys', () => {
    expect(shouldRedact('password', DEFAULT_SENSITIVE_KEYS as string[])).toBe(true);
    expect(shouldRedact('apiKey', DEFAULT_SENSITIVE_KEYS as string[])).toBe(true);
    expect(shouldRedact('authorization', DEFAULT_SENSITIVE_KEYS as string[])).toBe(
      true,
    );
    expect(shouldRedact('username', DEFAULT_SENSITIVE_KEYS as string[])).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(shouldRedact('PASSWORD', DEFAULT_SENSITIVE_KEYS as string[])).toBe(true);
    expect(shouldRedact('ApiKey', DEFAULT_SENSITIVE_KEYS as string[])).toBe(true);
  });

  it('should match partial keys', () => {
    expect(shouldRedact('userPassword', DEFAULT_SENSITIVE_KEYS as string[])).toBe(
      true,
    );
    expect(shouldRedact('my_api_key', DEFAULT_SENSITIVE_KEYS as string[])).toBe(true);
  });

  it('should redact sensitive values in objects', () => {
    const options = createSerializationOptions({
      sensitiveKeys: DEFAULT_SENSITIVE_KEYS as string[],
    });

    const obj = {
      username: 'john',
      password: 'secret123',
      data: { apiKey: 'key123' },
    };

    const result = safeSerialize(obj, options) as Record<string, unknown>;
    expect(result['username']).toBe('john');
    expect(result['password']).toBe('[REDACTED]');
    expect((result['data'] as Record<string, unknown>)['apiKey']).toBe('[REDACTED]');
  });

  it('should merge custom sensitive keys', () => {
    const merged = mergeSensitiveKeys(['customSecret']);
    expect(merged).toContain('password');
    expect(merged).toContain('customSecret');
  });
});
