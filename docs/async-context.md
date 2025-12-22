# Async Context Propagation

Automatically propagate correlation IDs and metadata across async boundaries without manual passing.

## Overview

Using Node.js `AsyncLocalStorage`, @nextrush/log can automatically include context (correlation IDs, user IDs, etc.) in all logs within an async execution context.

```typescript
import { runWithContext, log } from '@nextrush/log';

// Set context once at the entry point
await runWithContext({ correlationId: 'req-123' }, async () => {
  log.info('Starting request'); // Automatically includes correlationId
  await processOrder();         // All nested logs get the context
  log.info('Request complete'); // Still has correlationId
});
```

## Basic Usage

### Setting Context

```typescript
import { runWithContext } from '@nextrush/log';

app.use(async (req, res, next) => {
  await runWithContext(
    {
      correlationId: req.headers['x-request-id'] || crypto.randomUUID(),
      metadata: { userId: req.user?.id },
    },
    async () => {
      await next();
    }
  );
});
```

### Reading Context

```typescript
import { getAsyncContext, getContextCorrelationId } from '@nextrush/log';

function someDeepFunction() {
  const ctx = getAsyncContext();
  console.log(ctx?.correlationId); // 'req-123'
  console.log(ctx?.metadata);      // { userId: '456' }

  // Or get just the correlation ID
  const corrId = getContextCorrelationId();
}
```

## Express Middleware

Use the built-in middleware factory:

```typescript
import express from 'express';
import { createContextMiddleware } from '@nextrush/log';

const app = express();

app.use(createContextMiddleware((req) => ({
  correlationId: req.headers['x-request-id'] || crypto.randomUUID(),
  metadata: {
    userId: req.user?.id,
    path: req.path,
  },
})));

app.get('/api/orders', async (req, res) => {
  // All logs in this handler automatically have the context
  log.info('Fetching orders'); // includes correlationId, userId, path
  const orders = await orderService.getAll();
  res.json(orders);
});
```

## Nested Context

Context can be nested and merged:

```typescript
await runWithContext({ correlationId: 'req-123' }, async () => {
  log.info('Outer context'); // correlationId: 'req-123'

  await runWithContext({ metadata: { step: 'processing' } }, async () => {
    // Inner context inherits correlationId and adds metadata
    log.info('Inner context'); // correlationId: 'req-123', step: 'processing'
  });

  log.info('Back to outer'); // correlationId: 'req-123'
});
```

## API Reference

### `runWithContext<T>(context, callback): T | Promise<T>`

Run a function with async context.

```typescript
interface AsyncLogContext {
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

await runWithContext({ correlationId: 'abc' }, async () => {
  // ... your code
});
```

### `getAsyncContext(): AsyncLogContext | undefined`

Get the current async context.

```typescript
const ctx = getAsyncContext();
if (ctx) {
  console.log(ctx.correlationId);
  console.log(ctx.metadata);
}
```

### `getContextCorrelationId(): string | undefined`

Get just the current correlation ID.

```typescript
const correlationId = getContextCorrelationId();
```

### `getContextMetadata(): Record<string, unknown> | undefined`

Get just the current metadata.

```typescript
const metadata = getContextMetadata();
```

### `isAsyncContextAvailable(): boolean`

Check if AsyncLocalStorage is available (Node.js only).

```typescript
if (isAsyncContextAvailable()) {
  // Use async context features
} else {
  // Fallback to manual context passing
}
```

### `createContextMiddleware(getContext): Middleware`

Create Express/Koa-style middleware.

```typescript
const middleware = createContextMiddleware((req) => ({
  correlationId: req.id,
  metadata: { userId: req.user?.id },
}));

app.use(middleware);
```

## Runtime Support

| Runtime | Support |
|---------|---------|
| Node.js 16+ | ✅ Full (AsyncLocalStorage) |
| Bun | ✅ Full (AsyncLocalStorage) |
| Deno | ✅ Full (AsyncLocalStorage) |
| Browser | ⚠️ Fallback (single context) |
| Edge (Cloudflare) | ⚠️ Fallback (single context) |

In environments without `AsyncLocalStorage`, a synchronous fallback is used. This works for most cases but doesn't handle true async context isolation.

## Integration with Logger

The Logger class automatically reads from async context:

```typescript
import { createLogger, runWithContext } from '@nextrush/log';

const log = createLogger('MyService');

await runWithContext({ correlationId: 'req-123' }, async () => {
  // Logger automatically includes correlationId from async context
  log.info('This log has correlationId');

  // Child loggers also inherit the context
  const childLog = log.child('SubModule');
  childLog.info('Child also has correlationId');
});
```

## Best Practices

### 1. Set Context at Entry Points

Set context as early as possible:

```typescript
// HTTP requests
app.use(createContextMiddleware(/* ... */));

// Queue workers
async function processJob(job) {
  await runWithContext({ correlationId: job.id }, async () => {
    await handleJob(job);
  });
}

// Scheduled tasks
cron.schedule('* * * * *', async () => {
  await runWithContext({ correlationId: `cron-${Date.now()}` }, async () => {
    await runScheduledTask();
  });
});
```

### 2. Include Useful Metadata

```typescript
runWithContext({
  correlationId: req.id,
  metadata: {
    userId: req.user?.id,
    tenantId: req.tenant?.id,
    path: req.path,
    method: req.method,
  },
}, /* ... */);
```

### 3. Check Availability

```typescript
import { isAsyncContextAvailable, runWithContext } from '@nextrush/log';

if (isAsyncContextAvailable()) {
  await runWithContext(context, handler);
} else {
  // Pass context manually
  await handler(context);
}
```
