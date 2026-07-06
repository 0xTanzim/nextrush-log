<div align="center">

# @nextrush/log

**Universal logging for modern JavaScript.**

Zero dependencies • Tree-shakeable • Production-ready

Node.js • Bun • Deno • Browser • React • Next.js • Edge

[![npm](https://img.shields.io/npm/v/@nextrush/log?color=blue)](https://www.npmjs.com/package/@nextrush/log)
[![bundle](https://img.shields.io/bundlephobia/minzip/@nextrush/log?label=size)](https://bundlephobia.com/package/@nextrush/log)
[![license](https://img.shields.io/github/license/0xTanzim/nextrush-log)](https://github.com/0xTanzim/nextrush-log/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-vitepress-blueviolet)](https://0xtanzim.github.io/nextrush-log/)

</div>

---

## Why @nextrush/log?

- 🎯 **One config controls ALL loggers** — call `configure()` once, every `createLogger()` obeys it
- 🚀 **Zero dependencies** — no bloat, no supply-chain risk
- 🌍 **Universal** — same API on Node, Bun, Deno, edge runtimes, and the browser
- 🔒 **Production-safe by default** — auto-redaction, log-injection sanitization, and a fail-safe default (redaction stays ON if the runtime environment can't be detected)
- 📦 **Small, deliberate public API** — ~20 exports total, not hundreds of internal helpers leaking through

**[📖 Documentation](https://0xtanzim.github.io/nextrush-log/)** · **[📋 Changelog](./CHANGELOG.md)**

---

## Install

```bash
npm install @nextrush/log
```

> **Coming from v0.2.x?** v0.3.0 is a breaking release that removes redundant/internal exports. See [CHANGELOG.md](./CHANGELOG.md) for the full migration list.

---

## Quick Start

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('MyApp');

log.info('Server started', { port: 3000 });
log.warn('High memory', { used: '85%' });
log.error('Failed', new Error('timeout'));
```

**Development** — pretty, colorful output:
```
10:30:00 INFO  [MyApp] Server started { port: 3000 }
10:30:01 WARN  [MyApp] High memory { used: '85%' }
10:30:02 ERROR [MyApp] Failed Error: timeout
```

**Production** — structured JSON for log aggregators (Datadog, CloudWatch, etc.):
```json
{"timestamp":"2026-01-15T10:30:00.000Z","level":"info","context":"MyApp","message":"Server started","data":{"port":3000}}
```

---

## Central Control

One call controls every logger created anywhere in your app.

```typescript
// app-entry.ts — configure ONCE at startup
import { configure, disableLogging } from '@nextrush/log';

// Disable ALL logging instantly, from any file
disableLogging();

// Or configure globally
configure({
  enabled: process.env.NODE_ENV !== 'test',
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});
```

Every `createLogger()` call anywhere in the codebase — in this file or any
other — reads that same global config live. No dependency injection, no
prop-drilling a logger instance through 500 files.

---

## Log Levels

| Level | Priority | Use Case |
|-------|:--------:|----------|
| `trace` | 0 | Detailed debugging |
| `debug` | 1 | Development info |
| `info` | 2 | Normal operations ← **production default** |
| `warn` | 3 | Potential issues |
| `error` | 4 | Recoverable errors |
| `fatal` | 5 | Critical failures |

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.debug('ignored');  // ❌ below warn
log.warn('logged');    // ✅
log.error('logged');   // ✅
```

The effective minimum level is the **stricter** of the global `configure({ minLevel })` floor and each logger's own `minLevel`.

---

## Environment Behavior

| Setting | Development | Production |
|---------|:-----------:|:----------:|
| `minLevel` | `trace` | `info` |
| Output | Pretty + colors | JSON |
| Redaction | Off | On |

Environment is auto-detected from `NODE_ENV` (and Vite's `MODE`/`PROD`/`DEV`). **If no signal is available at all** (common on some edge/serverless runtimes), redaction defaults to **on** rather than silently turning it off — logging must never become a data leak just because a platform doesn't expose `NODE_ENV`.

```typescript
// Auto-detects
const log = createLogger('App');

// Or force it explicitly
const log = createLogger('App', { env: 'production' });
```

---

## Features

### Namespace Filtering (Large Codebases)

```typescript
import { configure, createLogger } from '@nextrush/log';

// Only log from specific modules
configure({ enabledNamespaces: ['api:*', 'auth:*'] });

createLogger('api:users').info('Logged');     // ✅
createLogger('db:queries').info('Ignored');   // ❌
```

### Child Loggers

```typescript
const log = createLogger('App');
const db = log.child('Database');

db.info('Connected');  // [App:Database] Connected
```

### Request Tracing

```typescript
const requestLog = log.withCorrelationId('req-abc123');
requestLog.info('Processing');
// Output includes: "correlationId": "req-abc123"
```

### Performance Timing

```typescript
const timer = log.time('db-query');
await db.query('SELECT * FROM users');
timer.end('Done', { rows: 100 });
// "Done" { duration: 42, rows: 100 }
```

### Auto-Redaction

```typescript
log.info('Login', {
  email: 'john@example.com',
  password: 'secret123',  // → "[REDACTED]"
  token: 'xyz',            // → "[REDACTED]"
});
```

Redaction matches whole key tokens (camelCase/snake_case/kebab-case aware), so it catches `apiKey`/`secret_token` without over-redacting unrelated fields like `primaryKey` or `passport`.

### Custom Transports

```typescript
import { createBatchTransport } from '@nextrush/log';

const { transport, flush } = createBatchTransport(
  async (logs) => fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify(logs)
  }),
  { batchSize: 50, flushInterval: 5000 }
);

log.addTransport(transport);
```

### Async Context Propagation

```typescript
import { createContextMiddleware, runWithContext } from '@nextrush/log';

// Express/Koa-style middleware
app.use(createContextMiddleware((req) => ({
  correlationId: req.headers['x-request-id'],
  metadata: { userId: req.user?.id },
})));

// Or manually
await runWithContext({ correlationId: 'req-123' }, async () => {
  log.info('Every log in here automatically gets correlationId: req-123');
});
```

Uses `AsyncLocalStorage` on Node; on runtimes without it, context propagation is scoped to avoid cross-request state bleed rather than falling back to unsafe shared state.

---

## Browser & React

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('App');
log.info('Works in the browser too — same API.');
```

Optional browser-specific helpers (error capture, beacon transport for page-unload delivery):

```typescript
import { setupBrowserLogging } from '@nextrush/log/browser';

const { logger, cleanup } = setupBrowserLogging({ context: 'MyApp' });
```

React integration:

```tsx
import { LoggerProvider, useLogger } from '@nextrush/log/react';

function App() {
  return (
    <LoggerProvider context="MyApp">
      <MyComponent />
    </LoggerProvider>
  );
}

function MyComponent() {
  const log = useLogger('MyComponent');
  return <button onClick={() => log.info('Clicked!')}>Click</button>;
}
```

---

## Testing Your Code

```typescript
import { createMockLogger, expectLogged } from '@nextrush/log/testing';

const mockLog = createMockLogger();
myFunction(mockLog);

expectLogged(mockLog, 'info', 'Operation completed');
```

The mock logger parses arguments identically to the real `Logger`, so assertions against it match production behavior.

---

## API Quick Reference

| Function | Description |
|----------|-------------|
| `createLogger(name, options?)` | Create a logger instance |
| `log` | Default pre-built logger instance |
| `configure(options)` | Set global configuration |
| `disableLogging()` | Disable ALL logging globally |
| `addGlobalTransport(fn)` | Add a transport to ALL loggers |
| `createBatchTransport(...)` | Buffer + flush logs on an interval/size threshold |
| `createFilteredTransport(...)` | Only forward logs at/above a minimum level |
| `createRateLimitedTransport(...)` | Token-bucket rate limiting for a transport |
| `runWithContext(ctx, fn)` | Run code with async correlation-ID/metadata context |
| `createContextMiddleware(fn)` | Express/Koa-style middleware for `runWithContext` |
| `getAsyncContext()` | Read the current async context |

| Logger Method | Description |
|---------------|-------------|
| `log.trace/debug/info/warn/error/fatal()` | Log at a level |
| `log.child(name)` | Create a child logger |
| `log.withCorrelationId(id)` | Add a correlation ID |
| `log.withMetadata(data)` | Add metadata to all subsequent logs |
| `log.time(label?)` | Start a performance timer |
| `log.setLevel(level)` | Change the minimum level at runtime |
| `log.isLevelEnabled(level)` | Check if a level would log |
| `log.addTransport(fn)` | Add a custom transport to this logger |

Additional configuration fields, submodule internals, and less-common
helpers still exist — see [CHANGELOG.md](./CHANGELOG.md) and the
[API reference](https://0xtanzim.github.io/nextrush-log/api) for the full
surface.

---

## Documentation

- 📖 [Getting Started](https://0xtanzim.github.io/nextrush-log/getting-started)
- 🎛️ [Global Configuration](https://0xtanzim.github.io/nextrush-log/global-configuration)
- 📚 [API Reference](https://0xtanzim.github.io/nextrush-log/api)
- 💡 [Examples](https://0xtanzim.github.io/nextrush-log/examples)
- 📋 [Changelog](./CHANGELOG.md)

---

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
