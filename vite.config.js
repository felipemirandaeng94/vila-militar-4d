import { defineConfig } from 'vite';

export default defineConfig({
  // caminho base: o do repositório no GitHub Pages (VITE_BASE, definido no workflow) ou relativo, que serve a qualquer
  // pasta e ao build offline
  base: process.env.VITE_BASE || './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // Vitest só nas regras (tests/); os testes de navegador (e2e/) são do Playwright
  test: { include: ['tests/**/*.test.js'] }
});
