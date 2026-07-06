# API Reference

Complete API documentation for `@nextrush/log` v0.3.0.

> This reference covers the **public surface only** — the ~20 exports available from
> `@nextrush/log`, `@nextrush/log/browser`, `@nextrush/log/react`, and `@nextrush/log/testing`.
> Internal helpers (serialization, redaction matching, runtime detection, etc.) are not
> part of the public contract and are not documented here — see [CHANGELOG](https://github.com/0xTanzim/nextrush-log/blob/main/CHANGELOG.md)
> if you're migrating from v0.2.x and relied on one of them.

---

## Log Levels

### Level Hierarchy

| Level | Priority (internal) | Description |
|-------|:-------------------:|-------------|
| `trace` | 0 | Most verbose — detailed debugging |
| `debug` | 1 | Development debugging |
| `info` | 2 | Normal operations (production default) |
| `warn` | 3 | Potential issues |
| `error` | 4 | Errors (recoverable) |
| `fatal` | 5 | Critical failures |

### Level Filtering

Setting `minLevel` logs that level **and all higher priority levels**:

| `minLevel` | trace | debug | info | warn | error | fatal |
|------------|:-----:|:-----:|:----:|:----:|:-----:|:-----:|
| `'trace'`  |  ✅   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'debug'`  |  ❌   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'info'`   |  ❌   |  ❌   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'warn'`   |  ❌   |  ❌   |  ❌  |  ✅  |  ✅   |  ✅   |
| `'error'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ✅   |  ✅   |
| `'fatal'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ❌   |  ✅   |

---

## Environment Defaults

The logger auto-configures based on `NODE_ENV` (and Vite's `MODE`/`PROD`/`DEV`):

| Setting | Development | Test | Production | **Undetected** |
|---------|:-----------:|:----:|:----------:|:---------------:|
| `minLevel` | `trace` | `trace` | `info` | `trace` |
| `pretty` | `true` | `true` | `false` | `true` |
| `colors` | `true` | `true` | `false` | `true` |
| `redact` | `false` | `false` | `true` | **`true`** |

**"Undetected"** means no `NODE_ENV`, no Vite env signal, and no explicit `env` option — this
happens on some edge/serverless runtimes. Redaction fails **safe** in that case (defaults to
on) rather than silently behaving like development, because a logger must never become a data
leak just because a platform doesn't expose `NODE_ENV`. An explicit `env: 'development'` or
`redact: false` always overrides this and disables redaction, as expected.

Override with the `env` option or individual settings.

---

## Table of Contents

- [Global Configuration](#global-configuration)
- [createLogger](#createlogger)
- [Log Methods](#log-methods)
- [Child Loggers](#child-loggers)
- [Timing](#timing)
- [Transports](#transports)
- [Types](#types)
- [Redacted Keys](#redacted-keys)

---

## Global Configuration

Control all loggers from a single place. `configure()` is the one function you need — it
covers every field global config has.

### configure()

```typescript
import { configure } from '@nextrush/log';

configure({
  enabled: true,                 // Master switch
  minLevel: 'warn',              // Global floor (stricter of this and each logger's floor wins)
  silent: false,                 // Global kill: no log output when true
  env: 'production',             // Environment preset
  enabledNamespaces: ['api:*'],  // Namespace filtering
  disabledNamespaces: ['debug:*'],
  defaults: {                    // Defaults for new loggers
    pretty: false,
    redact: true,
  },
});
```

### disableLogging()

```typescript
import { disableLogging } from '@nextrush/log';

disableLogging(); // All loggers become no-ops — call configure({ enabled: true }) to re-enable
```

### Namespace Filtering

```typescript
import { configure } from '@nextrush/log';

// Only log from specific modules
configure({ enabledNamespaces: ['api:*', 'auth:*'] });

// Disable verbose modules
configure({ disabledNamespaces: ['debug:*', 'trace:*'] });
```

### Global Transports

```typescript
import { addGlobalTransport } from '@nextrush/log';

// Add a transport that receives every log entry from every logger
addGlobalTransport((entry) => sendToMonitoring(entry));
```

---

## createLogger

Create a new logger instance.

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger(context, options?);
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | `string` | Yes | Logger name (appears in output) |
| `options` | `LoggerOptions` | No | Configuration options |

### Options

```typescript
interface LoggerOptions {
  // Environment
  env?: 'development' | 'test' | 'production';

  // Level filtering
  minLevel?: LogLevel;        // Default: 'trace' (dev) or 'info' (prod)

  // Output format
  pretty?: boolean;           // Default: true (dev) or false (prod)
  colors?: boolean;           // Default: true (dev) or false (prod)
  silent?: boolean;           // Default: false

  // Security
  redact?: boolean;           // Default: false (dev/test) or true (prod/undetected)
  sensitiveKeys?: string[];   // Additional keys to redact

  // Context
  correlationId?: string;     // Request/trace ID
  metadata?: object;          // Added to all log entries

  // Serialization limits
  maxDepth?: number;          // Default: 10
  maxStringLength?: number;   // Default: 10000
  maxArrayLength?: number;    // Default: 100

  // Advanced
  samplingRate?: number;      // 0-1, for debug/trace logs in production
  transports?: LogTransport[];// Custom transports
}
```

### Examples

```typescript
// Basic
const log = createLogger('MyApp');

// Production mode
const log = createLogger('API', { env: 'production' });

// Custom configuration
const log = createLogger('API', {
  minLevel: 'debug',
  metadata: { service: 'user-api', version: '2.1.0' },
  sensitiveKeys: ['internalToken'],
});

// Only errors
const log = createLogger('App', { minLevel: 'error' });
```

### `log` — the default instance

```typescript
import { log } from '@nextrush/log';

log.info('Same as createLogger("app")');
```

`log` is the only pre-built instance the package exports — there is no separate `logger` or
`scopedLogger` alias; use `createLogger(name)` directly for anything beyond the default.

---

## Log Methods

All log methods accept flexible arguments:

```typescript
// Just message
log.info(message);

// Message + data
log.info(message, data);

// Message + error
log.info(message, error);

// Message + data + error
log.info(message, data, error);

// Just data (message auto-generated)
log.info(data);

// Just error (message from error)
log.info(error);
```

### trace

```typescript
log.trace('Entering function', { fn: 'processUser', args: [123] });
```

Use for: Function entry/exit, variable values, loop iterations.

### debug

```typescript
log.debug('User state', { userId: 123, role: 'admin' });
```

Use for: Development debugging, request details, state changes.

### info

```typescript
log.info('User logged in', { userId: 123, ip: '192.168.1.1' });
```

Use for: Normal operations, milestones, successful actions.

### warn

```typescript
log.warn('Rate limit approaching', { current: 95, max: 100 });
```

Use for: Potential issues, deprecated APIs, approaching limits.

### error

```typescript
log.error('Database query failed', { query: 'SELECT...' }, new Error('timeout'));
```

Use for: Errors that are caught and handled, failed operations.

### fatal

```typescript
log.fatal('Cannot start server', new Error('Port 3000 in use'));
```

Use for: Critical failures, app crashes, unrecoverable errors.

A logging call can never throw into your code — if serializing a poisoned argument
internally fails, the logger falls back to a minimal `console.error` line instead of
propagating the failure.

---

## Logger Instance Methods

### setLevel

Change minimum log level at runtime.

```typescript
log.setLevel(level: LogLevel): void
```

```typescript
log.setLevel('error'); // Only error and fatal from now
log.setLevel('trace'); // Show everything
```

### isLevelEnabled

Check if a level would be logged.

```typescript
log.isLevelEnabled(level: LogLevel): boolean
```

```typescript
// Avoid expensive computation if not needed
if (log.isLevelEnabled('debug')) {
  const debugData = computeExpensiveDebugInfo();
  log.debug('Details', debugData);
}
```

### getContext

```typescript
log.getContext(): string
```

### getCorrelationId

```typescript
log.getCorrelationId(): string | undefined
```

### flush

Flush all transports that support it (for graceful shutdown). Only **instance**
transports are flushed; global transports are not (unless you flush them yourself).

```typescript
await log.flush(): Promise<void>
```

### dispose

Kept for backward compatibility. The current architecture doesn't retain any per-instance
subscription that needs cleanup, so this is a documented no-op — safe to call, and safe to
stop calling.

```typescript
log.dispose(): void
```

---

## Child Loggers

### child

Create a child logger with extended context.

```typescript
log.child(additionalContext: string, options?: Partial<LoggerOptions>): Logger
```

```typescript
const log = createLogger('App');
const dbLog = log.child('Database');
const cacheLog = log.child('Cache');

dbLog.info('Query');  // [App:Database] Query
cacheLog.info('Hit'); // [App:Cache] Hit

// With options override
const verboseDb = dbLog.child('', { minLevel: 'trace' });
```

### withCorrelationId

```typescript
log.withCorrelationId(id: string): Logger
```

```typescript
const requestLog = log.withCorrelationId('req-abc-123');
requestLog.info('Processing'); // includes correlationId in output
```

### withMetadata

```typescript
log.withMetadata(data: object): Logger
```

```typescript
const userLog = log.withMetadata({ userId: 123, role: 'admin' });
userLog.info('Action performed'); // includes userId and role
```

---

## Timing

::: info Log level
`timer.end()` emits a **`debug`**-level entry. It only appears if your effective minimum level includes `debug` (and global/namespace rules allow it).
:::

### time

```typescript
log.time(label?: string): Timer

interface Timer {
  elapsed(): number; // Get elapsed ms without stopping
  end(message?: string, context?: Record<string, unknown>): number; // Log duration and return ms
}
```

### Example

```typescript
const timer = log.time('database-query');

const result = await db.query('SELECT * FROM users');

timer.end('Query completed', { rows: result.length });
// Output: "Query completed" { duration: 42, rows: 150 }
```

```typescript
// Check elapsed without stopping
const timer = log.time('operation');
doStepOne();
console.log(`Step 1: ${timer.elapsed()}ms`);
doStepTwo();
console.log(`Step 2: ${timer.elapsed()}ms`);
timer.end('Done');
```

---

## Transports

### addTransport

```typescript
log.addTransport(transport: LogTransport): void

type LogTransport = (entry: LogEntry) => void | Promise<void>;
```

```typescript
log.addTransport((entry) => {
  fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
});
```

> Console output is always built in — do not add a "console transport" of your own, or every
> line will print twice.

### createBatchTransport

```typescript
import { createBatchTransport } from '@nextrush/log';

const { transport, flush, destroy } = createBatchTransport(
  handler: (entries: LogEntry[]) => Promise<void>,
  options?: {
    batchSize?: number;      // Default: 10
    flushInterval?: number;  // Default: 5000ms
    maxRetries?: number;     // Default: 3
    onError?: (error, entries) => void;
  }
);
```

```typescript
const { transport, flush, destroy } = createBatchTransport(
  async (entries) => {
    await fetch('/api/logs', { method: 'POST', body: JSON.stringify(entries) });
  },
  { batchSize: 50, flushInterval: 10000 }
);

log.addTransport(transport);

// On shutdown
process.on('SIGTERM', async () => {
  await flush();
  destroy();
  process.exit(0);
});
```

### createFilteredTransport

```typescript
import { createFilteredTransport } from '@nextrush/log';

const transport = createFilteredTransport(
  handler: LogTransport,
  minLevel: LogLevel
);
```

```typescript
// Only send errors to error tracking service
const errorTransport = createFilteredTransport((entry) => sendToSentry(entry), 'error');
log.addTransport(errorTransport);
```

### createRateLimitedTransport

Rate limit logs using a token-bucket algorithm. Accepts an optional per-namespace
configuration, so you no longer need a separate "namespace rate limited" variant.

```typescript
import { createRateLimitedTransport } from '@nextrush/log';

const { transport, getStats, reset } = createRateLimitedTransport(
  innerTransport: LogTransport,
  options?: {
    maxLogsPerSecond?: number;   // Default: 100
    burstAllowance?: number;     // Default: 50
    bypassLevels?: LogLevel[];   // Default: ['error', 'fatal']
    onDrop?: (entry, stats) => void;
  }
);
```

```typescript
const { transport, getStats } = createRateLimitedTransport(myTransport, {
  maxLogsPerSecond: 100,
  burstAllowance: 50,
  onDrop: (entry, stats) => {
    console.warn(`Dropped: ${stats.totalDropped}`);
  },
});

log.addTransport(transport);
```

---

## Async Context

Automatic context propagation across async boundaries, backed by `AsyncLocalStorage` on
Node.js. On runtimes without it (some edge/browser environments), propagation is scoped so
concurrent calls never observe each other's context — it never falls back to unsafe shared
state.

### runWithContext

```typescript
import { runWithContext } from '@nextrush/log';

await runWithContext(
  context: { correlationId?: string; metadata?: object },
  callback: () => T | Promise<T>
): T | Promise<T>
```

```typescript
await runWithContext({ correlationId: 'req-123' }, async () => {
  log.info('Has correlationId automatically');
  await someAsyncOperation();
});
```

### getAsyncContext

```typescript
import { getAsyncContext } from '@nextrush/log';

const ctx = getAsyncContext();
console.log(ctx?.correlationId);
console.log(ctx?.metadata);
```

### createContextMiddleware

Create Express/Koa-style middleware.

```typescript
import { createContextMiddleware } from '@nextrush/log';

const middleware = createContextMiddleware((req) => ({
  correlationId: req.headers['x-request-id'],
  metadata: { userId: req.user?.id },
}));

app.use(middleware);
```

---

## Types

### LogLevel

```typescript
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  /** Structured payload (logger `metadata` and async context merge here) */
  data?: Record<string, unknown>;
  error?: SerializedError;
  correlationId?: string;
  performance?: { duration: number };
  runtime: string;
  pid?: number;
}
```

### SerializedError

```typescript
interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: SerializedError;
}
```

### LogTransport

```typescript
type LogTransport = (entry: LogEntry) => void | Promise<void>;
```

### LoggerOptions

```typescript
interface LoggerOptions {
  env?: 'development' | 'test' | 'production';
  minLevel?: LogLevel;
  pretty?: boolean;
  colors?: boolean;
  silent?: boolean;
  redact?: boolean;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  sensitiveKeys?: string[];
  maxDepth?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  samplingRate?: number;
  transports?: LogTransport[];
}
```

---

## Redacted Keys

These keys are redacted whenever `redact` is on (production by default, and by default
whenever the environment can't be detected at all — see [Environment Defaults](#environment-defaults)).
Matching is whole-token based (camelCase/snake_case/kebab-case aware), so `primaryKey`,
`passport`, `author`, and `wildcard` are **not** redacted just because they contain `key`,
`pass`, `auth`, or `card` as a substring.

### Authentication & Authorization
`password`, `passwd`, `pwd`, `secret`, `token`, `apikey`, `api_key`, `apiSecret`, `api_secret`, `authorization`, `auth`, `bearer`, `credential`, `credentials`

### Cryptographic
`private`, `privatekey`, `private_key`, `publickey`, `public_key`, `certificate`, `cert`

### Tokens
`accesstoken`, `access_token`, `refreshtoken`, `refresh_token`, `idtoken`, `id_token`, `jwt`

### Session
`sessionid`, `session_id`, `sessionkey`, `session_key`, `cookie`, `cookies`

### Security
`csrf`, `xsrf`, `nonce`, `otp`, `totp`, `pin`

### PII
`ssn`, `social_security`, `socialsecurity`, `taxid`, `tax_id`

### Financial
`credit`, `creditcard`, `credit_card`, `card`, `cardnumber`, `card_number`, `cvv`, `cvc`, `ccv`, `expiry`, `expiration`, `accountnumber`, `account_number`, `routingnumber`, `routing_number`, `bankaccount`, `bank_account`

### Database
`connectionstring`, `connection_string`, `dbpassword`, `db_password`

### Cloud
`aws_secret`, `aws_secret_access_key`, `aws_access_key_id`

### Generic
`key`, `pass`, `hash`, `salt`, `signature`

Add custom keys:

```typescript
const log = createLogger('App', {
  sensitiveKeys: ['myCustomSecret', 'internalToken'],
});
```

Values matching an SSN or credit-card-number pattern are also redacted wherever they appear
inside structured data (not inside the free-text `message` string — prefer passing secrets as
structured data rather than interpolating them into a message).

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `'production'` enables JSON output and redaction |
| `DEBUG` | `'true'` enables debug level in production |
| `ENABLE_DEBUG_LOGS` | Alternative to `DEBUG` |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

---

## See Also

- [Getting Started](./getting-started.md)
- [Examples](./examples.md)
- [Architecture](./architecture.md)
