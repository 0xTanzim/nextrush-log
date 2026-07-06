/**
 * Browser environment detection.
 */

/** Check if running in browser environment */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Check if running on server (SSR/RSC) */
export function isServer(): boolean {
  return !isBrowser();
}

/** Check if navigator is online */
export function isOnline(): boolean {
  return isBrowser() && navigator.onLine;
}
