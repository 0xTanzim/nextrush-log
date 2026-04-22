<div align="center">

# @nextrush/log

**Universal logging for modern JavaScript.**

Zero dependencies • Tree-shakeable • Production-ready

Node.js • Bun • Deno • Browser • React • Next.js • Edge

[![npm](https://img.shields.io/npm/v/@nextrush/log?color=blue)](https://www.npmjs.com/package/@nextrush/log)
[![bundle](https://img.shields.io/bundlephobia/minzip/@nextrush/log?label=size)](https://bundlephobia.com/package/@nextrush/log)
[![coverage](https://img.shields.io/badge/coverage-89%25-brightgreen)](https://github.com/0xTanzim/nextrush-log)
[![license](https://img.shields.io/github/license/0xTanzim/nextrush-log)](https://github.com/0xTanzim/nextrush-log/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-vitepress-blueviolet)](https://0xtanzim.github.io/nextrush-log/)

</div>

---

## Why @nextrush/log?

- 🎯 **One config controls ALL loggers** — Singleton pattern for 100+ file projects
- 🚀 **Zero dependencies** — No bloat, no supply chain risk
- 🌍 **Universal** — Same API everywhere (Node, Browser, Edge, React)
- 🔒 **Production-safe** — Auto-redaction, JSON output, level filtering
- 📦 **Tiny** — Tree-shakeable, minimal bundle impact
- 🧪 **Well-tested** — 89%+ coverage, 194 tests

**[📖 Documentation](https://0xtanzim.github.io/nextrush-log/)** · **[🔧 API Reference](https://0xtanzim.github.io/nextrush-log/api)** · **[❓ FAQ](https://0xtanzim.github.io/nextrush-log/faq)**

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

**Development** — Pretty, colorful output:
```
10:30:00 INFO  [MyApp] Server started { port: 3000 }
10:30:01 WARN  [MyApp] High memory { used: '85%' }
10:30:02 ERROR [MyApp] Failed Error: timeout
```

**Production** — JSON for log aggregators (Datadog, CloudWatch, etc.):
```json
{"timestamp":"2025-01-15T10:30:00.000Z","level":"info","context":"MyApp","message":"Server started","data":{"port":3000}}
```

---

## 🎯 Central Control (The Killer Feature)

**One line controls ALL loggers across your entire application.**

```typescript
// app-entry.ts — Configure ONCE at startup
import { disableLogging, configure, setGlobalLevel } from '@nextrush/log';

// Option 1: Disable ALL logging instantly
disableLogging();

// Option 2: Configure globally
configure({
  enabled: process.env.NODE_ENV !== 'test',
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

// Option 3: Set global level
setGlobalLevel('error'); // Only errors across ALL loggers
```

**How it works:**
```
┌─────────────────────────────────────────────────────────────┐
│              Global Config (Singleton)                       │
│                                                             │
│   disableLogging()  ←── Call from ANY file, ONE time        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
           Instantly affects ALL loggers
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   file1.ts              file2.ts              file3.ts
   createLogger()        createLogger()        createLogger()
        │                     │                     │
        ▼                     ▼                     ▼
    DISABLED              DISABLED              DISABLED
```

**No need to change 100+ files.** Just configure once, all loggers obey.

---

## Log Levels

| Level | Priority | Use Case |
|-------|:--------:|----------|
| `trace` | 10 | Detailed debugging |
| `debug` | 20 | Development info |
| `info` | 30 | Normal operations ← **production default** |
| `warn` | 40 | Potential issues |
| `error` | 50 | Recoverable errors |
| `fatal` | 60 | Critical failures |

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.debug('ignored');  // ❌ Below warn
log.warn('logged');    // ✅
log.error('logged');   // ✅
```

---

## Environment Auto-Detection

| Setting | Development | Production |
|---------|:-----------:|:----------:|
| `minLevel` | `trace` | `info` |
| Output | Pretty | JSON |
| Colors | ✅ | ❌ |
| Redaction | ❌ | ✅ |

```typescript
// Auto-detects NODE_ENV
const log = createLogger('App');

// Or force environment
const log = createLogger('App', { env: 'production' });
```

---

## Features

### Namespace Filtering (Large Codebases)

```typescript
import { enableNamespaces, createLogger } from '@nextrush/log';

// Only log from specific modules
enableNamespaces(['api:*', 'auth:*']);

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

### Auto-Redaction (Production)

```typescript
log.info('Login', {
  email: 'john@example.com',
  password: 'secret123',  // → "[REDACTED]"
  token: 'xyz',           // → "[REDACTED]"
});
```

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

---

## React Integration

```tsx
import { LoggerProvider, useLogger } from '@nextrush/log/react';

function App() {
  return (
    <LoggerProvider
      context="MyApp"
      globalConfig={{ enabled: process.env.NODE_ENV !== 'test' }}
    >
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

## API Quick Reference

| Function | Description |
|----------|-------------|
| `createLogger(name, options?)` | Create a logger instance |
| `configure(options)` | Set global configuration |
| `disableLogging()` | Disable ALL logging globally |
| `enableLogging()` | Re-enable logging |
| `setGlobalLevel(level)` | Set global minimum level |
| `enableNamespaces(patterns)` | Filter by namespace patterns |
| `addGlobalTransport(fn)` | Add transport to ALL loggers |

| Logger Method | Description |
|---------------|-------------|
| `log.trace/debug/info/warn/error/fatal()` | Log at level |
| `log.child(name)` | Create child logger |
| `log.withCorrelationId(id)` | Add correlation ID |
| `log.time(label?)` | Start performance timer |
| `log.setLevel(level)` | Change level at runtime |
| `log.isLevelEnabled(level)` | Check if level would log |
| `log.addTransport(fn)` | Add custom transport |

---

## Documentation

- 📖 [Getting Started](https://0xtanzim.github.io/nextrush-log/getting-started)
- 🎛️ [Global Configuration](https://0xtanzim.github.io/nextrush-log/global-configuration)
- 📚 [API Reference](https://0xtanzim.github.io/nextrush-log/api)
- 💡 [Examples](https://0xtanzim.github.io/nextrush-log/examples)
- ✅ [Best Practices](https://0xtanzim.github.io/nextrush-log/best-practices)
- ❓ [FAQ](https://0xtanzim.github.io/nextrush-log/faq)

---

## License

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
