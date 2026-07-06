# Changelog

All notable changes to `@nextrush/log` are documented here.

## [0.3.0] — 2026-07-06

Full architecture and correctness remediation driven by an internal audit
(see `REPORT.md`). **This is a breaking release.**

### Breaking changes

- **Main entry (`@nextrush/log`) surface minimized from 76 exports to ~20.**
  Internal plumbing that was never meant to be imported directly by
  consumers has been removed from the main barrel. It is still used
  internally by the package; if you genuinely need one of these, open an
  issue describing your use case.
  - Removed: `shouldLog`, `compareLevels`, `stricterMinLevel`, `parseLogLevel`,
    `isValidLogLevel`, `LOG_LEVELS`, `LOG_LEVEL_PRIORITY`, `safeSerialize`,
    `sanitizeContext`, `shouldRedact`, `mergeSensitiveKeys`,
    `containsSensitivePattern`, `redactSensitiveValues`, `serializeError`,
    `isError`, `DEFAULT_SENSITIVE_KEYS`, `detectRuntime`, `getRuntime`,
    `getEnvVar`, `getProcessId`, `isProductionBuild`, `formatJSON`,
    `formatPrettyJSON`, `formatPrettyTerminal`, `formatTimestamp`,
    `formatPrettyTimestamp`, `getTime`, `onConfigChange`,
    `isNamespaceEnabled`, `getGlobalConfig`, `createConfigStore`.
- **Removed redundant logger-acquisition aliases.** `logger` (bare alias of
  the same singleton `log` already is) and `scopedLogger` (pure alias of
  `createLogger`) are gone. **Migration:** use `log` or `createLogger(name)`.
- **`Logger` is now a type-only export.** `new Logger(...)` is no longer
  supported from the public API. **Migration:** use `createLogger(name)`.
- **Removed `createConsoleTransport`.** It caused every log line to print
  twice when added via `addTransport`, because console output is already
  built into every `Logger`. There is no replacement — console output
  happens automatically.
- **Removed `createPredicateTransport`** (redundant with
  `createFilteredTransport`) and **`createNamespaceRateLimitedTransport`**
  (redundant with `createRateLimitedTransport`, which already accepts a
  namespace option internally). **Migration:** use `createFilteredTransport`
  and `createRateLimitedTransport` respectively.
- **Removed 8 single-field config mutators**: `clearGlobalLevel`,
  `clearGlobalTransports`, `enableLogging`, `enableNamespaces`,
  `disableNamespaces`, `setGlobalLevel`, `configureFromEnv`,
  `resetGlobalConfig`. **Migration:** use `configure({ ... })` with the
  equivalent field(s) — it already supported all of this.
- **Removed the `./context` package entry point.** Every symbol it exported
  was already re-exported from the main entry; import from `@nextrush/log`
  instead of `@nextrush/log/context`.
- **Removed the dead `timestamps` option** on `LoggerOptions`. It was
  assigned but never read — setting it never had any effect. Every log
  entry is always timestamped; there is nothing to configure.

### Fixed (correctness & production-safety)

- **Critical:** async-context correlation ID / metadata could bleed across
  concurrent requests on any runtime without `AsyncLocalStorage` (browser,
  edge, Deno, or ESM-Node where the old `require()`-based load silently
  failed). Context propagation now loads `async_hooks` correctly under ESM
  and no longer relies on a shared mutable fallback for concurrent state.
- Logging could throw and crash the caller if a logged value had a
  throwing getter. `log()` is now wrapped so an internal failure falls back
  to a `console.error` line instead of propagating into your code.
- Secrets attached directly to an `Error` object (e.g. `err.token = ...`)
  bypassed key-based redaction. They are now redacted the same as plain
  object keys.
- A shared (non-circular) object reference passed twice in one log call was
  incorrectly rendered as `[Circular Reference]`, silently losing data.
- Log messages were not sanitized before being written to the terminal or
  browser console, allowing embedded newlines/ANSI escapes to forge fake
  log lines, and allowing `%c`/`%s` in a message to corrupt the browser
  console's format-string arguments.
- Every `Logger` instance subscribed to a process-wide config-change
  listener that was only ever cleaned up by calling `dispose()` — which no
  documented usage pattern did. Config is now read live at log time
  instead, so there is nothing to leak and `dispose()` is a safe no-op.
- The two Error serializers (used depending on whether an error was passed
  positionally or nested inside a data object) produced different, lossy
  output for the same input. There is now one serializer used everywhere.
- `shouldRedact`'s substring matching over-redacted unrelated fields
  (`primaryKey`, `passport`, `author`, `wildcard`, ...). It now matches on
  whole tokens.
- `@nextrush/log/testing`'s mock logger parsed arguments differently from
  the real `Logger`, so a test could pass against the mock while
  production behaved differently. Both now share one implementation.

### Internal

- `Logger` (previously a 568-line, 25-method god class) is now a thin
  facade delegating to pure, independently-tested collaborators
  (`parseLogArgs`, `resolveLoggerOptions`, `deriveChildOptions`,
  `executeTransports`).
- Global config (`src/core/config.ts`) is now backed by an injectable
  `createConfigStore()` factory internally; the existing `configure()` /
  `disableLogging()` / etc. functions are thin wrappers over one default
  store, preserving 100% of their existing behavior.
- Added test coverage for `@nextrush/log/testing` (previously untested) and
  for the minimized public API surface.

## [0.2.5] and earlier

See git history.
