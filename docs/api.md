# API Reference

Complete API documentation for `@nextrush/log`.

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

The logger auto-configures based on `NODE_ENV`:

| Setting | Development | Test | Production |
|---------|:-----------:|:----:|:----------:|
| `minLevel` | `trace` | `trace` | `info` |
| `pretty` | `true` | `true` | `false` |
| `colors` | `true` | `true` | `false` |
| `redact` | `false` | `false` | `true` |
| `silent` (console) | `false` | `true`* | `false` |

\* When `NODE_ENV=test`, `configureFromEnv` sets `defaults.silent` unless you already set it.

Override with `env` option or individual settings.

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

Control all loggers from a single place.

### configure()

Set global options that affect all loggers.

```typescript
import { configure } from '@nextrush/log';

configure({
  enabled: true,              // Master switch
  minLevel: 'warn',           // Global floor (stricter of this and each logger’s floor wins)
  silent: false,              // Global kill: no log output when true
  env: 'production',          // Environment preset
  enabledNamespaces: ['api:*'],  // Namespace filtering
  disabledNamespaces: ['debug:*'],
  defaults: {                 // Defaults for new loggers
    pretty: false,
    redact: true,
  },
});
```

### disableLogging() / enableLogging()

```typescript
import { disableLogging, enableLogging } from '@nextrush/log';

disableLogging(); // All loggers become no-ops
enableLogging();  // Re-enable logging
```

### setGlobalLevel()

```typescript
import { setGlobalLevel } from '@nextrush/log';

setGlobalLevel('error'); // Global floor: stricter vs each logger’s `minLevel` wins
```

### Namespace Filtering

```typescript
import { enableNamespaces, disableNamespaces, isNamespaceEnabled } from '@nextrush/log';

// Only log from specific modules
enableNamespaces(['api:*', 'auth:*']);

// Disable verbose modules
disableNamespaces(['debug:*', 'trace:*']);

// Check if namespace would log
if (isNamespaceEnabled('api:users')) {
  // ...
}
```

### Global Transports

```typescript
import { addGlobalTransport, clearGlobalTransports } from '@nextrush/log';

// Add transport for all loggers
addGlobalTransport((entry) => sendToMonitoring(entry));

// Clear all global transports
clearGlobalTransports();
```

### configureFromEnv()

```typescript
import { configureFromEnv } from '@nextrush/log';

// Reads LOG_LEVEL, LOG_ENABLED, LOG_NAMESPACES, NODE_ENV
// Also: NEXT_PUBLIC_LOG_LEVEL, VITE_LOG_LEVEL, NEXT_PUBLIC_LOG_ENABLED, etc.
configureFromEnv((name) => process.env[name]);
```

Or pass `getEnvVar` from the main package (works across runtimes):

```typescript
import { configureFromEnv, getEnvVar } from '@nextrush/log';

configureFromEnv(getEnvVar);
```

### getGlobalConfig() / resetGlobalConfig() / clearGlobalLevel()

```typescript
import { getGlobalConfig, resetGlobalConfig, clearGlobalLevel } from '@nextrush/log';

const config = getGlobalConfig();
console.log(config.enabled, config.minLevel);

clearGlobalLevel(); // Unset global minLevel (per-logger + defaults apply)
resetGlobalConfig(); // Full reset to factory defaults
```

### onConfigChange()

```typescript
import { onConfigChange } from '@nextrush/log';

const unsubscribe = onConfigChange(() => {
  console.log('Config changed!');
});

unsubscribe(); // Stop listening
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
  timestamps?: boolean;       // Default: true

  // Security
  redact?: boolean;           // Default: false (dev) or true (prod)
  sensitiveKeys?: string[];   // Additional keys to redact

  // Context
  correlationId?: string;     // Request/trace ID
  metadata?: object;          // Added to all log entries

  // Serialization limits
  maxDepth?: number;          // Default: 10
  maxStringLength?: number;   // Default: 10000
  maxArrayLength?: number;    // Default: 100

  // Advanced
  samplingRate?: number;      // 0-1, for debug logs in production
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

### `log`, `logger`, and `scopedLogger`

The package also exports a **default app logger** and aliases:

```typescript
import { log, logger, scopedLogger, createLogger } from '@nextrush/log';

log.info('Same as a pre-built createLogger("app")');
logger.info('Identical to `log`');
const auth = scopedLogger('auth:login'); // createLogger('auth:login')
```

### Level helpers (tree-shakeable)

```typescript
import {
  shouldLog,
  stricterMinLevel,
  compareLevels,
  parseLogLevel,
  isValidLogLevel,
  LOG_LEVELS,
  LOG_LEVEL_PRIORITY,
} from '@nextrush/log';
```

Use these when you need the same level math as the library (e.g. custom filters).

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

Get the logger context name.

```typescript
log.getContext(): string
```

### getCorrelationId

Get the current correlation ID.

```typescript
log.getCorrelationId(): string | undefined
```

### flush

Flush all transports (for graceful shutdown). Only **instance** transports are flushed; global transports are not (unless you flush them yourself).

```typescript
await log.flush(): Promise<void>
```

### dispose

Unsubscribe this logger from global config change notifications. Use when you create many **short-lived** loggers to avoid listener buildup.

```typescript
log.dispose(): void
```

---

## Child Loggers

### child

Create a child logger with extended context.

```typescript
log.child(context: string, options?: Partial<LoggerOptions>): Logger
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

Create a child with a correlation ID for request tracing.

```typescript
log.withCorrelationId(id: string): Logger
```

```typescript
const requestLog = log.withCorrelationId('req-abc-123');
requestLog.info('Processing'); // includes correlationId in output
```

### withMetadata

Create a child with additional metadata.

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

Start a performance timer.

```typescript
log.time(label?: string): Timer
```

Returns:

```typescript
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

Add a custom transport function.

```typescript
log.addTransport(transport: LogTransport): void

type LogTransport = (entry: LogEntry) => void | Promise<void>;
```

```typescript
log.addTransport((entry) => {
  fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
});
```

### createBatchTransport

Batch log entries before sending.

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
    await fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify(entries),
    });
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

Filter logs by minimum level.

```typescript
import { createFilteredTransport } from '@nextrush/log';

const transport = createFilteredTransport(
  handler: LogTransport,
  minLevel: LogLevel
);
```

```typescript
// Only send errors to error tracking service
const errorTransport = createFilteredTransport(
  (entry) => sendToSentry(entry),
  'error'
);

log.addTransport(errorTransport);
```

### createPredicateTransport

Filter logs by custom predicate.

```typescript
import { createPredicateTransport } from '@nextrush/log';

const transport = createPredicateTransport(
  handler: LogTransport,
  predicate: (entry: LogEntry) => boolean
);
```

```typescript
// Only log entries from API context
const apiTransport = createPredicateTransport(
  (entry) => sendToApiLogs(entry),
  (entry) => entry.context.startsWith('API')
);
```

### createRateLimitedTransport

Rate limit logs using token bucket algorithm.

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

### createNamespaceRateLimitedTransport

Per-namespace rate limiting.

```typescript
import { createNamespaceRateLimitedTransport } from '@nextrush/log';

const transport = createNamespaceRateLimitedTransport(innerTransport, {
  'api:*': { maxLogsPerSecond: 100, burstAllowance: 50 },
  'db:*': { maxLogsPerSecond: 50 },
  '*': { maxLogsPerSecond: 200 },
});
```

---

## Async Context

Automatic context propagation across async boundaries.

### runWithContext

Run a function with async context.

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

Get the current async context.

```typescript
import { getAsyncContext } from '@nextrush/log';

const ctx = getAsyncContext();
console.log(ctx?.correlationId);
console.log(ctx?.metadata);
```

### getContextCorrelationId

Get just the current correlation ID.

```typescript
import { getContextCorrelationId } from '@nextrush/log';

const correlationId = getContextCorrelationId();
```

### getContextMetadata

Get just the current metadata.

```typescript
import { getContextMetadata } from '@nextrush/log';

const metadata = getContextMetadata();
```

### isAsyncContextAvailable

Check if AsyncLocalStorage is available.

```typescript
import { isAsyncContextAvailable } from '@nextrush/log';

if (isAsyncContextAvailable()) {
  // Use async context
}
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
  timestamps?: boolean;
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

These keys are automatically redacted in production (`redact: true`):

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
