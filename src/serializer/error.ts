/**
 * Error serialization utilities
 * Converts Error objects to safe, serializable structures
 */

import type { SerializationOptions, SerializedError } from '../types/index.js';
import { safeSerialize } from './serialize.js';

/** Well-known error properties to extract */
const ERROR_PROPERTIES = ['code', 'errno', 'syscall', 'hostname', 'path'];

/**
 * Serialize an Error object to a plain object
 * Handles nested causes, custom properties, and special error types
 */
export function serializeError(
  error: Error,
  options: SerializationOptions,
): SerializedError {
  const serialized: SerializedError = {
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
  };

  // Include stack trace
  if (error.stack) {
    serialized.stack = error.stack;
  }

  // Handle common error properties
  for (const prop of ERROR_PROPERTIES) {
    if (prop in error) {
      const value = (error as unknown as Record<string, unknown>)[prop];
      if (value !== undefined) {
        serialized[prop] = value;
      }
    }
  }

  // Handle error cause (ES2022+)
  if ('cause' in error && error.cause !== undefined) {
    const cause = error.cause;
    if (cause instanceof Error) {
      // Increment depth for nested error serialization
      const nestedOptions: SerializationOptions = {
        ...options,
        depth: options.depth + 1,
      };

      // Prevent infinite recursion
      if (nestedOptions.depth < options.maxDepth) {
        serialized.cause = serializeError(cause, nestedOptions);
      } else {
        serialized.cause = `[Error: ${cause.name}] ${cause.message}`;
      }
    } else {
      serialized.cause = safeSerialize(cause, options);
    }
  }

  // Handle AggregateError
  if (
    error.name === 'AggregateError' &&
    'errors' in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const aggregateErrors = (error as { errors: unknown[] }).errors;
    const nestedOptions: SerializationOptions = {
      ...options,
      depth: options.depth + 1,
    };

    if (nestedOptions.depth < options.maxDepth) {
      serialized['errors'] = aggregateErrors.slice(0, 10).map((e) => {
        if (e instanceof Error) {
          return serializeError(e, nestedOptions);
        }
        return safeSerialize(e, nestedOptions);
      });

      if (aggregateErrors.length > 10) {
        (serialized['errors'] as unknown[]).push(
          `[${aggregateErrors.length - 10} more errors]`,
        );
      }
    }
  }

  // Include any additional enumerable properties
  const ownKeys = Object.keys(error);
  for (const key of ownKeys) {
    if (key in serialized) continue;
    if (key === 'stack' || key === 'cause' || key === 'errors') continue;

    try {
      const value = (error as unknown as Record<string, unknown>)[key];
      serialized[key] = safeSerialize(value, options);
    } catch {
      serialized[key] = '[Unserializable]';
    }
  }

  return serialized;
}

/**
 * Check if a value is an Error-like object
 */
export function isError(value: unknown): value is Error {
  if (value instanceof Error) return true;

  // Duck typing for error-like objects
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['name'] === 'string' &&
      typeof obj['message'] === 'string' &&
      (obj['stack'] === undefined || typeof obj['stack'] === 'string')
    );
  }

  return false;
}
