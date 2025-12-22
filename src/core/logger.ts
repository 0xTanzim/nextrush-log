/**
 * Core Logger class
 * The main logger implementation with flexible API
 */

import { getEnvVar, getProcessId, getRuntime } from '../runtime/index.js';
import {
  createSerializationOptions,
  mergeSensitiveKeys,
  safeSerialize,
  serializeError,
} from '../serializer/index.js';
import { outputToConsole } from '../transport/console.js';
import type {
  ILogger,
  LogContext,
  LogEntry,
  LoggerEnvironment,
  LoggerOptions,
  LogLevel,
  LogTransport,
  ResolvedLoggerOptions,
  SerializationOptions,
  Timer,
} from '../types/index.js';
import { formatTimestamp, getTime } from '../utils/time.js';
import { shouldLog as shouldLogLevel } from './levels.js';

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

  constructor(context: string, options: LoggerOptions = {}) {
    this.context = context;
    this.options = this.resolveOptions(options);
    this.sensitiveKeys = mergeSensitiveKeys(this.options.sensitiveKeys);
  }

  /**
   * Resolve user options with defaults
   */
  private resolveOptions(options: LoggerOptions): ResolvedLoggerOptions {
    const runtime = getRuntime();
    const nodeEnv = getEnvVar('NODE_ENV');

    // Determine environment from options or NODE_ENV
    let env: LoggerEnvironment = options.env ?? 'development';
    if (!options.env) {
      if (nodeEnv === 'production') env = 'production';
      else if (nodeEnv === 'test') env = 'test';
    }

    const isDev = env === 'development';
    const isTest = env === 'test';
    const isProd = env === 'production';

    const enableDebug =
      getEnvVar('ENABLE_DEBUG_LOGS') === 'true' ||
      getEnvVar('DEBUG') === 'true';

    // Environment-based defaults
    const defaultMinLevel = isProd ? (enableDebug ? 'debug' : 'info') : 'trace';
    const defaultPretty = isDev || isTest;
    const defaultColors = runtime.supportsColors && (isDev || isTest);
    const defaultRedact = isProd; // Only redact in production by default

    const result: ResolvedLoggerOptions = {
      minLevel: options.minLevel ?? defaultMinLevel,
      pretty: options.pretty ?? defaultPretty,
      colors: options.colors ?? defaultColors,
      transports: options.transports ?? [],
      metadata: options.metadata ?? {},
      sensitiveKeys: options.sensitiveKeys ?? [],
      maxDepth: options.maxDepth ?? 10,
      maxStringLength: options.maxStringLength ?? 10000,
      maxArrayLength: options.maxArrayLength ?? 100,
      samplingRate: options.samplingRate ?? 0.1,
      timestamps: options.timestamps ?? true,
      silent: options.silent ?? false,
      redact: options.redact ?? defaultRedact,
      env,
    };

    if (options.correlationId !== undefined) {
      result.correlationId = options.correlationId;
    }

    return result;
  }

  /**
   * Check if a log level should be output (for console)
   */
  private shouldLog(level: LogLevel): boolean {
    if (!shouldLogLevel(level, this.options.minLevel)) return false;

    // Apply sampling for trace/debug in production
    if (level === 'trace' || level === 'debug') {
      const isDev = getEnvVar('NODE_ENV') !== 'production';
      if (!isDev && Math.random() > this.options.samplingRate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create serialization options for this logger
   */
  private getSerializationOptions(): SerializationOptions {
    return createSerializationOptions({
      maxDepth: this.options.maxDepth,
      maxStringLength: this.options.maxStringLength,
      maxArrayLength: this.options.maxArrayLength,
      sensitiveKeys: this.sensitiveKeys,
      redact: this.options.redact,
    });
  }

  /**
   * Parse flexible arguments into structured data
   * Supports: (message), (error), (data), (message, data), (message, error), etc.
   */
  private parseArgs(args: unknown[]): {
    message: string;
    data: LogContext;
    error: Error | undefined;
  } {
    let message = '';
    let data: LogContext = {};
    let error: Error | undefined;

    for (const arg of args) {
      if (arg instanceof Error) {
        error = arg;
        if (!message) message = arg.message;
      } else if (typeof arg === 'string') {
        message = message ? `${message} ${arg}` : arg;
      } else if (arg !== null && typeof arg === 'object') {
        // Merge object data
        data = { ...data, ...(arg as LogContext) };
      } else if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
        // Primitive values become part of the message
        const argStr = String(arg);
        message = message ? `${message} ${argStr}` : argStr;
      }
    }

    // Generate default message if none provided
    if (!message && Object.keys(data).length > 0) {
      message = 'Log data';
    }

    if (!message && error) {
      message = error.message;
    }

    if (!message) {
      message = 'Empty log';
    }

    return { message, data, error };
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const { message, data, error } = this.parseArgs(args);
    const serializationOpts = this.getSerializationOptions();

    // Merge metadata with call-specific data
    const combinedData = { ...this.options.metadata, ...data };

    // Build log entry
    const entry: LogEntry = {
      timestamp: formatTimestamp(new Date()),
      level,
      context: this.context,
      message,
      runtime: getRuntime().environment,
    };

    if (this.options.correlationId) {
      entry.correlationId = this.options.correlationId;
    }

    if (Object.keys(combinedData).length > 0) {
      entry.data = safeSerialize(combinedData, serializationOpts) as LogContext;
    }

    if (error) {
      entry.error = serializeError(error, serializationOpts);
    }

    // Add process ID for Node.js
    const pid = getProcessId();
    if (pid !== undefined) {
      entry.pid = pid;
    }

    // Output to console (unless silent)
    if (!this.options.silent) {
      const runtime = getRuntime();
      outputToConsole(
        entry,
        this.options.pretty,
        this.options.colors,
        runtime.isBrowser,
      );
    }

    // Execute custom transports
    this.executeTransports(entry);
  }

  /**
   * Execute all registered transports
   */
  private executeTransports(entry: LogEntry): void {
    for (const transport of this.options.transports) {
      try {
        const result = transport(entry);
        // Handle async transports silently
        if (result instanceof Promise) {
          result.catch(() => {
            // Silently ignore transport errors
          });
        }
      } catch {
        // Silently ignore transport errors to prevent logging loops
      }
    }
  }

  // ============================================================================
  // Public Logging Methods
  // ============================================================================

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

  // ============================================================================
  // Utility Methods
  // ============================================================================

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
        const logMessage = message ?? `${timerLabel} completed`;

        // Create log entry with performance data
        const entry: LogEntry = {
          timestamp: formatTimestamp(new Date()),
          level: 'debug',
          context: this.context,
          message: logMessage,
          runtime: getRuntime().environment,
          performance: { duration },
        };

        if (context) {
          entry.data = safeSerialize(
            context,
            this.getSerializationOptions(),
          ) as LogContext;
        }

        if (this.options.correlationId) {
          entry.correlationId = this.options.correlationId;
        }

        if (this.shouldLog('debug')) {
          const runtime = getRuntime();
          outputToConsole(
            entry,
            this.options.pretty,
            this.options.colors,
            runtime.isBrowser,
          );
          this.executeTransports(entry);
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
  child(
    additionalContext: string,
    options: Partial<LoggerOptions> = {},
  ): Logger {
    const newContext = additionalContext
      ? `${this.context}:${additionalContext}`
      : this.context;

    const childOptions: LoggerOptions = {
      minLevel: options.minLevel ?? this.options.minLevel,
      pretty: options.pretty ?? this.options.pretty,
      colors: options.colors ?? this.options.colors,
      transports: options.transports ?? this.options.transports,
      metadata: { ...this.options.metadata, ...options.metadata },
      sensitiveKeys: [
        ...this.options.sensitiveKeys,
        ...(options.sensitiveKeys ?? []),
      ],
      maxDepth: options.maxDepth ?? this.options.maxDepth,
      maxStringLength: options.maxStringLength ?? this.options.maxStringLength,
      maxArrayLength: options.maxArrayLength ?? this.options.maxArrayLength,
      samplingRate: options.samplingRate ?? this.options.samplingRate,
      timestamps: options.timestamps ?? this.options.timestamps,
      silent: options.silent ?? this.options.silent,
      redact: options.redact ?? this.options.redact,
      env: options.env ?? this.options.env,
    };

    // Only set correlationId if defined
    const correlationId = options.correlationId ?? this.options.correlationId;
    if (correlationId !== undefined) {
      childOptions.correlationId = correlationId;
    }

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
    return new Logger(this.context, {
      ...this.options,
      metadata: { ...this.options.metadata, ...metadata },
    });
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
    this.options.minLevel = level;
  }

  /**
   * Flush all transports that support it
   * This is a no-op for most transports, but batch transports may implement flush
   */
  async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    for (const transport of this.options.transports) {
      // Check if transport has a flush method (duck typing)
      const maybeFlushable = transport as { flush?: () => Promise<void> };
      if (typeof maybeFlushable.flush === 'function') {
        flushPromises.push(maybeFlushable.flush());
      }
    }

    if (flushPromises.length > 0) {
      await Promise.all(flushPromises);
    }
  }
}
