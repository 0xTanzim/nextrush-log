/**
 * Runtime environment detection
 * Detects the current JavaScript runtime with comprehensive edge case handling
 */

import type { RuntimeEnvironment, RuntimeInfo } from '../types/index.js';

/** Global type augmentation for runtime-specific globals */
interface GlobalWithRuntimes {
  Deno?: {
    env?: { get: (name: string) => string | undefined };
    noColor?: boolean;
  };
  Bun?: unknown;
  EdgeRuntime?: unknown;
  caches?: unknown;
  navigator?: { userAgent?: string; product?: string };
  process?: {
    versions?: { node?: string };
    env?: Record<string, string | undefined>;
    stdout?: { isTTY?: boolean };
    pid?: number;
  };
  window?: unknown;
  document?: unknown;
  WorkerGlobalScope?: unknown;
  DedicatedWorkerGlobalScope?: unknown;
  SharedWorkerGlobalScope?: unknown;
  ServiceWorkerGlobalScope?: unknown;
}

const g = globalThis as GlobalWithRuntimes;

function detectBrowser(): boolean {
  return typeof g.window !== 'undefined' && typeof g.document !== 'undefined';
}

function detectDeno(): boolean {
  return typeof g.Deno !== 'undefined';
}

function detectBun(): boolean {
  return typeof g.Bun !== 'undefined';
}

function detectWorker(): boolean {
  return (
    typeof g.WorkerGlobalScope !== 'undefined' ||
    typeof g.DedicatedWorkerGlobalScope !== 'undefined' ||
    typeof g.SharedWorkerGlobalScope !== 'undefined' ||
    typeof g.ServiceWorkerGlobalScope !== 'undefined'
  );
}

function detectReactNative(): boolean {
  return g.navigator?.product === 'ReactNative';
}

function detectEdge(): boolean {
  // Vercel Edge Runtime
  if (typeof g.EdgeRuntime !== 'undefined') return true;

  // Cloudflare Workers
  if (
    typeof g.caches !== 'undefined' &&
    g.navigator?.userAgent === 'Cloudflare-Workers'
  ) {
    return true;
  }

  // Generic edge detection: has caches API but not a full browser
  if (typeof g.caches !== 'undefined' && !detectBrowser() && !detectWorker()) {
    return true;
  }

  return false;
}

function detectNode(): boolean {
  return (
    typeof g.process !== 'undefined' && Boolean(g.process.versions?.node)
  );
}

function detectColorSupport(runtime: RuntimeEnvironment): boolean {
  if (runtime === 'browser') {
    return true; // Browsers support CSS colors in console
  }

  if (runtime === 'node' || runtime === 'bun') {
    const proc = g.process;
    if (!proc) return false;

    // Respect NO_COLOR and FORCE_COLOR environment variables
    if (proc.env?.['NO_COLOR']) return false;
    if (proc.env?.['FORCE_COLOR'] === '0') return false;
    if (proc.env?.['FORCE_COLOR']) return true;

    // Check if stdout is a TTY
    return Boolean(proc.stdout?.isTTY);
  }

  if (runtime === 'deno') {
    // Deno has its own color detection
    return g.Deno?.noColor !== true;
  }

  return false;
}

function detectPerformanceSupport(): boolean {
  return (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
  );
}

/**
 * Detect the current runtime environment
 * Results are cached for performance
 */
export function detectRuntime(): RuntimeInfo {
  const isBrowser = detectBrowser();
  const isDeno = detectDeno();
  const isBun = detectBun();
  const isWorker = detectWorker();
  const isReactNative = detectReactNative();
  const isEdge = !isBrowser && !isWorker && detectEdge();
  const isNode = !isBrowser && !isEdge && !isDeno && !isBun && detectNode();

  let environment: RuntimeEnvironment = 'unknown';

  // Priority order for environment detection
  if (isReactNative) environment = 'react-native';
  else if (isBrowser) environment = 'browser';
  else if (isWorker) environment = 'worker';
  else if (isEdge) environment = 'edge';
  else if (isDeno) environment = 'deno';
  else if (isBun) environment = 'bun';
  else if (isNode) environment = 'node';

  const supportsColors = detectColorSupport(environment);
  const supportsPerformance = detectPerformanceSupport();

  return {
    environment,
    isBrowser,
    isEdge,
    isNode,
    isDeno,
    isBun,
    isWorker,
    isReactNative,
    supportsColors,
    supportsPerformance,
  };
}

/** Cached runtime info for performance */
let cachedRuntime: RuntimeInfo | null = null;

/**
 * Get cached runtime info
 * Call this instead of detectRuntime() for repeated access
 */
export function getRuntime(): RuntimeInfo {
  cachedRuntime ??= detectRuntime();
  return cachedRuntime;
}

/**
 * Reset cached runtime (useful for testing)
 */
export function resetRuntimeCache(): void {
  cachedRuntime = null;
}

/**
 * Safely get environment variable across runtimes
 */
export function getEnvVar(name: string): string | undefined {
  try {
    // Node.js, Bun
    if (g.process?.env) {
      return g.process.env[name];
    }

    // Deno
    if (g.Deno?.env) {
      return g.Deno.env.get(name);
    }
  } catch {
    // Environment access not available
  }

  return undefined;
}

/**
 * Get process ID if available
 */
export function getProcessId(): number | undefined {
  try {
    if (typeof g.process?.pid === 'number') {
      return g.process.pid;
    }
  } catch {
    // PID not available
  }

  return undefined;
}
