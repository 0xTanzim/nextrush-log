# Request Tracing

Track requests across your application with correlation IDs.

## Basic Usage

```typescript
const log = createLogger('API');

const requestLog = log.withCorrelationId('req-abc-123');
requestLog.info('Request started');
requestLog.info('Processing');
requestLog.info('Request completed');

// All logs include: "correlationId": "req-abc-123"
```

## Express Middleware

```typescript
import { createLogger } from '@nextrush/log';
import crypto from 'crypto';

const log = createLogger('API');

// Middleware to add correlation ID
app.use((req, res, next) => {
  const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  req.log = log.withCorrelationId(correlationId);
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Use in routes
app.get('/users', async (req, res) => {
  req.log.info('Fetching users');
  const users = await db.users.findMany();
  req.log.info('Users fetched', { count: users.length });
  res.json(users);
});
```

## Next.js Server Actions

```typescript
import { createLogger } from '@nextrush/log';
import { headers } from 'next/headers';

const log = createLogger('App');

export async function createPost(formData: FormData) {
  const headersList = await headers();
  const requestId = headersList.get('x-request-id') || crypto.randomUUID();
  const actionLog = log.withCorrelationId(requestId);

  actionLog.info('Creating post');
  // ... create post
  actionLog.info('Post created', { postId: post.id });
}
```

## Microservices

Pass correlation ID between services:

```typescript
// Service A
const log = createLogger('ServiceA');

app.post('/orders', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  const requestLog = log.withCorrelationId(correlationId);

  requestLog.info('Creating order');

  // Forward correlation ID to Service B
  await fetch('http://service-b/inventory', {
    headers: { 'x-correlation-id': correlationId },
    method: 'POST',
    body: JSON.stringify(order),
  });

  requestLog.info('Order created');
});
```

```typescript
// Service B
const log = createLogger('ServiceB');

app.post('/inventory', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'];
  const requestLog = log.withCorrelationId(correlationId);

  requestLog.info('Reserving inventory');
  // Same correlationId links logs across services
});
```

## Combined with Metadata

```typescript
const log = createLogger('API');

const requestLog = log
  .withCorrelationId('req-abc-123')
  .withMetadata({
    userId: req.user.id,
    ip: req.ip,
  });

requestLog.info('Action performed');
// { correlationId: 'req-abc-123', data: { userId: 123, ip: '...' } }
```
