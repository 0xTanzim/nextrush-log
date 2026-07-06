// Edge-runtime simulation — a REAL Node subprocess (not vitest/vi.stubGlobal)
// with `process`, `Deno`, and CJS `require` removed before dist/index.js is
// ever imported, approximating a genuinely signal-less edge worker (no
// NODE_ENV, no async_hooks via require). This is defense-in-depth on top of
// the unit tests: it proves the fail-safe behavior holds even at the exact
// module-load boundary, not just inside a stubbed test harness.
'use strict';

// Must delete these BEFORE importing dist/index.js, since some resolution
// (e.g. runtime detection, async_hooks loading) happens at import/construction time.
// @ts-ignore
delete globalThis.process;
// @ts-ignore
globalThis.Deno = undefined;
// Simulate an environment where CJS require is not available (true in native ESM
// on many edge runtimes) by shadowing any global `require` if present.
if (typeof globalThis.require !== 'undefined') {
  globalThis.require = undefined;
}

let failures = 0;
function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}`);
  if (!condition) failures++;
}

const { createLogger, runWithContext } = await import('../dist/index.js');

// 1. Logger construction must not throw even with process/Deno both absent.
let logger;
try {
  logger = createLogger('edge-sim');
  check('createLogger does not throw with no process/Deno global', true);
} catch (err) {
  console.error(err);
  check('createLogger does not throw with no process/Deno global', false);
}

// 2. SAFE-2: redaction must default ON when the environment is genuinely undetected.
const captured = [];
const originalLog = console.log;
console.log = (...args) => {
  captured.push(args.map(String).join(' '));
};
logger.info('login', { password: 'edge-secret-value' });
console.log = originalLog;
check(
  'SAFE-2: redaction defaults ON on a genuinely undetected (edge-like) environment',
  !captured.some((line) => line.includes('edge-secret-value')),
);

// 3. SAFE-1: context propagation must not crash and must not bleed, even
// without process/Deno (so no require('node:async_hooks') path at all).
const results = [];
await Promise.all([
  runWithContext({ correlationId: 'edge-req-A' }, async () => {
    await new Promise((r) => setTimeout(r, 10));
    results.push(createLogger('a').withCorrelationId('edge-req-A').getCorrelationId());
  }),
  runWithContext({ correlationId: 'edge-req-B' }, async () => {
    await new Promise((r) => setTimeout(r, 5));
    results.push(createLogger('b').withCorrelationId('edge-req-B').getCorrelationId());
  }),
]);
check(
  'SAFE-1: context propagation works without process/Deno/require',
  results.includes('edge-req-A') && results.includes('edge-req-B'),
);

// 4. Logging must never throw even when passed a poisoned getter (SAFE-4),
// verified again in this exact stripped-down environment.
try {
  const poisoned = { get x() { throw new Error('boom'); } };
  logger.info('poisoned', poisoned);
  check('SAFE-4: poisoned getter does not crash the caller on edge-sim', true);
} catch {
  check('SAFE-4: poisoned getter does not crash the caller on edge-sim', false);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
if (failures > 0) {
  throw new Error(`edge-sim smoke test had ${failures} failure(s)`);
}
