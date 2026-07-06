// Reproduction: dual-package hazard. If a bundler/host loads BOTH the ESM
// and CJS builds of @nextrush/log into one process (e.g. one dependency
// requires() it while the app import()s it), each build has its OWN
// config-store singleton — disableLogging() on one never reaches loggers
// created via the other. This is the most plausible root cause of "disable
// doesn't work" reports from real consumers using bundlers/monorepos.
import { createRequire } from 'node:module';

const esm = await import('../dist/index.js');
const require_ = createRequire(import.meta.url);
const cjs = require_('../dist/index.cjs');

const captured = [];
const originalInfo = console.info;
console.info = (...args) => { captured.push(args.map(String).join(' ')); };

// Disable via the ESM instance only.
esm.disableLogging();

// Log via the CJS instance's logger.
const cjsLogger = cjs.createLogger('cjs-instance-test');
cjsLogger.info('this should be silenced if disable propagates correctly');

console.info = originalInfo;

const stillLogged = captured.length > 0;
console.log(stillLogged
  ? 'BUG REPRODUCED: disableLogging() via ESM did NOT silence a logger created via CJS (dual-package hazard)'
  : 'OK: disableLogging() propagated across ESM/CJS instances');

if (stillLogged) {
  console.log('Captured output that should have been silenced:', captured);
  process.exitCode = 1;
}
