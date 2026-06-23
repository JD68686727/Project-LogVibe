import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project under /Project-CSV/; dev stays at root so
  // the dev server and e2e tests work unchanged.
  base: command === 'build' ? '/Project-CSV/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
