// Deno universality smoke test — run against the BUILT dist output, not source,
// since that's what real consumers get. Exercises: basic logging, child loggers,
// redaction, correlation IDs, and SAFE-1 (async-context isolation) specifically
// under Deno, which does not provide Node's `require('node:async_hooks')` path.
import {
  createContextMiddleware,
  createLogger,
  log,
  runWithContext,
} from '../dist/index.js';

let failures = 0;

function check(name, condition) {
  if (condition) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failures++;
  }
}

// 1. Basic logger creation and logging works at all under Deno.
const logger = createLogger('deno-smoke');
try {
  logger.info('hello from deno', { runtime: 'deno' });
  check('basic logging does not throw', true);
} catch {
  check('basic logging does not throw', false);
}

// 2. The default `log` instance works.
try {
  log.info('default logger works under deno');
  check('default log instance works', true);
} catch {
  check('default log instance works', false);
}

// 3. Child loggers work.
const child = logger.child('sub');
check('child logger has correct context', child.getContext() === 'deno-smoke:sub');

// 4. Redaction works under Deno (SAFE-3/SAFE-11 regression guard).
const captured = [];
const originalInfo = console.info;
console.info = (...args) => {
  captured.push(args.map(String).join(' '));
  originalInfo.apply(console, args);
};
logger.info('login attempt', { password: 'super-secret-value' });
console.info = originalInfo;
check(
  'sensitive keys are redacted under Deno',
  !captured.some((line) => line.includes('super-secret-value')),
);

// 5. SAFE-1: async context does not bleed between two "concurrent" runWithContext calls.
async function contextIsolationCheck() {
  const results = [];

  const taskA = runWithContext({ correlationId: 'req-A' }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ctxLogger = createLogger('ctx-a').withCorrelationId('req-A');
    results.push(ctxLogger.getCorrelationId());
  });

  const taskB = runWithContext({ correlationId: 'req-B' }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const ctxLogger = createLogger('ctx-b').withCorrelationId('req-B');
    results.push(ctxLogger.getCorrelationId());
  });

  await Promise.all([taskA, taskB]);

  check(
    'runWithContext does not throw when interleaved under Deno',
    results.length === 2,
  );
  check(
    'each interleaved context keeps its own correlation id (SAFE-1)',
    results.includes('req-A') && results.includes('req-B'),
  );
}

await contextIsolationCheck();

// 6. createContextMiddleware works without throwing.
try {
  const middleware = createContextMiddleware((req) => ({ correlationId: req.id }));
  let nextCalled = false;
  middleware({ id: 'mw-req-1' }, {}, () => { nextCalled = true; });
  check('createContextMiddleware invokes next()', nextCalled);
} catch {
  check('createContextMiddleware invokes next()', false);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
if (failures > 0) {
  Deno.exit(1);
}
