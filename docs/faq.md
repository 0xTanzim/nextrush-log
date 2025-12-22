# Frequently Asked Questions (FAQ)

Common questions and answers about `@nextrush/log`.

## Installation & Setup

### How do I install @nextrush/log?

```bash
npm install @nextrush/log
# or
pnpm add @nextrush/log
# or
yarn add @nextrush/log
# or
bun add @nextrush/log
```

### Does it work with TypeScript?

Yes! Full TypeScript support with complete type definitions included. No additional `@types` package needed.

### What runtimes are supported?

| Runtime | Supported | Notes |
|---------|:---------:|-------|
| Node.js | ✅ | v16+ recommended |
| Bun | ✅ | Full support |
| Deno | ✅ | Use npm: specifier |
| Browser | ✅ | Works in all modern browsers |
| React | ✅ | Dedicated hooks and providers |
| Next.js | ✅ | Client and server components |
| Edge (Cloudflare/Vercel) | ✅ | Zero Node.js dependencies |

### How do I use it in Deno?

```typescript
import { createLogger } from 'npm:@nextrush/log';

const log = createLogger('MyApp');
log.info('Works in Deno!');
```

---

## Global Configuration

### How do I disable ALL logging with one line?

```typescript
import { disableLogging } from '@nextrush/log';

disableLogging(); // Done! All loggers are silent.
```

### If I have 400+ files using `createLogger`, do I need to change them all?

**No!** Global configuration is a **singleton** - configure once, affects all files:

```typescript
// src/lib/logger.ts - Configure ONCE
import { configure } from '@nextrush/log';

configure({ enabled: false }); // Affects ALL 400+ files!
```

All other files just use `createLogger()` normally - they automatically respect global config.

### Where should I call `configure()` or `disableLogging()`?

At your app's **entry point**, before other code runs:

| App Type | Where to Configure |
|----------|-------------------|
| Node.js | `src/index.ts` or `src/main.ts` |
| React/Vite | `src/main.tsx` (before `<App />`) |
| Next.js | `_app.tsx` or root `layout.tsx` |
| Express | Before `app.listen()` |

### What if multiple files import `configure`?

Importing doesn't call the function. Only the file that **calls** `configure()` changes settings. It's safe to import everywhere.

### How do I reset configuration to defaults?

```typescript
import { resetGlobalConfig } from '@nextrush/log';

resetGlobalConfig(); // Back to factory defaults
```

---

## Log Levels

### What are the available log levels?

| Level | Priority | Use Case |
|-------|:--------:|----------|
| `trace` | 10 | Detailed debugging (function entry/exit) |
| `debug` | 20 | Development debugging |
| `info` | 30 | Normal operations (default in production) |
| `warn` | 40 | Potential issues |
| `error` | 50 | Recoverable errors |
| `fatal` | 60 | Critical failures |

### How does level filtering work?

Setting `minLevel` logs that level **and all higher priority levels**:

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.debug('ignored'); // ❌ Priority 20 < 40
log.info('ignored');  // ❌ Priority 30 < 40
log.warn('logged');   // ✅ Priority 40 = 40
log.error('logged');  // ✅ Priority 50 > 40
log.fatal('logged');  // ✅ Priority 60 > 40
```

### How do I change log level at runtime?

```typescript
const log = createLogger('App');

// Change level dynamically
log.setLevel('error'); // Now only error + fatal

// Check before expensive operations
if (log.isLevelEnabled('debug')) {
  log.debug('Data', computeExpensiveData());
}
```

### Why are my debug logs not showing in production?

By default, production (`NODE_ENV=production`) uses `minLevel: 'info'`. Debug and trace are filtered out.

To enable debug logs in production:

```typescript
const log = createLogger('App', {
  env: 'production',
  minLevel: 'debug', // Override the default
});
```

---

## Environment & Production

### How does environment detection work?

The logger reads `NODE_ENV` automatically:

| NODE_ENV | minLevel | Output | Redaction |
|----------|:--------:|:------:|:---------:|
| `development` | `trace` | Pretty | Off |
| `test` | `trace` | Pretty | Off |
| `production` | `info` | JSON | On |

### Why are my debug logs showing in Vite production build?

Vite uses `import.meta.env.MODE` instead of `NODE_ENV`. Force production mode:

```typescript
const log = createLogger('App', {
  env: 'production' // Force production mode
});

// Or configure globally
configure({ env: 'production' });
```

### How do I get JSON output?

Set `pretty: false` or use `env: 'production'`:

```typescript
const log = createLogger('App', { pretty: false });
// OR
const log = createLogger('App', { env: 'production' });
```

### How do I get colorful output in production?

```typescript
const log = createLogger('App', {
  env: 'production',
  pretty: true,  // Override JSON output
  colors: true,  // Enable colors
});
```

---

## Sensitive Data

### What fields are automatically redacted?

By default in production, these fields are redacted:
- `password`, `passwd`, `pwd`
- `token`, `accessToken`, `refreshToken`
- `secret`, `apiKey`, `apiSecret`
- `authorization`, `auth`
- `cookie`, `session`
- `creditCard`, `cardNumber`, `cvv`
- `ssn`, `socialSecurity`

### How do I add custom sensitive fields?

```typescript
const log = createLogger('App', {
  sensitiveKeys: ['customSecret', 'myApiKey', 'internalToken'],
});
```

### How do I disable redaction?

```typescript
const log = createLogger('App', { redact: false });
```

::: warning
Never disable redaction in production - sensitive data will be logged!
:::

### Does redaction work in nested objects?

Yes! Redaction is recursive:

```typescript
log.info('Data', {
  user: {
    name: 'John',
    auth: {
      password: 'secret123', // → "[REDACTED]"
    },
  },
});
```

---

## Child Loggers

### What is a child logger?

A child logger inherits parent settings and adds a namespace prefix:

```typescript
const log = createLogger('App');
const db = log.child('Database');
const api = log.child('API');

db.info('Connected');  // [App:Database] Connected
api.info('Ready');     // [App:API] Ready
```

### Do child loggers respect global config?

Yes! Child loggers inherit global configuration just like parent loggers.

### Can I create deeply nested children?

Yes:

```typescript
const log = createLogger('App');
const api = log.child('API');
const users = api.child('Users');
const create = users.child('Create');

create.info('User created'); // [App:API:Users:Create] User created
```

---

## Performance

### Is logging expensive?

Logging is designed to be cheap:
- Level checks are fast (number comparison)
- Disabled logs are no-ops (almost zero cost)
- Serialization only happens for enabled logs

### How do I avoid expensive computations for disabled logs?

```typescript
// ❌ Bad: Always computes even if debug is disabled
log.debug('Data', { result: expensiveComputation() });

// ✅ Good: Only compute if level is enabled
if (log.isLevelEnabled('debug')) {
  log.debug('Data', { result: expensiveComputation() });
}
```

### How do I measure performance?

```typescript
const timer = log.time('db-query');
const result = await db.query('SELECT * FROM users');
timer.end('Query done', { rows: result.length });
// Output: "Query done" { duration: 42, rows: 150 }
```

---

## Transports

### What is a transport?

A transport is a function that receives log entries and does something with them (e.g., send to a server, write to file).

```typescript
const myTransport = (entry) => {
  fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
};

const log = createLogger('App');
log.addTransport(myTransport);
```

### What is a global transport?

A global transport receives logs from **ALL loggers** in your app:

```typescript
import { addGlobalTransport } from '@nextrush/log';

addGlobalTransport((entry) => {
  if (entry.level === 'error') {
    sendToSentry(entry);
  }
});
```

### How do I batch logs before sending?

Use `createBatchTransport`:

```typescript
import { createBatchTransport } from '@nextrush/log';

const { transport, flush } = createBatchTransport(
  async (logs) => {
    await fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify(logs),
    });
  },
  { batchSize: 50, flushInterval: 5000 }
);

const log = createLogger('App');
log.addTransport(transport);

// Flush before shutdown
process.on('SIGTERM', async () => {
  await flush();
  process.exit(0);
});
```

---

## React & Browser

### How do I use in React?

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

### How do I disable logging in React production builds?

```tsx
<LoggerProvider
  context="MyApp"
  globalConfig={{
    enabled: process.env.NODE_ENV !== 'production',
  }}
>
  {children}
</LoggerProvider>
```

### Does it work with Next.js App Router?

Yes! Works in both client and server components:

```tsx
// Server Component
import { createLogger } from '@nextrush/log';
const log = createLogger('ServerComponent');

// Client Component
'use client';
import { useLogger } from '@nextrush/log/react';
```

### How do I see logs in browser DevTools?

Logs automatically go to browser console. Use DevTools → Console tab.

---

## Namespace Filtering

### How do I log only from specific modules?

```typescript
import { enableNamespaces, createLogger } from '@nextrush/log';

// Only log from api and auth
enableNamespaces(['api:*', 'auth:*']);

createLogger('api:users').info('Logged');    // ✅
createLogger('db:queries').info('Ignored');  // ❌
```

### What patterns are supported?

| Pattern | Matches |
|---------|---------|
| `*` | Everything |
| `api:*` | `api:users`, `api:auth`, `api:orders:create` |
| `auth:login` | Only `auth:login` (exact) |

### How do I disable specific namespaces?

```typescript
import { enableNamespaces, disableNamespaces } from '@nextrush/log';

enableNamespaces(['*']);           // Enable everything
disableNamespaces(['verbose:*']);  // Except verbose
```

---

## Troubleshooting

### My logs are not appearing

1. **Check if logging is enabled:**
   ```typescript
   import { getGlobalConfig } from '@nextrush/log';
   console.log(getGlobalConfig()); // Check enabled, minLevel
   ```

2. **Check log level:**
   ```typescript
   const log = createLogger('App');
   console.log(log.isLevelEnabled('debug')); // false if level too high
   ```

3. **Check namespace filtering:**
   ```typescript
   import { isNamespaceEnabled } from '@nextrush/log';
   console.log(isNamespaceEnabled('your:namespace'));
   ```

### My logs are showing "[REDACTED]"

Redaction is on (usually in production). Either:
- Check you're not logging sensitive fields unintentionally
- Disable redaction for development: `{ redact: false }`

### TypeError: createLogger is not a function

Check your import:

```typescript
// ✅ Correct
import { createLogger } from '@nextrush/log';

// ❌ Wrong
import createLogger from '@nextrush/log';
```

### React: useLogger must be used within LoggerProvider

Wrap your app with `LoggerProvider`:

```tsx
function App() {
  return (
    <LoggerProvider context="App">
      {/* Your components here */}
    </LoggerProvider>
  );
}
```

### Logs are appearing twice

You might have added the same transport twice, or have both console transport and `pretty: true`. Check your transports:

```typescript
const log = createLogger('App');
console.log(log); // Inspect transports array
```

---

## Architecture & Design

### Why singleton pattern instead of DI?

Logging is a **cross-cutting concern** used everywhere in an application. The singleton pattern:

1. **Simplicity** - No need to pass logger through every function
2. **Industry standard** - Winston, Pino, Bunyan all use singletons
3. **Testability** - `resetGlobalConfig()` makes tests isolated
4. **Performance** - No DI container overhead

### Is it tree-shakeable?

Yes! Import only what you need:

```typescript
// Only imports createLogger, not global config functions
import { createLogger } from '@nextrush/log';
```

### Does it have any dependencies?

**Zero dependencies.** The entire library is self-contained.

### Is it safe to use in serverless/edge?

Yes! Designed for:
- Cloudflare Workers
- Vercel Edge Functions
- AWS Lambda@Edge
- Deno Deploy

No file system or Node.js-specific APIs required.

---

## Migration

### Migrating from console.log

```typescript
// Before
console.log('User created:', userId);

// After
import { createLogger } from '@nextrush/log';
const log = createLogger('App');
log.info('User created', { userId });
```

### Migrating from Winston

```typescript
// Winston
const winston = require('winston');
const logger = winston.createLogger({ level: 'info' });
logger.info('Hello', { user: 'john' });

// @nextrush/log
import { createLogger } from '@nextrush/log';
const log = createLogger('App', { minLevel: 'info' });
log.info('Hello', { user: 'john' });
```

### Migrating from Pino

```typescript
// Pino
const pino = require('pino');
const logger = pino({ level: 'info' });
logger.info({ user: 'john' }, 'Hello');

// @nextrush/log (data comes last)
import { createLogger } from '@nextrush/log';
const log = createLogger('App', { minLevel: 'info' });
log.info('Hello', { user: 'john' });
```

---

## See Also

- [Getting Started](./getting-started.md)
- [Global Configuration](./global-configuration.md)
- [Best Practices](./best-practices.md)
- [API Reference](./api.md)
- [Examples](./examples.md)
