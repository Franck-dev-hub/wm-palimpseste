// @ts-check
import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';

export default defineConfig(
  includeIgnoreFile(join(import.meta.dirname, '.gitignore')),
  {
    files: ['**/*.{ts,js}'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['src/content/**/*.ts'],
    ignores: ['src/content/dom/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...[
          'querySelector',
          'querySelectorAll',
          'closest',
          'matches',
          'getElementsByClassName',
          'getElementsByTagName',
        ].map((property) => ({
          property,
          message: 'Use query/queryAll from src/content/dom/: they skip our nodes.',
        })),
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    extends: [vitest.configs.recommended],
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
