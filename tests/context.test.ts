/**
 * Async context propagation tests
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
    __forceAsyncContextFallbackForTesting,
    __resetAsyncContextFallbackForTesting,
    getAsyncContext,
    getContextCorrelationId,
    getContextMetadata,
    isAsyncContextAvailable,
    runWithContext,
} from '../src/context/index.js';

describe('runWithContext (AsyncLocalStorage path)', () => {
  it('is available in the Node test environment', () => {
    expect(isAsyncContextAvailable()).toBe(true);
  });

  it('makes the correlation id visible inside the callback', () => {
    runWithContext({ correlationId: 'req-1' }, () => {
      expect(getContextCorrelationId()).toBe('req-1');
    });
  });

  it('makes metadata visible inside the callback', () => {
    runWithContext({ metadata: { userId: 'u1' } }, () => {
      expect(getContextMetadata()).toEqual({ userId: 'u1' });
    });
  });

  it('returns undefined outside of any runWithContext call', () => {
    expect(getAsyncContext()).toBeUndefined();
  });

  it('restores the previous context after a synchronous callback returns', () => {
    runWithContext({ correlationId: 'outer' }, () => {
      runWithContext({ correlationId: 'inner' }, () => {
        expect(getContextCorrelationId()).toBe('inner');
      });
      expect(getContextCorrelationId()).toBe('outer');
    });
    expect(getContextCorrelationId()).toBeUndefined();
  });

  it('keeps correlation id visible across an await inside the callback', async () => {
    await runWithContext({ correlationId: 'async-req' }, async () => {
      expect(getContextCorrelationId()).toBe('async-req');
      await Promise.resolve();
      expect(getContextCorrelationId()).toBe('async-req');
    });
  });

  it('does not leak context to code after the callback\'s promise settles', async () => {
    await runWithContext({ correlationId: 'temp' }, async () => {
      await Promise.resolve();
    });
    expect(getContextCorrelationId()).toBeUndefined();
  });

  it('does not let two interleaved (microtask-ordered) async calls see each other\'s correlationId', async () => {
    const seenByA: (string | undefined)[] = [];
    const seenByB: (string | undefined)[] = [];

    const callA = runWithContext({ correlationId: 'A' }, async () => {
      seenByA.push(getContextCorrelationId());
      await Promise.resolve();
      seenByA.push(getContextCorrelationId());
      await Promise.resolve();
      seenByA.push(getContextCorrelationId());
    });

    const callB = runWithContext({ correlationId: 'B' }, async () => {
      seenByB.push(getContextCorrelationId());
      await Promise.resolve();
      seenByB.push(getContextCorrelationId());
      await Promise.resolve();
      seenByB.push(getContextCorrelationId());
    });

    await Promise.all([callA, callB]);

    expect(seenByA).toEqual(['A', 'A', 'A']);
    expect(seenByB).toEqual(['B', 'B', 'B']);
  });

  it('propagates context into a callback spawned during the sync extent, even after that extent returns (middleware-style)', async () => {
    let seenInsideNext: string | undefined;
    let nextResolve: (() => void) | undefined;
    const nextRan = new Promise<void>((resolve) => {
      nextResolve = resolve;
    });

    function next(): void {
      // Simulates an async downstream handler that resumes on a later microtask,
      // after runWithContext's synchronous callback has already returned.
      void Promise.resolve().then(() => {
        seenInsideNext = getContextCorrelationId();
        nextResolve?.();
      });
    }

    runWithContext({ correlationId: 'mw-req' }, () => {
      next();
    });

    await nextRan;
    expect(seenInsideNext).toBe('mw-req');
  });
});

describe('runWithContext (fallback path — AsyncLocalStorage unavailable)', () => {
  afterEach(() => {
    __forceAsyncContextFallbackForTesting(false);
    __resetAsyncContextFallbackForTesting();
  });

  it('reports isAsyncContextAvailable() as false while forced into fallback mode', () => {
    __forceAsyncContextFallbackForTesting(true);
    expect(isAsyncContextAvailable()).toBe(false);
  });

  it('makes the correlation id visible inside a synchronous callback', () => {
    __forceAsyncContextFallbackForTesting(true);

    runWithContext({ correlationId: 'req-1' }, () => {
      expect(getContextCorrelationId()).toBe('req-1');
    });
  });

  it('restores the previous context after a synchronous callback returns', () => {
    __forceAsyncContextFallbackForTesting(true);

    runWithContext({ correlationId: 'outer' }, () => {
      runWithContext({ correlationId: 'inner' }, () => {
        expect(getContextCorrelationId()).toBe('inner');
      });
      expect(getContextCorrelationId()).toBe('outer');
    });
    expect(getContextCorrelationId()).toBeUndefined();
  });

  it('never returns another call\'s correlationId when two async calls are genuinely concurrent (not time-nested)', async () => {
    __forceAsyncContextFallbackForTesting(true);

    const seenByA: (string | undefined)[] = [];
    const seenByB: (string | undefined)[] = [];

    const callA = runWithContext({ correlationId: 'A' }, async () => {
      seenByA.push(getContextCorrelationId());
      await Promise.resolve();
      seenByA.push(getContextCorrelationId());
      await Promise.resolve();
      seenByA.push(getContextCorrelationId());
    });

    const callB = runWithContext({ correlationId: 'B' }, async () => {
      seenByB.push(getContextCorrelationId());
      await Promise.resolve();
      seenByB.push(getContextCorrelationId());
      await Promise.resolve();
      seenByB.push(getContextCorrelationId());
    });

    await Promise.all([callA, callB]);

    // SAFE-1 regression check: with the old single shared mutable global, B's
    // context could overwrite A's while A's continuation was still pending, so
    // A would observe 'B' here. Without real AsyncLocalStorage there is no
    // userland way to correctly attribute a later microtask to the right one of
    // several *genuinely concurrent* calls — but it must never silently return
    // the WRONG call's id. It is safe to fail closed (undefined) instead.
    expect(seenByA).not.toContain('B');
    expect(seenByB).not.toContain('A');
  });

  it('does not leak context to unrelated code once all overlapping calls settle', async () => {
    __forceAsyncContextFallbackForTesting(true);

    const callA = runWithContext({ correlationId: 'A' }, async () => {
      await Promise.resolve();
    });
    const callB = runWithContext({ correlationId: 'B' }, async () => {
      await Promise.resolve();
    });

    await Promise.all([callA, callB]);

    expect(getContextCorrelationId()).toBeUndefined();
  });

  it('does not overwrite an outer call\'s context via a nested call that starts and finishes during an outer await', async () => {
    __forceAsyncContextFallbackForTesting(true);

    const seenByOuter: (string | undefined)[] = [];

    await runWithContext({ correlationId: 'outer' }, async () => {
      seenByOuter.push(getContextCorrelationId());
      await runWithContext({ correlationId: 'nested' }, async () => {
        expect(getContextCorrelationId()).toBe('nested');
        await Promise.resolve();
      });
      seenByOuter.push(getContextCorrelationId());
    });

    expect(seenByOuter).toEqual(['outer', 'outer']);
  });
});
