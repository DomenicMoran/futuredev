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
      'tools/qa/**',
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
);
