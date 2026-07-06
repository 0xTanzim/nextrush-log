/**
 * Collection and generator serialization utilities
 * Split out of serialize.ts (ARCH-4: keep serializer modules under the
 * 300-line hard cap) — these have no dependency on the object-dispatch
 * logic beyond calling back into `safeSerialize` for element values.
 */

import type { SerializationOptions } from '../types/index.js';
import { REDACTED_PLACEHOLDER, shouldRedact } from './redaction.js';
import { safeSerialize } from './serialize.js';

/** Placeholder for objects whose own keys could not be read */
export const UNSERIALIZABLE_PLACEHOLDER = '[Unserializable]';

/**
 * Serialize a Map, capping entries at maxArrayLength with a truncation marker.
 */
export function serializeMap(
  map: Map<unknown, unknown>,
  options: SerializationOptions,
): Record<string, unknown> {
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
 * Serialize a Set, capping items at maxArrayLength with a truncation marker.
 */
export function serializeSet(
  set: Set<unknown>,
  options: SerializationOptions,
): Record<string, unknown> {
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
 * Serialize an Array, capping length at maxArrayLength with a truncation marker.
 */
export function serializeArray(
  arr: unknown[],
  options: SerializationOptions,
): unknown[] {
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
 * Serialize a plain object, capping key count at maxKeys with a truncation
 * marker (SAFE-7: unbounded key iteration is a CPU/memory DoS vector).
 */
export function serializePlainObject(
  obj: object,
  options: SerializationOptions,
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  // Get own enumerable keys (handles null prototype objects)
  let keys: string[];
  try {
    keys = Object.keys(obj);
  } catch {
    return { __error: UNSERIALIZABLE_PLACEHOLDER };
  }

  for (const key of keys.slice(0, options.maxKeys)) {
    try {
      const value = (obj as Record<string, unknown>)[key];

      if (options.redact && shouldRedact(key, options.sensitiveKeys)) {
        serialized[key] = REDACTED_PLACEHOLDER;
      } else {
        serialized[key] = safeSerialize(value, options);
      }
    } catch {
      serialized[key] = UNSERIALIZABLE_PLACEHOLDER;
    }
  }

  if (keys.length > options.maxKeys) {
    serialized['...'] = `[${keys.length - options.maxKeys} more keys]`;
  }

  return serialized;
}

/**
 * Type guard for Generator objects
 */
export function isGenerator(value: unknown): boolean {
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
export function isAsyncGenerator(value: unknown): boolean {
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
