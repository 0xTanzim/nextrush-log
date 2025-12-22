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
| `LOG_LEVEL` | Set minimum log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `LOG_ENABLED` | `'false'` or `'0'` disables all logging |
| `LOG_NAMESPACES` | Comma-separated namespace patterns (`api:*,auth:*`) |
| `DEBUG` | `'true'` enables debug level in production |
| `ENABLE_DEBUG_LOGS` | Alternative to `DEBUG` |
| `NO_COLOR` | Disable colored output |
| `FORCE_COLOR` | Force colored output |

## Configure from Environment

Use `configureFromEnv()` to automatically read environment variables:

```typescript
import { configureFromEnv } from '@nextrush/log';

// Node.js / Bun
configureFromEnv((name) => process.env[name]);

// Vite
configureFromEnv((name) => import.meta.env[name] ?? import.meta.env[`VITE_${name}`]);

// Deno
configureFromEnv((name) => Deno.env.get(name));
```

### Example .env Files

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
LOG_ENABLED=true
LOG_NAMESPACES=*

# .env.production
NODE_ENV=production
LOG_LEVEL=info
LOG_ENABLED=true
LOG_NAMESPACES=api:*,auth:*,payments:*

# .env.test
NODE_ENV=test
LOG_ENABLED=false
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
