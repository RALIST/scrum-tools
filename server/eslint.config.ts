import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'knexfile.cjs', 'data/migrations/**/*.cjs', 'eslint.config.ts'] },

  // TypeScript source files with type-checked rules
  {
    files: ['**/*.ts'],
    ignores: ['__tests__/**'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2021 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      // Import ordering and hygiene
      'import-x/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'never',
        'alphabetize': { order: 'asc', caseInsensitive: true },
      }],
      'import-x/no-duplicates': 'error',

      // Type import/export consistency
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: true }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // Test files — lighter rules (globals.jest covers vitest globals: describe, it, expect, etc.)
  {
    files: ['__tests__/**/*.test.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, ...globals.es2021 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-async-promise-executor': 'warn',
      'no-useless-catch': 'warn',
    },
  },
);
