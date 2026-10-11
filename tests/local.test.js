// Testes do local real (Fase 3): eixo sobre a via existente, terreno, greide e canteiro, com os arquivos de public/local/.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { carregarDados } from '../src/dados.js';
import { configurarDominio } from '../src/dominio/modelo.js';
import { P, gr, nat } from '../src/dominio/geometria.js';
import { LOCAL, localDeObra, obraDeLocal, cotaTerreno, pontoDoEixo } from '../src/dominio/local.js';

const ler = f => readFileSync(new URL('../public/local/' + f, import.meta.url));
const json = f => JSON.parse(ler(f).toString('utf-8'));

let dados, q, local;
beforeAll(() => {
  const b = ler('terreno.bin');
  local = { eixo: json('eixo.json'), meta: json('meta.json'), terreno: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  dados = { ...carregarDados(), local };
  q = configurarDominio(dados);
});
afterAll(() => configurarDominio(carregarDados()));

describe('eixo real', () => {
  it('a extensão medida do eixo é a extensão da obra', () => {
    expect(LOCAL.ativo).toBe(true);
    expect(Math.abs(LOCAL.extensao - P.L)).toBeLessThan(0.5);
    expect(local.eixo.vias).toEqual(['Avenida Duque de Caxias']);
  });
  it('o eixo liga o início e o fim de dados/local.json (ajuste confirmado de 26 m no início e de 3 m no fim)', () => {
    const a = pontoDoEixo(0),
      b = pontoDoEixo(P.L);
    expect(Math.hypot(a.x, a.y)).toBeLessThan(30);
    // o fim fica sobre o eixo x local, à distância em linha reta do início
    expect(Math.hypot(b.x - 1583, b.y)).toBeLessThan(15);
  });
  it('coordenadas da obra e locais vão e voltam (erro < 20 cm até 30 m do eixo, pela tangente suavizada)', () => {
    for (let s = 0; s <= P.L; s += 97.3)
      for (const z of [-30, -4.05, 0, 3.5, 25]) {
        const [x, y] = localDeObra(s, z);
        const o = obraDeLocal(x, y);
        expect(Math.abs(o.s - s)).toBeLessThan(0.2);
        expect(Math.abs(o.z - z)).toBeLessThan(0.2);
      }
  });
  it('o lado direito (z > 0) fica à direita de quem vai do início para o fim', () => {
    const p = pontoDoEixo(800),
      [x, y] = localDeObra(800, 10);
    // produto vetorial tangente × (ponto - eixo) negativo = à direita
    expect(p.tx * (y - p.y) - p.ty * (x - p.x)).toBeLessThan(0);
  });
});

describe('terreno e greide', () => {
  it('o greide acompanha a via existente sobre o relevo real (sem corte e aterro)', () => {
    for (let s = 0; s <= P.L; s += 20) {
      const t = cotaTerreno(...localDeObra(s, 0));
      expect(Math.abs(gr(s) - t)).toBeLessThan(1.5);
    }
    // rampas suaves de via urbana
    for (let s = 0; s + 20 <= P.L; s += 20) expect(Math.abs(gr(s + 20) - gr(s)) / 20).toBeLessThan(0.06);
  });
  it('as cotas do terreno estão na faixa do MDT da região (Deodoro, 15 a 60 m)', () => {
    for (let s = -200; s <= P.L + 200; s += 50)
      for (const z of [-200, -50, 50, 200]) {
        const c = nat(s, z);
        expect(c).toBeGreaterThan(15);
        expect(c).toBeLessThan(60);
      }
  });
  it('junto à caixa do pavimento, o terreno é a plataforma da via existente', () => {
    for (let s = 50; s < P.L; s += 150) {
      expect(nat(s, P.W_CX / 2 + 0.2)).toBeCloseTo(gr(s), 6);
      expect(nat(s, -(P.Z_VIA + 1))).toBeCloseTo(gr(s) + 0.12, 6);
    }
  });
});

describe('canteiro e usina', () => {
  it('ficam no início do trecho, na área confirmada, fora das edificações', () => {
    const c = P.CANT;
    expect(c.s1 - c.s0).toBeCloseTo(135, 6);
    expect(c.z1 - c.z0).toBeCloseTo(72, 6);
    expect(c.s1).toBeLessThan(0); // antes do início do trecho
    expect(c.s1).toBeGreaterThan(-300);
    const edif = json('edificacoes.json');
    for (const e of edif)
      for (const [x, y] of e.c) {
        const o = obraDeLocal(x, y);
        const dentro = o.s > c.s0 + 1 && o.s < c.s1 - 1 && o.z > c.z0 + 1 && o.z < c.z1 - 1;
        expect(dentro).toBe(false);
      }
  });
  it('a meta do local registra a posição confirmada e os créditos', () => {
    expect(local.meta.canteiro.confirmado).toMatch(/confirmada/);
    const txt = local.meta.creditos.map(c => c.texto).join(' ');
    expect(txt).toContain('© colaboradores do OpenStreetMap (ODbL)');
    expect(txt).toContain('Instituto Pereira Passos');
    expect(JSON.stringify(local.meta).toLowerCase()).not.toContain('google');
  });
});

describe('quantitativos com o local real', () => {
  it('recalculados para a extensão medida', () => {
    expect(q.total.areaFresagem).toBeCloseTo(P.L * 7.0, 6);
    expect(q.frentes.at(-1).s1).toBe(P.L);
    // o perfil do greide nos quantitativos vem do relevo real
    expect(q.rows[0].gr).toBeCloseTo(gr(0), 6);
  });
});
