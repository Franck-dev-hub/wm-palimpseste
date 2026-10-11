import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    dir: 'test',
    setupFiles: ['@webext-core/fake-browser/auto'],
  },
});
