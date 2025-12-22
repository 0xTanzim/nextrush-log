# Environment Configuration

The logger auto-configures based on your environment.

## Auto-Detection

The logger reads `NODE_ENV` and applies these defaults:

| Setting | Development | Test | Production |
|---------|:-----------:|:----:|:----------:|
| `minLevel` | `trace` | `trace` | `info` |
| `pretty` | ✅ | ✅ | ❌ (JSON) |
| `colors` | ✅ | ✅ | ❌ |
| `redact` | ❌ | ❌ | ✅ |

## Development Mode

When `NODE_ENV !== 'production'`:

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

// Force development mode (even in production)
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
| `NODE_ENV` | `'production'` enables JSON output and redaction |
| `DEBUG` | `'true'` enables debug level in production |
| `ENABLE_DEBUG_LOGS` | Alternative to `DEBUG` |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

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
