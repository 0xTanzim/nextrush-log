/**
 * Core Logger class
 * The main logger implementation with flexible API
 */

import { getAsyncContext } from '../context/index.js';
import { getEnvVar, getProcessId, getRuntime, isProductionBuild } from '../runtime/index.js';
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
  LoggerEnvironment,
  LoggerOptions,
  LogLevel,
  LogTransport,
  ResolvedLoggerOptions,
  SerializationOptions,
  Timer,
} from '../types/index.js';
import { formatTimestamp, getTime } from '../utils/time.js';
import { getGlobalConfig, isNamespaceEnabled, onConfigChange, type GlobalLoggerConfig } from './config.js';
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
  private cachedGlobalConfig: GlobalLoggerConfig;
  private readonly configUnsubscribe: () => void;

  constructor(context: string, options: LoggerOptions = {}) {
    // Sanitize context to prevent log injection
    this.context = sanitizeContext(context);
    this.options = this.resolveOptions(options);
    this.sensitiveKeys = mergeSensitiveKeys(this.options.sensitiveKeys);

    // Cache global config for performance
    this.cachedGlobalConfig = getGlobalConfig();
    this.configUnsubscribe = onConfigChange(() => {
      this.cachedGlobalConfig = getGlobalConfig();
    });
  }

  /**
   * Resolve user options with defaults
   */
  private resolveOptions(options: LoggerOptions): ResolvedLoggerOptions {
    const runtime = getRuntime();
    const globalConfig = getGlobalConfig();
    const nodeEnv = getEnvVar('NODE_ENV');

    // Determine environment from options, global config, or NODE_ENV
    let env: LoggerEnvironment = options.env ?? globalConfig.env ?? 'development';
    if (!options.env && !globalConfig.env) {
      if (nodeEnv === 'production' || isProductionBuild()) env = 'production';
      else if (nodeEnv === 'test') env = 'test';
    }

    const isDev = env === 'development';
    const isTest = env === 'test';
    const isProd = env === 'production';

    const enableDebug =
      getEnvVar('ENABLE_DEBUG_LOGS') === 'true' ||
      getEnvVar('DEBUG') === 'true';

    // Apply global defaults, then environment defaults, then user options
    const defaults = globalConfig.defaults;
    const defaultMinLevel = isProd ? (enableDebug ? 'debug' : 'info') : 'trace';
    const defaultPretty = isDev || isTest;
    const defaultColors = runtime.supportsColors && (isDev || isTest);
    const defaultRedact = isProd;

    const result: ResolvedLoggerOptions = {
      minLevel: options.minLevel ?? defaults.minLevel ?? defaultMinLevel,
      pretty: options.pretty ?? defaults.pretty ?? defaultPretty,
      colors: options.colors ?? defaults.colors ?? defaultColors,
      transports: options.transports ?? defaults.transports ?? [],
      metadata: { ...defaults.metadata, ...options.metadata },
      sensitiveKeys: options.sensitiveKeys ?? defaults.sensitiveKeys ?? [],
      maxDepth: options.maxDepth ?? defaults.maxDepth ?? 10,
      maxStringLength: options.maxStringLength ?? defaults.maxStringLength ?? 10000,
      maxArrayLength: options.maxArrayLength ?? defaults.maxArrayLength ?? 100,
      samplingRate: options.samplingRate ?? defaults.samplingRate ?? 0.1,
      timestamps: options.timestamps ?? defaults.timestamps ?? true,
      silent: options.silent ?? defaults.silent ?? false,
      redact: options.redact ?? defaults.redact ?? defaultRedact,
      env,
    };

    if (options.correlationId !== undefined) {
      result.correlationId = options.correlationId;
    }

    return result;
  }

  /**
   * Check if a log level should be output (for console)
   * Respects global configuration for enable/disable and namespace filtering
   */
  private shouldLog(level: LogLevel): boolean {
    const globalConfig = this.cachedGlobalConfig;

    // Global kill switch
    if (!globalConfig.enabled) return false;

    // Check namespace filtering
    if (!isNamespaceEnabled(this.context)) return false;

    // Global minimum level override
    const effectiveMinLevel = globalConfig.minLevel ?? this.options.minLevel;
    if (!shouldLogLevel(level, effectiveMinLevel)) return false;

    // Global silent mode
    if (globalConfig.silent) return false;

    // Apply sampling for trace/debug in production
    if (level === 'trace' || level === 'debug') {
      const isDev = getEnvVar('NODE_ENV') !== 'production' && !isProductionBuild();
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
        // Merge object data using Object.assign for better performance
        Object.assign(data, arg as LogContext);
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

    // Get async context for automatic correlation ID and metadata
    const asyncContext = getAsyncContext();

    // Merge metadata: async context -> logger options -> call-specific data
    const combinedData = {
      ...asyncContext?.metadata,
      ...this.options.metadata,
      ...data
    };

    // Build log entry
    const entry: LogEntry = {
      timestamp: formatTimestamp(new Date()),
      level,
      context: this.context,
      message,
      runtime: getRuntime().environment,
    };

    // Correlation ID priority: logger options -> async context
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
   * Execute all registered transports (local and global)
   */
  private executeTransports(entry: LogEntry): void {
    const globalConfig = this.cachedGlobalConfig;

    // Execute global transports first
    for (const transport of globalConfig.transports) {
      try {
        const result = transport(entry);
        if (result instanceof Promise) {
          result.catch(() => { /* Silently ignore */ });
        }
      } catch {
        // Silently ignore transport errors
      }
    }

    // Execute instance transports
    for (const transport of this.options.transports) {
      try {
        const result = transport(entry);
        if (result instanceof Promise) {
          result.catch(() => { /* Silently ignore */ });
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

    // Always inherit parent's correlationId unless explicitly overridden
    const inheritedCorrelationId = options.correlationId ?? this.options.correlationId;

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

    // Only add correlationId if it's defined
    if (inheritedCorrelationId !== undefined) {
      childOptions.correlationId = inheritedCorrelationId;
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

  /**
   * Clean up resources (unsubscribe from config changes)
   * Call this when disposing of a logger instance
   */
  dispose(): void {
    this.configUnsubscribe();
  }
}
