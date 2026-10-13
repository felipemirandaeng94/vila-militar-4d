// Fumaça e capturas de referência (Fase 10): o app abre sem erros, troca as vistas e as abas, e cada vista bate com a
// captura de referência (e2e/capturas/) dentro da tolerância de playwright.config.js.
import { test, expect } from '@playwright/test';
import { abrir, congelar, descongelar, vista, irAoDia } from './app.js';

const VISTAS = ['iso', 'top', 'perfil', 'usina', 'frente'];
const ABAS = ['seq', 'missao', 'diario', 'ctrl', 'lab', 'usina', 'quant', 'ctx'];

test('abre, troca vistas e abas sem erros e confere as capturas de referência', async ({ page }) => {
  const erros = await abrir(page);
  await expect(page.locator('#viewport canvas')).toBeVisible();
  // texturas do terreno em KTX2 carregadas no lado do perfil médio
  expect(await page.evaluate(() => window.__vm4d.texturasCarregadas.lado)).toBe(1024);
  await congelar(page);
  // dia fixo (início da imprimação na primeira frente) para as capturas não dependerem do dia inicial
  const dia = await page.evaluate(() => Math.floor(window.__vm4d.M.svc.find(s => s.id === 'S22').jan[0].a) + 0.45);
  await irAoDia(page, dia);
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  for (const v of VISTAS) {
    await vista(page, v);
    await congelar(page);
    await expect(page.locator('#viewport'), `vista ${v}`).toHaveScreenshot(`vista-${v}.png`);
  }
  await descongelar(page);
  for (const a of ABAS) {
    const aba = page.locator(`#tabs [data-tab="${a}"]`);
    await aba.click();
    await expect(aba).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#pane')).not.toBeEmpty();
  }
  // créditos e licenças
  await page.locator('header [data-creditos]').click();
  await expect(page.locator('#creditosCorpo')).toContainText('OpenStreetMap');
  await page.locator('#creditosX').click();
  expect(erros).toEqual([]);
});

test('os três perfis de qualidade carregam as texturas no lado certo', async ({ page }) => {
  const erros = await abrir(page, { perfil: 'baixa' });
  await page.locator('summary', { hasText: 'Visualização' }).click();
  for (const [perfil, lado] of [
    ['baixa', 512],
    ['media', 1024],
    ['alta', 2048]
  ]) {
    await page.locator('#optQual').selectOption(perfil);
    await page.waitForFunction(l => window.__vm4d.texturasCarregadas.lado === l, lado, { timeout: 60000 });
    expect(await page.evaluate(() => window.__vm4d.visual.perfil)).toBe(perfil);
  }
  expect(erros).toEqual([]);
});
