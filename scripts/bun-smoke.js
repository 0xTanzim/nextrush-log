// Bun universality smoke test — run against the BUILT dist output.
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

const logger = createLogger('bun-smoke');
try {
  logger.info('hello from bun', { runtime: 'bun' });
  check('basic logging does not throw', true);
} catch {
  check('basic logging does not throw', false);
}

try {
  log.info('default logger works under bun');
  check('default log instance works', true);
} catch {
  check('default log instance works', false);
}

const child = logger.child('sub');
check('child logger has correct context', child.getContext() === 'bun-smoke:sub');

const captured = [];
const originalInfo = console.info;
console.info = (...args) => {
  captured.push(args.map(String).join(' '));
  originalInfo.apply(console, args);
};
logger.info('login attempt', { password: 'super-secret-value' });
console.info = originalInfo;
check(
  'sensitive keys are redacted under Bun',
  !captured.some((line) => line.includes('super-secret-value')),
);

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

  check('runWithContext does not throw when interleaved under Bun', results.length === 2);
  check(
    'each interleaved context keeps its own correlation id (SAFE-1)',
    results.includes('req-A') && results.includes('req-B'),
  );
}

await contextIsolationCheck();

try {
  const middleware = createContextMiddleware((req) => ({ correlationId: req.id }));
  let nextCalled = false;
  middleware({ id: 'mw-req-1' }, {}, () => { nextCalled = true; });
  check('createContextMiddleware invokes next()', nextCalled);
} catch {
  check('createContextMiddleware invokes next()', false);
}

// Bun exposes process.env like Node — verify production env resolves correctly.
const prodLogger = createLogger('bun-prod-test', { env: 'production' });
const prodCaptured = [];
const originalLog = console.log;
console.log = (...args) => {
  prodCaptured.push(args.map(String).join(' '));
};
prodLogger.info('prod check', { apiKey: 'prod-secret-key' });
console.log = originalLog;
check(
  'explicit production env redacts under Bun',
  !prodCaptured.some((line) => line.includes('prod-secret-key')),
);

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
if (failures > 0) {
  process.exit(1);
}
