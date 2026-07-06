/**
 * Logger option resolution, extracted from the Logger class (ARCH-1).
 *
 * Merges global-config defaults, environment detection, and user-supplied
 * options into one resolved option set. Pure with respect to its inputs —
 * takes the runtime/env/global-config snapshots as parameters instead of
 * reaching into module state itself, so it stays unit-testable in isolation.
 */

import { getEnvVar, isProductionBuild } from '../runtime/index.js';
import type {
    LoggerEnvironment,
    LoggerOptions,
    LogLevel,
    ResolvedLoggerOptions,
} from '../types/index.js';
import type { GlobalLoggerConfig } from './config.js';

export interface ResolveOptionsInput {
  options: LoggerOptions;
  explicitUserMin: LogLevel | undefined;
  globalConfig: GlobalLoggerConfig;
  runtimeSupportsColors: boolean;
}

export interface ResolveOptionsResult {
  resolved: ResolvedLoggerOptions;
  envBaselineMin: LogLevel;
}

/**
 * Resolve the effective environment, and whether it was genuinely detected
 * vs. silently defaulted. SAFE-2: an undetected environment (no NODE_ENV,
 * no Vite MODE/PROD/DEV signal — common on edge/serverless runtimes) must
 * not be treated identically to an explicitly-known development
 * environment, because that silently disables redaction in production.
 */
function resolveEnvironment(
  options: LoggerOptions,
  globalConfig: GlobalLoggerConfig,
): { env: LoggerEnvironment; wasDetected: boolean } {
  if (options.env) {
    return { env: options.env, wasDetected: true };
  }
  if (globalConfig.env) {
    return { env: globalConfig.env, wasDetected: true };
  }

  const nodeEnv = getEnvVar('NODE_ENV');
  if (nodeEnv === 'production' || isProductionBuild()) {
    return { env: 'production', wasDetected: true };
  }
  if (nodeEnv === 'test') {
    return { env: 'test', wasDetected: true };
  }
  if (nodeEnv === 'development') {
    return { env: 'development', wasDetected: true };
  }

  // No explicit signal anywhere — genuinely undetected (e.g. an edge
  // runtime with no NODE_ENV at all). Default the DISPLAY behavior to
  // development-like (pretty output is harmless), but the caller must
  // treat this case as NOT safe to skip redaction.
  return { env: 'development', wasDetected: false };
}

export function resolveLoggerOptions(input: ResolveOptionsInput): ResolveOptionsResult {
  const { options, explicitUserMin, globalConfig, runtimeSupportsColors } = input;

  const { env, wasDetected } = resolveEnvironment(options, globalConfig);
  const isDev = env === 'development';
  const isTest = env === 'test';
  const isProd = env === 'production';

  const enableDebug =
    getEnvVar('ENABLE_DEBUG_LOGS') === 'true' || getEnvVar('DEBUG') === 'true';

  const defaults = globalConfig.defaults;
  const defaultMinLevel: LogLevel = isProd ? (enableDebug ? 'debug' : 'info') : 'trace';
  const defaultPretty = isDev || isTest;
  const defaultColors = runtimeSupportsColors && (isDev || isTest);
  // Fail safe: redact by default unless we positively know we're in a
  // non-production environment. An undetected environment redacts too.
  const defaultRedact = isProd || !wasDetected;

  const resolvedMin = explicitUserMin ?? defaults.minLevel ?? defaultMinLevel;

  const result: ResolvedLoggerOptions = {
    minLevel: resolvedMin,
    pretty: options.pretty ?? defaults.pretty ?? defaultPretty,
    colors: options.colors ?? defaults.colors ?? defaultColors,
    transports: options.transports ?? defaults.transports ?? [],
    metadata: { ...defaults.metadata, ...options.metadata },
    sensitiveKeys: options.sensitiveKeys ?? defaults.sensitiveKeys ?? [],
    maxDepth: options.maxDepth ?? defaults.maxDepth ?? 10,
    maxStringLength: options.maxStringLength ?? defaults.maxStringLength ?? 10000,
    maxArrayLength: options.maxArrayLength ?? defaults.maxArrayLength ?? 100,
    samplingRate: options.samplingRate ?? defaults.samplingRate ?? 0.1,
    silent: options.silent ?? defaults.silent ?? false,
    redact: options.redact ?? defaults.redact ?? defaultRedact,
    env,
  };

  if (options.correlationId !== undefined) {
    result.correlationId = options.correlationId;
  }

  return { resolved: result, envBaselineMin: defaultMinLevel };
}

/** Build the options for a derived (child/withCorrelationId/withMetadata) logger. */
export function deriveChildOptions(
  base: ResolvedLoggerOptions,
  baseExplicitMin: LogLevel | undefined,
  overrides: Partial<LoggerOptions>,
): LoggerOptions {
  const inheritedMin = overrides.minLevel ?? baseExplicitMin;
  const inheritedCorrelationId = overrides.correlationId ?? base.correlationId;

  const childOptions: LoggerOptions = {
    pretty: overrides.pretty ?? base.pretty,
    colors: overrides.colors ?? base.colors,
    transports: overrides.transports ?? base.transports,
    metadata: { ...base.metadata, ...overrides.metadata },
    sensitiveKeys: [...base.sensitiveKeys, ...(overrides.sensitiveKeys ?? [])],
    maxDepth: overrides.maxDepth ?? base.maxDepth,
    maxStringLength: overrides.maxStringLength ?? base.maxStringLength,
    maxArrayLength: overrides.maxArrayLength ?? base.maxArrayLength,
    samplingRate: overrides.samplingRate ?? base.samplingRate,
    silent: overrides.silent ?? base.silent,
    redact: overrides.redact ?? base.redact,
    env: overrides.env ?? base.env,
  };

  if (inheritedMin !== undefined) {
    childOptions.minLevel = inheritedMin;
  }
  if (inheritedCorrelationId !== undefined) {
    childOptions.correlationId = inheritedCorrelationId;
  }

  return childOptions;
}
