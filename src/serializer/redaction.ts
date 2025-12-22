/**
 * Sensitive data redaction utilities
 * Protects PII and secrets from appearing in logs
 */

/** Default keys that should be redacted from logs */
export const DEFAULT_SENSITIVE_KEYS: readonly string[] = [
  // Authentication & Authorization
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'apiSecret',
  'api_secret',
  'authorization',
  'auth',
  'bearer',
  'credential',
  'credentials',

  // Cryptographic
  'private',
  'privatekey',
  'private_key',
  'publickey',
  'public_key',
  'certificate',
  'cert',

  // Tokens
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'jwt',

  // Session
  'sessionid',
  'session_id',
  'sessionkey',
  'session_key',
  'cookie',
  'cookies',

  // Security
  'csrf',
  'xsrf',
  'nonce',
  'otp',
  'totp',
  'pin',

  // PII
  'ssn',
  'social_security',
  'socialsecurity',
  'taxid',
  'tax_id',

  // Financial
  'credit',
  'creditcard',
  'credit_card',
  'card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'ccv',
  'expiry',
  'expiration',
  'accountnumber',
  'account_number',
  'routingnumber',
  'routing_number',
  'bankaccount',
  'bank_account',

  // Database
  'connectionstring',
  'connection_string',
  'dbpassword',
  'db_password',

  // AWS
  'aws_secret',
  'aws_secret_access_key',
  'aws_access_key_id',

  // Generic
  'key',
  'pass',
  'hash',
  'salt',
  'signature',
] as const;

/** Placeholder for redacted values */
export const REDACTED_PLACEHOLDER = '[REDACTED]';

/** Patterns for sensitive data in string values */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  // SSN (US Social Security Number): XXX-XX-XXXX
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Credit card numbers (with or without spaces/dashes)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  // Credit card with different groupings
  /\b\d{4}[- ]?\d{6}[- ]?\d{5}\b/g,
] as const;

/**
 * Check if a key should be redacted based on sensitive patterns
 * Case-insensitive partial matching
 */
export function shouldRedact(key: string, sensitiveKeys: string[]): boolean {
  if (!key || typeof key !== 'string') return false;

  const lowerKey = key.toLowerCase();

  for (const sensitive of sensitiveKeys) {
    if (lowerKey.includes(sensitive.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Redact sensitive patterns from string values
 * Detects and masks SSNs, credit card numbers, etc.
 */
export function redactSensitiveValues(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED_PLACEHOLDER);
  }
  return result;
}

/**
 * Check if a string value contains sensitive patterns
 */
export function containsSensitivePattern(value: string): boolean {
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Create a merged list of sensitive keys with defaults
 */
export function mergeSensitiveKeys(customKeys: string[] = []): string[] {
  const merged = new Set([...DEFAULT_SENSITIVE_KEYS, ...customKeys]);
  return Array.from(merged);
}

/**
 * Sanitize context names to prevent log injection
 * Removes control characters that could break log parsing
 */
export function sanitizeContext(context: string): string {
  if (!context || typeof context !== 'string') return 'unknown';
  // Remove newlines, tabs, and other control characters
  return context.replace(/[\r\n\t\x00-\x1F\x7F]/g, '_');
}
