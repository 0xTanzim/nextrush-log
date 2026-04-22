# Global Configuration

Control **all loggers from a single place**. Perfect for large applications with 100+ files.

## How It Works

::: tip Key Concept
The global configuration is a **singleton** (single shared object). When you call `configure()` or `disableLogging()` from **ANY file**, it affects **ALL loggers across your entire application** - even loggers created in other files!
:::

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Config (Singleton)                 │
│                                                             │
│  configure({ enabled: false })  ←── Called from ANY file    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ file1.ts │          │ file2.ts │          │ file3.ts │
   │ Logger A │          │ Logger B │          │ Logger C │
   │ DISABLED │          │ DISABLED │          │ DISABLED │
   └─────────┘          └─────────┘          └─────────┘
```

## The Problem

In large applications, you might have logging in hundreds of files:

```typescript
// ❌ Problem: 500+ files, each with createLogger
// How do you disable all logging? Change every file?

// file1.ts
import { createLogger } from '@nextrush/log';
const log = createLogger('Component1');

// file2.ts
import { createLogger } from '@nextrush/log';
const log = createLogger('Component2');

// ... 498 more files
```

## Global vs per-logger `silent`

- **`configure({ silent: true })`**: entries are **not** written at all (no console, no transports) while enabled.
- **`createLogger({ silent: true })`**: skips **console** only; **transports** (instance + global) still run. Use that when you want external sinks without stdout noise.

## The Solution

**Global configuration** lets you control ALL loggers from one place:

```typescript
// ✅ Solution: One line controls everything!
// Call this from ANY file - it affects ALL loggers
import { disableLogging } from '@nextrush/log';

disableLogging(); // Done! All 500 loggers are now silent
```

## Central Configuration Pattern

::: warning Important
You only need to call `configure()` **ONCE** at app startup. All other files just use `createLogger()` normally - they automatically respect the global config!
:::

### Step 1: Create a Central Config File

```typescript
// src/lib/logger.ts - This is your ONLY configuration file
import { configure, createLogger } from '@nextrush/log';

// Call this ONCE at app startup
export function initializeLogging() {
  configure({
    enabled: process.env.NODE_ENV !== 'test',
    minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  });
}

// Re-export createLogger for convenience
export { createLogger };
```

### Step 2: Initialize at App Entry Point

```typescript
// src/index.ts or src/main.ts
import { initializeLogging } from './lib/logger';

// Initialize logging ONCE before any other code
initializeLogging();

// ... rest of your app
```

### Step 3: Use Loggers Anywhere (No Config Needed!)

```typescript
// src/features/users/service.ts
// Just import and use - global config is already applied!
import { createLogger } from '@nextrush/log';

const log = createLogger('users:service');
log.info('Creating user'); // Respects global config automatically!
```

```typescript
// src/features/orders/controller.ts
// Same thing - no config needed here
import { createLogger } from '@nextrush/log';

const log = createLogger('orders:controller');
log.debug('Order received'); // Also respects global config!
```

## FAQ: Common Questions

### Q: If I have 400+ files using `createLogger`, do I need to change them all?

**No!** You only configure ONCE. All files using `createLogger` automatically respect the global config.

```typescript
// You DON'T need this in every file:
import { configure, createLogger } from '@nextrush/log';
configure({ ... }); // ❌ Don't do this in every file!

// You ONLY need this:
import { createLogger } from '@nextrush/log';
const log = createLogger('MyComponent'); // ✅ Just this!
```

### Q: Where should I call `configure()` or `disableLogging()`?

**Call it ONCE at your app's entry point** (before any other code runs):

| App Type | Where to Configure |
|----------|-------------------|
| Node.js | `src/index.ts` (entry file) |
| React/Vite | `src/main.tsx` (before `<App />`) |
| Next.js | `_app.tsx` or root layout |
| Express | Before `app.listen()` |

### Q: What if 50 files import `configure` but only 1 calls it?

That's fine! Importing doesn't call the function. Only the file that actually **calls** `configure()` changes the config.

```typescript
// file1.ts - imports but doesn't call
import { configure, createLogger } from '@nextrush/log';
const log = createLogger('File1'); // Uses default config

// file2.ts - imports AND calls
import { configure, createLogger } from '@nextrush/log';
configure({ minLevel: 'warn' }); // THIS changes global config
const log = createLogger('File2');

// After file2.ts runs, File1's logger ALSO uses minLevel: 'warn'
```

## Quick Reference

### Disable All Logging

```typescript
import { disableLogging } from '@nextrush/log';
disableLogging(); // All loggers across all files stop logging
```

### Enable All Logging

```typescript
import { enableLogging } from '@nextrush/log';
enableLogging(); // All loggers start logging again
```

### Set Global Level

```typescript
import { setGlobalLevel } from '@nextrush/log';
setGlobalLevel('error'); // Global floor — stricter per-logger minLevel still wins
```

### Full Configuration

```typescript
import { configure } from '@nextrush/log';

  configure({
    enabled: true,                    // Master switch
    minLevel: 'warn',                 // Global floor (stricter vs each logger wins)
    silent: false,                    // Global silent: no output when true
  env: 'production',                // Environment preset
  enabledNamespaces: ['api:*'],     // Only these namespaces log
  disabledNamespaces: ['debug:*'],  // These namespaces don't log
  defaults: {                       // Defaults for new loggers
    pretty: false,
    redact: true,
  },
});
```

## Namespace Filtering

Log only from specific parts of your app:

```typescript
import { enableNamespaces, createLogger } from '@nextrush/log';

// Only log from api and auth modules
enableNamespaces(['api:*', 'auth:*']);

// These will log:
const apiLog = createLogger('api:users');     // ✅ Matches api:*
const authLog = createLogger('auth:login');   // ✅ Matches auth:*

// These will NOT log:
const dbLog = createLogger('db:queries');     // ❌ No match
const cacheLog = createLogger('cache:redis'); // ❌ No match
```

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `*` | Everything |
| `api:*` | `api:users`, `api:auth`, `api:orders:create` |
| `auth:login` | Only `auth:login` (exact match) |

## Global Transports

Add transports that receive logs from ALL loggers:

```typescript
import { addGlobalTransport } from '@nextrush/log';

// This transport receives logs from EVERY logger in your app
addGlobalTransport((entry) => {
  if (entry.level === 'error' || entry.level === 'fatal') {
    sendToSentry(entry);
  }
});
```

## Environment Variables

```typescript
import { configureFromEnv } from '@nextrush/log';

// Reads LOG_* and NEXT_PUBLIC_* / VITE_* aliases, plus NODE_ENV
import { configureFromEnv, getEnvVar } from '@nextrush/log';
configureFromEnv(getEnvVar);
```

| Variable | Description | Example |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log level | `warn` |
| `NEXT_PUBLIC_LOG_LEVEL` / `VITE_LOG_LEVEL` | Same, for client / Vite bundles | `error` |
| `LOG_ENABLED` | Enable/disable all logging | `false` |
| `NEXT_PUBLIC_LOG_ENABLED` / `VITE_LOG_ENABLED` | Same, for client bundles | `0` |
| `LOG_NAMESPACES` | Comma-separated patterns | `api:*,auth:*` |
| `NODE_ENV` | `production` / `test` adjust `configureFromEnv` defaults | `production` |

When `NODE_ENV=test`, `configureFromEnv` sets `defaults.silent` when unset (quieter tests).

## Complete Example

```typescript
// ====== src/lib/logger.ts ======
import {
  configure,
  configureFromEnv,
  createLogger,
  addGlobalTransport
} from '@nextrush/log';

export function initializeLogging() {
  // Read from environment
  configureFromEnv((name) => process.env[name]);

  // Or configure explicitly
  configure({
    enabled: process.env.NODE_ENV !== 'test',
    minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  });

  // Add error tracking in production
  if (process.env.NODE_ENV === 'production') {
    addGlobalTransport((entry) => {
      if (entry.level === 'error') {
        sendToMonitoring(entry);
      }
    });
  }
}

export { createLogger };

// ====== src/index.ts ======
import { initializeLogging } from './lib/logger';
initializeLogging(); // Call ONCE at startup!
// ... rest of app

// ====== src/any-other-file.ts ======
import { createLogger } from '@nextrush/log';
const log = createLogger('any-module');
log.info('This respects global config!'); // No config needed here!
```

## See Also

- [Getting Started](./getting-started.md)
- [Best Practices](./best-practices.md)
- [API Reference](./api.md)
