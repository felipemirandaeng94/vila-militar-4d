import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // Vitest só nas regras (tests/); os testes de navegador (e2e/) são do Playwright
  test: { include: ['tests/**/*.test.js'] }
});
