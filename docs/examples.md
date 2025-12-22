# Examples

Real-world usage patterns for `@nextrush/log`.

## Table of Contents

- [Express.js API](#expressjs-api)
- [Next.js Application](#nextjs-application)
- [Microservice](#microservice)
- [CLI Application](#cli-application)
- [Worker/Background Jobs](#workerbackground-jobs)
- [Browser Application](#browser-application)
- [React Application](#react-application)

---

## Express.js API

### Setup

```typescript
// src/logger.ts
import { createLogger } from '@nextrush/log';

export const log = createLogger('API', {
  metadata: {
    service: 'user-api',
    version: process.env.npm_package_version,
  },
});
```

### Request Logging Middleware

```typescript
// src/middleware/logger.ts
import { log } from '../logger';

export function requestLogger(req, res, next) {
  const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  const requestLog = log.withCorrelationId(correlationId);

  req.log = requestLog;
  res.setHeader('x-correlation-id', correlationId);

  const timer = requestLog.time();

  res.on('finish', () => {
    timer.end('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
  });

  next();
}
```

### Route Handlers

```typescript
// src/routes/users.ts
import express from 'express';

const router = express.Router();

router.get('/:id', async (req, res) => {
  const { log } = req;
  const { id } = req.params;

  log.info('Fetching user', { userId: id });

  try {
    const user = await db.users.findById(id);

    if (!user) {
      log.warn('User not found', { userId: id });
      return res.status(404).json({ error: 'Not found' });
    }

    log.debug('User found', { userId: id });
    res.json(user);
  } catch (error) {
    log.error('Failed to fetch user', { userId: id }, error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
```

### Error Handler

```typescript
// src/middleware/error.ts
import { log } from '../logger';

export function errorHandler(error, req, res, next) {
  const requestLog = req.log || log;

  requestLog.error('Unhandled error', {
    method: req.method,
    path: req.path,
  }, error);

  res.status(500).json({ error: 'Internal server error' });
}
```

---

## Next.js Application

### Shared Logger

```typescript
// lib/logger.ts
import { createLogger } from '@nextrush/log';

export const log = createLogger('MyApp', {
  metadata: { version: process.env.NEXT_PUBLIC_VERSION },
});
```

### Server Actions

```typescript
// app/actions.ts
'use server';

import { log } from '@/lib/logger';
import { headers } from 'next/headers';

export async function createPost(formData: FormData) {
  const headersList = await headers();
  const requestId = headersList.get('x-request-id') || crypto.randomUUID();
  const actionLog = log.withCorrelationId(requestId);

  actionLog.info('Creating post');

  try {
    const title = formData.get('title');
    const post = await db.posts.create({ title });

    actionLog.info('Post created', { postId: post.id });
    return { success: true, post };
  } catch (error) {
    actionLog.error('Failed to create post', error);
    return { success: false, error: 'Failed to create post' };
  }
}
```

### API Routes

```typescript
// app/api/users/route.ts
import { log } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();
  const routeLog = log.withCorrelationId(correlationId);

  routeLog.info('Fetching users');

  try {
    const users = await db.users.findMany();
    routeLog.debug('Users fetched', { count: users.length });

    return NextResponse.json(users, {
      headers: { 'x-correlation-id': correlationId },
    });
  } catch (error) {
    routeLog.error('Failed to fetch users', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Middleware

```typescript
// middleware.ts
import { log } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const correlationId = request.headers.get('x-request-id') || crypto.randomUUID();

  log.info('Request', {
    method: request.method,
    path: request.nextUrl.pathname,
    correlationId,
  });

  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  return response;
}
```

---

## Microservice

### Logger with Service Context

```typescript
// src/logger.ts
import { createLogger, createBatchTransport } from '@nextrush/log';

const log = createLogger('OrderService', {
  metadata: {
    service: 'order-service',
    version: process.env.VERSION,
    instance: process.env.HOSTNAME,
    region: process.env.AWS_REGION,
  },
});

// Send logs to centralized logging
const { transport, flush } = createBatchTransport(
  async (entries) => {
    await fetch(process.env.LOG_COLLECTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    });
  },
  { batchSize: 100, flushInterval: 1000 }
);

log.addTransport(transport);

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('Shutting down');
  await flush();
  process.exit(0);
});

export { log };
```

### Event Handling

```typescript
// src/handlers/order-created.ts
import { log } from '../logger';

export async function handleOrderCreated(event: OrderCreatedEvent) {
  const handlerLog = log
    .withCorrelationId(event.correlationId)
    .withMetadata({ orderId: event.orderId });

  handlerLog.info('Processing order');

  const timer = handlerLog.time('order-processing');

  try {
    await validateOrder(event.order);
    handlerLog.debug('Order validated');

    await reserveInventory(event.order);
    handlerLog.debug('Inventory reserved');

    await processPayment(event.order);
    handlerLog.debug('Payment processed');

    timer.end('Order processed successfully');
  } catch (error) {
    timer.end('Order processing failed');
    handlerLog.error('Failed to process order', error);
    throw error;
  }
}
```

---

## CLI Application

### Setup with Verbosity Levels

```typescript
// src/cli.ts
import { createLogger } from '@nextrush/log';
import { program } from 'commander';

function createCliLogger(verbose: boolean) {
  return createLogger('CLI', {
    minLevel: verbose ? 'debug' : 'info',
    pretty: true,
  });
}

program
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    const log = createCliLogger(options.verbose);

    log.info('Starting build');
    log.debug('Build configuration', { options });

    try {
      const timer = log.time('build');
      await runBuild();
      timer.end('Build completed');
    } catch (error) {
      log.error('Build failed', error);
      process.exit(1);
    }
  });

program.parse();
```

---

## Worker/Background Jobs

### Job Processing Logger

```typescript
// src/worker.ts
import { createLogger } from '@nextrush/log';

const workerLog = createLogger('Worker', {
  metadata: { workerId: process.env.WORKER_ID },
});

export async function processJob(job: Job) {
  const jobLog = workerLog.withMetadata({
    jobId: job.id,
    jobType: job.type,
    attempt: job.attemptNumber,
  });

  jobLog.info('Job started');
  const timer = jobLog.time();

  try {
    switch (job.type) {
      case 'email':
        await sendEmail(job.data);
        break;
      case 'report':
        await generateReport(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    timer.end('Job completed');
  } catch (error) {
    timer.end('Job failed');
    jobLog.error('Job execution failed', error);
    throw error;
  }
}
```

### Queue Event Logging

```typescript
// src/queue.ts
import { log } from './logger';

queue.on('completed', (job, result) => {
  log.info('Job completed', { jobId: job.id, jobType: job.type });
});

queue.on('failed', (job, error) => {
  log.error('Job failed', { jobId: job.id, jobType: job.type }, error);
});

queue.on('stalled', (job) => {
  log.warn('Job stalled', { jobId: job.id, jobType: job.type });
});
```

---

## Browser Application

### Setup

```typescript
// src/logger.ts
import { createLogger, createBatchTransport } from '@nextrush/log';

const log = createLogger('App', {
  minLevel: import.meta.env.PROD ? 'warn' : 'debug',
});

// Send errors to backend in production
if (import.meta.env.PROD) {
  const { transport } = createBatchTransport(
    async (entries) => {
      const errors = entries.filter(e => e.level === 'error' || e.level === 'fatal');
      if (errors.length === 0) return;

      await fetch('/api/client-logs', {
        method: 'POST',
        body: JSON.stringify(errors),
      });
    },
    { batchSize: 5, flushInterval: 10000 }
  );

  log.addTransport(transport);
}

export { log };
```

### Usage

```typescript
// src/api.ts
import { log } from './logger';

export async function fetchUser(id: string) {
  const apiLog = log.child('API');

  apiLog.debug('Fetching user', { userId: id });

  try {
    const response = await fetch(`/api/users/${id}`);

    if (!response.ok) {
      apiLog.error('API error', { status: response.status, userId: id });
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    apiLog.error('Failed to fetch user', { userId: id }, error);
    throw error;
  }
}
```

---

## React Application

### Provider Setup

```tsx
// src/App.tsx
import { LogProvider, LogErrorBoundary } from '@nextrush/log/react';

export default function App() {
  return (
    <LogProvider
      context="MyApp"
      options={{ minLevel: import.meta.env.PROD ? 'warn' : 'debug' }}
    >
      <LogErrorBoundary fallback={<ErrorPage />}>
        <Router />
      </LogErrorBoundary>
    </LogProvider>
  );
}
```

### Component Logging

```tsx
// src/components/UserProfile.tsx
import { useLogger } from '@nextrush/log/react';
import { useEffect, useState } from 'react';

export function UserProfile({ userId }) {
  const log = useLogger('UserProfile');
  const [user, setUser] = useState(null);

  useEffect(() => {
    log.debug('Loading user', { userId });

    fetchUser(userId)
      .then((data) => {
        log.debug('User loaded', { userId });
        setUser(data);
      })
      .catch((error) => {
        log.error('Failed to load user', { userId }, error);
      });
  }, [userId, log]);

  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}
```

### Custom Hook with Logging

```tsx
// src/hooks/useApi.ts
import { useLogger } from '@nextrush/log/react';
import { useState, useCallback } from 'react';

export function useApi<T>(endpoint: string) {
  const log = useLogger('useApi');
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    log.debug('Fetching', { endpoint });

    try {
      const response = await fetch(endpoint);
      const result = await response.json();

      log.debug('Fetch complete', { endpoint });
      setData(result);
      return result;
    } catch (err) {
      log.error('Fetch failed', { endpoint }, err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, log]);

  return { data, loading, error, execute };
}
```

---

## See Also

- [API Reference](./api.md)
- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
