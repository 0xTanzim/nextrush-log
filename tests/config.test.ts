/**
 * Global configuration tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addGlobalTransport,
  clearGlobalTransports,
  configure,
  configureFromEnv,
  createLogger,
  disableLogging,
  disableNamespaces,
  enableLogging,
  enableNamespaces,
  getGlobalConfig,
  isNamespaceEnabled,
  onConfigChange,
  resetGlobalConfig,
  setGlobalLevel,
} from '../src/core/index.js';
import type { LogEntry } from '../src/types/index.js';

const noop = (): void => { /* empty mock */ };

describe('Global Configuration', () => {
  beforeEach(() => {
    // Reset before each test to ensure isolation
    resetGlobalConfig();
    vi.spyOn(console, 'info').mockImplementation(noop);
    vi.spyOn(console, 'debug').mockImplementation(noop);
    vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.spyOn(console, 'error').mockImplementation(noop);
  });

  afterEach(() => {
    // Reset after each test for cleanup
    resetGlobalConfig();
    vi.restoreAllMocks();
  });

  describe('disableLogging / enableLogging', () => {
    it('should disable all logging with one call', () => {
      const log = createLogger('Test', { pretty: false });

      log.info('Before disable');
      expect(console.info).toHaveBeenCalledTimes(1);

      disableLogging();

      log.info('After disable');
      log.warn('Still disabled');
      log.error('All disabled');

      // No additional calls after disable
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should re-enable logging', () => {
      const log = createLogger('Test', { pretty: false });

      disableLogging();
      log.info('Disabled');
      expect(console.info).not.toHaveBeenCalled();

      enableLogging();
      log.info('Enabled again');
      expect(console.info).toHaveBeenCalledTimes(1);
    });

    it('should affect all logger instances', () => {
      const log1 = createLogger('Logger1', { pretty: false });
      const log2 = createLogger('Logger2', { pretty: false });
      const log3 = createLogger('Logger3', { pretty: false });

      disableLogging();

      log1.info('From logger 1');
      log2.warn('From logger 2');
      log3.error('From logger 3');

      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('setGlobalLevel', () => {
    it('should override individual logger levels', () => {
      const log = createLogger('Test', { minLevel: 'trace', pretty: false });

      // Logger allows debug
      log.debug('Should appear');
      expect(console.debug).toHaveBeenCalledTimes(1);

      // Set global level to warn
      setGlobalLevel('warn');

      log.debug('Should not appear');
      log.info('Should not appear');
      log.warn('Should appear');

      expect(console.debug).toHaveBeenCalledTimes(1); // Still only 1
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('configure', () => {
    it('should set multiple options at once', () => {
      configure({
        enabled: true,
        minLevel: 'error',
        silent: false,
      });

      const config = getGlobalConfig();
      expect(config.minLevel).toBe('error');
    });

    it('should merge with existing config', () => {
      configure({ minLevel: 'warn' });
      configure({ silent: true });

      const config = getGlobalConfig();
      expect(config.minLevel).toBe('warn');
      expect(config.silent).toBe(true);
    });
  });

  describe('namespace filtering', () => {
    it('should filter by namespace pattern', () => {
      enableNamespaces(['api:*']);

      const apiLogger = createLogger('api:users', { pretty: false });
      const dbLogger = createLogger('db:queries', { pretty: false });

      apiLogger.info('API log');
      dbLogger.info('DB log');

      // Only API should log
      expect(console.info).toHaveBeenCalledTimes(1);
      const output = (console.info as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(output).toContain('api:users');
    });

    it('should support multiple patterns', () => {
      enableNamespaces(['api:*', 'auth:*']);

      const apiLogger = createLogger('api:users', { pretty: false });
      const authLogger = createLogger('auth:login', { pretty: false });
      const dbLogger = createLogger('db:queries', { pretty: false });

      apiLogger.info('API');
      authLogger.info('Auth');
      dbLogger.info('DB');

      expect(console.info).toHaveBeenCalledTimes(2);
    });

    it('should disable specific namespaces', () => {
      enableNamespaces(['*']);
      disableNamespaces(['verbose:*', 'trace:*']);

      const normalLogger = createLogger('app:main', { pretty: false });
      const verboseLogger = createLogger('verbose:debug', { pretty: false });

      normalLogger.info('Normal');
      verboseLogger.info('Verbose');

      expect(console.info).toHaveBeenCalledTimes(1);
    });

    it('should check namespace enabled correctly', () => {
      enableNamespaces(['api:*', 'auth:login']);
      disableNamespaces(['api:internal']);

      expect(isNamespaceEnabled('api:users')).toBe(true);
      expect(isNamespaceEnabled('api:internal')).toBe(false);
      expect(isNamespaceEnabled('auth:login')).toBe(true);
      expect(isNamespaceEnabled('auth:logout')).toBe(false);
      expect(isNamespaceEnabled('db:queries')).toBe(false);
    });
  });

  describe('global transports', () => {
    it('should call global transport for all loggers', () => {
      const globalTransport = vi.fn();
      addGlobalTransport(globalTransport);

      const log1 = createLogger('Logger1', { pretty: false });
      const log2 = createLogger('Logger2', { pretty: false });

      log1.info('From 1');
      log2.info('From 2');

      expect(globalTransport).toHaveBeenCalledTimes(2);

      const call1 = globalTransport.mock.calls[0] as [LogEntry] | undefined;
      const call2 = globalTransport.mock.calls[1] as [LogEntry] | undefined;
      expect(call1?.[0].context).toBe('Logger1');
      expect(call2?.[0].context).toBe('Logger2');
    });

    it('should combine global and instance transports', () => {
      const globalTransport = vi.fn();
      const instanceTransport = vi.fn();

      addGlobalTransport(globalTransport);

      const log = createLogger('Test', {
        transports: [instanceTransport],
        pretty: false,
      });

      log.info('Test message');

      expect(globalTransport).toHaveBeenCalledTimes(1);
      expect(instanceTransport).toHaveBeenCalledTimes(1);
    });

    it('should clear global transports', () => {
      const transport1 = vi.fn();
      const transport2 = vi.fn();

      addGlobalTransport(transport1);
      addGlobalTransport(transport2);

      clearGlobalTransports();

      const log = createLogger('Test', { pretty: false });
      log.info('Test');

      expect(transport1).not.toHaveBeenCalled();
      expect(transport2).not.toHaveBeenCalled();
    });
  });

  describe('resetGlobalConfig', () => {
    it('should reset all settings to defaults', () => {
      // Apply changes
      disableLogging();
      setGlobalLevel('fatal');
      enableNamespaces(['test:*']);

      // Verify changes were applied
      const changedConfig = getGlobalConfig();
      expect(changedConfig.enabled).toBe(false);
      expect(changedConfig.minLevel).toBe('fatal');
      expect(changedConfig.enabledNamespaces).toEqual(['test:*']);

      // Reset
      resetGlobalConfig();

      // Verify reset worked
      const config = getGlobalConfig();
      expect(config.enabled).toBe(true);
      expect(config.minLevel).toBeUndefined();
      expect(config.enabledNamespaces).toEqual(['*']);
      expect(config.silent).toBe(false);
      expect(config.disabledNamespaces).toEqual([]);
    });
  });

  describe('child loggers', () => {
    it('should respect global config in child loggers', () => {
      const parent = createLogger('Parent', { pretty: false });
      const child = parent.child('Child');

      child.info('Before disable');
      expect(console.info).toHaveBeenCalledTimes(1);

      disableLogging();
      child.info('After disable');

      expect(console.info).toHaveBeenCalledTimes(1);
    });

    it('should filter child logger namespaces', () => {
      enableNamespaces(['api:*']);

      const parent = createLogger('api', { pretty: false });
      const child = parent.child('users');

      child.info('Should appear'); // namespace is "api:users"
      expect(console.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('configureFromEnv', () => {
    it('should configure from LOG_LEVEL environment variable', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'LOG_LEVEL') return 'warn';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.minLevel).toBe('warn');
    });

    it('should ignore invalid LOG_LEVEL values', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'LOG_LEVEL') return 'invalid';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.minLevel).toBeUndefined();
    });

    it('should disable logging when LOG_ENABLED is false', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'LOG_ENABLED') return 'false';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.enabled).toBe(false);
    });

    it('should disable logging when LOG_ENABLED is 0', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'LOG_ENABLED') return '0';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.enabled).toBe(false);
    });

    it('should parse LOG_NAMESPACES comma-separated list', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'LOG_NAMESPACES') return 'api:*, auth:*, db:queries';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.enabledNamespaces).toEqual(['api:*', 'auth:*', 'db:queries']);
    });

    it('should configure production mode from NODE_ENV', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'NODE_ENV') return 'production';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.env).toBe('production');
      expect(config.defaults.minLevel).toBe('info');
      expect(config.defaults.pretty).toBe(false);
      expect(config.defaults.redact).toBe(true);
    });

    it('should configure test mode from NODE_ENV', () => {
      const mockEnv = (name: string): string | undefined => {
        if (name === 'NODE_ENV') return 'test';
        return undefined;
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.env).toBe('test');
      expect(config.defaults.silent).toBe(true);
    });

    it('should handle multiple env vars together', () => {
      const mockEnv = (name: string): string | undefined => {
        const envVars: Record<string, string> = {
          LOG_LEVEL: 'error',
          LOG_NAMESPACES: 'critical:*',
          NODE_ENV: 'production',
        };
        return envVars[name];
      };

      configureFromEnv(mockEnv);

      const config = getGlobalConfig();
      expect(config.minLevel).toBe('error');
      expect(config.enabledNamespaces).toEqual(['critical:*']);
      expect(config.env).toBe('production');
    });
  });

  describe('onConfigChange', () => {
    it('should notify listeners when config changes', () => {
      const listener = vi.fn();
      onConfigChange(listener);

      configure({ minLevel: 'warn' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify on disableLogging', () => {
      const listener = vi.fn();
      onConfigChange(listener);

      disableLogging();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify on enableLogging', () => {
      const listener = vi.fn();
      onConfigChange(listener);

      enableLogging();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should notify on setGlobalLevel', () => {
      const listener = vi.fn();
      onConfigChange(listener);

      setGlobalLevel('error');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = onConfigChange(listener);

      configure({ minLevel: 'warn' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      configure({ minLevel: 'error' });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      onConfigChange(errorListener);
      onConfigChange(goodListener);

      // Should not throw
      expect(() => configure({ minLevel: 'warn' })).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('namespace matching edge cases', () => {
    it('should handle exact namespace match', () => {
      enableNamespaces(['app:main']);

      expect(isNamespaceEnabled('app:main')).toBe(true);
      expect(isNamespaceEnabled('app:main:sub')).toBe(false);
      expect(isNamespaceEnabled('app')).toBe(false);
    });

    it('should handle wildcard at end', () => {
      enableNamespaces(['app:*']);

      expect(isNamespaceEnabled('app:main')).toBe(true);
      expect(isNamespaceEnabled('app:main:sub')).toBe(true);
      expect(isNamespaceEnabled('app:')).toBe(true);
      expect(isNamespaceEnabled('application')).toBe(false);
    });

    it('should handle global wildcard', () => {
      enableNamespaces(['*']);

      expect(isNamespaceEnabled('anything')).toBe(true);
      expect(isNamespaceEnabled('any:thing')).toBe(true);
    });

    it('should handle special regex characters in namespace', () => {
      enableNamespaces(['app.v2:*']);

      expect(isNamespaceEnabled('app.v2:main')).toBe(true);
      expect(isNamespaceEnabled('appXv2:main')).toBe(false);
    });

    it('should return false when logging is disabled', () => {
      disableLogging();
      enableNamespaces(['*']);

      expect(isNamespaceEnabled('anything')).toBe(false);
    });
  });
});
