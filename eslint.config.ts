import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

// Clean browser globals (filter entries with whitespace in keys)
const cleanBrowserGlobals = Object.fromEntries(
  Object.entries(globals.browser).filter(([key]) => key.trim() === key)
);

export default tseslint.config(
  { ignores: ['dist', 'server', 'node_modules', 'eslint.config.ts'] },

  // TypeScript source files with type-checked rules (excludes test files)
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/setupTests.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: {
        ...cleanBrowserGlobals,
        ...globals.es2021,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'import-x': importX,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Core JS strictness
      'eqeqeq': ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

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

      // Align dot-notation with tsconfig's noPropertyAccessFromIndexSignature
      '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],

      // Additional typescript-eslint strictness
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/strict-boolean-expressions': ['warn', {
        allowNullableBoolean: true,
        allowNullableString: true,
        allowNullableNumber: false,
        allowNullableObject: true,
        allowNumber: true,
        allowString: true,
      }],

      // React quality
      'react/no-unstable-nested-components': 'error',
      'react/no-array-index-key': 'warn',
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary', 'coerce'] }],
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'ignore' }],
      'react/hook-use-state': 'warn',
      'react/jsx-boolean-value': ['error', 'never'],
    },
  },

  // Test files and setup — lighter rules, no type-checked (excluded from tsconfig)
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/setupTests.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...cleanBrowserGlobals,
        ...globals.es2021,
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'eqeqeq': ['error', 'always'],
    },
  },

  // Config files — lighter rules, no type-checked
  {
    files: ['*.config.{ts,js,mjs}'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
);
