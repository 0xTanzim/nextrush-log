import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // Allow base-to-string for logging unknown values
      '@typescript-eslint/no-base-to-string': 'off',
      // Allow redundant union types for clarity in complex scenarios
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests legitimately need floating promises for fire-and-forget patterns
      '@typescript-eslint/no-floating-promises': 'off',
      // Tests may need unsafe returns for JSON parsing
      '@typescript-eslint/no-unsafe-return': 'off',
      // Tests access mock properties on vitest spies
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js'],
  },
);
