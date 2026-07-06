/**
 * Core Logger class
 *
 * A thin facade over extracted collaborators (option resolution, argument
 * parsing, transport pipeline) — see REPORT.md ARCH-1. Reads global config
 * live on every call instead of caching + subscribing (REPORT.md SAFE-5):
 * a per-instance `onConfigChange` subscription meant every logger had to be
 * `dispose()`d or it leaked forever, which nothing in the documented API
 * ever did. A plain object read has no such cost.
 */

import { getAsyncContext } from '../context/index.js';
import { getProcessId, getRuntime } from '../runtime/index.js';
import {
    createSerializationOptions,
    mergeSensitiveKeys,
    safeSerialize,
    sanitizeContext,
    serializeError,
} from '../serializer/index.js';
import { outputToConsole } from '../transport/console.js';
import type {
    ILogger,
    LogContext,
    LogEntry,
    LoggerOptions,
    LogLevel,
    LogTransport,
    ResolvedLoggerOptions,
    SerializationOptions,
    Timer,
} from '../types/index.js';
import { formatTimestamp, getTime } from '../utils/time.js';
import { getGlobalConfig, isNamespaceEnabled } from './config.js';
import { shouldLog as shouldLogLevel, stricterMinLevel } from './levels.js';
import { parseLogArgs } from './parse-log-args.js';
import { deriveChildOptions, resolveLoggerOptions } from './resolve-options.js';
import { executeTransports } from './transport-pipeline.js';

/**
 * Core Logger class
 *
 * @example
 * ```ts
 * const logger = new Logger('MyService');
 * logger.info('Server started', { port: 3000 });
 * logger.error('Failed to connect', new Error('Connection refused'));
 * ```
 */
export class Logger implements ILogger {
  private readonly context: string;
  private options: ResolvedLoggerOptions;
  private readonly sensitiveKeys: string[];
  /**
   * Per-instance level from constructor or `setLevel` only (undefined = use global defaults + env floor).
   * Not the same as resolved `this.options.minLevel` when that was only from global defaults.
   */
  private explicitUserMin: LogLevel | undefined;
  /** Environment baseline (dev/test vs prod) fixed at construction */
  private readonly envBaselineMin: LogLevel;

  constructor(context: string, options: LoggerOptions = {}) {
    this.context = sanitizeContext(context);
    this.explicitUserMin = options.minLevel;

    const { resolved, envBaselineMin } = resolveLoggerOptions({
      options,
      explicitUserMin: this.explicitUserMin,
      globalConfig: getGlobalConfig(),
      runtimeSupportsColors: getRuntime().supportsColors,
    });
    this.options = resolved;
    this.envBaselineMin = envBaselineMin;
    this.sensitiveKeys = mergeSensitiveKeys(this.options.sensitiveKeys);
  }

  /** Effective minimum level: singleton `configure` + per-logger + env baseline */
  private getEffectiveMinLevel(): LogLevel {
    const g = getGlobalConfig();
    const floor = this.explicitUserMin ?? g.defaults.minLevel ?? this.envBaselineMin;
    if (g.minLevel === undefined) {
      return floor;
    }
    return stricterMinLevel(g.minLevel, floor);
  }

  /**
   * Check if a log level should be output.
   * Respects global configuration for enable/disable and namespace filtering.
   */
  private shouldLog(level: LogLevel): boolean {
    const globalConfig = getGlobalConfig();

    if (!globalConfig.enabled) return false;
    if (!isNamespaceEnabled(this.context)) return false;
    if (!shouldLogLevel(level, this.getEffectiveMinLevel())) return false;
    if (globalConfig.silent) return false;

    if (level === 'trace' || level === 'debug') {
      const isDev = this.options.env !== 'production';
      if (!isDev && Math.random() > this.options.samplingRate) {
        return false;
      }
    }

    return true;
  }

  private getSerializationOptions(): SerializationOptions {
    return createSerializationOptions({
      maxDepth: this.options.maxDepth,
      maxStringLength: this.options.maxStringLength,
      maxArrayLength: this.options.maxArrayLength,
      sensitiveKeys: this.sensitiveKeys,
      redact: this.options.redact,
    });
  }

  private buildEntry(level: LogLevel, message: string): LogEntry {
    const entry: LogEntry = {
      timestamp: formatTimestamp(new Date()),
      level,
      context: this.context,
      message,
      runtime: getRuntime().environment,
    };

    const pid = getProcessId();
    if (pid !== undefined) {
      entry.pid = pid;
    }

    return entry;
  }

  private emit(entry: LogEntry): void {
    if (!this.options.silent) {
      outputToConsole(entry, this.options.pretty, this.options.colors, getRuntime().isBrowser);
    }
    executeTransports(entry, getGlobalConfig().transports, this.options.transports);
  }

  /**
   * Core logging method.
   *
   * Wrapped so a poisoned argument (e.g. a throwing getter, per SAFE-4) can
   * never propagate out of a log call and crash the caller — logging must be
   * fail-safe. On internal failure this falls back to a minimal
   * `console.error` line instead of losing the log entirely.
   */
  private log(level: LogLevel, ...args: unknown[]): void {
    try {
      if (!this.shouldLog(level)) return;

      const { message, data, error } = parseLogArgs(args);
      const serializationOpts = this.getSerializationOptions();
      const asyncContext = getAsyncContext();

      const combinedData = {
        ...asyncContext?.metadata,
        ...this.options.metadata,
        ...data,
      };

      const entry = this.buildEntry(level, message);

      const correlationId = this.options.correlationId ?? asyncContext?.correlationId;
      if (correlationId) {
        entry.correlationId = correlationId;
      }

      if (Object.keys(combinedData).length > 0) {
        entry.data = safeSerialize(combinedData, serializationOpts) as LogContext;
      }

      if (error) {
        entry.error = serializeError(error, serializationOpts);
      }

      this.emit(entry);
    } catch (internalError) {
      console.error(
        `[@nextrush/log] internal logging failure (context="${this.context}", level="${level}"):`,
        internalError,
      );
    }
  }

  /** Log at trace level (most verbose) */
  trace(...args: unknown[]): void {
    this.log('trace', ...args);
  }

  /** Log at debug level */
  debug(...args: unknown[]): void {
    this.log('debug', ...args);
  }

  /** Log at info level */
  info(...args: unknown[]): void {
    this.log('info', ...args);
  }

  /** Log at warn level */
  warn(...args: unknown[]): void {
    this.log('warn', ...args);
  }

  /** Log at error level */
  error(...args: unknown[]): void {
    this.log('error', ...args);
  }

  /** Log at fatal level (most severe) */
  fatal(...args: unknown[]): void {
    this.log('fatal', ...args);
  }

  /**
   * Create a timer for performance measurement
   *
   * @example
   * ```ts
   * const timer = logger.time('database-query');
   * await db.query(...);
   * timer.end('Query completed', { rows: result.length });
   * ```
   */
  time(label?: string): Timer {
    const start = getTime();
    const timerLabel = label ?? 'Timer';

    return {
      elapsed: () => getTime() - start,
      end: (message?: string, context?: LogContext) => {
        const duration = getTime() - start;

        try {
          const entry = this.buildEntry('debug', message ?? `${timerLabel} completed`);
          entry.performance = { duration };

          if (context) {
            entry.data = safeSerialize(context, this.getSerializationOptions()) as LogContext;
          }
          if (this.options.correlationId) {
            entry.correlationId = this.options.correlationId;
          }

          if (this.shouldLog('debug')) {
            this.emit(entry);
          }
        } catch (internalError) {
          console.error(`[@nextrush/log] internal timer failure (context="${this.context}"):`, internalError);
        }

        return duration;
      },
    };
  }

  /**
   * Create a child logger with extended context
   *
   * @example
   * ```ts
   * const childLogger = logger.child('database');
   * // Logs will have context "MyService:database"
   * ```
   */
  child(additionalContext: string, options: Partial<LoggerOptions> = {}): Logger {
    const newContext = additionalContext ? `${this.context}:${additionalContext}` : this.context;
    const childOptions = deriveChildOptions(this.options, this.explicitUserMin, options);
    return new Logger(newContext, childOptions);
  }

  /**
   * Create a child logger with a correlation ID
   */
  withCorrelationId(correlationId: string): Logger {
    return this.child('', { correlationId });
  }

  /**
   * Create a child logger with additional metadata
   */
  withMetadata(metadata: LogContext): Logger {
    return this.child('', { metadata });
  }

  /**
   * Add a transport to this logger
   */
  addTransport(transport: LogTransport): void {
    this.options.transports.push(transport);
  }

  /**
   * Get the current context
   */
  getContext(): string {
    return this.context;
  }

  /**
   * Get the current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.options.correlationId;
  }

  /**
   * Check if a level would be logged
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }

  /**
   * Change the minimum log level at runtime
   */
  setLevel(level: LogLevel): void {
    this.explicitUserMin = level;
    this.options.minLevel = level;
  }

  /**
   * Flush all transports that support it.
   * This is a no-op for most transports, but batch transports may implement flush.
   */
  async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    for (const transport of this.options.transports) {
      const maybeFlushable = transport as { flush?: () => Promise<void> };
      if (typeof maybeFlushable.flush === 'function') {
        flushPromises.push(maybeFlushable.flush());
      }
    }

    if (flushPromises.length > 0) {
      await Promise.all(flushPromises);
    }
  }

  /**
   * No-op kept for backward compatibility. Logger no longer subscribes to
   * any process-wide listener (SAFE-5), so there is nothing to clean up.
   * @deprecated Safe to stop calling — retained only so existing call sites don't break.
   */
  dispose(): void {
    // Intentionally empty — see class doc comment.
  }
}
