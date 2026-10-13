// Mede o desempenho dos três perfis de qualidade no build de produção e grava docs/desempenho.json (Fase 10).
// Uso: npm run desempenho [-- --saida arquivo.json]
// Sobe o vite preview, abre o Chromium do Playwright com a GPU da máquina (ANGLE) e roda e2e/medicao.js por perfil.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { medirPerfil } from './medicao.js';
import { ORCAMENTO, conferir } from './orcamento.js';

const PORTA = 4179;
const args = process.argv.slice(2);
const saida = args.includes('--saida') ? args[args.indexOf('--saida') + 1] : 'docs/desempenho.json';
if (!existsSync('dist/index.html')) {
  console.error('Rode npm run build antes.');
  process.exit(1);
}
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORTA}/`;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* ainda subindo */
    }
    await new Promise(r => setTimeout(r, 250));
  }
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']
  });
  const res = [];
  for (const perfil of ['baixa', 'media', 'alta']) {
    const r = await medirPerfil(browser, url, perfil);
    res.push(r);
    const v = Object.values(r.vistas);
    console.log(
      `${perfil.padEnd(6)} carga ${(r.cargaMs / 1000).toFixed(1)} s (${r.rede.mb} MB, ${r.rede.arquivos} arquivos) · GPU ${r.memoria.total} MB` +
        ` (texturas ${r.memoria.texturas}, buffers ${r.memoria.buffers}) · desenhos até ${Math.max(...v.map(x => x.desenhos))}` +
        ` · fps mín. ${Math.min(...v.map(x => x.fps))}${r.erros.length ? ' · ERROS: ' + r.erros.length : ''}`
    );
    for (const f of conferir(r)) console.log('  fora do orçamento: ' + f);
  }
  await browser.close();
  const gpu = res[0] && res[0].gpu;
  writeFileSync(saida, JSON.stringify({ data: new Date().toISOString(), gpu, orcamento: ORCAMENTO, perfis: res }, null, 2) + '\n');
  console.log('Gravado em ' + saida);
} finally {
  servidor.kill();
}
