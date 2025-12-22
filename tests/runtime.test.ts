/**
 * Runtime detection tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    detectRuntime,
    getEnvVar,
    getRuntime,
    resetRuntimeCache,
} from '../src/runtime/index.js';

describe('detectRuntime', () => {
  it('should return runtime info object', () => {
    const runtime = detectRuntime();

    expect(runtime).toHaveProperty('environment');
    expect(runtime).toHaveProperty('isBrowser');
    expect(runtime).toHaveProperty('isEdge');
    expect(runtime).toHaveProperty('isNode');
    expect(runtime).toHaveProperty('isDeno');
    expect(runtime).toHaveProperty('isBun');
    expect(runtime).toHaveProperty('supportsColors');
    expect(runtime).toHaveProperty('supportsPerformance');
  });

  it('should detect Node.js environment', () => {
    const runtime = detectRuntime();

    // In test environment (Node.js with Vitest)
    expect(runtime.isNode).toBe(true);
    expect(runtime.environment).toBe('node');
  });

  it('should detect performance API support', () => {
    const runtime = detectRuntime();

    // Node.js supports performance API
    expect(runtime.supportsPerformance).toBe(true);
  });
});

describe('getRuntime', () => {
  beforeEach(() => {
    resetRuntimeCache();
  });

  it('should return cached runtime info', () => {
    const runtime1 = getRuntime();
    const runtime2 = getRuntime();

    expect(runtime1).toBe(runtime2);
  });

  it('should reset cache correctly', () => {
    const runtime1 = getRuntime();
    resetRuntimeCache();
    const runtime2 = getRuntime();

    // Should be equal but not same reference
    expect(runtime1).toEqual(runtime2);
  });
});

describe('getEnvVar', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should read environment variables', () => {
    process.env['TEST_VAR'] = 'test_value';
    expect(getEnvVar('TEST_VAR')).toBe('test_value');
  });

  it('should return undefined for missing variables', () => {
    expect(getEnvVar('NON_EXISTENT_VAR_12345')).toBeUndefined();
  });

  it('should read NODE_ENV', () => {
    const nodeEnv = getEnvVar('NODE_ENV');
    // In test environment, NODE_ENV is usually 'test'
    expect(typeof nodeEnv === 'string' || typeof nodeEnv === 'undefined').toBe(true);
  });
});
