// Medição de desempenho de um perfil de qualidade (Fase 10), usada por e2e/medir-desempenho.mjs (relatório em
// docs/DESEMPENHO.md) e por e2e/desempenho.spec.js (confere o orçamento de e2e/orcamento.js).
import { instrumentar } from './instrumentacao.js';

export const VIEWPORT = { width: 1600, height: 900 };
// vistas medidas: a do início (3D), a planta de todo o trecho e a usina
export const VISTAS = ['iso', 'top', 'usina'];

/** Espera o app montar o motor e todos os arquivos pedidos chegarem (sem novos por 1,5 s). */
export async function esperarCarga(page, limite = 180000) {
  await page.waitForFunction(() => window.__vm4d, null, { timeout: limite });
  await page.waitForFunction(
    () => {
      const a = window.__vm4d.andamento;
      const fim = a.total > 0 && a.feitos + a.falhas >= a.total;
      const w = (window.__esperaCarga = window.__esperaCarga || { n: -1, t: 0 });
      if (!fim || a.total !== w.n) {
        w.n = fim ? a.total : -1;
        w.t = performance.now();
        return false;
      }
      return performance.now() - w.t > 1500;
    },
    null,
    { timeout: limite, polling: 250 }
  );
}

/**
 * Abre o app num contexto novo (sem cache) com o perfil pedido e mede: tempos de carga, bytes transferidos, memória de
 * vídeo, chamadas de desenho, triângulos e quadros por segundo em cada vista, no dia inicial e num dia de CBUQ.
 */
export async function medirPerfil(browser, url, perfil, { duracao = 4000 } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await ctx.addInitScript(instrumentar);
  await ctx.addInitScript(p => {
    try {
      localStorage.setItem('vm4d.qualidade', p);
    } catch (e) {
      /* sem armazenamento: perfil automático */
    }
  }, perfil);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => m.type() === 'error' && erros.push(m.text()));
  const t0 = Date.now();
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'teste');
  await page.waitForFunction(() => window.__vm4d, null, { timeout: 120000 });
  const motor = Date.now() - t0;
  await esperarCarga(page);
  const carga = Date.now() - t0 - 1500;
  const rede = await page.evaluate(() => {
    const r = performance.getEntriesByType('resource');
    const nav = performance.getEntriesByType('navigation')[0];
    const bytes = r.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), nav ? nav.transferSize : 0);
    return { arquivos: r.length + 1, mb: Math.round((bytes / 1048576) * 10) / 10 };
  });
  // o painel de carga some e a página rola até o modelo (a vista 3D fica inteira na tela)
  await page.evaluate(() => {
    const l = document.getElementById('loading');
    if (l) l.hidden = true;
    document.getElementById('viewport').scrollIntoView({ block: 'center' });
  });
  const real = await page.evaluate(() => window.__vm4d.visual.perfil);
  const dias = await page.evaluate(() => {
    const { M } = window.__vm4d;
    const s24 = M.svc.find(s => s.id === 'S24');
    return { inicio: window.__vm4d.ST.day, cbuq: s24 ? s24.jan[0].a + 0.4 : window.__vm4d.ST.day };
  });
  const vistas = {};
  for (const [nomeDia, dia] of Object.entries(dias)) {
    await page.evaluate(d => window.__vm4d.acoes.irParaDia(d), dia);
    for (const v of VISTAS) {
      await page.evaluate(x => window.__vm4d.setView(x), v);
      // a câmera chega à vista e os modelos que a vista pede começam a carregar
      await page.waitForTimeout(1500);
      await esperarCarga(page);
      const m = await page.evaluate(d => window.__gpu.medir(d), duracao);
      vistas[nomeDia + ':' + v] = {
        fps: Math.round(m.fps * 10) / 10,
        desenhos: Math.round(m.desenhos),
        triangulos: Math.round(m.triangulos),
        piorQuadroMs: Math.round(m.piorQuadroMs)
      };
    }
  }
  const memoria = await page.evaluate(() => window.__gpu.memoria());
  const maiores = await page.evaluate(() => window.__gpu.maiores(40));
  const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
  const gpu = await page.evaluate(() => window.__vm4d.visual.gpu);
  await ctx.close();
  return { perfil, aplicado: real, gpu, motorMs: motor, cargaMs: carga, rede, memoria, maiores, heapMb: heap, vistas, erros };
}
