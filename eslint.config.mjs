// ESLint 9 Flat-Config, gemeinsam für alle Pakete im Arbeitsbereich.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      '**/.turbo/**',
      '**/coverage/**',
      'tools/audio/out/**',
      'tools/audio/.venv-chatterbox/**',
      'apps/web/out/**',
      'apps/web/next-env.d.ts',
      // Local emulator captures, throwaway fixtures and Python QA environments.
      // Maintained tools/qa sources remain linted below.
      'tmp-qa/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.cjs', 'tools/*.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
    },
  },
);
