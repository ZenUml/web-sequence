// Flat config for web/ (#910). ESLint >= 9 reads only eslint.config.*; the
// root .eslintrc.json belongs to the legacy Preact app.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'src/editor/grammar/zenuml-parser.js',
      'src/editor/conformance/*.generated.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // House style: `_name` marks an intentionally unused parameter, and
      // `catch {}` / `catch (e) {}` is a deliberate best-effort swallow.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 70 existing sites; tightening them is separate work (#866).
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Ambient declarations for Vite `define` constants.
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
