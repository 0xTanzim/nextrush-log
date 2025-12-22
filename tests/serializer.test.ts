/**
 * Serializer tests
 * Tests for safe serialization, redaction, and special type handling
 */

import { describe, expect, it } from 'vitest';
import {
    createSerializationOptions,
    DEFAULT_SENSITIVE_KEYS,
    isError,
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

  it('should serialize error with code property', () => {
    const error = new Error('Connection failed') as Error & {
      code: string;
      errno: number;
      syscall: string;
      hostname: string;
      path: string;
    };
    error.code = 'ECONNREFUSED';
    error.errno = -111;
    error.syscall = 'connect';
    error.hostname = 'localhost';
    error.path = '/tmp/socket';

    const result = serializeError(error, defaultOptions);

    expect(result.code).toBe('ECONNREFUSED');
    expect(result['errno']).toBe(-111);
    expect(result['syscall']).toBe('connect');
    expect(result['hostname']).toBe('localhost');
    expect(result['path']).toBe('/tmp/socket');
  });

  it('should serialize error without stack', () => {
    const error = new Error('No stack');
    delete error.stack;

    const result = serializeError(error, defaultOptions);

    expect(result.name).toBe('Error');
    expect(result.message).toBe('No stack');
    expect(result.stack).toBeUndefined();
  });

  it('should handle error with non-Error cause', () => {
    const error = new Error('Wrapper', { cause: 'string cause' });
    const result = serializeError(error, defaultOptions);

    expect(result.cause).toBe('string cause');
  });

  it('should handle deeply nested error causes', () => {
    const options = createSerializationOptions({ maxDepth: 3 });

    const root = new Error('Root');
    const level1 = new Error('Level 1', { cause: root });
    const level2 = new Error('Level 2', { cause: level1 });
    const level3 = new Error('Level 3', { cause: level2 });
    const level4 = new Error('Level 4', { cause: level3 });

    const result = serializeError(level4, options);

    expect(result.message).toBe('Level 4');
    expect(result.cause).toBeDefined();
    const cause = result.cause as Record<string, unknown>;
    expect(cause['message']).toBe('Level 3');
  });

  it('should serialize AggregateError', () => {
    const errors = [
      new Error('Error 1'),
      new Error('Error 2'),
      new TypeError('Type error'),
    ];
    const aggError = new AggregateError(errors, 'Multiple errors');

    const result = serializeError(aggError, defaultOptions);

    expect(result.name).toBe('AggregateError');
    expect(result.message).toBe('Multiple errors');
    expect(Array.isArray(result['errors'])).toBe(true);
    expect((result['errors'] as unknown[]).length).toBe(3);
  });

  it('should truncate AggregateError with more than 10 errors', () => {
    const errors = Array.from({ length: 15 }, (_, i) => new Error(`Error ${i}`));
    const aggError = new AggregateError(errors, 'Many errors');

    const result = serializeError(aggError, defaultOptions);

    const serializedErrors = result['errors'] as unknown[];
    expect(serializedErrors.length).toBe(11); // 10 + 1 truncation message
    expect(serializedErrors[10]).toBe('[5 more errors]');
  });

  it('should handle error without name', () => {
    const error = new Error('No name');
    Object.defineProperty(error, 'name', { value: '' });

    const result = serializeError(error, defaultOptions);

    expect(result.name).toBe('Error'); // Falls back to 'Error'
  });

  it('should handle error without message', () => {
    const error = new Error();
    Object.defineProperty(error, 'message', { value: '' });

    const result = serializeError(error, defaultOptions);

    expect(result.message).toBe('Unknown error'); // Falls back
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

describe('isError', () => {
  it('should return true for Error instances', () => {
    expect(isError(new Error('test'))).toBe(true);
    expect(isError(new TypeError('test'))).toBe(true);
    expect(isError(new RangeError('test'))).toBe(true);
    expect(isError(new SyntaxError('test'))).toBe(true);
  });

  it('should return true for error-like objects', () => {
    const errorLike = {
      name: 'CustomError',
      message: 'Something went wrong',
      stack: 'Error: Something went wrong\n    at Test',
    };
    expect(isError(errorLike)).toBe(true);
  });

  it('should return true for error-like objects without stack', () => {
    const errorLike = {
      name: 'CustomError',
      message: 'Something went wrong',
    };
    expect(isError(errorLike)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isError(undefined)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isError('error')).toBe(false);
    expect(isError(123)).toBe(false);
    expect(isError(true)).toBe(false);
  });

  it('should return false for regular objects', () => {
    expect(isError({ foo: 'bar' })).toBe(false);
    expect(isError({ name: 'NotAnError' })).toBe(false);
    expect(isError({ message: 'Just a message' })).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isError([])).toBe(false);
    expect(isError(['error'])).toBe(false);
  });

  it('should return false for functions', () => {
    expect(isError(() => { /* empty */ })).toBe(false);
  });
});
