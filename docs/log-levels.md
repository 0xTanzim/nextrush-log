# Log Levels

There are **six** levels, from most verbose to most critical. Internally they use priority **0–5** (see the [API reference](/api#log-levels) for the exact table).

## Choosing a level

- **`trace` / `debug`** — local troubleshooting, high volume (often off in production).
- **`info`** — normal lifecycle events (started, completed).
- **`warn`** — something odd but the app continues.
- **`error` / `fatal`** — failures; `fatal` is reserved for the worst cases.

## Filtering with `minLevel`

Only messages with **severity ≥ `minLevel`** are emitted. Example:

```typescript
const log = createLogger('App', { minLevel: 'warn' });

log.info('startup');  // skipped — below `warn`
log.warn('slow');     // kept
log.error('failed');  // kept
```

### Matrix

| `minLevel` | trace | debug | info | warn | error | fatal |
|------------|:-----:|:-----:|:----:|:----:|:-----:|:-----:|
| `'trace'`  |  ✅   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'debug'`  |  ❌   |  ✅   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'info'`   |  ❌   |  ❌   |  ✅  |  ✅  |  ✅   |  ✅   |
| `'warn'`   |  ❌   |  ❌   |  ❌  |  ✅  |  ✅   |  ✅   |
| `'error'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ✅   |  ✅   |
| `'fatal'`  |  ❌   |  ❌   |  ❌  |  ❌  |  ❌   |  ✅   |

## Global + per-logger

`configure({ minLevel })` and `setGlobalLevel()` set a **global floor**. The **stricter** of the global floor and each logger’s `minLevel` wins (so a logger created with `minLevel: 'error'` does not start logging at `info` when the global is `trace`). Details: [Global configuration](/global-configuration).

## See also

- [API: levels & environment defaults](/api#log-levels)
- [Environment & `NODE_ENV`](/environment)
- [Timing (`time` / `timer.end` logs at **debug** )](/api#timing)
