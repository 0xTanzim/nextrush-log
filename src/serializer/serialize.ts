/**
 * Safe serialization utilities
 * Handles circular references, special types, and depth limits
 */

import type { SerializationOptions } from '../types/index.js';
import { REDACTED_PLACEHOLDER, redactSensitiveValues, shouldRedact } from './redaction.js';

/** Placeholder messages for special cases */
const PLACEHOLDERS = {
  CIRCULAR: '[Circular Reference]',
  MAX_DEPTH: '[Max Depth Reached]',
  UNSERIALIZABLE: '[Unserializable]',
  WEAK_MAP: '[WeakMap]',
  WEAK_SET: '[WeakSet]',
  WEAK_REF: '[WeakRef]',
  PROMISE: '[Promise]',
  GENERATOR: '[Generator]',
  ASYNC_GENERATOR: '[AsyncGenerator]',
} as const;

/**
 * Create default serialization options
 */
export function createSerializationOptions(
  overrides: Partial<SerializationOptions> = {},
): SerializationOptions {
  return {
    maxDepth: 10,
    maxStringLength: 10000,
    maxArrayLength: 100,
    sensitiveKeys: [],
    seen: new WeakSet(),
    depth: 0,
    redact: true,
    ...overrides,
  };
}

/**
 * Safely serialize a value, handling edge cases
 */
export function safeSerialize(
  value: unknown,
  options: SerializationOptions,
): unknown {
  const { maxStringLength } = options;

  // Handle null and undefined
  if (value === null) return null;
  if (value === undefined) return undefined;

  const type = typeof value;

  // Handle primitives
  if (type === 'string') {
    let str = value as string;

    // Apply value-based redaction if enabled
    if (options.redact) {
      str = redactSensitiveValues(str);
    }

    if (str.length > maxStringLength) {
      const truncated = str.length - maxStringLength;
      return `${str.slice(0, maxStringLength)}... [truncated ${truncated} chars]`;
    }
    return str;
  }

  if (type === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) {
      return value === Infinity ? 'Infinity' : '-Infinity';
    }
    return value;
  }

  if (type === 'boolean') return value;
  if (type === 'bigint') return `${String(value)}n`;
  if (type === 'symbol') return (value as symbol).toString();

  if (type === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    const funcName = fn.name || 'anonymous';
    return `[Function: ${funcName}]`;
  }

  // Handle objects
  if (type === 'object') {
    return serializeObject(value as object, options);
  }

  // Fallback for unknown types - primitives should be stringifiable
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '[Unknown Type]';
}

/**
 * Serialize an object value
 */
function serializeObject(
  value: object,
  options: SerializationOptions,
): unknown {
  const {
    maxDepth,
    maxStringLength,
    maxArrayLength,
    sensitiveKeys,
    seen,
    depth,
    redact,
  } = options;

  // Circular reference detection
  if (seen.has(value)) {
    return PLACEHOLDERS.CIRCULAR;
  }

  // Depth limit
  if (depth >= maxDepth) {
    return PLACEHOLDERS.MAX_DEPTH;
  }

  // Track this object
  seen.add(value);

  const nextOptions: SerializationOptions = {
    maxDepth,
    maxStringLength,
    maxArrayLength,
    sensitiveKeys,
    seen,
    depth: depth + 1,
    redact,
  };

  // Handle Error objects - delegate to error serializer
  if (value instanceof Error) {
    return serializeErrorInline(value, nextOptions);
  }

  // Handle Date
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return 'Invalid Date';
    }
    return value.toISOString();
  }

  // Handle RegExp
  if (value instanceof RegExp) {
    return value.toString();
  }

  // Handle URL
  if (typeof URL !== 'undefined' && value instanceof URL) {
    return value.toString();
  }

  // Handle Map
  if (value instanceof Map) {
    return serializeMap(value, nextOptions);
  }

  // Handle Set
  if (value instanceof Set) {
    return serializeSet(value, nextOptions);
  }

  // Handle WeakMap, WeakSet, WeakRef
  if (typeof WeakMap !== 'undefined' && value instanceof WeakMap) {
    return PLACEHOLDERS.WEAK_MAP;
  }
  if (typeof WeakSet !== 'undefined' && value instanceof WeakSet) {
    return PLACEHOLDERS.WEAK_SET;
  }
  if (typeof WeakRef !== 'undefined' && value instanceof WeakRef) {
    return PLACEHOLDERS.WEAK_REF;
  }

  // Handle ArrayBuffer and TypedArrays
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return `[ArrayBuffer: ${value.byteLength} bytes]`;
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    return `[SharedArrayBuffer: ${value.byteLength} bytes]`;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value;
    return `[${view.constructor.name}: ${view.byteLength} bytes]`;
  }

  // Handle Promise
  if (value instanceof Promise) {
    return PLACEHOLDERS.PROMISE;
  }

  // Handle Generator objects
  if (isGenerator(value)) {
    return PLACEHOLDERS.GENERATOR;
  }

  if (isAsyncGenerator(value)) {
    return PLACEHOLDERS.ASYNC_GENERATOR;
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    return serializeArray(value, nextOptions);
  }

  // Handle plain objects (including null prototype objects)
  return serializePlainObject(value, nextOptions);
}

/**
 * Inline error serialization to avoid circular import
 */
function serializeErrorInline(
  error: Error,
  options: SerializationOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
  };

  if (error.stack) {
    result['stack'] = error.stack;
  }

  // Handle cause
  if ('cause' in error && error.cause !== undefined) {
    if (error.cause instanceof Error && options.depth < options.maxDepth) {
      result['cause'] = serializeErrorInline(error.cause, {
        ...options,
        depth: options.depth + 1,
      });
    } else if (error.cause instanceof Error) {
      result['cause'] = `[Error: ${error.cause.name}] ${error.cause.message}`;
    } else {
      result['cause'] = safeSerialize(error.cause, options);
    }
  }

  return result;
}

/**
 * Serialize a Map
 */
function serializeMap(map: Map<unknown, unknown>, options: SerializationOptions): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of map) {
    if (count >= options.maxArrayLength) {
      entries['...'] = `[${map.size - count} more entries]`;
      break;
    }

    const keyStr = typeof key === 'string' ? key : String(safeSerialize(key, options));

    if (options.redact && shouldRedact(keyStr, options.sensitiveKeys)) {
      entries[keyStr] = REDACTED_PLACEHOLDER;
    } else {
      entries[keyStr] = safeSerialize(value, options);
    }

    count++;
  }

  return { __type: 'Map', size: map.size, entries };
}

/**
 * Serialize a Set
 */
function serializeSet(set: Set<unknown>, options: SerializationOptions): Record<string, unknown> {
  const items: unknown[] = [];
  let count = 0;

  for (const item of set) {
    if (count >= options.maxArrayLength) {
      items.push(`[${set.size - count} more items]`);
      break;
    }

    items.push(safeSerialize(item, options));
    count++;
  }

  return { __type: 'Set', size: set.size, items };
}

/**
 * Serialize an Array
 */
function serializeArray(arr: unknown[], options: SerializationOptions): unknown[] {
  const { maxArrayLength } = options;

  if (arr.length > maxArrayLength) {
    const serialized = arr
      .slice(0, maxArrayLength)
      .map((item) => safeSerialize(item, options));
    serialized.push(`[${arr.length - maxArrayLength} more items]`);
    return serialized;
  }

  return arr.map((item) => safeSerialize(item, options));
}

/**
 * Serialize a plain object
 */
function serializePlainObject(
  obj: object,
  options: SerializationOptions,
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  // Get own enumerable keys (handles null prototype objects)
  let keys: string[];
  try {
    keys = Object.keys(obj);
  } catch {
    return { __error: PLACEHOLDERS.UNSERIALIZABLE };
  }

  for (const key of keys) {
    try {
      const value = (obj as Record<string, unknown>)[key];

      if (options.redact && shouldRedact(key, options.sensitiveKeys)) {
        serialized[key] = REDACTED_PLACEHOLDER;
      } else {
        serialized[key] = safeSerialize(value, options);
      }
    } catch {
      serialized[key] = PLACEHOLDERS.UNSERIALIZABLE;
    }
  }

  return serialized;
}

/**
 * Type guard for Generator objects
 */
function isGenerator(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  if (!proto) return false;
  const constructorObj = proto as { constructor?: { name?: string } };
  const constructorName = constructorObj.constructor?.name;
  if (
    constructorName === 'Generator' ||
    constructorName === 'GeneratorFunction'
  ) {
    return true;
  }
  const valueWithMethods = value as { next?: unknown; throw?: unknown };
  return (
    typeof valueWithMethods.next === 'function' &&
    typeof valueWithMethods.throw === 'function'
  );
}

/**
 * Type guard for AsyncGenerator objects
 */
function isAsyncGenerator(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  if (!proto) return false;
  const constructorObj = proto as { constructor?: { name?: string } };
  const constructorName = constructorObj.constructor?.name;
  return (
    constructorName === 'AsyncGenerator' ||
    constructorName === 'AsyncGeneratorFunction'
  );
}
