# Best Practices

Production-ready patterns for enterprise applications.

## Central Configuration

::: tip Golden Rule
**Configure logging ONCE at app startup.** Every other file just imports and uses `createLogger()`.
:::

### The Pattern

```typescript
// ====== src/lib/logger.ts ======
// This is your ONLY config file for the entire app
import { configure, createLogger, addGlobalTransport } from '@nextrush/log';

export function initializeLogging() {
  // Environment-based configuration
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  configure({
    enabled: !isTest,                    // Disable in tests
    minLevel: isProd ? 'info' : 'debug', // Less noise in prod
    defaults: {
      pretty: !isProd,                   // JSON in prod, pretty in dev
      redact: isProd,                    // Redact sensitive data in prod
    },
  });

  // Error tracking in production
  if (isProd) {
    addGlobalTransport((entry) => {
      if (entry.level === 'error' || entry.level === 'fatal') {
        sendToErrorTracking(entry);
      }
    });
  }
}

// Re-export for convenience
export { createLogger };
```

```typescript
// ====== src/index.ts (entry point) ======
import { initializeLogging } from './lib/logger';

// Initialize FIRST, before any other imports that might log
initializeLogging();

// Now import the rest of your app
import { startServer } from './server';
startServer();
```

```typescript
// ====== Any other file (500+ files) ======
import { createLogger } from '@nextrush/log';

const log = createLogger('users:service');
log.info('User created'); // Automatically uses global config!
```

## Logger Naming Convention

Use a hierarchical naming system for easy filtering:

```typescript
// Pattern: <domain>:<component>:<subcomponent>

// User domain
const log = createLogger('user:service');
const log = createLogger('user:repository');
const log = createLogger('user:controller');

// Order domain
const log = createLogger('order:service');
const log = createLogger('order:payment');
const log = createLogger('order:shipping');

// Infrastructure
const log = createLogger('db:postgres');
const log = createLogger('cache:redis');
const log = createLogger('queue:rabbitmq');
```

### Filtering by Namespace

```typescript
import { enableNamespaces } from '@nextrush/log';

// Debug only user-related code
enableNamespaces(['user:*']);

// Debug user and order
enableNamespaces(['user:*', 'order:*']);

// Debug everything except cache
enableNamespaces(['*']);
disableNamespaces(['cache:*']);
```

## Environment-Based Configuration

### Development

```typescript
configure({
  enabled: true,
  minLevel: 'debug',    // Show everything
  defaults: {
    pretty: true,       // Human-readable output
    redact: false,      // See full data for debugging
    colors: true,       // Colorful terminal output
  },
});
```

### Production

```typescript
configure({
  enabled: true,
  minLevel: 'info',     // No debug logs
  defaults: {
    pretty: false,      // JSON for log aggregators
    redact: true,       // Protect sensitive data
    colors: false,      // Clean logs for CloudWatch/Datadog
  },
});
```

### Testing

```typescript
configure({
  enabled: false,       // Silent during tests
});
```

### CI/CD

```typescript
configure({
  enabled: true,
  minLevel: 'warn',     // Only warnings and errors
  defaults: {
    pretty: false,      // Machine-readable
  },
});
```

## Structured Logging

Always log structured data instead of concatenated strings:

```typescript
// ❌ Bad: String concatenation
log.info('User ' + userId + ' created order ' + orderId);

// ✅ Good: Structured data
log.info('Order created', { userId, orderId });

// ❌ Bad: Template literals for data
log.info(`Processing payment of ${amount} for user ${userId}`);

// ✅ Good: Separate message and data
log.info('Processing payment', { amount, userId });
```

### Benefits of Structured Logging

1. **Searchable**: Query logs by field (`userId:123`)
2. **Indexable**: Log aggregators can index fields
3. **Type-safe**: TypeScript checks your data
4. **Consistent**: Same format everywhere

## Error Logging

Always log errors with full context:

```typescript
// ❌ Bad: Just the error
try {
  await processOrder(orderId);
} catch (error) {
  log.error('Failed'); // No context!
}

// ✅ Good: Error with context
try {
  await processOrder(orderId);
} catch (error) {
  log.error('Order processing failed', {
    error,               // Full error object
    orderId,             // What was being processed
    userId,              // Who triggered it
    action: 'processOrder',
  });
}
```

## Child Loggers

Use child loggers to add persistent context:

```typescript
const baseLog = createLogger('api');

// In a request handler
function handleRequest(req, res, next) {
  // Create child with request context
  const log = baseLog.child({
    requestId: req.id,
    userId: req.user?.id,
    path: req.path,
  });

  // All logs now include request context
  log.info('Request started');

  // Pass to services
  await userService.getUser(userId, log);

  log.info('Request completed', { duration: Date.now() - start });
}
```

## Performance Tips

### Lazy Evaluation

Avoid expensive computations for disabled logs:

```typescript
// ❌ Bad: Always computes even if debug is disabled
log.debug('User data', { user: expensiveSerialize(user) });

// ✅ Good: Only compute if needed
if (log.isLevelEnabled('debug')) {
  log.debug('User data', { user: expensiveSerialize(user) });
}
```

### Log Level Checks

```typescript
// Check before expensive operations
if (log.isLevelEnabled('trace')) {
  const stackTrace = captureStackTrace();
  log.trace('Stack trace', { stack: stackTrace });
}
```

## Sensitive Data

### Automatic Redaction

Enable redaction to protect sensitive fields:

```typescript
configure({
  defaults: {
    redact: true,  // Enabled by default
    redactKeys: ['password', 'token', 'apiKey', 'secret', 'authorization'],
  },
});

// Automatically redacts sensitive fields
log.info('Login attempt', {
  email: 'user@example.com',
  password: 'secret123'  // Will be redacted to [REDACTED]
});
```

### Never Log These

```typescript
// ❌ Never log:
log.info('Auth', { password });           // Passwords
log.info('Token', { accessToken });       // Auth tokens
log.info('Card', { creditCardNumber });   // Financial data
log.info('SSN', { socialSecurityNumber }); // PII
```

## Multi-Tenant Applications

### Tenant Context

```typescript
// Create tenant-scoped loggers
function getTenantLogger(tenantId: string) {
  return createLogger(`tenant:${tenantId}`);
}

// In middleware
app.use((req, res, next) => {
  req.log = getTenantLogger(req.tenantId).child({
    requestId: req.id,
  });
  next();
});
```

### Filtering by Tenant

```typescript
// Debug specific tenant
enableNamespaces(['tenant:acme-corp:*']);
```

## Integration Patterns

### Express/Koa Middleware

```typescript
import { createLogger } from '@nextrush/log';

const httpLog = createLogger('http');

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    httpLog.info('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });

  next();
});
```

### Async Context (Node.js)

```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { createLogger } from '@nextrush/log';

const asyncLocalStorage = new AsyncLocalStorage();
const log = createLogger('app');

// Store context
app.use((req, res, next) => {
  asyncLocalStorage.run({ requestId: req.id }, next);
});

// Access anywhere
function logWithContext(message: string, data?: object) {
  const store = asyncLocalStorage.getStore();
  log.info(message, { ...data, requestId: store?.requestId });
}
```

## Checklist

### Before Production

- [ ] Global config is initialized at app entry point
- [ ] `minLevel` is set to `info` or higher in production
- [ ] `pretty: false` for JSON output in production
- [ ] `redact: true` to protect sensitive data
- [ ] Error tracking transport is added
- [ ] Logger namespaces follow consistent convention
- [ ] Debug logs don't contain sensitive data
- [ ] Child loggers add request context

### Code Review

- [ ] Logs use structured data, not string concatenation
- [ ] Error logs include full context
- [ ] No sensitive data in log messages
- [ ] Appropriate log levels used
- [ ] Namespaces follow project convention

## See Also

- [Global Configuration](./global-configuration.md)
- [Child Loggers](./child-loggers.md)
- [Transports](./transports.md)
- [API Reference](./api.md)
