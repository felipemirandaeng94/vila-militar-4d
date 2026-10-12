// Testes dos efeitos e do som (Fase 8): regras que ligam cada efeito ao estado da obra e orçamento por perfil.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { vapor, chao, levantaPoeira, taxaPoeira, volumePelaDistancia, VAPOR_DIAS, SECAGEM_DIAS } from '../src/motor/efeitosRegras.js';
import { PERFIS, ORDEM } from '../src/motor/qualidade.js';

const NUNCA = Infinity;
const dias = o => ({
  remocao: NUNCA,
  regularizacao: NUNCA,
  substituicao: NUNCA,
  subBase: NUNCA,
  base: NUNCA,
  imprimacao: NUNCA,
  pintura: NUNCA,
  cbuq: NUNCA,
  sarjeta: NUNCA,
  ...o
});

describe('vapor do CBUQ', () => {
  it('só há vapor com a massa quente, decrescendo com a idade', () => {
    expect(vapor(-0.01)).toBe(0);
    expect(vapor(0)).toBe(1);
    expect(vapor(VAPOR_DIAS / 2)).toBeGreaterThan(0);
    expect(vapor(VAPOR_DIAS / 2)).toBeLessThan(vapor(VAPOR_DIAS / 4));
    expect(vapor(VAPOR_DIAS)).toBe(0);
    expect(vapor(NaN)).toBe(0);
  });
});

describe('chão sob a máquina', () => {
  it('pista existente e revestimentos não levantam poeira', () => {
    expect(chao('pista', dias({}), 10).tipo).toBe('pavimento');
    expect(chao('pista', dias({ remocao: 5, imprimacao: 9 }), 10).tipo).toBe('pavimento');
    expect(chao('pista', dias({ remocao: 5, base: 8, cbuq: 9 }), 10).tipo).toBe('pavimento');
    expect(chao('via', dias({}), 10).tipo).toBe('pavimento');
    expect(chao('lateral', dias({ remocao: 5, sarjeta: 9 }), 10).tipo).toBe('pavimento');
  });
  it('subleito exposto é terra, e a idade conta da última camada de solo', () => {
    const c = chao('pista', dias({ remocao: 5, regularizacao: 8 }), 10);
    expect(c).toEqual({ tipo: 'terra', idade: 2 });
    expect(chao('pista', dias({ remocao: 5, regularizacao: 12 }), 10)).toEqual({ tipo: 'terra', idade: 5 });
  });
  it('sub-base e base são brita', () => {
    expect(chao('pista', dias({ remocao: 1, subBase: 6 }), 10)).toEqual({ tipo: 'brita', idade: 4 });
    expect(chao('pista', dias({ remocao: 1, subBase: 6, base: 9.5 }), 10)).toEqual({ tipo: 'brita', idade: 0.5 });
  });
  it('canteiro e faixa de desvio sempre secos', () => {
    expect(chao('canteiro', {}, 3).tipo).toBe('brita');
    expect(chao('desvio', {}, 3).tipo).toBe('terra');
  });
});

describe('poeira', () => {
  it('só em solo ou brita seca', () => {
    expect(levantaPoeira({ tipo: 'terra', idade: SECAGEM_DIAS + 0.1 }, false)).toBe(true);
    // camada recém-molhada pelo pipa (dentro do tempo de secagem do shader)
    expect(levantaPoeira({ tipo: 'brita', idade: SECAGEM_DIAS / 2 }, false)).toBe(false);
    // pipa em serviço por perto
    expect(levantaPoeira({ tipo: 'terra', idade: 5 }, true)).toBe(false);
    expect(levantaPoeira({ tipo: 'pavimento', idade: Infinity }, false)).toBe(false);
  });
  it('taxa cresce com a velocidade, com mínimo para quem trabalha o solo, e segue o perfil', () => {
    expect(taxaPoeira(0, false)).toBe(0);
    expect(taxaPoeira(0, true)).toBeGreaterThan(0);
    expect(taxaPoeira(4, false)).toBeGreaterThan(taxaPoeira(2, false));
    expect(taxaPoeira(100, false)).toBe(24);
    expect(taxaPoeira(4, false, 0.5)).toBeCloseTo(taxaPoeira(4, false) / 2);
  });
});

describe('som', () => {
  it('volume pleno perto, cai com a distância e some além do alcance', () => {
    expect(volumePelaDistancia(5, 25, 600)).toBe(1);
    expect(volumePelaDistancia(50, 25, 600)).toBeCloseTo(0.5);
    expect(volumePelaDistancia(100, 25, 600)).toBeLessThan(volumePelaDistancia(50, 25, 600));
    expect(volumePelaDistancia(600, 25, 600)).toBe(0);
    expect(volumePelaDistancia(590, 25, 600)).toBeLessThan(0.01);
  });
  it('os áudios existem, são MP3 e estão nos créditos', () => {
    const cred = readFileSync('assets/CREDITOS.md', 'utf8');
    for (const f of ['motor-diesel', 'bipe-re', 'rolo-vibratorio', 'usina']) {
      const p = `public/sons/${f}.mp3`;
      expect(existsSync(p)).toBe(true);
      const b = readFileSync(p);
      const mp3 = (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.subarray(0, 3).toString() === 'ID3';
      expect(mp3).toBe(true);
      expect(cred).toContain(`${f}.mp3`);
    }
  });
});

describe('orçamento de partículas', () => {
  it('cresce de baixa para alta', () => {
    for (let i = 1; i < ORDEM.length; i++) {
      expect(PERFIS[ORDEM[i]].efeitos.max).toBeGreaterThan(PERFIS[ORDEM[i - 1]].efeitos.max);
      expect(PERFIS[ORDEM[i]].efeitos.taxa).toBeGreaterThan(PERFIS[ORDEM[i - 1]].efeitos.taxa);
    }
    expect(PERFIS.alta.efeitos.max).toBeLessThanOrEqual(4000);
  });
});
