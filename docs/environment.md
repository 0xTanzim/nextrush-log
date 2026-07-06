# Environment Configuration

The logger auto-configures based on your environment.

## Auto-Detection

The logger reads `NODE_ENV` (and Vite's `MODE`/`PROD`/`DEV`) and applies these defaults:

| Setting | Development | Test | Production | Undetected |
|---------|:-----------:|:----:|:----------:|:----------:|
| `minLevel` | `trace` | `trace` | `info` | `trace` |
| `pretty` | ✅ | ✅ | ❌ (JSON) | ✅ |
| `colors` | ✅ | ✅ | ❌ | ✅ |
| `redact` | ❌ | ❌ | ✅ | **✅** |

**Undetected** means no `NODE_ENV`, no Vite signal, and no explicit `env` option — this can
happen on some edge/serverless runtimes. Redaction defaults **on** in that case: a logger
must never silently leak secrets just because a platform doesn't expose `NODE_ENV`. Set
`env: 'development'` explicitly (or `redact: false`) if you genuinely want unredacted output
on such a platform, e.g. for local development against an edge runtime emulator.

## Development Mode

When `NODE_ENV !== 'production'` (and explicitly resolved, not merely undetected):

- **All logs visible** — trace through fatal
- **Pretty output** — human-readable, colorful
- **No redaction** — see full data for debugging

```
10:30:00 DEBUG [App] User login { password: 'secret123' }
```

## Production Mode

When `NODE_ENV === 'production'`:

- **Info and above** — trace/debug filtered out
- **JSON output** — for log aggregators (Datadog, Splunk, etc.)
- **Redaction enabled** — sensitive data protected

```json
{"timestamp":"...","level":"info","message":"User login","data":{"password":"[REDACTED]"}}
```

## Override Environment

### Force Environment Mode

```typescript
// Force production mode (even in development)
const log = createLogger('App', { env: 'production' });

// Force development mode (even in production, or on an undetected runtime)
const log = createLogger('App', { env: 'development' });
```

### Override Individual Settings

```typescript
// Production JSON + debug logs
const log = createLogger('App', {
  env: 'production',
  minLevel: 'debug',
});

// Development pretty + redaction enabled
const log = createLogger('App', {
  env: 'development',
  redact: true,
});
```

### Conditional Configuration

```typescript
const isProd = process.env.NODE_ENV === 'production';

const log = createLogger('App', {
  minLevel: isProd ? 'info' : 'trace',
  redact: isProd,
  pretty: !isProd,
});
```

### Using `env` Option

```typescript
const log = createLogger('App', {
  env: process.env.NODE_ENV as 'development' | 'test' | 'production',
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `'production'` enables JSON output and redaction; unset/undetected also enables redaction (fail-safe) |
| `DEBUG` | `'true'` enables debug level in production |
| `ENABLE_DEBUG_LOGS` | Alternative to `DEBUG` |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

These are read automatically by `createLogger()` — there is no separate step to wire them up.
If you want to read your own `LOG_LEVEL`/`LOG_ENABLED`/`LOG_NAMESPACES` variables and apply
them globally at startup, do that explicitly with `configure()` — see
[Global Configuration](./global-configuration.md#reading-configuration-from-environment-variables).

### Example .env Files

```bash
# .env.development
NODE_ENV=development

# .env.production
NODE_ENV=production

# .env.test
NODE_ENV=test
```

## Common Configurations

### API Server (Production)

```typescript
const log = createLogger('API', {
  env: 'production',
  minLevel: 'info',
  metadata: {
    service: 'user-api',
    version: process.env.npm_package_version,
  },
});
```

### Debug Mode in Production

```typescript
const log = createLogger('App', {
  env: 'production',
  minLevel: process.env.DEBUG === 'true' ? 'debug' : 'info',
});
```

### CI/Test Environment

```typescript
const log = createLogger('Test', {
  env: 'test',
  silent: process.env.CI === 'true', // Silent in CI
});
```
