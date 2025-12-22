# Log Levels

Six levels from most verbose to most critical.

## Level Hierarchy

| Level | Priority | When to Use |
|-------|:--------:|-------------|
| `trace` | 10 | Detailed debugging (function entry/exit, variable values) |
| `debug` | 20 | Development debugging (request details, state changes) |
| `info` | 30 | Normal operations (server started, user logged in) |
| `warn` | 40 | Potential issues (deprecated API, high memory) |
| `error` | 50 | Errors (failed request, caught exception) |
| `fatal` | 60 | Critical failures (app crash, unrecoverable) |

## Level Filtering

Setting `minLevel` logs that level **and all higher priority levels**:

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.trace('ignored');  // ❌ priority 10 < 40
log.debug('ignored');  // ❌ priority 20 < 40
log.info('ignored');   // ❌ priority 30 < 40
log.warn('logged');    // ✅ priority 40 >= 40
log.error('logged');   // ✅ priority 50 >= 40
log.fatal('logged');   // ✅ priority 60 >= 40
```

### Quick Reference Table

| `minLevel` | trace | debug | info | warn | error | fatal |
|------------|:-----:|:-----:|:----:|:----:|:-----:|:-----:|
| `'trace'`  |  ✅   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'debug'`  |  ❌   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'info'`   |  ❌   |  ❌   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'warn'`   |  ❌   |  ❌   |  ❌  |  ✅  |  ✅   |  ✅   |
| `'error'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ✅   |  ✅   |
| `'fatal'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ❌   |  ✅   |

## Runtime Level Control

Change log level at runtime:

```typescript
const log = createLogger('App');

// Start with all levels
log.trace('Detailed info');  // ✅ Logged

// Later, reduce noise
log.setLevel('error');
log.trace('Detailed info');  // ❌ Now ignored
log.error('Problem!');       // ✅ Still logged
```

### Check Before Expensive Operations

Avoid computing expensive data if it won't be logged:

```typescript
if (log.isLevelEnabled('debug')) {
  // Only compute if debug is enabled
  const debugData = JSON.stringify(largeObject, null, 2);
  log.debug('Full state', { data: debugData });
}
```

## Environment Defaults

| Environment | Default `minLevel` |
|-------------|-------------------|
| Development | `trace` (all logs) |
| Test | `trace` (all logs) |
| Production | `info` (no trace/debug) |

Override:

```typescript
// Force specific level regardless of environment
const log = createLogger('App', { minLevel: 'debug' });
```
