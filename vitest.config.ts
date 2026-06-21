import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Pure-logic tests run in Node (default, fast). Hook/component tests opt into
// jsdom per-file via a `// @vitest-environment jsdom` docblock. Alias mirrors
// vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // `globals` lets React Testing Library auto-register cleanup between tests.
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
