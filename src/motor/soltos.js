// Material solto (leiras, montes e camada espalhada antes da compactação). Geometria procedural com semente fixa:
// - leiras de solo (substituição), solo-brita (sub-base) e brita graduada (base) na pista, à frente da motoniveladora:
//   surgem onde os basculantes descarregam (cerca de 14 m à frente da frente de serviço) e diminuem à medida que a
//   motoniveladora as espalha;
// - monte de terra ao lado da vala aberta, que some no reaterro;
// - monte cônico com ruído (montes(), usado no estoque de fresado do canteiro, canteiro.js).
// A camada espalhada e não compactada é um estado do shader das camadas (superficies.js, ESPALHADO): fica entre o rolo e
// a frente, pelas estacas que atualizarSoltos() calcula a cada quadro a partir do cronograma.
import * as THREE from 'three';
import { P, larguraVala, diametroRede } from '../dominio/geometria.js';
import { trechosRuins } from '../dominio/quantitativos.js';
import { D } from '../estado.js';
import { wy, mat, mundo } from './base.js';
import { cena } from './renderizador.js';
import { comDias, finito } from './dias.js';
import { pbr } from './superficies.js';
import { alturas, ativas, diaRep, diasDaVala, servicoRep, superficie } from './pavimento.js';

// ---------- ruído com semente fixa ----------
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ruído de valor 1D suave (-1 a 1), com nós a cada passo
function ruido1(semente, passo = 3) {
  const R = aleatorio(semente),
    nos = [];
  return x => {
    const u = x / passo,
      i = Math.floor(u),
      f = u - i;
    while (nos.length <= i + 1) nos.push(R() * 2 - 1);
    const a = nos[Math.max(0, i)],
      b = nos[Math.max(0, i + 1)],
      k = f * f * (3 - 2 * f);
    return a + (b - a) * k;
  };
}

// ---------- estado das frentes (uniformes do shader) ----------
// serviços com material espalhado: textura solta, avanço do rolo atrás da frente (m, pelas posições de
// equipamentos.js) e leiras (cor, escala da seção e camada de apoio)
const LONGE = -1e6;
export const SERVICOS = {
  regularizacao: { camada: 'solo_solto', rolo: 12 },
  substituicao: { camada: 'solo_solto', rolo: 6, leira: { cor: 0xa9784a, escala: 1.6, apoio: s => alturas(s).b } },
  subBase: { camada: 'cascalho_solto', rolo: 10, leira: { cor: 0xb79a72, escala: 1.15, apoio: s => alturas(s).b + 0.03 } },
  base: { camada: 'cascalho_solto', rolo: 10, leira: { cor: 0x9d9d97, escala: 1, apoio: s => alturas(s).sb } }
};
for (const v of Object.values(SERVICOS)) v.frente = new THREE.Vector2(LONGE, LONGE);

/** Material PBR da camada espalhada do serviço rep (opção espalhado de pbr). */
export const espalhado = rep => ({ camada: SERVICOS[rep].camada, frente: SERVICOS[rep].frente });

/** Estacas do rolo e da frente de cada serviço no dia d; sem frente ativa, nada fica solto. */
export function atualizarSoltos(d) {
  for (const [rep, v] of Object.entries(SERVICOS)) {
    const a = ativas(rep, d)[0];
    if (a) v.frente.set(a.s - v.rolo, a.s);
    else v.frente.set(LONGE, LONGE);
  }
}

// ---------- leiras ----------
// seção de uma leira (meia largura e altura relativas, de um pé ao outro); área ≈ 0,65 m² com escala 1, o volume solto
// de meia pista de base de 15 cm (7,0 m × 0,15 m × 1,25 / 2)
const SECAO = [
  [-1, 0],
  [-0.62, 0.55],
  [-0.25, 0.94],
  [0, 1],
  [0.25, 0.94],
  [0.62, 0.55],
  [1, 0]
];
const MEIA_BASE = 1.0,
  ALTURA = 0.5;
// trecho da leira à frente da frente de serviço: espalhada até 1 m atrás e cheia a partir de 9 m à frente; a descarga
// dos basculantes vai até 17 m à frente
const LEIRA = { espalha: [-1, 9], descarga: [13, 17] };
const VERT_LEIRA = /* glsl */ `
{
  float ds = aLeira.x - uFrenteLeira.y;
  float k = smoothstep(${LEIRA.espalha[0].toFixed(1)}, ${LEIRA.espalha[1].toFixed(1)}, ds) * (1.0 - smoothstep(${LEIRA.descarga[0].toFixed(1)}, ${LEIRA.descarga[1].toFixed(1)}, ds));
  transformed.y -= aLeira.y * (1.0 - k);
}
`;
// encolhe a leira pela posição da frente (uniforme): aLeira = [estaca, altura do vértice acima do apoio]
function comLeira(material, frente) {
  const anterior = material.onBeforeCompile,
    chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = function (sh, r) {
    if (anterior) anterior.call(this, sh, r);
    sh.uniforms.uFrenteLeira = { value: frente };
    sh.vertexShader =
      'attribute vec2 aLeira;\nuniform vec2 uFrenteLeira;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_LEIRA);
  };
  material.customProgramCacheKey = function () {
    return (chaveAnterior ? chaveAnterior.call(this) : '') + 'leira';
  };
  return material;
}

// malha em faixa ao longo do eixo: secao(s) devolve os pontos [z, y, alt] de uma seção; dias(s) -> [aparece, some]
function malhaAoLongo(estacas, secao, dias) {
  const pos = [],
    dd = [],
    le = [],
    idx = [];
  let n = 0;
  for (const s of estacas) {
    const sec = secao(s);
    n = sec.length;
    const [a, b] = dias(s);
    for (const [z, y, alt] of sec) {
      const p = mundo(s, z);
      pos.push(p.x, wy(y), p.z);
      dd.push(finito(a), finito(b));
      le.push(s, alt);
    }
  }
  for (let i = 0; i < estacas.length - 1; i++)
    for (let k = 0; k < n - 1; k++) {
      const a = i * n + k,
        c = a + n;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDias', new THREE.Float32BufferAttribute(dd, 2));
  geo.setAttribute('aLeira', new THREE.Float32BufferAttribute(le, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // a orientação dos triângulos depende do sentido do afastamento no mundo: a face visível é a de cima
  const ny = geo.attributes.normal.array.reduce((a, v, i) => (i % 3 === 1 ? a + v : a), 0);
  if (ny < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  return geo;
}
const estacasDe = (s0, s1, passo = 1) => {
  const out = [];
  for (let s = s0; s < s1 - 1e-6; s += passo) out.push(s);
  out.push(s1);
  return out;
};
// afinamento nas pontas de cada trecho (m)
const pontas = (s, s0, s1, l = 3) => Math.min(1, Math.max(0, (s - s0) / l), Math.max(0, (s1 - s) / l));

// leiras e montes da obra (também cortados na vista em perfil, camera.js)
export const SOLTOS = [];
function adicionar(geo, material, nome, info) {
  const o = new THREE.Mesh(geo, material);
  o.name = nome;
  o.userData.info = info;
  // a sombra ignoraria o descarte por dia e o encolhimento da leira: só recebe
  o.castShadow = false;
  o.receiveShadow = true;
  SOLTOS.push(o);
  cena.LAY.pavimento.add(o);
}

function buildLeiras() {
  let semente = 17;
  for (const [rep, cfg] of Object.entries(SERVICOS)) {
    const lr = cfg.leira,
      svc = servicoRep(rep);
    if (!lr || !svc) continue;
    // trechos com material: a janela inteira, ou só os trechos de solo mole na substituição
    const trechos = [];
    for (const w of svc.jan) {
      if (rep === 'substituicao') for (const t of trechosRuins(D.obra, w.s0, w.s1)) trechos.push([Math.max(w.s0, t.de), Math.min(w.s1, t.ate), w]);
      else trechos.push([w.s0, w.s1, w]);
    }
    const material = pbr(comLeira(comDias(mat(lr.cor, { roughness: 1 }).clone()), cfg.frente), { camada: cfg.camada });
    for (const [s0, s1, w] of trechos) {
      if (!(s1 - s0 > 2)) continue;
      // duas leiras, uma por meia pista
      for (const zc of [-1.75, 1.75]) {
        const nA = ruido1(semente++, 3.5),
          nL = ruido1(semente++, 5),
          nW = ruido1(semente++, 4);
        const secao = s => {
          const k = pontas(s, s0, s1) * lr.escala,
            h = ALTURA * k * (1 + 0.2 * nA(s - s0)),
            mb = MEIA_BASE * Math.sqrt(lr.escala) * (1 + 0.12 * nW(s - s0)),
            zm = zc + 0.15 * nL(s - s0),
            y0 = lr.apoio(s);
          return SECAO.map(([u, v]) => [zm + u * mb, y0 + v * h, v * h]);
        };
        // aparece quando a frente está 17 m atrás (descarga) e some quando ela passa 1 m adiante (espalhada)
        const dias = s => [diaRep(rep, Math.max(w.s0, s - LEIRA.descarga[1])), diaRep(rep, Math.min(w.s1, s - LEIRA.espalha[0]))];
        adicionar(malhaAoLongo(estacasDe(s0, s1), secao, dias), material, 'leira', {
          t: `Leira de ${rep === 'base' ? 'brita graduada' : rep === 'subBase' ? 'solo-brita' : 'solo de jazida'}`,
          d: { Situação: 'Material descarregado, a espalhar pela motoniveladora', Serviço: svc.nome }
        });
      }
    }
  }
}

// ---------- monte de terra ao lado da vala ----------
function buildMonteDaVala() {
  const svc = servicoRep('vala');
  if (!svc) return;
  const zr = P.DRN.afastamentoRede;
  const lado = zr >= 0 ? 1 : -1;
  const material = pbr(comDias(mat(0x8a5a3a, { roughness: 1 }).clone()), { camada: 'solo_solto' });
  let semente = 101;
  for (const w of svc.jan) {
    const nA = ruido1(semente++, 2.5),
      nW = ruido1(semente++, 3.5),
      nL = ruido1(semente++, 6);
    const secao = s => {
      const lv = larguraVala(diametroRede(s));
      // monte de seção ~ volume da vala aberta (largura × profundidade), com folga de 1,2 m da borda
      const k = pontas(s, w.s0, w.s1, 4),
        mb = 1.5 * (1 + 0.15 * nW(s)),
        h = 1.25 * k * (1 + 0.25 * nA(s)),
        zm = zr + lado * (lv / 2 + 1.2 + mb) + 0.2 * nL(s),
        dv = diasDaVala(s),
        y0 = superficie(s, zm, dv.esc + 0.01);
      return SECAO.map(([u, v]) => [zm + u * mb, y0 + v * h, v * h]);
    };
    const dias = s => {
      const v = diasDaVala(s);
      return [v.esc, v.reat];
    };
    adicionar(malhaAoLongo(estacasDe(w.s0, w.s1), secao, dias), material, 'monte-vala', {
      t: 'Material escavado da vala',
      d: { Situação: 'Ao lado da vala aberta; volta no reaterro ou vai para o bota-fora', Serviço: svc.nome }
    });
  }
}

/** Leiras e monte da vala (partes que dependem do cronograma); chamado junto com buildPavement. */
export function buildSoltos() {
  for (const o of SOLTOS) {
    cena.LAY.pavimento.remove(o);
    o.geometry.dispose();
  }
  SOLTOS.length = 0;
  buildLeiras();
  buildMonteDaVala();
}

// ---------- monte cônico ----------
/**
 * Geometria de monte de material solto: cone de raio r e altura h com perfil abaulado, ruído no raio e na altura
 * (semente fixa) e base em y = 0.
 */
export function geometriaMonte(r, h, semente = 7, setores = 40, aneis = 12) {
  const R = aleatorio(semente);
  const harm = Array.from({ length: 4 }, (_, i) => [R() * Math.PI * 2, (0.09 / (i + 1)) * (0.6 + 0.8 * R())]);
  const pos = [],
    idx = [];
  for (let j = 0; j <= aneis; j++) {
    const t = j / aneis; // 0 = pé, 1 = topo
    for (let i = 0; i < setores; i++) {
      const a = (i / setores) * Math.PI * 2;
      let dr = 0;
      harm.forEach(([f, amp], k) => (dr += amp * Math.sin(a * (k + 2) + f + t * 1.7 * k)));
      const rr = r * (1 - t) * (1 + dr * (1 - 0.5 * t)) * (1 + 0.04 * (R() - 0.5));
      // perfil côncavo perto do pé e abaulado no topo (ângulo de repouso do material solto)
      const y = h * (1 - Math.pow(1 - t, 1.35)) * (1 + 0.05 * (R() - 0.5) * (1 - t));
      pos.push(Math.cos(a) * rr, j === 0 ? 0 : y, Math.sin(a) * rr);
    }
  }
  const topo = pos.length / 3;
  pos.push(0, h, 0);
  for (let j = 0; j < aneis; j++)
    for (let i = 0; i < setores; i++) {
      const a = j * setores + i,
        b = j * setores + ((i + 1) % setores),
        c = a + setores,
        d = b + setores;
      if (j === aneis - 1) idx.push(a, topo, b);
      else idx.push(a, c, b, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
