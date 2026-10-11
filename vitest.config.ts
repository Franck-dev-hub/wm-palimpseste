import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    dir: 'src',
    setupFiles: ['@webext-core/fake-browser/auto'],
  },
});
