/**
 * Namespace glob matching, shared by global config and namespace-scoped
 * rate limiting.
 *
 * Previously duplicated: `core/config.ts` had a ReDoS-guarded, cached
 * implementation while `transport/ratelimit.ts` had an unguarded,
 * uncached copy (see REPORT.md DEAD-2/QUAL-1). There is now exactly one
 * implementation; every caller gets the same hardening.
 */

const MAX_PATTERN_LENGTH = 100;
const MAX_WILDCARDS = 10;

function compilePattern(pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*'); // Convert * to .*

  return new RegExp(`^${regexPattern}$`);
}

/**
 * A namespace pattern matcher with its own compiled-regex cache and a
 * ReDoS guard on pattern complexity. Each call site should own one
 * instance rather than sharing a module-level cache across unrelated
 * config stores.
 */
export interface NamespaceMatcher {
  matches(namespace: string, pattern: string): boolean;
  clearCache(): void;
}

export function createNamespaceMatcher(): NamespaceMatcher {
  const patternCache = new Map<string, RegExp>();

  return {
    matches(namespace, pattern) {
      if (pattern === '*') return true;
      if (pattern === namespace) return true;

      // Validate pattern complexity to prevent ReDoS
      if (pattern.length > MAX_PATTERN_LENGTH || pattern.split('*').length > MAX_WILDCARDS) {
        return false;
      }

      let regex = patternCache.get(pattern);
      if (!regex) {
        regex = compilePattern(pattern);
        patternCache.set(pattern, regex);
      }

      return regex.test(namespace);
    },

    clearCache() {
      patternCache.clear();
    },
  };
}
