// Reduz o "Jacaranda Tree" do Poly Haven (CC0, 3,8 milhões de triângulos) para as árvores instanciadas do entorno
// (Fase 6) e grava public/modelos/arvores/jacaranda.glb com dois níveis de detalhe:
//   - tronco e galhos: os raminhos finos (componentes pequenos) saem e o resto é simplificado pelo meshoptimizer, que
//     mantém os vértices originais (e as coordenadas de textura da casca);
//   - folhas: cada cartão curvo do original (116 mil, ~21 triângulos) vira um quadrilátero pelo ajuste afim entre a
//     textura e o espaço; uma amostra estratificada pela copa fica, ampliada para manter a cobertura;
//   - normais das folhas puxadas para fora da copa (iluminação macia de copa) e oclusão na cor dos vértices.
// O impostor de longe é gerado no navegador a partir do nível 1 (src/motor/arvores.js).
//
// Uso: python scripts/assets/baixar_modelos.py && node scripts/assets/arvores.mjs
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BRUTOS = resolve(RAIZ, 'assets/brutos/modelos/jacaranda_tree');
const SAIDA = resolve(RAIZ, 'public/modelos/arvores/jacaranda.glb');

// níveis de detalhe: cartões de folha, triângulos de madeira e diagonal mínima dos galhos mantidos (m)
const NIVEIS = [
  { cartoes: 3600, madeira: 5000, galhoMin: 2.2 },
  { cartoes: 1100, madeira: 900, galhoMin: 4.5 }
];
// fração da área original de folhas que os cartões ampliados cobrem (o original se sobrepõe muito)
const COBERTURA = 0.8;

// ---------- leitura do glTF ----------
const gltfArq = resolve(BRUTOS, 'jacaranda_tree_1k.gltf');
if (!existsSync(gltfArq)) {
  console.error('Modelo bruto ausente: rode python scripts/assets/baixar_modelos.py');
  process.exit(1);
}
const G = JSON.parse(readFileSync(gltfArq, 'utf8'));
const BIN = readFileSync(resolve(BRUTOS, G.buffers[0].uri));
const TIPOS = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function acessor(i) {
  const a = G.accessors[i],
    v = G.bufferViews[a.bufferView],
    T = TIPOS[a.componentType];
  const off = BIN.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  const n = a.count * NCOMP[a.type];
  // cópia alinhada
  return new T(BIN.buffer.slice(off, off + n * T.BYTES_PER_ELEMENT));
}
const prims = G.meshes[0].primitives.map(p => ({
  material: G.materials[p.material].name,
  pos: acessor(p.attributes.POSITION),
  nor: acessor(p.attributes.NORMAL),
  uv: acessor(p.attributes.TEXCOORD_0),
  idx: Uint32Array.from(acessor(p.indices))
}));
const prim = nome => prims.find(p => p.material.endsWith(nome));
const galhos = prim('branches'),
  tronco = prim('trunk'),
  folhas = prim('leaves');

// ---------- utilidades ----------
function componentes(idx, nv) {
  const pai = new Int32Array(nv).map((_, i) => i);
  const raiz = i => {
    while (pai[i] !== i) i = pai[i] = pai[pai[i]];
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = raiz(idx[t]);
    for (const k of [1, 2]) {
      const b = raiz(idx[t + k]);
      if (a !== b) pai[b] = a;
    }
  }
  // triângulos agrupados por componente
  const grupos = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = raiz(idx[t]);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(t);
  }
  return [...grupos.values()];
}
function caixa(pos, idx, tris) {
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k];
      for (let c = 0; c < 3; c++) {
        mn[c] = Math.min(mn[c], pos[v * 3 + c]);
        mx[c] = Math.max(mx[c], pos[v * 3 + c]);
      }
    }
  return { mn, mx, diag: Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) };
}
// gerador pseudoaleatório com semente (resultado reprodutível)
function rng(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// centro e semieixos da copa (elipsoide), pela caixa das folhas
const cx = caixa(
  folhas.pos,
  folhas.idx,
  Array.from({ length: folhas.idx.length / 3 }, (_, i) => i * 3)
);
const CENTRO = cx.mn.map((m, c) => (m + cx.mx[c]) / 2);
const RAIO = cx.mn.map((m, c) => (cx.mx[c] - m) / 2);
// base do tronco: centro dos vértices do tronco no metro mais baixo; o modelo é transladado para ela em x e z
let bx = 0,
  bz = 0,
  bn = 0,
  ymin = 1e9;
for (let i = 0; i < tronco.pos.length; i += 3) ymin = Math.min(ymin, tronco.pos[i + 1]);
for (let i = 0; i < tronco.pos.length; i += 3)
  if (tronco.pos[i + 1] < ymin + 1) {
    bx += tronco.pos[i];
    bz += tronco.pos[i + 2];
    bn++;
  }
const BASE = [bx / bn, 0, bz / bn];
// oclusão pela profundidade na copa: 0 no centro, 1 na casca do elipsoide
function oclusao(x, y, z, minimo) {
  const d = Math.hypot((x - CENTRO[0]) / RAIO[0], (y - CENTRO[1]) / RAIO[1], (z - CENTRO[2]) / RAIO[2]);
  const t = Math.min(1, Math.max(0, (d - 0.15) / 0.85));
  const s = t * t * (3 - 2 * t);
  // a parte de baixo da copa recebe menos luz do céu
  const baixo = Math.min(1, Math.max(0, (y - cx.mn[1]) / (cx.mx[1] - cx.mn[1])));
  return Math.max(minimo, (0.42 + 0.58 * s) * (0.82 + 0.18 * baixo));
}

// ---------- madeira ----------
await MeshoptSimplifier.ready;
function madeira(nivel) {
  const partes = [];
  for (const [p, galho] of [
    [tronco, false],
    [galhos, true]
  ]) {
    let tris = componentes(p.idx, p.pos.length / 3);
    if (galho) tris = tris.filter(c => caixa(p.pos, p.idx, c).diag >= nivel.galhoMin);
    const idx = new Uint32Array(tris.flat().flatMap(t => [p.idx[t], p.idx[t + 1], p.idx[t + 2]]));
    partes.push({ p, idx });
  }
  const total = partes.reduce((s, x) => s + x.idx.length / 3, 0);
  return partes.map(({ p, idx }) => {
    const alvo = Math.max(3, Math.round((nivel.madeira * (idx.length / 3)) / total)) * 3;
    // as costuras da textura (vértices repetidos na mesma posição) travariam a simplificação: os índices são soldados
    // pela posição e cada vértice soldado usa a coordenada de textura do primeiro original
    const solda = soldar(p.pos);
    const [simples] = MeshoptSimplifier.simplify(
      idx.map(v => solda[v]),
      p.pos,
      3,
      alvo,
      0.05,
      ['Permissive', 'Prune']
    );
    return compactar(p, simples, (x, y, z) => oclusao(x, y, z, 0.55));
  });
}
function soldar(pos) {
  const mapa = new Map(),
    r = new Uint32Array(pos.length / 3);
  for (let i = 0; i < r.length; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    if (!mapa.has(k)) mapa.set(k, i);
    r[i] = mapa.get(k);
  }
  return r;
}
function compactar(p, idx, ao) {
  const mapa = new Map(),
    pos = [],
    nor = [],
    uv = [],
    cor = [],
    novo = [];
  for (const v of idx) {
    if (!mapa.has(v)) {
      mapa.set(v, pos.length / 3);
      const x = p.pos[v * 3],
        y = p.pos[v * 3 + 1],
        z = p.pos[v * 3 + 2];
      pos.push(x - BASE[0], y, z - BASE[2]);
      nor.push(p.nor[v * 3], p.nor[v * 3 + 1], p.nor[v * 3 + 2]);
      uv.push(p.uv[v * 2], p.uv[v * 2 + 1]);
      const a = ao(x, y, z);
      cor.push(a, a, a);
    }
    novo.push(mapa.get(v));
  }
  return { pos, nor, uv, cor, idx: novo };
}

// ---------- folhas ----------
const cartoes = componentes(folhas.idx, folhas.pos.length / 3)
  .map(tris => {
    // ajuste afim posição = c + a·u + b·v pelos mínimos quadrados sobre os vértices do cartão
    const vs = [...new Set(tris.flatMap(t => [folhas.idx[t], folhas.idx[t + 1], folhas.idx[t + 2]]))];
    let suu = 0,
      suv = 0,
      svv = 0,
      su = 0,
      sv = 0;
    const n = vs.length,
      sxu = [0, 0, 0],
      sxv = [0, 0, 0],
      sx = [0, 0, 0];
    let umin = 1e9,
      umax = -1e9,
      vmin = 1e9,
      vmax = -1e9;
    for (const i of vs) {
      const u = folhas.uv[i * 2],
        v = folhas.uv[i * 2 + 1];
      umin = Math.min(umin, u);
      umax = Math.max(umax, u);
      vmin = Math.min(vmin, v);
      vmax = Math.max(vmax, v);
      suu += u * u;
      suv += u * v;
      svv += v * v;
      su += u;
      sv += v;
      for (let c = 0; c < 3; c++) {
        const x = folhas.pos[i * 3 + c];
        sxu[c] += x * u;
        sxv[c] += x * v;
        sx[c] += x;
      }
    }
    // sistema 3 × 3 (simétrico) resolvido por Cramer
    const A = [
      [suu, suv, su],
      [suv, svv, sv],
      [su, sv, n]
    ];
    const det = m =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(A);
    if (Math.abs(D) < 1e-12) return null;
    const coef = [0, 1, 2].map(c => {
      const b = [sxu[c], sxv[c], sx[c]];
      return [0, 1, 2].map(k => det(A.map((linha, i) => linha.map((x, j) => (j === k ? b[i] : x)))) / D);
    });
    const ponto = (u, v) => coef.map(([a, b, c]) => a * u + b * v + c);
    let area = 0;
    for (const t of tris) {
      const [a, b, c] = [0, 1, 2].map(k => folhas.idx[t + k]);
      const e1 = [0, 1, 2].map(k => folhas.pos[b * 3 + k] - folhas.pos[a * 3 + k]);
      const e2 = [0, 1, 2].map(k => folhas.pos[c * 3 + k] - folhas.pos[a * 3 + k]);
      area += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
    }
    const uv = [
      [umin, vmin],
      [umax, vmin],
      [umax, vmax],
      [umin, vmax]
    ];
    const cantos = uv.map(([u, v]) => ponto(u, v));
    const centro = [0, 1, 2].map(c => cantos.reduce((s, p) => s + p[c], 0) / 4);
    return { cantos, uv, centro, area };
  })
  .filter(Boolean);
const AREA_TOTAL = cartoes.reduce((s, c) => s + c.area, 0);
console.log(`folhas: ${cartoes.length} cartões, ${AREA_TOTAL.toFixed(0)} m² de cartões no original`);

// amostra estratificada: um cartão sorteado por célula de uma grade 3D, com o lado ajustado para dar o número pedido
function amostra(n, semente) {
  const R = rng(semente);
  const ordem = cartoes.map((c, i) => ({ i, k: R() }));
  let lado = 1,
    escolhidos = [];
  for (let it = 0; it < 30; it++) {
    const cel = new Map();
    for (const { i, k } of ordem) {
      const c = cartoes[i].centro;
      const chave = c.map(x => Math.floor(x / lado)).join(',');
      const atual = cel.get(chave);
      if (!atual || k < atual.k) cel.set(chave, { i, k });
    }
    escolhidos = [...cel.values()].map(x => x.i);
    if (Math.abs(escolhidos.length - n) < n * 0.04) break;
    lado *= Math.pow(escolhidos.length / n, 1 / 3);
  }
  return escolhidos.map(i => cartoes[i]);
}
function folhagem(nivel, semente) {
  const sel = amostra(nivel.cartoes, semente);
  const areaSel = sel.reduce((s, c) => s + c.area, 0);
  const k = Math.sqrt((COBERTURA * AREA_TOTAL) / areaSel);
  const pos = [],
    nor = [],
    uv = [],
    cor = [],
    idx = [];
  for (const c of sel) {
    const P = c.cantos.map(p => p.map((x, i) => c.centro[i] + (x - c.centro[i]) * k));
    const e1 = P[1].map((x, i) => x - P[0][i]),
      e2 = P[3].map((x, i) => x - P[0][i]);
    let nc = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const ln = Math.hypot(...nc) || 1;
    nc = nc.map(x => x / ln);
    // a face do cartão voltada para fora da copa
    const fora = c.centro.map((x, i) => (x - CENTRO[i]) / RAIO[i]);
    if (nc[0] * fora[0] + nc[1] * fora[1] + nc[2] * fora[2] < 0) nc = nc.map(x => -x);
    const base = pos.length / 3;
    P.forEach((p, j) => {
      pos.push(p[0] - BASE[0], p[1], p[2] - BASE[2]);
      const r = p.map((x, i) => (x - CENTRO[i]) / (RAIO[i] * RAIO[i]));
      const lr = Math.hypot(...r) || 1;
      const nn = [0, 1, 2].map(i => 0.35 * nc[i] + (0.65 * r[i]) / lr);
      const l = Math.hypot(...nn) || 1;
      nor.push(nn[0] / l, nn[1] / l, nn[2] / l);
      uv.push(...c.uv[j]);
      const a = oclusao(...p, 0.3);
      cor.push(a, a, a);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, nor, uv, cor, idx, escala: k };
}

// ---------- gravação ----------
const doc = new Document();
const buf = doc.createBuffer();
const cena = doc.createScene('arvore');
function malha(nome, g) {
  const nv = g.pos.length / 3;
  const p = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.uv)).setBuffer(buf))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.cor)).setBuffer(buf))
    .setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(nv < 65536 ? new Uint16Array(g.idx) : new Uint32Array(g.idx))
        .setBuffer(buf)
    );
  cena.addChild(doc.createNode(nome).setMesh(doc.createMesh(nome).addPrimitive(p)));
  return g.idx.length / 3;
}
let altura = 0;
for (const p of prims) for (let i = 1; i < p.pos.length; i += 3) altura = Math.max(altura, p.pos[i]);
NIVEIS.forEach((nivel, n) => {
  const [t, g] = madeira(nivel);
  const f = folhagem(nivel, 7 + n);
  const tt = malha(`tronco_${n}`, t),
    tg = malha(`galhos_${n}`, g),
    tf = malha(`folhas_${n}`, f);
  console.log(`nível ${n}: tronco ${tt}, galhos ${tg}, folhas ${tf} triângulos (cartões ampliados ${f.escala.toFixed(2)}×)`);
});
cena.setExtras({ altura, centroCopa: [CENTRO[0] - BASE[0], CENTRO[1], CENTRO[2] - BASE[2]], raioCopa: RAIO, origem: 'Poly Haven, jacaranda_tree (CC0)' });
mkdirSync(dirname(SAIDA), { recursive: true });
await new NodeIO().write(SAIDA, doc);
console.log('gravado', SAIDA, `altura ${altura.toFixed(1)} m`);
