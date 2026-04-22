# Testing Utilities

Mock loggers and assertions for testing code that uses @nextrush/log.

## Installation

Testing utilities are available as a submodule:

```typescript
import { createMockLogger, expectLogged } from '@nextrush/log/testing';
```

## Quick Start

```typescript
import { describe, it, expect } from 'vitest';
import { createMockLogger, expectLogged, expectNoErrors } from '@nextrush/log/testing';

describe('MyService', () => {
  it('should log success message', () => {
    const mockLog = createMockLogger();

    myService.doSomething(mockLog);

    expectLogged(mockLog, 'info', 'Operation completed');
    expectNoErrors(mockLog);
  });
});
```

## Mock Logger

### Creating a Mock Logger

```typescript
import { createMockLogger } from '@nextrush/log/testing';

const mockLog = createMockLogger('MyContext');

// Use like a normal logger
mockLog.info('Hello world');
mockLog.error('Something failed', new Error('Oops'));
mockLog.debug('Debug info', { userId: 123 });
```

The mock’s `withCorrelationId` / `withMetadata` return the same instance (no chained metadata). Use a **real** `Logger` in integration tests if you need those behaviors.

### Accessing Recorded Calls

```typescript
const mockLog = createMockLogger();

myFunction(mockLog);

// All calls
console.log(mockLog.calls.all);

// By level
console.log(mockLog.calls.info);
console.log(mockLog.calls.error);
console.log(mockLog.calls.warn);

// Last call
const lastCall = mockLog.lastCall();
const lastError = mockLog.lastCall('error');
```

### LogCall Structure

```typescript
interface LogCall {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  args: unknown[];
  message: string;
  data?: Record<string, unknown>;
  error?: Error;
  timestamp: Date;
}
```

### Checking Logs

```typescript
// Check if a message was logged
if (mockLog.wasLogged('info', 'Expected message')) {
  console.log('Found it!');
}

// With regex
if (mockLog.wasLogged('error', /failed to connect/i)) {
  console.log('Connection error was logged');
}

// Assert (throws if not found)
mockLog.assertLogged('info', 'Expected message');
```

### Clearing Logs

```typescript
mockLog.info('First');
mockLog.info('Second');

mockLog.clear();

console.log(mockLog.calls.all.length); // 0
```

## Assertion Helpers

### expectLogged

Assert that a message was logged at the specified level:

```typescript
import { expectLogged } from '@nextrush/log/testing';

const mockLog = createMockLogger();
myFunction(mockLog);

// String match (contains)
expectLogged(mockLog, 'info', 'User created');

// Regex match
expectLogged(mockLog, 'error', /failed.*timeout/i);
```

### expectNoErrors

Assert that no error or fatal logs occurred:

```typescript
import { expectNoErrors } from '@nextrush/log/testing';

const mockLog = createMockLogger();
myFunction(mockLog);

expectNoErrors(mockLog); // Throws if any error/fatal logs exist
```

## Recording Transport

Capture log entries from a real logger:

```typescript
import { createRecordingTransport, createLogger } from '@nextrush/log/testing';

const { transport, entries, clear } = createRecordingTransport();

const log = createLogger('Test');
log.addTransport(transport);

log.info('Hello');
log.error('Oops');

console.log(entries.length); // 2
console.log(entries[0].message); // 'Hello'

clear();
console.log(entries.length); // 0
```

## Full Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockLogger, expectLogged, expectNoErrors } from '@nextrush/log/testing';
import { OrderService } from './order-service';

describe('OrderService', () => {
  let mockLog: MockLogger;
  let service: OrderService;

  beforeEach(() => {
    mockLog = createMockLogger('OrderService');
    service = new OrderService(mockLog);
  });

  it('should log order creation', async () => {
    await service.createOrder({ userId: '123', items: ['A', 'B'] });

    expectLogged(mockLog, 'info', 'Order created');
    expect(mockLog.calls.info[0].data).toEqual({
      userId: '123',
      itemCount: 2,
    });
  });

  it('should log errors on failure', async () => {
    await expect(service.createOrder({ userId: null })).rejects.toThrow();

    expectLogged(mockLog, 'error', /invalid user/i);
    expect(mockLog.calls.error[0].error).toBeInstanceOf(Error);
  });

  it('should not log errors on success', async () => {
    await service.createOrder({ userId: '123', items: ['A'] });

    expectNoErrors(mockLog);
  });

  it('should include correlation ID in child loggers', async () => {
    const childLog = mockLog.child('Payment');
    childLog.info('Processing payment');

    expect(mockLog.calls.all).toHaveLength(0); // Child has its own calls
  });
});
```

## API Reference

### `createMockLogger(context?: string): MockLogger`

Create a mock logger that records all calls.

### `expectLogged(logger: MockLogger, level: LogLevel, message: string | RegExp): void`

Assert that a message was logged. Throws if not found.

### `expectNoErrors(logger: MockLogger): void`

Assert that no error or fatal logs occurred. Throws if any exist.

### `createRecordingTransport(): { transport, entries, clear }`

Create a transport that records entries for inspection.

### `MockLogger.calls`

Object containing all recorded calls by level:
- `calls.all` - All calls in order
- `calls.trace` - Trace level calls
- `calls.debug` - Debug level calls
- `calls.info` - Info level calls
- `calls.warn` - Warn level calls
- `calls.error` - Error level calls
- `calls.fatal` - Fatal level calls

### `MockLogger.clear()`

Clear all recorded calls.

### `MockLogger.lastCall(level?: LogLevel): LogCall | undefined`

Get the last call, optionally filtered by level.

### `MockLogger.wasLogged(level: LogLevel, message: string | RegExp): boolean`

Check if a message was logged at the specified level.

### `MockLogger.assertLogged(level: LogLevel, message: string | RegExp): void`

Assert that a message was logged. Throws if not found.

## Tips

### 1. Use Fresh Mock Per Test

```typescript
beforeEach(() => {
  mockLog = createMockLogger();
});
```

### 2. Check Data, Not Just Messages

```typescript
expectLogged(mockLog, 'info', 'Order created');
expect(mockLog.calls.info[0].data).toMatchObject({
  orderId: expect.any(String),
  userId: '123',
});
```

### 3. Verify Error Objects

```typescript
const errorCall = mockLog.lastCall('error');
expect(errorCall?.error).toBeInstanceOf(ValidationError);
expect(errorCall?.error?.message).toContain('Invalid input');
```

### 4. Test Log Absence

```typescript
expect(mockLog.wasLogged('warn', 'deprecated')).toBe(false);
```
