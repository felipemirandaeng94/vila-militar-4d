// Percurso da obra (Fase 10): do dia 0 ao fim em cada cenário do modo explorar e na missão do engenheiro, sem erros no
// console, com a data do painel acompanhando a linha do tempo e capturas de referência do fim de cada percurso.
import { test, expect } from '@playwright/test';
import { abrir, congelar, descongelar, irAoDia, fimDaObra, diaAtual } from './app.js';

// passo da linha do tempo (dias úteis): cada parada redesenha o modelo inteiro naquele estado
const PASSO = 4;

async function percorrer(page) {
  const fim = await fimDaObra(page);
  let data = '',
    anterior = -1;
  for (let d = 0; d <= fim + PASSO - 0.01; d += PASSO) {
    const dia = Math.min(d, fim);
    await irAoDia(page, dia);
    // dois quadros desenhados no novo estado
    await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
    const nova = await page.locator('#nowDate').textContent();
    if (Math.floor(dia) !== Math.floor(anterior) && anterior >= 0) expect(nova, `data no dia ${dia}`).not.toBe(data);
    data = nova;
    anterior = dia;
  }
  expect(await diaAtual(page)).toBeCloseTo(fim, 3);
}

test('explorar: percorre a obra do dia 0 ao fim em cada cenário', async ({ page }) => {
  const erros = await abrir(page);
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  const cenarios = await page.locator('#optCen option').evaluateAll(os => os.map(o => o.value));
  expect(cenarios.length).toBeGreaterThan(1);
  for (const c of cenarios) {
    await page.locator('#optCen').selectOption(c);
    await expect(page.locator('#cenDesc')).not.toBeEmpty();
    await percorrer(page);
    await congelar(page);
    await expect(page.locator('#viewport'), `fim da obra, cenário ${c}`).toHaveScreenshot(`fim-${c}.png`);
    await descongelar(page);
  }
  // execução contínua: o botão toca a obra e o dia avança
  await irAoDia(page, 10);
  const d0 = await diaAtual(page);
  await page.locator('#optSpd [data-spd="4"]').click();
  await page.locator('#play').click();
  await page.waitForTimeout(3000);
  await page.locator('#play').click();
  expect(await diaAtual(page)).toBeGreaterThan(d0 + 1);
  expect(erros).toEqual([]);
});

test('missão: do briefing à nota final, respondendo todas as decisões', async ({ page }) => {
  const erros = await abrir(page);
  await page.locator('[data-mode="missao"]').click();
  await expect(page.locator('#gm')).toBeVisible();
  await page.locator('#gmGo').click();
  const fim = await fimDaObra(page);
  let decisoes = 0;
  for (let i = 0; i < 80; i++) {
    if (await page.locator('#gmRe').isVisible()) break;
    if (await page.locator('#gm').isHidden()) {
      // a linha do tempo para na próxima decisão
      await irAoDia(page, fim);
      await expect(page.locator('#gm')).toBeVisible();
      continue;
    }
    const ops = page.locator('#gmc .gm-op');
    if ((await ops.count()) > 0) {
      // alterna as alternativas para passar por retrabalhos e consequências
      await ops.nth(decisoes % (await ops.count())).click();
      decisoes++;
    } else await page.locator('#gmOk').click();
  }
  await expect(page.locator('#gmc')).toContainText('Missão concluída');
  expect(decisoes).toBeGreaterThanOrEqual(5);
  // o fim da obra foi alcançado
  expect(await diaAtual(page)).toBeCloseTo(await fimDaObra(page), 3);
  await page.locator('#gmEx').click();
  expect(erros).toEqual([]);
});
