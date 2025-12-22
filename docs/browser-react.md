# Browser & React

Same API works everywhere.

## Browser Usage

```typescript
import { createLogger } from '@nextrush/log';

const log = createLogger('App');
log.info('Works in browser!');
```

Output goes to browser console with appropriate console methods:
- `trace` → `console.debug`
- `debug` → `console.debug`
- `info` → `console.info`
- `warn` → `console.warn`
- `error` → `console.error`
- `fatal` → `console.error`

## Error Capture

Automatically capture unhandled errors:

```typescript
import { createLogger } from '@nextrush/log';
import { setupErrorCapture } from '@nextrush/log/browser';

const log = createLogger('App');
setupErrorCapture(log);

// Now captures:
// - window.onerror
// - unhandledrejection
```

## React Integration

### Provider Setup

```tsx
import { LogProvider, useLogger } from '@nextrush/log/react';

function App() {
  return (
    <LogProvider
      context="MyApp"
      options={{ minLevel: 'debug' }}
    >
      <Router />
    </LogProvider>
  );
}
```

### Using the Hook

```tsx
import { useLogger } from '@nextrush/log/react';

function MyComponent() {
  const log = useLogger('MyComponent');

  const handleClick = () => {
    log.info('Button clicked');
  };

  return <button onClick={handleClick}>Click</button>;
}
```

### Error Boundary

```tsx
import { LogErrorBoundary } from '@nextrush/log/react';

function App() {
  return (
    <LogProvider context="App">
      <LogErrorBoundary fallback={<ErrorPage />}>
        <Router />
      </LogErrorBoundary>
    </LogProvider>
  );
}
```

## Next.js

### Client Components

```tsx
'use client';

import { createLogger } from '@nextrush/log';

const log = createLogger('ClientComponent');

export function Button() {
  return (
    <button onClick={() => log.info('Clicked!')}>
      Click
    </button>
  );
}
```

### Server Components

```tsx
import { createLogger } from '@nextrush/log';

const log = createLogger('ServerComponent');

export async function UserList() {
  log.info('Fetching users');
  const users = await getUsers();
  log.info('Users fetched', { count: users.length });
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Server Actions

```typescript
'use server';

import { createLogger } from '@nextrush/log';

const log = createLogger('Actions');

export async function createPost(formData: FormData) {
  log.info('Creating post');
  // ...
}
```

## Send Browser Logs to Server

```typescript
import { createLogger, createBatchTransport } from '@nextrush/log';

const { transport, flush } = createBatchTransport(
  async (entries) => {
    // Filter to only send errors in production
    const toSend = entries.filter(e =>
      e.level === 'error' || e.level === 'fatal'
    );
    if (toSend.length === 0) return;

    await fetch('/api/client-logs', {
      method: 'POST',
      body: JSON.stringify(toSend),
    });
  },
  { batchSize: 5, flushInterval: 10000 }
);

const log = createLogger('App');
log.addTransport(transport);

// Flush before page unload
window.addEventListener('beforeunload', flush);
```
