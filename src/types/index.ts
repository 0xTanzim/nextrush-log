/**
 * Type definitions for @nextrush/log
 * @packageDocumentation
 */

/** Log severity levels ordered from least to most severe */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Flexible context object for structured logging */
export type LogContext = Record<string, unknown>;

/** Serialized error information */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: SerializedError | string | unknown;
  [key: string]: unknown;
}

/** Performance metrics attached to log entries */
export interface PerformanceMetrics {
  duration?: number;
  memory?: number;
  timestamp?: number;
}

/** Detected runtime environment */
export type RuntimeEnvironment =
  | 'browser'
  | 'edge'
  | 'node'
  | 'deno'
  | 'bun'
  | 'worker'
  | 'react-native'
  | 'unknown';

/** Complete log entry structure */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  correlationId?: string;
  data?: LogContext;
  error?: SerializedError;
  performance?: PerformanceMetrics;
  runtime: RuntimeEnvironment;
  pid?: number;
}

/** Transport function for custom log destinations */
export type LogTransport = (entry: LogEntry) => void | Promise<void>;

/** Environment preset for logger configuration */
export type LoggerEnvironment = 'development' | 'test' | 'production';

/** Logger configuration options */
export interface LoggerOptions {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Force pretty printing regardless of environment */
  pretty?: boolean;
  /** Enable/disable colors in terminal output */
  colors?: boolean;
  /** Custom transports for log output */
  transports?: LogTransport[];
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Additional metadata to include in all logs */
  metadata?: LogContext;
  /** Custom sensitive keys to redact (merged with defaults) */
  sensitiveKeys?: string[];
  /** Maximum depth for object serialization */
  maxDepth?: number;
  /** Maximum string length before truncation */
  maxStringLength?: number;
  /** Maximum array length before truncation */
  maxArrayLength?: number;
  /** Sampling rate for debug logs in production (0-1) */
  samplingRate?: number;
  /** Enable timestamps in output */
  timestamps?: boolean;
  /** Enable silent mode (no console output) */
  silent?: boolean;
  /** Enable redaction of sensitive keys (default: true in production, false in dev/test) */
  redact?: boolean;
  /** Environment preset: 'development', 'test', or 'production' */
  env?: LoggerEnvironment;
}

/** Internal resolved options with required fields */
export interface ResolvedLoggerOptions {
  minLevel: LogLevel;
  pretty: boolean;
  colors: boolean;
  transports: LogTransport[];
  correlationId?: string;
  metadata: LogContext;
  sensitiveKeys: string[];
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  samplingRate: number;
  timestamps: boolean;
  silent: boolean;
  redact: boolean;
  env: LoggerEnvironment;
}

/** Timer result from time() method */
export interface Timer {
  /** Stop the timer and log the duration */
  end: (message?: string, context?: LogContext) => number;
  /** Get elapsed time without stopping */
  elapsed: () => number;
}

/** Runtime detection result */
export interface RuntimeInfo {
  environment: RuntimeEnvironment;
  isBrowser: boolean;
  isEdge: boolean;
  isNode: boolean;
  isDeno: boolean;
  isBun: boolean;
  isWorker: boolean;
  isReactNative: boolean;
  supportsColors: boolean;
  supportsPerformance: boolean;
}

/** Serialization options for safe object handling */
export interface SerializationOptions {
  maxDepth: number;
  maxStringLength: number;
  maxArrayLength: number;
  sensitiveKeys: string[];
  seen: WeakSet<object>;
  depth: number;
  redact: boolean;
}

/** Batch transport configuration */
export interface BatchTransportOptions {
  /** Maximum entries before auto-flush */
  batchSize?: number;
  /** Milliseconds between auto-flushes */
  flushInterval?: number;
  /** Maximum retries on flush failure */
  maxRetries?: number;
  /** Callback for flush errors */
  onError?: (error: unknown, entries: LogEntry[]) => void;
}

/** Batch transport instance with cleanup method */
export interface BatchTransport {
  /** The transport function */
  transport: LogTransport;
  /** Force flush all buffered entries */
  flush: () => Promise<void>;
  /** Clean up resources (clear timers) */
  destroy: () => void;
}

/** Logger interface for type safety */
export interface ILogger {
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
  time(label?: string): Timer;
  child(additionalContext: string, options?: Partial<LoggerOptions>): ILogger;
  withCorrelationId(correlationId: string): ILogger;
  withMetadata(metadata: LogContext): ILogger;
  addTransport(transport: LogTransport): void;
  getContext(): string;
  getCorrelationId(): string | undefined;
  isLevelEnabled(level: LogLevel): boolean;
  setLevel(level: LogLevel): void;
  flush(): Promise<void>;
  dispose(): void;
}
