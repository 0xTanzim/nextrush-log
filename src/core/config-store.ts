/**
 * Injectable config store factory (ARCH-2).
 *
 * Each store owns its own config object, namespace-pattern cache, and
 * change-listener set — mutating one store never affects another. This is
 * what makes global config safe to test in isolation and safe to scope
 * per-tenant in a reused serverless/edge isolate, instead of relying on one
 * process-wide mutable singleton.
 */

import type { LoggerOptions, LogLevel, LogTransport } from '../types/index.js';
import { createNamespaceMatcher } from './namespace-matcher.js';

export interface GlobalLoggerConfig {
  /** Global enable/disable all logging */
  enabled: boolean;
  /**
   * Global minimum level floor: combined with each logger’s level by taking the **stricter**
   * of the two (e.g. global `trace` + instance `error` → only `error` and above).
   */
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

const DEFAULT_CONFIG_VALUES = {
  enabled: true,
  silent: false,
} as const;

function freshConfig(): GlobalLoggerConfig {
  return {
    enabled: DEFAULT_CONFIG_VALUES.enabled,
    silent: DEFAULT_CONFIG_VALUES.silent,
    transports: [],
    enabledNamespaces: ['*'],
    disabledNamespaces: [],
    defaults: {},
  };
}

/** An isolated, injectable holder of global logger configuration. */
export interface ConfigStore {
  configure(options: Partial<GlobalLoggerConfig>): void;
  getConfig(): Readonly<GlobalLoggerConfig>;
  resetConfig(): void;
  clearGlobalLevel(): void;
  disableLogging(): void;
  enableLogging(): void;
  setGlobalLevel(level: LogLevel): void;
  addGlobalTransport(transport: LogTransport): void;
  clearGlobalTransports(): void;
  enableNamespaces(patterns: string[]): void;
  disableNamespaces(patterns: string[]): void;
  isNamespaceEnabled(namespace: string): boolean;
  onConfigChange(listener: () => void): () => void;
  configureFromEnv(getEnv: (name: string) => string | undefined): void;
}

/** Create an independent, isolated config store. */
export function createConfigStore(): ConfigStore {
  let config: GlobalLoggerConfig = freshConfig();
  const listeners = new Set<() => void>();
  const namespaceMatcher = createNamespaceMatcher();

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors — a broken subscriber must not break config mutation.
      }
    }
  }

  return {
    configure(options) {
      const next: GlobalLoggerConfig = { ...config, ...options };
      if (options.defaults !== undefined) {
        next.defaults = { ...config.defaults, ...options.defaults };
      }
      config = next;
      notify();
    },

    getConfig() {
      return config;
    },

    resetConfig() {
      config = freshConfig();
      namespaceMatcher.clearCache();
      notify();
    },

    clearGlobalLevel() {
      if ('minLevel' in config) {
        delete config.minLevel;
      }
      notify();
    },

    disableLogging() {
      config.enabled = false;
      notify();
    },

    enableLogging() {
      config.enabled = true;
      notify();
    },

    setGlobalLevel(level) {
      config.minLevel = level;
      notify();
    },

    addGlobalTransport(transport) {
      config.transports.push(transport);
      notify();
    },

    clearGlobalTransports() {
      config.transports = [];
      notify();
    },

    enableNamespaces(patterns) {
      config.enabledNamespaces = patterns;
      notify();
    },

    disableNamespaces(patterns) {
      config.disabledNamespaces = patterns;
      notify();
    },

    isNamespaceEnabled(namespace) {
      if (!config.enabled) return false;

      // Check disabled patterns first (higher priority)
      for (const pattern of config.disabledNamespaces) {
        if (namespaceMatcher.matches(namespace, pattern)) return false;
      }

      // Check enabled patterns
      for (const pattern of config.enabledNamespaces) {
        if (namespaceMatcher.matches(namespace, pattern)) return true;
      }

      // Default: if no patterns match, check if '*' is in enabled
      return config.enabledNamespaces.includes('*');
    },

    onConfigChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    configureFromEnv(getEnv) {
      const logLevel =
        getEnv('LOG_LEVEL') ??
        getEnv('NEXT_PUBLIC_LOG_LEVEL') ??
        getEnv('VITE_LOG_LEVEL');
      const logEnabled =
        getEnv('LOG_ENABLED') ??
        getEnv('NEXT_PUBLIC_LOG_ENABLED') ??
        getEnv('VITE_LOG_ENABLED');
      const logNamespaces = getEnv('LOG_NAMESPACES') ?? getEnv('NEXT_PUBLIC_LOG_NAMESPACES');
      const nodeEnv = getEnv('NODE_ENV');

      if (logLevel) {
        const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
        if (validLevels.includes(logLevel)) {
          config.minLevel = logLevel as LogLevel;
        }
      }

      if (logEnabled === 'false' || logEnabled === '0') {
        config.enabled = false;
      }

      if (logNamespaces) {
        config.enabledNamespaces = logNamespaces.split(',').map((s) => s.trim());
      }

      if (nodeEnv === 'production') {
        config.env = 'production';
        config.defaults.minLevel ??= 'info';
        config.defaults.pretty ??= false;
        config.defaults.redact ??= true;
      } else if (nodeEnv === 'test') {
        config.env = 'test';
        config.defaults.silent ??= true;
      }

      notify();
    },
  };
}
