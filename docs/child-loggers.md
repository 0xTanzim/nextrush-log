# Child Loggers

Create specialized loggers with extended context.

## Basic Usage

```typescript
const log = createLogger('App');

const dbLog = log.child('Database');
const apiLog = log.child('API');
const cacheLog = log.child('Cache');

dbLog.info('Connected');   // [App:Database] Connected
apiLog.info('Ready');      // [App:API] Ready
cacheLog.info('Warmed up');// [App:Cache] Warmed up
```

## Nested Children

```typescript
const log = createLogger('App');
const dbLog = log.child('Database');
const queryLog = dbLog.child('Query');

queryLog.info('Executed'); // [App:Database:Query] Executed
```

## Override Options

Child loggers can override parent options:

```typescript
const log = createLogger('App', { minLevel: 'info' });

// Verbose database logging
const dbLog = log.child('Database', { minLevel: 'trace' });

dbLog.trace('Query plan'); // ✅ Logged (child overrides)
log.trace('App trace');    // ❌ Not logged (parent level)
```

## With Metadata

Add context to all logs from a child:

```typescript
const log = createLogger('API');

// Add user context
const userLog = log.withMetadata({ userId: 123, role: 'admin' });
userLog.info('Action performed');
// { ..., "data": { "userId": 123, "role": "admin" } }

// Add request context
const requestLog = log.withMetadata({
  requestId: 'req-123',
  ip: '192.168.1.1'
});
```

## With Correlation ID

For distributed tracing:

```typescript
const log = createLogger('API');

const requestLog = log.withCorrelationId('req-abc-123');
requestLog.info('Processing');
// { ..., "correlationId": "req-abc-123" }
```

## Express Middleware Example

```typescript
const log = createLogger('API');

app.use((req, res, next) => {
  req.log = log
    .child('Request')
    .withCorrelationId(req.headers['x-request-id'] || crypto.randomUUID())
    .withMetadata({ path: req.path, method: req.method });
  next();
});

app.get('/users', (req, res) => {
  req.log.info('Fetching users');
  // [API:Request] Fetching users { path: '/users', method: 'GET', correlationId: '...' }
});
```
