// Orçamento de desempenho (Fase 10): mede cada perfil de qualidade (e2e/medicao.js) e confere os limites de
// e2e/orcamento.js. A taxa de quadros só é conferida com GPU de verdade; as medições completas ficam em
// docs/DESEMPENHO.md (npm run desempenho).
import { test, expect } from '@playwright/test';
import { medirPerfil } from './medicao.js';
import { conferir } from './orcamento.js';

for (const perfil of ['baixa', 'media', 'alta'])
  test(`perfil ${perfil} dentro do orçamento`, async ({ browser, baseURL }) => {
    const r = await medirPerfil(browser, baseURL, perfil, { duracao: 2500 });
    test
      .info()
      .annotations.push({ type: 'medição', description: JSON.stringify({ cargaS: r.cargaMs / 1000, rede: r.rede, gpu: r.memoria, vistas: r.vistas }) });
    expect(r.erros).toEqual([]);
    expect(conferir(r)).toEqual([]);
  });
