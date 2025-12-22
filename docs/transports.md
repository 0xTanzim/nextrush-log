# Custom Transports

Send logs to external services, files, or anywhere.

## Basic Transport

A transport is a function that receives log entries:

```typescript
import { createLogger, LogEntry } from '@nextrush/log';

const log = createLogger('App');

log.addTransport((entry: LogEntry) => {
  // Send to your service
  fetch('/api/logs', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
});
```

## Batch Transport

Send logs in batches for better performance:

```typescript
import { createLogger, createBatchTransport } from '@nextrush/log';

const { transport, flush, destroy } = createBatchTransport(
  async (entries) => {
    await fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify(entries),
    });
  },
  {
    batchSize: 50,       // Flush after 50 entries
    flushInterval: 5000, // Or every 5 seconds
    maxRetries: 3,       // Retry failed flushes
    onError: (error, entries) => {
      console.error('Failed to send logs:', error);
    },
  }
);

const log = createLogger('App');
log.addTransport(transport);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await flush();
  destroy();
  process.exit(0);
});
```

## Filtered Transport

Only send specific log levels:

```typescript
import { createFilteredTransport } from '@nextrush/log';

// Only send errors to error tracking service
const errorTransport = createFilteredTransport(
  (entry) => sendToSentry(entry),
  'error' // Only error and fatal
);

log.addTransport(errorTransport);
```

## Predicate Transport

Custom filtering logic:

```typescript
import { createPredicateTransport } from '@nextrush/log';

// Only log entries from API context
const apiTransport = createPredicateTransport(
  (entry) => sendToApiLogs(entry),
  (entry) => entry.context.startsWith('API')
);

log.addTransport(apiTransport);
```

## Multiple Transports

```typescript
const log = createLogger('App');

// Send all logs to central logging
log.addTransport(centralLoggingTransport);

// Send only errors to Sentry
log.addTransport(createFilteredTransport(sentryTransport, 'error'));

// Send API logs to separate service
log.addTransport(createPredicateTransport(
  apiLogsTransport,
  (entry) => entry.context.includes('API')
));
```

## Popular Integrations

### Datadog

```typescript
log.addTransport(async (entry) => {
  await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': process.env.DD_API_KEY,
    },
    body: JSON.stringify({
      ...entry,
      ddsource: 'nodejs',
      service: 'my-app',
    }),
  });
});
```

### File Transport (Node.js)

```typescript
import { appendFileSync } from 'fs';

log.addTransport((entry) => {
  appendFileSync('app.log', JSON.stringify(entry) + '\n');
});
```

### Console Override

```typescript
// Don't output to console, only to transports
const log = createLogger('App', { silent: true });
log.addTransport(myTransport);
```

## LogEntry Type

```typescript
interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: SerializedError;
  correlationId?: string;
  performance?: { duration: number };
  runtime: string;
  pid?: number;
}
```
