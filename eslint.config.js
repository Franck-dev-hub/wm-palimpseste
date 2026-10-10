// @ts-check
import eslint from '@eslint/js';
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
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
