// Testes do catálogo de modelos 3D (Fase 7, complemento): dados/modelos.json e os arquivos de public/modelos.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const cat = JSON.parse(readFileSync(resolve(RAIZ, 'dados/modelos.json'), 'utf8'));
const pasta = resolve(RAIZ, 'public/modelos');

describe('catálogo de modelos 3D', () => {
  it('cada modelo aceito tem id ASCII único e os campos das decisões', () => {
    const ids = new Set();
    for (const m of cat.modelos) {
      expect(m.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      for (const k of ['arquivo', 'equipamento', 'categoria', 'criterioEscala', 'frenteOriginal', 'animacao']) expect(m[k], `${m.id}.${k}`).toBeTruthy();
      expect(m.comprimento_m).toBeGreaterThan(0);
      expect([0, 90, -90, 180, -140]).toContain(m.rotacaoY_graus);
      expect(typeof m.recolorir).toBe('boolean');
      expect(Array.isArray(m.partesMoveis)).toBe(true);
      if (m.referenciaEscala === 'altura') expect(m.altura_m).toBeGreaterThan(0);
      expect(['terraplenagem', 'pavimentação', 'usina', 'drenagem', 'canteiro', 'apoio/viaturas', 'sinalização']).toContain(m.categoria);
    }
    expect(cat.licencaPadrao).toMatch(/Felipe Miranda.*Tripo AI/);
    for (const r of cat.rejeitados) expect(r.motivo.length).toBeGreaterThan(20);
  });

  it('cobre os equipamentos exigidos no aceite da fase', () => {
    const tipos = new Set(cat.modelos.flatMap(m => m.tipos4D));
    for (const t of ['exc', 'bascula', 'grader', 'pe', 'liso', 'pneus', 'tandem', 'paver', 'espargidor', 'munck', 'mill']) expect(tipos.has(t), t).toBe(true);
  });

  it('os arquivos processados cabem no orçamento (nível 0 até 1,5 MB, pasta abaixo de 40 MB)', () => {
    let total = 0;
    for (const m of cat.modelos)
      for (const n of [0, 1]) {
        const f = resolve(pasta, `${m.id}_lod${n}.glb`);
        expect(existsSync(f), f).toBe(true);
        const t = statSync(f).size;
        if (n === 0) expect(t).toBeLessThanOrEqual(1.5 * 1048576);
        total += t;
      }
    const soma = d =>
      readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? soma(resolve(d, e.name)) : statSync(resolve(d, e.name)).size), 0);
    expect(soma(pasta)).toBeLessThan(40 * 1048576);
    expect(total).toBeGreaterThan(0);
  });
});
