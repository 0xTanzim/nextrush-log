/**
 * Core module exports
 */

export {
    addGlobalTransport,
    clearGlobalLevel,
    clearGlobalTransports,
    configure,
    configureFromEnv,
    createConfigStore,
    disableLogging,
    disableNamespaces,
    enableLogging,
    enableNamespaces,
    getDefaultConfigStore,
    getGlobalConfig,
    isNamespaceEnabled,
    onConfigChange,
    resetGlobalConfig,
    setGlobalLevel
} from './config.js';
export type { ConfigStore, GlobalLoggerConfig } from './config.js';
export { createLogger, logger, scopedLogger } from './factory.js';
export {
    LOG_LEVELS,
    LOG_LEVEL_PRIORITY, compareLevels,
    isValidLogLevel, parseLogLevel,
    shouldLog,
    stricterMinLevel
} from './levels.js';
export { Logger } from './logger.js';
