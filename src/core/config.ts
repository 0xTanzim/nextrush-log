/**
 * Global Logger Configuration
 *
 * Provides centralized control over all logger instances.
 * Enables one-line enable/disable for entire application.
 */

import type { LoggerOptions, LogLevel, LogTransport } from '../types/index.js';

export interface GlobalLoggerConfig {
  /** Global enable/disable all logging */
  enabled: boolean;
  /** Global minimum log level (overrides individual loggers) */
  minLevel?: LogLevel;
  /** Force silent mode globally */
  silent: boolean;
  /** Global transports applied to all loggers */
  transports: LogTransport[];
  /** Environment preset */
  env?: 'development' | 'test' | 'production';
  /** Namespace patterns to enable (e.g., ['api:*', 'db:*']) */
  enabledNamespaces: string[];
  /** Namespace patterns to disable */
  disabledNamespaces: string[];
  /** Default options for new loggers */
  defaults: Partial<LoggerOptions>;
}

const DEFAULT_CONFIG: GlobalLoggerConfig = {
  enabled: true,
  silent: false,
  transports: [],
  enabledNamespaces: ['*'],
  disabledNamespaces: [],
  defaults: {},
};

let globalConfig: GlobalLoggerConfig = { ...DEFAULT_CONFIG };
const configChangeListeners: Set<() => void> = new Set();

/**
 * Configure global logger settings
 *
 * @example
 * ```ts
 * import { configure } from '@nextrush/log';
 *
 * // Disable all logging with one line
 * configure({ enabled: false });
 *
 * // Set production mode
 * configure({ env: 'production', minLevel: 'warn' });
 *
 * // Enable only specific namespaces
 * configure({ enabledNamespaces: ['api:*', 'auth:*'] });
 * ```
 */
export function configure(options: Partial<GlobalLoggerConfig>): void {
  globalConfig = { ...globalConfig, ...options };
  notifyConfigChange();
}

/**
 * Get current global configuration
 */
export function getGlobalConfig(): Readonly<GlobalLoggerConfig> {
  return globalConfig;
}

/**
 * Reset global configuration to defaults
 */
export function resetGlobalConfig(): void {
  globalConfig = { ...DEFAULT_CONFIG };
  notifyConfigChange();
}

/**
 * Disable all logging globally
 *
 * @example
 * ```ts
 * import { disableLogging } from '@nextrush/log';
 * disableLogging(); // All log calls become no-ops
 * ```
 */
export function disableLogging(): void {
  globalConfig.enabled = false;
  notifyConfigChange();
}

/**
 * Enable logging globally
 */
export function enableLogging(): void {
  globalConfig.enabled = true;
  notifyConfigChange();
}

/**
 * Set global minimum log level
 *
 * @example
 * ```ts
 * import { setGlobalLevel } from '@nextrush/log';
 * setGlobalLevel('warn'); // Only warn, error, fatal will log
 * ```
 */
export function setGlobalLevel(level: LogLevel): void {
  globalConfig.minLevel = level;
  notifyConfigChange();
}

/**
 * Add a global transport that receives logs from all loggers
 *
 * @example
 * ```ts
 * import { addGlobalTransport } from '@nextrush/log';
 *
 * addGlobalTransport((entry) => {
 *   fetch('/api/logs', {
 *     method: 'POST',
 *     body: JSON.stringify(entry)
 *   });
 * });
 * ```
 */
export function addGlobalTransport(transport: LogTransport): void {
  globalConfig.transports.push(transport);
  notifyConfigChange();
}

/**
 * Remove all global transports
 */
export function clearGlobalTransports(): void {
  globalConfig.transports = [];
  notifyConfigChange();
}

/**
 * Enable logging for specific namespace patterns
 *
 * @example
 * ```ts
 * import { enableNamespaces } from '@nextrush/log';
 *
 * // Only log from api and auth modules
 * enableNamespaces(['api:*', 'auth:*']);
 *
 * // Log everything
 * enableNamespaces(['*']);
 * ```
 */
export function enableNamespaces(patterns: string[]): void {
  globalConfig.enabledNamespaces = patterns;
  notifyConfigChange();
}

/**
 * Disable logging for specific namespace patterns
 *
 * @example
 * ```ts
 * import { disableNamespaces } from '@nextrush/log';
 *
 * // Disable verbose modules
 * disableNamespaces(['verbose:*', 'debug:*']);
 * ```
 */
export function disableNamespaces(patterns: string[]): void {
  globalConfig.disabledNamespaces = patterns;
  notifyConfigChange();
}

/**
 * Check if a namespace is enabled based on global config
 */
export function isNamespaceEnabled(namespace: string): boolean {
  if (!globalConfig.enabled) return false;

  // Check disabled patterns first (higher priority)
  for (const pattern of globalConfig.disabledNamespaces) {
    if (matchNamespace(namespace, pattern)) return false;
  }

  // Check enabled patterns
  for (const pattern of globalConfig.enabledNamespaces) {
    if (matchNamespace(namespace, pattern)) return true;
  }

  // Default: if no patterns match, check if '*' is in enabled
  return globalConfig.enabledNamespaces.includes('*');
}

/**
 * Match namespace against a pattern
 * Supports wildcards: 'api:*' matches 'api:users', 'api:auth:login'
 */
const patternCache = new Map<string, RegExp>();
const MAX_PATTERN_LENGTH = 100;
const MAX_WILDCARDS = 10;

function matchNamespace(namespace: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === namespace) return true;

  // Validate pattern complexity to prevent ReDoS
  if (pattern.length > MAX_PATTERN_LENGTH || pattern.split('*').length > MAX_WILDCARDS) {
    return false;
  }

  // Check cache first
  let regex = patternCache.get(pattern);
  if (!regex) {
    // Convert pattern to regex: 'api:*' -> /^api:.*$/
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    regex = new RegExp(`^${regexPattern}$`);
    patternCache.set(pattern, regex);
  }

  return regex.test(namespace);
}

/**
 * Subscribe to config changes
 */
export function onConfigChange(listener: () => void): () => void {
  configChangeListeners.add(listener);
  return () => {
    configChangeListeners.delete(listener);
  };
}

function notifyConfigChange(): void {
  for (const listener of configChangeListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Auto-configure from environment
 * Reads LOG_LEVEL, LOG_ENABLED, LOG_NAMESPACES from environment
 */
export function configureFromEnv(getEnv: (name: string) => string | undefined): void {
  const logLevel = getEnv('LOG_LEVEL');
  const logEnabled = getEnv('LOG_ENABLED');
  const logNamespaces = getEnv('LOG_NAMESPACES');
  const nodeEnv = getEnv('NODE_ENV');

  if (logLevel) {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    if (validLevels.includes(logLevel)) {
      globalConfig.minLevel = logLevel as LogLevel;
    }
  }

  if (logEnabled === 'false' || logEnabled === '0') {
    globalConfig.enabled = false;
  }

  if (logNamespaces) {
    globalConfig.enabledNamespaces = logNamespaces.split(',').map(s => s.trim());
  }

  if (nodeEnv === 'production') {
    globalConfig.env = 'production';
    globalConfig.defaults.minLevel ??= 'info';
    globalConfig.defaults.pretty ??= false;
    globalConfig.defaults.redact ??= true;
  } else if (nodeEnv === 'test') {
    globalConfig.env = 'test';
    globalConfig.defaults.silent ??= true;
  }

  notifyConfigChange();
}
