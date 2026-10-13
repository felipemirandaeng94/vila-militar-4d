// Utilidades dos testes de navegador (Fase 10): abrir o app com um perfil fixo, coletar erros e preparar capturas.
import { expect } from '@playwright/test';
import { esperarCarga } from './medicao.js';

// avisos do compilador de shaders do Direct3D (ANGLE) que o three repassa ao console; não são erros do app
const IGNORAR = [/warning X\d+/];

/**
 * Abre o app (?teste expõe window.__vm4d) com o perfil de qualidade pedido e espera todos os arquivos. Devolve a lista
 * de erros (console.error, exceções da página e respostas HTTP com erro), que cresce até o fim do teste.
 */
export async function abrir(page, { perfil = 'media', hash = '' } = {}) {
  const erros = [];
  page.on('pageerror', e => erros.push('exceção: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !IGNORAR.some(r => r.test(m.text()))) erros.push('console: ' + m.text());
  });
  page.on('response', r => {
    if (r.status() >= 400) erros.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('requestfailed', r => erros.push('falha de rede: ' + r.url()));
  await page.addInitScript(p => {
    try {
      localStorage.setItem('vm4d.qualidade', p);
    } catch (e) {
      /* sem armazenamento */
    }
  }, perfil);
  await page.goto('./?teste' + hash);
  await esperarCarga(page);
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30000 });
  return erros;
}

/**
 * Deixa a cena parada para as capturas: sem partículas e sem a obra tocando; depois de alguns quadros (a câmera assenta),
 * o laço de desenho para (requestAnimationFrame vira nulo) e o canvas guarda o último quadro. descongelar() o retoma.
 */
export async function congelar(page) {
  await page.evaluate(async () => {
    window.__vm4d.definirEfeitos(false);
    window.__vm4d.ST.playing = false;
    for (let i = 0; i < 30; i++) await new Promise(ok => requestAnimationFrame(ok));
    window.__rafOriginal = window.__rafOriginal || window.requestAnimationFrame;
    window.__laco = [];
    window.requestAnimationFrame = f => (window.__laco.push(f), 0);
    await new Promise(ok => setTimeout(ok, 100));
  });
}
export async function descongelar(page) {
  await page.evaluate(() => {
    if (!window.__rafOriginal) return;
    window.requestAnimationFrame = window.__rafOriginal;
    for (const f of window.__laco.splice(0)) window.requestAnimationFrame(f);
  });
}

/** Troca a vista pelo botão e espera a câmera chegar e os modelos que ela pedir. */
export async function vista(page, v) {
  await descongelar(page);
  await page.locator(`[data-view="${v}"]`).click();
  await expect(page.locator(`[data-view="${v}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(2500);
  await esperarCarga(page);
}

/** Vai ao dia d pela linha do tempo (o mesmo caminho do controle deslizante). */
export async function irAoDia(page, d) {
  await descongelar(page);
  await page.evaluate(x => {
    const s = document.getElementById('stg');
    s.value = String(x);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, d);
}

/** Fim da obra (dias úteis) e a data mostrada no painel. */
export const fimDaObra = page => page.evaluate(() => window.__vm4d.M.fim);
export const diaAtual = page => page.evaluate(() => window.__vm4d.ST.day);
