<div align="center">

# @nextrush/log

**Universal logging for modern JavaScript.**

Node.js • Bun • Deno • Browser • React • Next.js • Edge

[![npm](https://img.shields.io/npm/v/@nextrush/log?color=blue)](https://www.npmjs.com/package/@nextrush/log)
[![bundle](https://img.shields.io/bundlephobia/minzip/@nextrush/log?label=size)](https://bundlephobia.com/package/@nextrush/log)
[![license](https://img.shields.io/github/license/0xTanzim/nextrush-log)](https://github.com/0xTanzim/nextrush-log/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-vitepress-blueviolet)](https://0xtanzim.github.io/nextrush-log/)

</div>

---

**[Documentation Site →](https://0xtanzim.github.io/nextrush-log/)**

---

## Install

```bash
npm install @nextrush/log
```

---

## Quick Start

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('MyApp');

log.info('Server started', { port: 3000 });
log.warn('High memory', { used: '85%' });
log.error('Failed', new Error('timeout'));
```

**Development output** — pretty, colorful:
```
10:30:00 INFO  [MyApp] Server started { port: 3000 }
10:30:01 WARN  [MyApp] High memory { used: '85%' }
10:30:02 ERROR [MyApp] Failed Error: timeout
```

**Production output** — JSON for log aggregators:
```json
{"timestamp":"...","level":"info","context":"MyApp","message":"Server started","data":{"port":3000}}
```

---

## Log Levels

Six levels from verbose to critical:

| Level | Priority | When to Use |
|-------|:--------:|-------------|
| `trace` | 10 | Detailed debugging (function entry/exit) |
| `debug` | 20 | Development debugging |
| `info` | 30 | Normal operations ← **production default** |
| `warn` | 40 | Potential issues |
| `error` | 50 | Errors (recoverable) |
| `fatal` | 60 | Critical failures |

### Level Filtering

Setting `minLevel` logs that level **and above**:

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.debug('ignored');  // ❌ below warn
log.info('ignored');   // ❌ below warn
log.warn('logged');    // ✅
log.error('logged');   // ✅
```

| `minLevel` | trace | debug | info | warn | error | fatal |
|------------|:-----:|:-----:|:----:|:----:|:-----:|:-----:|
| `'trace'`  |  ✅   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'debug'`  |  ❌   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'info'`   |  ❌   |  ❌   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'warn'`   |  ❌   |  ❌   |  ❌  |  ✅  |  ✅   |  ✅   |
| `'error'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ✅   |  ✅   |

### Runtime Level Control

```typescript
// Change level at runtime
log.setLevel('error');  // Now only error + fatal

// Check before expensive operations
if (log.isLevelEnabled('debug')) {
  log.debug('Data', expensiveComputation());
}
```

---

## Environment Defaults

Auto-detects `NODE_ENV`:

| Setting | Development | Test | Production |
|---------|:-----------:|:----:|:----------:|
| `minLevel` | `trace` | `trace` | `info` |
| Output | Pretty | Pretty | JSON |
| Colors | ✅ | ✅ | ❌ |
| Redaction | ❌ | ❌ | ✅ |

### Override Environment

```typescript
// Force production mode
const log = createLogger('App', { env: 'production' });

// Force development mode
const log = createLogger('App', { env: 'development' });

// Production JSON + debug logs
const log = createLogger('App', {
  env: 'production',
  minLevel: 'debug'
});

// Only errors, always redact
const log = createLogger('App', {
  minLevel: 'error',
  redact: true
});
```

### Conditional Configuration

```typescript
const log = createLogger('App', {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'trace',
  redact: process.env.NODE_ENV === 'production',
});

// Or use env option
const log = createLogger('App', {
  env: process.env.NODE_ENV as 'development' | 'production',
});
```

---

## Features

### Child Loggers

```typescript
const log = createLogger('App');
const db = log.child('Database');
const api = log.child('API');

db.info('Connected');  // [App:Database] Connected
api.info('Ready');     // [App:API] Ready
```

### Request Tracing

```typescript
const requestLog = log.withCorrelationId('req-abc123');
requestLog.info('Processing');
// Output: { ..., "correlationId": "req-abc123" }
```

### Performance Timing

```typescript
const timer = log.time('db-query');
const result = await db.query('SELECT * FROM users');
timer.end('Done', { rows: result.length });
// "Done" { duration: 42, rows: 150 }
```

### Sensitive Data Redaction

In production, sensitive fields are auto-redacted:

```typescript
log.info('Login', {
  user: 'john@example.com',
  password: 'secret123',  // → "[REDACTED]"
  token: 'xyz',           // → "[REDACTED]"
});
```

Add custom keys:
```typescript
const log = createLogger('App', {
  sensitiveKeys: ['ssn', 'bankAccount'],
});
```

---

## Configuration

```typescript
const log = createLogger('App', {
  // Environment
  env: 'production',        // 'development' | 'test' | 'production'

  // Filtering
  minLevel: 'info',         // 'trace'|'debug'|'info'|'warn'|'error'|'fatal'

  // Output
  pretty: false,            // true = human readable, false = JSON
  colors: false,            // Terminal colors
  silent: false,            // Disable all output

  // Security
  redact: true,             // Redact sensitive keys
  sensitiveKeys: ['custom'],// Additional keys to redact

  // Context
  correlationId: 'req-123',
  metadata: { service: 'api', version: '2.0' },
});
```

---

## Custom Transports

```typescript
import { createLogger, createBatchTransport } from '@nextrush/log';

const { transport, flush } = createBatchTransport(
  async (logs) => {
    await fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify(logs)
    });
  },
  { batchSize: 50, flushInterval: 5000 }
);

const log = createLogger('App');
log.addTransport(transport);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await flush();
  process.exit(0);
});
```

---

## Browser & React

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('App');
log.info('Works in browser!');
```

### React

```tsx
import { LogProvider, useLogger } from '@nextrush/log/react';

function App() {
  return (
    <LogProvider context="MyApp">
      <MyComponent />
    </LogProvider>
  );
}

function MyComponent() {
  const log = useLogger('MyComponent');
  return <button onClick={() => log.info('Clicked!')}>Click</button>;
}
```

---

## API

| Method | Description |
|--------|-------------|
| `createLogger(name, options?)` | Create logger |
| `log.trace/debug/info/warn/error/fatal()` | Log at level |
| `log.child(name)` | Create child logger |
| `log.withCorrelationId(id)` | Add correlation ID |
| `log.time(label?)` | Start timer |
| `log.setLevel(level)` | Change level at runtime |
| `log.isLevelEnabled(level)` | Check if level enabled |
| `log.addTransport(fn)` | Add custom transport |
| `log.flush()` | Flush transports |

[Full API →](./docs/api.md) · [Examples →](./docs/examples.md) · [Architecture →](./docs/architecture.md)

---

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
