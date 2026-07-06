/**
 * Global Logger Configuration
 *
 * Provides centralized control over all logger instances.
 * Enables one-line enable/disable for entire application.
 *
 * Backed by `createConfigStore()` (src/core/config-store.ts) — the
 * functions below are thin wrappers over one default store instance, kept
 * for backward compatibility with the original singleton-style API.
 */

import type { LogLevel, LogTransport } from '../types/index.js';
import { createConfigStore, type ConfigStore } from './config-store.js';

export type { ConfigStore, GlobalLoggerConfig } from './config-store.js';
export { createConfigStore } from './config-store.js';

/**
 * Well-known globalThis key backing the single default config store.
 *
 * Dual-package hazard fix: a bundler, monorepo, or host runtime can load
 * BOTH the ESM and CJS builds of this package into the same process (e.g.
 * one dependency `require()`s it while the app `import`s it). Each build is
 * a *different* module-graph node with its own module-scoped variables, so a
 * plain `const defaultStore = createConfigStore()` would silently create two
 * independent stores — `disableLogging()` called through one build would
 * never reach a logger created through the other. Routing the default store
 * through a `globalThis` slot means every module instance in the same JS
 * realm (same Node process, same browser tab, same Worker) converges on one
 * shared store, regardless of how many times the module itself is
 * separately evaluated.
 */
const DEFAULT_STORE_GLOBAL_KEY = '__NEXTRUSH_LOG_DEFAULT_CONFIG_STORE__';

interface GlobalWithDefaultStore {
  [DEFAULT_STORE_GLOBAL_KEY]?: ConfigStore;
}

/**
 * Get the single process-wide default config store, creating it on first
 * access. Safe to call from any module instance — see the dual-package
 * hazard note above.
 */
export function getDefaultConfigStore(): ConfigStore {
  const g = globalThis as GlobalWithDefaultStore;
  g[DEFAULT_STORE_GLOBAL_KEY] ??= createConfigStore();
  return g[DEFAULT_STORE_GLOBAL_KEY];
}

/** The default store backing the module-level convenience functions below. */
const defaultStore = getDefaultConfigStore();

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
export function configure(options: Parameters<typeof defaultStore.configure>[0]): void {
  defaultStore.configure(options);
}

/** Get current global configuration */
export function getGlobalConfig(): ReturnType<typeof defaultStore.getConfig> {
  return defaultStore.getConfig();
}

/** Reset global configuration to factory defaults. */
export function resetGlobalConfig(): void {
  defaultStore.resetConfig();
}

/**
 * Remove the global `minLevel` floor (same as it being unset from initial state).
 * Per-logger and `defaults.minLevel` apply again.
 */
export function clearGlobalLevel(): void {
  defaultStore.clearGlobalLevel();
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
  defaultStore.disableLogging();
}

/** Enable logging globally */
export function enableLogging(): void {
  defaultStore.enableLogging();
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
  defaultStore.setGlobalLevel(level);
}

/**
 * Add a global transport that receives logs from all loggers
 *
 * @example
 * ```ts
 * import { addGlobalTransport } from '@nextrush/log';
 *
 * addGlobalTransport((entry) => {
 *   fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
 * });
 * ```
 */
export function addGlobalTransport(transport: LogTransport): void {
  defaultStore.addGlobalTransport(transport);
}

/** Remove all global transports */
export function clearGlobalTransports(): void {
  defaultStore.clearGlobalTransports();
}

/**
 * Enable logging for specific namespace patterns
 *
 * @example
 * ```ts
 * import { enableNamespaces } from '@nextrush/log';
 * enableNamespaces(['api:*', 'auth:*']);
 * ```
 */
export function enableNamespaces(patterns: string[]): void {
  defaultStore.enableNamespaces(patterns);
}

/**
 * Disable logging for specific namespace patterns
 *
 * @example
 * ```ts
 * import { disableNamespaces } from '@nextrush/log';
 * disableNamespaces(['verbose:*', 'debug:*']);
 * ```
 */
export function disableNamespaces(patterns: string[]): void {
  defaultStore.disableNamespaces(patterns);
}

/** Check if a namespace is enabled based on global config */
export function isNamespaceEnabled(namespace: string): boolean {
  return defaultStore.isNamespaceEnabled(namespace);
}

/** Subscribe to config changes */
export function onConfigChange(listener: () => void): () => void {
  return defaultStore.onConfigChange(listener);
}

/**
 * Auto-configure from environment.
 * Reads `LOG_*` (and `NEXT_PUBLIC_*` / `VITE_*` aliases) plus `NODE_ENV`.
 */
export function configureFromEnv(getEnv: (name: string) => string | undefined): void {
  defaultStore.configureFromEnv(getEnv);
}
