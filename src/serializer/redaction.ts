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
 * Create a merged list of sensitive keys with defaults
 */
export function mergeSensitiveKeys(customKeys: string[] = []): string[] {
  const merged = new Set([...DEFAULT_SENSITIVE_KEYS, ...customKeys]);
  return Array.from(merged);
}
