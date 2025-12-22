/**
 * React integration for @nextrush/log
 *
 * NOTE: The main `createLogger` from '@nextrush/log' already works in React!
 * This module provides React-specific conveniences:
 * - Context/Provider pattern
 * - Hooks for easy access
 * - Error boundary with logging
 *
 * @example
 * ```tsx
 * // Option 1: Direct usage (works fine!)
 * import { createLogger } from '@nextrush/log';
 * const log = createLogger('MyComponent');
 * log.info('Works in React!');
 *
 * // Option 2: With React context
 * import { LoggerProvider, useLogger } from '@nextrush/log/react';
 * ```
 */

import type { ComponentType, ErrorInfo, ReactNode } from 'react';
import {
    Component,
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';

import type { GlobalLoggerConfig } from '../core/index.js';
import { configure, createLogger, Logger } from '../core/index.js';
import type { LoggerOptions } from '../types/index.js';

// ============================================================================
// Context
// ============================================================================

interface LoggerContextValue {
  logger: Logger;
  getLogger: (context: string) => Logger;
}

const LoggerContext = createContext<LoggerContextValue | null>(null);
LoggerContext.displayName = 'LoggerContext';

// ============================================================================
// Provider
// ============================================================================

export interface LoggerProviderProps {
  /** Root context name (default: 'app') */
  context?: string;
  /** Logger options */
  options?: LoggerOptions;
  /** Global configuration to apply on mount */
  globalConfig?: Partial<GlobalLoggerConfig>;
  /** Children */
  children: ReactNode;
}

/**
 * Logger provider component
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LoggerProvider context="my-app">
 *   <App />
 * </LoggerProvider>
 *
 * // With global config (disable all logs in production)
 * <LoggerProvider
 *   context="my-app"
 *   globalConfig={{
 *     enabled: process.env.NODE_ENV !== 'production',
 *     minLevel: 'info'
 *   }}
 * >
 *   <App />
 * </LoggerProvider>
 * ```
 */
export function LoggerProvider(props: LoggerProviderProps): ReactNode {
  const { context = 'app', children, globalConfig: globalConfigProp } = props;
  const options = props.options;

  // Apply global config on mount
  const hasAppliedGlobalConfig = useRef(false);
  if (!hasAppliedGlobalConfig.current && globalConfigProp) {
    configure(globalConfigProp);
    hasAppliedGlobalConfig.current = true;
  }

  const loggerRef = useRef<Logger | null>(null);
  const childLoggersRef = useRef(new Map<string, Logger>());

  loggerRef.current ??= createLogger(context, options);

  const getLogger = useCallback((childContext: string): Logger => {
    const cache = childLoggersRef.current;
    const existing = cache.get(childContext);
    if (existing) return existing;

    const parent = loggerRef.current;
    const child = parent ? parent.child(childContext) : createLogger(childContext, options);
    cache.set(childContext, child);
    return child;
  }, [options]);

  const value = useMemo((): LoggerContextValue => ({
    logger: loggerRef.current ?? createLogger(context, options),
    getLogger,
  }), [context, options, getLogger]);

  return createElement(LoggerContext.Provider, { value }, children);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get a logger instance from context or create a standalone one
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const log = useLogger('MyComponent');
 *   log.info('Rendered');
 *   return <div>Hello</div>;
 * }
 * ```
 */
export function useLogger(context?: string): Logger {
  const ctx = useContext(LoggerContext);

  // Use useMemo to properly recreate logger when context changes
  const fallbackLogger = useMemo(() => {
    if (ctx) return null;
    return createLogger(context ?? 'app');
  }, [context, ctx]);

  if (!ctx && fallbackLogger) {
    return fallbackLogger;
  }

  if (!ctx) {
    // Safety fallback - should not reach here
    return createLogger(context ?? 'app');
  }

  return context ? ctx.getLogger(context) : ctx.logger;
}

/**
 * Log component lifecycle (mount/unmount)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useLogLifecycle('MyComponent');
 *   return <div>Hello</div>;
 * }
 * ```
 */
export function useLogLifecycle(componentName: string): void {
  const logger = useLogger(componentName);

  useEffect(() => {
    logger.debug('mounted');
    return () => { logger.debug('unmounting'); };
  }, [logger]);
}

// ============================================================================
// Error Boundary
// ============================================================================

export interface LogErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  context?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface LogErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary with automatic logging
 *
 * @example
 * ```tsx
 * <LogErrorBoundary fallback={<ErrorPage />}>
 *   <App />
 * </LogErrorBoundary>
 * ```
 */
export class LogErrorBoundary extends Component<LogErrorBoundaryProps, LogErrorBoundaryState> {
  private logger: Logger;

  constructor(props: LogErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.logger = createLogger(props.context ?? 'error-boundary');
  }

  static getDerivedStateFromError(error: Error): LogErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.logger.error('React error boundary caught error', {
      componentStack: errorInfo.componentStack,
    }, error);
    this.props.onError?.(error, errorInfo);
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      return fallback ?? null;
    }

    return children;
  }
}

// ============================================================================
// HOC (for class components)
// ============================================================================

export interface WithLoggerProps {
  logger: Logger;
}

/**
 * HOC to inject logger prop
 *
 * @example
 * ```tsx
 * const MyComponent = withLogger('MyComponent')(({ logger }) => {
 *   logger.info('Rendering');
 *   return <div>Hello</div>;
 * });
 * ```
 */
export function withLogger<P extends WithLoggerProps>(
  context: string,
): (Component: ComponentType<P>) => ComponentType<Omit<P, 'logger'>> {
  return (WrappedComponent: ComponentType<P>) => {
    function WithLogger(props: Omit<P, 'logger'>): ReactNode {
      const logger = useLogger(context);
      return createElement(WrappedComponent, { ...props, logger } as P);
    }
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    WithLogger.displayName = `withLogger(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return WithLogger;
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export {
    configure,
    createLogger,
    disableLogging,
    enableLogging,
    getGlobalConfig,
    Logger,
    setGlobalLevel
} from '../core/index.js';
export type { GlobalLoggerConfig } from '../core/index.js';
export type { LogEntry, LoggerOptions, LogLevel } from '../types/index.js';
