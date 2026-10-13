// Playwright (Fase 10): testes de navegador em e2e/*.spec.js contra o build de produção servido pelo vite preview.
// O Chromium usa a GPU da máquina (ANGLE); sem GPU, cai na renderização por software e os testes de taxa de quadros
// são dispensados. As capturas de referência ficam em e2e/capturas/ (uma por sistema; refaça com
// npm run test:e2e -- --update-snapshots depois de uma mudança visual intencional).
import { defineConfig } from '@playwright/test';

const PORTA = 4180;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.js',
  // um teste por vez: todos disputam a mesma GPU e as medições de desempenho não podem se atrapalhar
  workers: 1,
  fullyParallel: false,
  timeout: 300000,
  expect: {
    timeout: 20000,
    // comparação visual com tolerância: antisserrilhado, partículas e a ordem de chegada das texturas variam um pouco
    toHaveScreenshot: { maxDiffPixelRatio: 0.03, threshold: 0.25, animations: 'disabled' }
  },
  snapshotPathTemplate: '{testDir}/capturas/{arg}-{platform}{ext}',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA}/`,
    channel: 'chromium',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    launchOptions: { args: ['--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}/`,
    reuseExistingServer: false,
    timeout: 60000
  }
});
