/**
 * Safe serialization utilities
 * Handles circular references, special types, and depth limits
 */

import type { SerializationOptions } from '../types/index.js';
import {
  isAsyncGenerator,
  isGenerator,
  serializeArray,
  serializeMap,
  serializePlainObject,
  serializeSet,
} from './collections.js';
import { serializeError } from './error.js';
import { redactSensitiveValues } from './redaction.js';

/** Placeholder messages for special cases */
const PLACEHOLDERS = {
  CIRCULAR: '[Circular Reference]',
  MAX_DEPTH: '[Max Depth Reached]',
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
    maxKeys: 100,
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
  const { maxDepth, seen, depth } = options;

  // Circular reference detection
  if (seen.has(value)) {
    return PLACEHOLDERS.CIRCULAR;
  }

  // Depth limit
  if (depth >= maxDepth) {
    return PLACEHOLDERS.MAX_DEPTH;
  }

  // Track this object for the duration of its own subtree only (ancestry-
  // scoped, not global) — removed in the `finally` below once every branch
  // that may recurse into `value`'s children has finished, so a merely
  // repeated (non-circular) reference isn't mistaken for a true cycle.
  seen.add(value);

  try {
    return serializeKnownObjectType(value, nextOptionsFor(options));
  } finally {
    seen.delete(value);
  }
}

/**
 * Build the options passed one level deeper into an object's subtree.
 */
function nextOptionsFor(options: SerializationOptions): SerializationOptions {
  return {
    maxDepth: options.maxDepth,
    maxStringLength: options.maxStringLength,
    maxArrayLength: options.maxArrayLength,
    maxKeys: options.maxKeys,
    sensitiveKeys: options.sensitiveKeys,
    seen: options.seen,
    depth: options.depth + 1,
    redact: options.redact,
  };
}

/**
 * Ordered [predicate, serializer] handler table for known object types.
 * Iterated once in order — first matching predicate wins — replacing a long
 * sequential instanceof-ladder (QUAL-1) with a data-driven dispatch that's
 * easier to extend and lowers cyclomatic complexity.
 */
const OBJECT_TYPE_HANDLERS: readonly (readonly [
  predicate: (value: object) => boolean,
  serialize: (value: object, options: SerializationOptions) => unknown,
])[] = [
  [(v) => v instanceof Error, (v, o) => serializeError(v as Error, o)],
  [
    (v) => v instanceof Date,
    (v) => {
      const date = v as Date;
      return Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString();
    },
  ],
  [(v) => v instanceof RegExp, (v) => (v as RegExp).toString()],
  [
    (v) => typeof URL !== 'undefined' && v instanceof URL,
    (v) => (v as URL).toString(),
  ],
  [(v) => v instanceof Map, (v, o) => serializeMap(v as Map<unknown, unknown>, o)],
  [(v) => v instanceof Set, (v, o) => serializeSet(v as Set<unknown>, o)],
  [
    (v) => typeof WeakMap !== 'undefined' && v instanceof WeakMap,
    () => PLACEHOLDERS.WEAK_MAP,
  ],
  [
    (v) => typeof WeakSet !== 'undefined' && v instanceof WeakSet,
    () => PLACEHOLDERS.WEAK_SET,
  ],
  [
    (v) => typeof WeakRef !== 'undefined' && v instanceof WeakRef,
    () => PLACEHOLDERS.WEAK_REF,
  ],
  [
    (v) => typeof ArrayBuffer !== 'undefined' && v instanceof ArrayBuffer,
    (v) => `[ArrayBuffer: ${(v as ArrayBuffer).byteLength} bytes]`,
  ],
  [
    (v) =>
      typeof SharedArrayBuffer !== 'undefined' && v instanceof SharedArrayBuffer,
    (v) => `[SharedArrayBuffer: ${(v as SharedArrayBuffer).byteLength} bytes]`,
  ],
  [
    (v) => ArrayBuffer.isView(v),
    (v) => {
      const view = v as ArrayBufferView;
      return `[${view.constructor.name}: ${view.byteLength} bytes]`;
    },
  ],
  [(v) => v instanceof Promise, () => PLACEHOLDERS.PROMISE],
  [(v) => isGenerator(v), () => PLACEHOLDERS.GENERATOR],
  [(v) => isAsyncGenerator(v), () => PLACEHOLDERS.ASYNC_GENERATOR],
  [
    (v) => Array.isArray(v),
    (v, o) => serializeArray(v as unknown[], o),
  ],
];

/**
 * Dispatch a non-circular, within-depth object to its concrete serializer.
 * Falls back to plain-object serialization when no known type matches (see
 * DEAD-1: the Error branch previously duplicated a lossy inline copy to
 * dodge a perceived circular import; error.ts and serialize.ts only call
 * each other's exports inside function bodies, so the ESM live-binding
 * cycle resolves fine).
 */
function serializeKnownObjectType(
  value: object,
  nextOptions: SerializationOptions,
): unknown {
  for (const [matches, serialize] of OBJECT_TYPE_HANDLERS) {
    if (matches(value)) {
      return serialize(value, nextOptions);
    }
  }

  // Handle plain objects (including null prototype objects)
  return serializePlainObject(value, nextOptions);
}
