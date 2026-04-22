# Getting Started

Get up and running with `@nextrush/log` in 5 minutes.

## Installation

```bash
npm install @nextrush/log
```

## Log Levels at a Glance

Six levels from most verbose to most critical (internal priority **0–5** — see [API](/api#log-levels)):

| Level | When to Use |
|-------|-------------|
| `trace` | Very chatty diagnostics |
| `debug` | Development detail |
| `info` | Normal operations |
| `warn` | Something wrong but recoverable |
| `error` / `fatal` | Failures |

Setting `minLevel: 'warn'` shows **warn, error, and fatal** only. Global `configure({ minLevel })` is a **floor**: the **stricter** of the global floor and each logger’s `minLevel` wins — see [Global configuration](/global-configuration).

## Environment Defaults

The logger auto-detects your environment:

| Setting | Development | Test | Production |
|---------|:-----------:|:----:|:----------:|
| `minLevel` | `trace` | `trace` | `info` |
| Output | Pretty + Colors | Pretty + Colors | JSON |
| Redaction | Off | Off | On |

**Development** — See everything for debugging:
```
10:30:00 DEBUG [App] User data { password: 'secret123' }
```

**Production** — JSON for log aggregators, sensitive data protected:
```json
{"level":"debug","message":"User data","data":{"password":"[REDACTED]"}}
```

## Quick Start

### 1. Create a Logger

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('MyApp');
```

### 2. Log at Different Levels

```typescript
log.trace('Function entered', { fn: 'processUser' });
log.debug('Processing user', { userId: 123 });
log.info('User logged in', { userId: 123 });
log.warn('Rate limit approaching', { current: 95, max: 100 });
log.error('Failed to save', new Error('DB timeout'));
log.fatal('Cannot start', new Error('Port in use'));
```

### 3. See Output

**Development:**
```
10:30:00 TRACE [MyApp] Function entered { fn: 'processUser' }
10:30:00 DEBUG [MyApp] Processing user { userId: 123 }
10:30:00 INFO  [MyApp] User logged in { userId: 123 }
10:30:00 WARN  [MyApp] Rate limit approaching { current: 95, max: 100 }
10:30:00 ERROR [MyApp] Failed to save Error: DB timeout
10:30:00 FATAL [MyApp] Cannot start Error: Port in use
```

**Production (NODE_ENV=production):**
```json
{"timestamp":"...","level":"info","context":"MyApp","message":"User logged in","data":{"userId":123}}
{"timestamp":"...","level":"warn","context":"MyApp","message":"Rate limit approaching","data":{"current":95,"max":100}}
{"timestamp":"...","level":"error","context":"MyApp","message":"Failed to save","error":{"name":"Error","message":"DB timeout"}}
{"timestamp":"...","level":"fatal","context":"MyApp","message":"Cannot start","error":{"name":"Error","message":"Port in use"}}
```

Notice: In production, `trace` and `debug` are filtered out by default.

## Central Configuration (For Large Apps)

::: tip Key Concept
Configure logging **ONCE** at app startup. Every other file just uses `createLogger()` - the global config automatically applies!
:::

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Config (Singleton)                 │
│                                                             │
│  configure() or disableLogging() ←── Call from ONE place    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
            Automatically affects ALL loggers
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ file1.ts │          │ file2.ts │          │ file3.ts │
   │ createLogger()      │ createLogger()      │ createLogger()
   └─────────┘          └─────────┘          └─────────┘
       ... up to 500+ files - ALL respect global config
```

### Example: Central Configuration

```typescript
// ====== src/lib/logger.ts (ONLY config file) ======
import { configure, createLogger } from '@nextrush/log';

export function initializeLogging() {
  configure({
    enabled: process.env.NODE_ENV !== 'test',
    minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  });
}

export { createLogger };
```

```typescript
// ====== src/index.ts (entry point) ======
import { initializeLogging } from './lib/logger';
initializeLogging(); // Call ONCE at startup!

// ... rest of app
```

```typescript
// ====== ANY other file (500+ files) ======
import { createLogger } from '@nextrush/log';

const log = createLogger('users:service');
log.info('Working!'); // Automatically uses global config!
```

For complete details, see [Global Configuration](./global-configuration.md).

## Control What Gets Logged

### Disable All Logging (One Line!)

```typescript
import { disableLogging } from '@nextrush/log';

disableLogging(); // All loggers across all files are now silent
```

### Enable All Logging

```typescript
import { enableLogging } from '@nextrush/log';

enableLogging(); // All loggers start logging again
```

### Set Global Level

```typescript
import { setGlobalLevel } from '@nextrush/log';

setGlobalLevel('error'); // Global floor: only error + fatal unless a logger is stricter
```

### Set Minimum Level per Logger

```typescript
// Only warn and above
const log = createLogger('App', { minLevel: 'warn' });

log.debug('Ignored');  // ❌ Not logged (below warn)
log.info('Ignored');   // ❌ Not logged (below warn)
log.warn('Logged');    // ✅ Logged
log.error('Logged');   // ✅ Logged
```

### Level filtering matrix

See [Log levels](/log-levels#matrix) (same table as the API reference).

### Change Level at Runtime

```typescript
const log = createLogger('App');

// Later, reduce noise
log.setLevel('error');

// Check before expensive operations
if (log.isLevelEnabled('debug')) {
  log.debug('Details', computeExpensiveData());
}
```

## Override Environment Defaults

```typescript
// Force production mode (JSON, redaction enabled)
const log = createLogger('App', { env: 'production' });

// Force development mode (pretty, no redaction)
const log = createLogger('App', { env: 'development' });

// Production JSON but include debug logs
const log = createLogger('App', {
  env: 'production',
  minLevel: 'debug',
});

// Development but with redaction (testing redaction)
const log = createLogger('App', {
  env: 'development',
  redact: true,
});
```

## Common Patterns

### Child Loggers

```typescript
const log = createLogger('App');
const dbLog = log.child('Database');
const apiLog = log.child('API');

dbLog.info('Connected');  // [App:Database] Connected
apiLog.info('Ready');     // [App:API] Ready
```

### Request Tracing

```typescript
app.use((req, res, next) => {
  req.log = log.withCorrelationId(req.headers['x-request-id']);
  next();
});

app.get('/users', (req, res) => {
  req.log.info('Fetching users');
  // Log includes correlationId for tracing
});
```

### Add Metadata to All Logs

```typescript
const log = createLogger('API', {
  metadata: {
    service: 'user-api',
    version: '2.1.0',
    region: 'us-east-1',
  },
});

log.info('Started');
// Every log includes service, version, region
```

### Measure Performance

`timer.end()` emits a **debug**-level entry; it appears only if debug is allowed for that logger.

```typescript
const timer = log.time('db-query');
const result = await db.query('SELECT * FROM users');
timer.end('Query done', { rows: result.length });
```

## Browser & React

Same API works everywhere:

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('App');
log.info('Works in browser!');
```

### React Integration

```tsx
import { LoggerProvider, useLogger } from '@nextrush/log/react';

function App() {
  return (
    <LoggerProvider context="MyApp" options={{ minLevel: 'debug' }}>
      <MyComponent />
    </LoggerProvider>
  );
}

function MyComponent() {
  const log = useLogger('MyComponent');
  return <button onClick={() => log.info('Clicked!')}>Click</button>;
}
```

`LoggerProvider` applies `globalConfig` with **`configure` in a `useEffect`**, so the singleton updates after the component mounts. See [Browser & React](/browser-react).

## Sensitive Data Redaction

In production (`env: 'production'` or `NODE_ENV=production`), sensitive fields are auto-redacted:

```typescript
log.info('Login', {
  user: 'john@example.com',
  password: 'secret123',  // → "[REDACTED]"
  token: 'bearer-xyz',    // → "[REDACTED]"
});
```

Add custom sensitive keys:

```typescript
const log = createLogger('App', {
  sensitiveKeys: ['ssn', 'bankAccount'],
});
```

## Next Steps

- [Global Configuration](./global-configuration.md) — Control all loggers from one place
- [Best Practices](./best-practices.md) — Production patterns for enterprise apps
- [API Reference](./api.md) — Complete method documentation
- [Examples](./examples.md) — Express, Next.js, React patterns
