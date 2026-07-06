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
 * Sensitive keyword entries that are single generic English words. When one of
 * these appears as only ONE segment inside a larger compound key (e.g. the
 * "key" in "primaryKey"), the compound is a normal identifier, not a secret —
 * so these only redact when they are the ENTIRE normalized key, not merely a
 * segment of it. Multi-word/compound entries (e.g. "api_key", "auth") keep
 * matching as whole segments/sequences since they're specific enough not to
 * over-redact (see SAFE-11).
 */
const GENERIC_SINGLE_WORD_KEYS: ReadonlySet<string> = new Set([
  'key',
  'pass',
  'hash',
  'card',
  'auth',
]);

/**
 * Split a key into lowercase tokens on camelCase, snake_case, and
 * kebab-case boundaries.
 */
function tokenize(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-_\s]+/g, '_')
    .toLowerCase()
    .split('_')
    .filter(Boolean);
}

/**
 * Check whether `needle`'s tokens appear as a contiguous run within
 * `haystack`'s tokens (aligned on token boundaries, not substrings).
 */
function containsTokenSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;

  for (let start = 0; start <= haystack.length - needle.length; start++) {
    let matches = true;
    for (let i = 0; i < needle.length; i++) {
      if (haystack[start + i] !== needle[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Check if a key should be redacted based on sensitive patterns.
 * Case-insensitive, whole-token matching: a sensitive keyword must match a
 * full token or contiguous token sequence in the key (split on camelCase,
 * snake_case, kebab-case boundaries) — not an arbitrary substring. This
 * avoids over-redacting compounds like "primaryKey", "passport", "author",
 * "wildcard", "hashtag", or "monkey" that merely CONTAIN a sensitive
 * substring (SAFE-11).
 */
export function shouldRedact(key: string, sensitiveKeys: string[]): boolean {
  if (!key || typeof key !== 'string') return false;

  const lowerKey = key.toLowerCase();
  const keyTokens = tokenize(key);

  for (const sensitive of sensitiveKeys) {
    const lowerSensitive = sensitive.toLowerCase();

    // Exact whole-string match always redacts (covers multi-word sensitive
    // entries and keys with no segment boundaries at all).
    if (lowerKey === lowerSensitive) return true;

    if (GENERIC_SINGLE_WORD_KEYS.has(lowerSensitive)) {
      // Generic single-word entries only redact the whole key, never a lone
      // segment of a larger compound (handled by the exact match above).
      continue;
    }

    const sensitiveTokens = tokenize(sensitive);
    if (containsTokenSequence(keyTokens, sensitiveTokens)) {
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
  // eslint-disable-next-line no-control-regex -- C0 + DEL, intentional for log injection hardening
  return context.replace(/[\r\n\t\x00-\x1F\x7F]/g, '_');
}
