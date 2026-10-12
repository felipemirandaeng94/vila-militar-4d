// Testes do entorno (Fase 6): geometria plana, classificação das edificações, telhado, amostragem das vias, níveis de
// detalhe das árvores e perfis de vegetação.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  areaPoligono,
  dentroPoligono,
  distanciaAoSegmento,
  retanguloMinimo,
  retangularidade,
  classificarEdificacao,
  temTelhadoCeramico,
  telhadoQuatroAguas,
  nivelDeDetalhe,
  amostrarAoLongo,
  reamostrar,
  comprimento,
  tufosNoRaio
} from '../src/motor/entornoGeo.js';
import { PERFIS, ORDEM } from '../src/motor/qualidade.js';

// retângulo 20 × 8 girado de 30° em torno de (100, 50)
const girado = (() => {
  const a = Math.PI / 6,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-10, -4],
    [10, -4],
    [10, 4],
    [-10, 4]
  ].map(([x, y]) => [100 + x * c - y * s, 50 + x * s + y * c]);
})();
const ret = (w, l) => [
  [0, 0],
  [w, 0],
  [w, l],
  [0, l]
];

describe('geometria plana', () => {
  it('área, ponto no polígono e distância ao segmento', () => {
    expect(areaPoligono(ret(10, 5))).toBeCloseTo(50);
    expect(areaPoligono([...ret(10, 5)].reverse())).toBeCloseTo(-50);
    expect(dentroPoligono(ret(10, 5), 5, 2)).toBe(true);
    expect(dentroPoligono(ret(10, 5), 11, 2)).toBe(false);
    expect(distanciaAoSegmento(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distanciaAoSegmento(13, 4, 0, 0, 10, 0)).toBeCloseTo(5);
  });

  it('retângulo mínimo de um retângulo girado', () => {
    const r = retanguloMinimo(girado);
    expect(r.comp).toBeCloseTo(20, 5);
    expect(r.larg).toBeCloseTo(8, 5);
    expect(r.c[0]).toBeCloseTo(100, 5);
    expect(r.c[1]).toBeCloseTo(50, 5);
    // eixo longo na direção de 30° (ou oposta)
    expect(Math.abs(r.u[0] * Math.cos(Math.PI / 6) + r.u[1] * Math.sin(Math.PI / 6))).toBeCloseTo(1, 5);
    expect(r.u[0] * r.v[0] + r.u[1] * r.v[1]).toBeCloseTo(0, 9);
    expect(retangularidade(girado)).toBeCloseTo(1, 5);
    // em L: ocupa 3/4 do retângulo
    expect(
      retangularidade([
        [0, 0],
        [10, 0],
        [10, 5],
        [5, 5],
        [5, 10],
        [0, 10]
      ])
    ).toBeCloseTo(0.75, 5);
  });
});

describe('edificações', () => {
  const e = (c, h, uso = 'edificação') => ({ c, h, uso });
  it('classifica pelo uso, área, forma e altura', () => {
    expect(classificarEdificacao(e(ret(10, 10), 4, 'telheiro'))).toBe('cobertura');
    expect(classificarEdificacao(e(ret(10, 10), 4, 'galpão'))).toBe('utilitario');
    expect(classificarEdificacao(e(ret(5, 5), 3))).toBe('utilitario');
    expect(classificarEdificacao(e(ret(12, 10), 4))).toBe('residencial');
    expect(classificarEdificacao(e(ret(30, 25), 27))).toBe('residencial');
    expect(classificarEdificacao(e(ret(60, 12), 7))).toBe('alojamento');
    expect(classificarEdificacao(e(ret(25, 20), 8))).toBe('administrativo');
  });

  it('telhado cerâmico só em prédios baixos, quase retangulares e não muito largos', () => {
    expect(temTelhadoCeramico('residencial', e(ret(12, 10), 4))).toBe(true);
    expect(temTelhadoCeramico('residencial', e(ret(30, 25), 27))).toBe(false);
    expect(temTelhadoCeramico('administrativo', e(ret(60, 40), 9))).toBe(false);
    expect(temTelhadoCeramico('utilitario', e(ret(12, 10), 4))).toBe(false);
  });

  it('telhado de quatro águas cobre o retângulo com o beiral e tem a altura da inclinação', () => {
    const r = retanguloMinimo(girado);
    const t = telhadoQuatroAguas(r, 0.5, 0.3);
    // meia largura com beiral = 4,5 m
    expect(t.altura).toBeCloseTo(0.3 * 4.5, 6);
    // 2 trapézios (2 triângulos cada) e 2 pontas
    expect(t.tris.length).toBe(6);
    // área em planta = (20 + 1) × (8 + 1)
    let a = 0;
    for (const tri of t.tris) a += Math.abs(areaPoligono(tri.map(([x, y]) => [x, y])));
    expect(a).toBeCloseTo(21 * 9, 4);
    const dz = t.tris.flat().map(v => v[2]);
    expect(Math.max(...dz)).toBeCloseTo(t.altura, 6);
    expect(Math.min(...dz)).toBe(0);
    // telhado quadrado vira pirâmide: 4 triângulos
    expect(telhadoQuatroAguas(retanguloMinimo(ret(10, 10)), 0, 0.3).tris.length).toBe(4);
  });
});

describe('vias e vegetação', () => {
  it('amostra ao longo da polilinha com deslocamento lateral', () => {
    const pts = [
      [0, 0],
      [10, 0],
      [10, 10]
    ];
    expect(comprimento(pts)).toBeCloseTo(20);
    const a = amostrarAoLongo(pts, 5, 2, 0);
    expect(a.map(p => p.d)).toEqual([0, 5, 10, 15, 20]);
    // primeiro trecho para +x: a esquerda é +y
    expect(a[1].x).toBeCloseTo(5);
    expect(a[1].y).toBeCloseTo(2);
    // segundo trecho para +y: a esquerda é −x
    expect(a[3].x).toBeCloseTo(8);
    expect(a[3].y).toBeCloseTo(5);
  });

  it('reamostra em pedaços de até 4 m com normal à esquerda', () => {
    const r = reamostrar(
      [
        [0, 0],
        [10, 0]
      ],
      4
    );
    expect(r.length).toBe(4);
    expect(r[1].x).toBeCloseTo(10 / 3);
    expect(r[1].nx).toBeCloseTo(0);
    expect(r[1].ny).toBeCloseTo(1);
  });

  it('nível de detalhe pela distância', () => {
    expect(nivelDeDetalhe(10, 70, 200)).toBe(0);
    expect(nivelDeDetalhe(70, 70, 200)).toBe(1);
    expect(nivelDeDetalhe(500, 70, 200)).toBe(2);
  });

  it('perfis: alcance das árvores e gramado crescem com a qualidade', () => {
    for (let i = 1; i < ORDEM.length; i++) {
      const a = PERFIS[ORDEM[i - 1]],
        b = PERFIS[ORDEM[i]];
      expect(b.arvores.perto).toBeGreaterThan(a.arvores.perto);
      expect(b.arvores.medio).toBeGreaterThan(a.arvores.medio);
      expect(tufosNoRaio(b)).toBeGreaterThan(tufosNoRaio(a));
    }
    for (const p of Object.values(PERFIS)) expect(p.arvores.medio).toBeGreaterThan(p.arvores.perto);
  });

  it('o modelo reduzido da árvore existe e tem dois níveis', () => {
    const glb = readFileSync('public/modelos/arvores/jacaranda.glb');
    const tam = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + tam).toString('utf8'));
    const nomes = json.nodes.map(n => n.name);
    for (const n of ['tronco_0', 'galhos_0', 'folhas_0', 'tronco_1', 'galhos_1', 'folhas_1']) expect(nomes).toContain(n);
    expect(glb.length).toBeLessThan(2e6);
  });
});
