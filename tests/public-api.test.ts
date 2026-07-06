/**
 * Public API surface tests (REPORT.md API-1..6).
 *
 * These tests characterize the MINIMIZED main barrel: they assert which
 * symbols are still exported (the ones consumers actually need) and which
 * internal-plumbing / duplicate / dead symbols have been removed from
 * `@nextrush/log`'s public surface. Internals remain reachable through
 * their owning submodule (e.g. `src/serializer/index.js`) for the package's
 * own internal use — this test only governs the MAIN entry's surface.
 */

import { describe, expect, it } from 'vitest';
import * as mainBarrel from '../src/index.js';

describe('main barrel — minimized public API surface (API-1..4)', () => {
  it('still exports the small set of symbols a consumer actually needs', () => {
    const requiredValueExports = [
      'log',
      'createLogger',
      'configure',
      'disableLogging',
      'addGlobalTransport',
      'createBatchTransport',
      'createFilteredTransport',
      'createRateLimitedTransport',
      'runWithContext',
      'createContextMiddleware',
    ] as const;

    for (const name of requiredValueExports) {
      expect(mainBarrel).toHaveProperty(name);
      expect((mainBarrel as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('no longer exports internal plumbing that consumers should never import directly', () => {
    const removedInternals = [
      'shouldLog',
      'compareLevels',
      'stricterMinLevel',
      'parseLogLevel',
      'isValidLogLevel',
      'LOG_LEVELS',
      'LOG_LEVEL_PRIORITY',
      'safeSerialize',
      'sanitizeContext',
      'shouldRedact',
      'mergeSensitiveKeys',
      'containsSensitivePattern',
      'redactSensitiveValues',
      'serializeError',
      'isError',
      'DEFAULT_SENSITIVE_KEYS',
      'detectRuntime',
      'getRuntime',
      'getEnvVar',
      'getProcessId',
      'isProductionBuild',
      'formatJSON',
      'formatPrettyJSON',
      'formatPrettyTerminal',
      'formatTimestamp',
      'formatPrettyTimestamp',
      'getTime',
      'onConfigChange',
      'isNamespaceEnabled',
      'getGlobalConfig',
      'createConfigStore',
    ];

    for (const name of removedInternals) {
      expect(mainBarrel).not.toHaveProperty(name);
    }
  });

  it('no longer exports the redundant logger-acquisition aliases', () => {
    // `log` (kept) and `createLogger` (kept) are enough; `logger` was a bare
    // alias of the same singleton `log` is, and `scopedLogger` was a pure
    // alias of `createLogger`.
    expect(mainBarrel).not.toHaveProperty('logger');
    expect(mainBarrel).not.toHaveProperty('scopedLogger');
  });

  it('no longer exports the double-logging createConsoleTransport or overlapping transport variants', () => {
    expect(mainBarrel).not.toHaveProperty('createConsoleTransport');
    expect(mainBarrel).not.toHaveProperty('createPredicateTransport');
    expect(mainBarrel).not.toHaveProperty('createNamespaceRateLimitedTransport');
  });

  it('no longer exports the redundant single-field config mutators (configure() covers them)', () => {
    const removedMutators = [
      'clearGlobalLevel',
      'clearGlobalTransports',
      'enableLogging',
      'enableNamespaces',
      'disableNamespaces',
      'setGlobalLevel',
      'configureFromEnv',
      'resetGlobalConfig',
    ];
    for (const name of removedMutators) {
      expect(mainBarrel).not.toHaveProperty(name);
    }
  });

  it('createLogger + log still produce fully working loggers end to end', () => {
    expect(() => {
      const l = mainBarrel.createLogger('smoke-test');
      l.info('hello');
      mainBarrel.log.info('hello from default logger');
    }).not.toThrow();
  });
});
