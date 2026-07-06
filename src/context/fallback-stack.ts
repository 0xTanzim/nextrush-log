/**
 * Fallback context propagation for runtimes with no AsyncLocalStorage.
 *
 * A single mutable value is NOT safe here: two overlapping `runWithContext` calls
 * (e.g. two concurrent requests, interleaved via microtask scheduling) would each
 * overwrite the same slot, so one call's continuation could read the other's data
 * after an `await` (this was the SAFE-1 bug). A stack of *frames* (push on enter,
 * remove on exit) correctly restores call-nested (LIFO) usage — e.g. a synchronous
 * callback, or an async call whose entire lifetime is nested inside another call's
 * pending `await`.
 *
 * A stack alone can NOT correctly isolate two async calls that are genuinely
 * concurrent and NOT time-nested (both started, neither's promise settled before
 * the other started) — no userland stack can know, on a later microtask, which of
 * several simultaneously in-flight frames that microtask "belongs" to. That
 * requires real per-async-resource tracking, i.e. AsyncLocalStorage itself. Each
 * frame is tagged with the "root" call it belongs to; while more than one root is
 * live at once, `getFallbackContext()` fails safe to `undefined` rather than risk
 * returning a different call's data.
 */

import { type AsyncLogContext, mergeContext } from './types.js';

interface FallbackFrame {
  readonly id: number;
  readonly rootId: number;
  readonly context: AsyncLogContext;
}

const stack: FallbackFrame[] = [];
let nextFrameId = 0;
/** Root call ids currently live (a "root" is a call that started while no sibling call chain was mid-synchronous-execution). */
const liveRootIds = new Set<number>();
/** Id of the frame whose callback is currently executing synchronously, if any. */
let currentlyExecutingFrameId: number | undefined;

/**
 * Run a callback against the fallback context stack, restoring it correctly
 * whether the callback is synchronous or returns a Promise.
 *
 * For a synchronous callback, push/run/remove happens entirely within one
 * synchronous extent — always safe, since nothing else can run "concurrently"
 * with it in JS.
 *
 * For an async callback, we push before calling it and remove its frame only once
 * its returned promise settles (not when the callback synchronously returns,
 * which happens before its first internal `await` resolves). This is what fixes
 * the `createContextMiddleware` bug: restoring context immediately after a
 * synchronous `next()` returns — while a downstream async handler `next()`
 * triggered is still pending — used to wipe the context out from under that
 * handler.
 *
 * A call is "nested" under another (shares its root) only if it is invoked
 * synchronously from *within* that other call's own currently-executing callback
 * — that is genuinely LIFO-safe. A call started later by unrelated code, while an
 * earlier call is merely pending at an `await`, is a sibling with its own root,
 * even though the earlier call's frame is still on the stack.
 */
export function runWithFallbackContext<T>(
  context: AsyncLogContext,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  const nestedUnder =
    currentlyExecutingFrameId !== undefined
      ? stack.find((f) => f.id === currentlyExecutingFrameId)
      : undefined;

  const frame: FallbackFrame = {
    id: nextFrameId++,
    rootId: nestedUnder?.rootId ?? nextFrameId,
    context: mergeContext(nestedUnder?.context, context),
  };
  stack.push(frame);
  liveRootIds.add(frame.rootId);

  const previouslyExecuting = currentlyExecutingFrameId;
  currentlyExecutingFrameId = frame.id;

  const settle = (): void => {
    const index = stack.findIndex((f) => f.id === frame.id);
    if (index !== -1) stack.splice(index, 1);
    if (!stack.some((f) => f.rootId === frame.rootId)) {
      liveRootIds.delete(frame.rootId);
    }
  };

  try {
    const result = callback();
    currentlyExecutingFrameId = previouslyExecuting;
    if (result instanceof Promise) {
      return result.finally(settle);
    }
    settle();
    return result;
  } catch (error) {
    currentlyExecutingFrameId = previouslyExecuting;
    settle();
    throw error;
  }
}

/**
 * Read the current fallback context. Fails safe to `undefined` once more than one
 * root call is live at once — see the module doc comment for why a userland stack
 * cannot correctly attribute a read to the right one of several genuinely
 * concurrent calls in that case.
 */
export function getFallbackContext(): AsyncLogContext | undefined {
  if (liveRootIds.size > 1) return undefined;
  return stack[stack.length - 1]?.context;
}

/**
 * Test-only seam: clear all fallback bookkeeping. Guards against state leaking
 * between tests if a previous test's fallback call didn't fully settle before the
 * next started. Not part of the package's public API.
 */
export function resetFallbackContextForTesting(): void {
  stack.length = 0;
  liveRootIds.clear();
  currentlyExecutingFrameId = undefined;
}
