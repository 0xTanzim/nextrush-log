/**
 * Serialization module
 * Safe serialization with redaction, circular reference handling, and special type support
 */

export {
    createSerializationOptions, safeSerialize
} from './serialize.js';

export { isError, serializeError } from './error.js';

export {
    DEFAULT_SENSITIVE_KEYS,
    REDACTED_PLACEHOLDER, mergeSensitiveKeys, shouldRedact
} from './redaction.js';
