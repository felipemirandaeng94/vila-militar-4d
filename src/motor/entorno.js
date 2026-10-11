// Entorno real do trecho (public/local/): vias existentes do OpenStreetMap sobre o relevo, edificações do IPP (contorno e
// altura do Lidar 2019; OSM onde o IPP não cobre) extrudadas e vegetação nas matas e áreas verdes. Edificações e vias são
// geometrias únicas por material, e as árvores usam InstancedMesh, para manter o desempenho em 1,6 km.
// Área militar: só dados de fontes públicas, sem nomes de edificações.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../dominio/geometria.js';
import { obraDeLocal } from '../dominio/local.js';
import { rng } from '../dominio/util.js';
import { wy, mat, mundoDeLocal } from './base.js';
import { cena, registrarVegetacao } from './renderizador.js';
import { cotaNoLocal } from './terreno.js';
import { comDias, NUNCA, diasPorInstancia } from './dias.js';
import { pbr } from './superficies.js';
import { M, D } from '../estado.js';

// ---------- vias ----------
const COR_VIA = {
  asfalto: 0x55595a,
  concreto: 0x9c9a94,
  bloco: 0x8a817a,
  terra: 0x9a8566,
  pedestre: 0xb9b5aa
};
// textura PBR de cada tipo de via (superficies.js)
const TEX_VIA = { asfalto: 'asfalto_usado', concreto: 'concreto', bloco: 'concreto', terra: 'solo', pedestre: 'concreto' };
function corDaVia(v) {
  if (['footway', 'steps', 'pedestrian'].includes(v.tipo)) return 'pedestre';
  if (v.tipo === 'bridleway') return 'terra';
  const sf = v.superficie || '';
  if (/concrete/.test(sf) || v.tipo === 'busway') return 'concreto';
  if (/paving|stones|sett/.test(sf)) return 'bloco';
  if (/unpaved|dirt|ground|gravel|sand/.test(sf)) return 'terra';
  return 'asfalto';
}
// o trecho da via que coincide com a obra é desenhado pela faixa do eixo (terreno.js) e pelo pavimento
function cobertoPelaObra(v, x, y) {
  const o = obraDeLocal(x, y, true);
  if (!o) return false;
  if (v.eixo_obra) return o.s > -40 && o.s < P.L + 40 && Math.abs(o.z) < 24;
  return o.s > -2 && o.s < P.L + 2 && Math.abs(o.z) < P.Z_VIA + 2.2;
}
// faixa da via sobre o relevo, reamostrada a cada 4 m
function faixaDaVia(v, pos, idx) {
  const pts = [];
  for (let i = 0; i < v.pts.length - 1; i++) {
    const [x0, y0] = v.pts[i],
      [x1, y1] = v.pts[i + 1],
      n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let k = 0; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  pts.push(v.pts[v.pts.length - 1]);
  const w = v.largura / 2,
    ergue = v.tipo === 'footway' ? 0.05 : 0.07;
  let ant = null;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i],
      [xa, ya] = pts[Math.max(0, i - 1)],
      [xb, yb] = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(xb - xa, yb - ya) || 1,
      nx = -(yb - ya) / l,
      ny = (xb - xa) / l;
    const base = pos.length / 3;
    for (const sd of [-1, 1]) {
      const px = x + nx * w * sd,
        py = y + ny * w * sd,
        m = mundoDeLocal(px, py);
      pos.push(m.x, wy(cotaNoLocal(px, py)) + ergue, m.z);
    }
    const cob = cobertoPelaObra(v, x, y);
    if (ant != null && !cob && !ant.cob) idx.push(ant.base, ant.base + 1, base, base, ant.base + 1, base + 1);
    ant = { base, cob };
  }
}
function construirVias(LAY) {
  const grupos = {};
  for (const v of D.local.vias) {
    const k = corDaVia(v);
    grupos[k] = grupos[k] || { pos: [], idx: [] };
    faixaDaVia(v, grupos[k].pos, grupos[k].idx);
  }
  for (const [k, g] of Object.entries(grupos)) {
    if (!g.idx.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: COR_VIA[k],
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide
    });
    const o = new THREE.Mesh(geo, pbr(material, { camada: TEX_VIA[k] }));
    o.receiveShadow = true;
    o.userData.info = {
      t: k === 'pedestre' ? 'Caminho de pedestres existente' : 'Via existente',
      d: { Fonte: '© colaboradores do OpenStreetMap (ODbL)', Situação: 'Fora da obra' }
    };
    LAY.entorno.add(o);
  }
}

// ---------- edificações ----------
const COR_EDIF = {
  edificação: 0xe0d5bb,
  construção: 0xd2c8b0,
  galpão: 0xb8bcb8,
  telheiro: 0xa9aaa4,
  'casa de máquinas': 0xc8c4ba,
  reservatório: 0xc9c7c0,
  marquise: 0xbfbcb2
};
function geometriaDoPredio(e) {
  // contorno no mundo (sentido anti-horário visto de cima), base no ponto mais baixo do terreno
  let pts = e.c.map(([x, y]) => [x, y]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[(i + 1) % pts.length];
    area += x0 * y1 - x1 * y0;
  }
  if (area < 0) pts = pts.reverse();
  const cotas = pts.map(([x, y]) => cotaNoLocal(x, y));
  const y0 = wy(Math.min(...cotas)) - 0.3,
    y1 = wy(Math.min(...cotas)) + Math.max(2.5, e.h);
  const W = pts.map(([x, y]) => mundoDeLocal(x, y));
  const pos = [],
    idx = [];
  // paredes e cobertura com as faces para fora (o contorno anti-horário no plano local fica horário no mundo, z = −y):
  // as normais para fora são necessárias para o viés de normal da sombra
  for (let i = 0; i < W.length; i++) {
    const a = W[i],
      b = W[(i + 1) % W.length],
      k = pos.length / 3;
    pos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y1, a.z);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  // cobertura plana
  const tri = THREE.ShapeUtils.triangulateShape(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    []
  );
  const k = pos.length / 3;
  for (const w of W) pos.push(w.x, y1, w.z);
  for (const [a, b, c] of tri) idx.push(k + a, k + b, k + c);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}
function construirEdificacoes(LAY) {
  const porUso = {};
  for (const e of D.local.edificacoes) {
    if (e.c.length < 3) continue;
    (porUso[e.uso] = porUso[e.uso] || []).push(geometriaDoPredio(e));
  }
  for (const [uso, geos] of Object.entries(porUso)) {
    const g = mergeGeometries(geos);
    g.computeVertexNormals();
    const o = new THREE.Mesh(g, mat(COR_EDIF[uso] || COR_EDIF.edificação, { roughness: 0.9 }));
    o.castShadow = o.receiveShadow = true;
    o.userData.info = {
      t: 'Edificação existente',
      d: {
        Uso: uso,
        Fonte:
          'Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos (Edificações 2019, altura do Lidar); complemento © colaboradores do OpenStreetMap (ODbL)',
        Interferência: 'Nenhuma; fora da faixa da obra'
      }
    };
    LAY.entorno.add(o);
  }
}

// ---------- vegetação ----------
function pontosNasAreas(R) {
  const out = [];
  const densidade = { mata: 1 / 45, verde: 1 / 260, campo: 1 / 900 };
  for (const a of D.local.areas) {
    const d = densidade[a.tipo];
    if (!d) continue;
    const xs = a.pts.map(p => p[0]),
      ys = a.pts.map(p => p[1]);
    const bb = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let area = 0;
    for (let i = 0; i < a.pts.length; i++) {
      const [x0, y0] = a.pts[i],
        [x1, y1] = a.pts[(i + 1) % a.pts.length];
      area += (x0 * y1 - x1 * y0) / 2;
    }
    const n = Math.min(900, Math.round(Math.abs(area) * d));
    for (let k = 0, t = 0; k < n && t < n * 6; t++) {
      const x = bb[0] + R() * (bb[1] - bb[0]),
        y = bb[2] + R() * (bb[3] - bb[2]);
      if (!dentroPoligono(a.pts, x, y)) continue;
      out.push([x, y]);
      k++;
    }
  }
  return out;
}
function dentroPoligono(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
// grade de ocupação (edificações e vias) para não plantar árvores sobre elas
function ocupacao() {
  const cel = 3,
    set = new Set();
  const marca = (x, y) => set.add(Math.floor(x / cel) * 100003 + Math.floor(y / cel));
  for (const e of D.local.edificacoes) {
    const xs = e.c.map(p => p[0]),
      ys = e.c.map(p => p[1]);
    for (let x = Math.min(...xs) - 2; x <= Math.max(...xs) + 2; x += cel) for (let y = Math.min(...ys) - 2; y <= Math.max(...ys) + 2; y += cel) marca(x, y);
  }
  for (const v of D.local.vias)
    for (let i = 0; i < v.pts.length - 1; i++) {
      const [x0, y0] = v.pts[i],
        [x1, y1] = v.pts[i + 1],
        n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5) + 1;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n,
          y = y0 + ((y1 - y0) * k) / n;
        for (let dx = -v.largura / 2 - 1.5; dx <= v.largura / 2 + 1.5; dx += cel)
          for (let dy = -v.largura / 2 - 1.5; dy <= v.largura / 2 + 1.5; dy += cel) marca(x + dx, y + dy);
      }
    }
  return (x, y) => set.has(Math.floor(x / cel) * 100003 + Math.floor(y / cel));
}
function construirVegetacao(LAY) {
  const R = rng(31),
    K = rng(77);
  const ocupado = ocupacao();
  const c = P.CANT;
  const lista = [];
  for (const [x, y] of pontosNasAreas(R)) {
    if (ocupado(x, y)) continue;
    const o = obraDeLocal(x, y, true);
    if (o && o.s > -40 && o.s < P.L + 40 && Math.abs(o.z) < P.Z_VIA + 3) continue;
    const oc = obraDeLocal(x, y);
    if (oc.s > c.s0 - 8 && oc.s < c.s1 + 8 && oc.z > c.z0 - 8 && oc.z < c.z1 + 8) continue;
    // árvores na faixa do desvio provisório saem com a limpeza
    const naFaixaDoDesvio = !!o && o.z < -5 && o.z > -12 && o.s > -30 && o.s < P.L + 30;
    lista.push({ x, y, h: 6 + R() * 7, rot: R() * 6, palma: R() < 0.15, cor: R() < 0.5, naFaixaDoDesvio, k: K() });
  }
  // ordem aleatória (chave k): a densidade do perfil de qualidade desenha só o começo de cada malha, as árvores com k
  // abaixo da fração, de modo que tronco, copa e folhas da mesma árvore aparecem juntos
  lista.sort((a, b) => a.k - b.k);
  const malhas = [];
  const limpeza = M.svc.find(x => x.meta && x.meta.representacao === 'limpeza');
  const fimLimpeza = limpeza ? limpeza.b : NUNCA;
  const ob = new THREE.Object3D();
  const montar = (geo, material, itens, f, nome) => {
    if (!itens.length) return null;
    const m = new THREE.InstancedMesh(geo, comDias(material), itens.length);
    itens.forEach((t, i) => {
      const w = mundoDeLocal(t.x, t.y);
      f(t, ob, w, wy(cotaNoLocal(t.x, t.y)) - 0.1);
      ob.updateMatrix();
      m.setMatrixAt(i, ob.matrix);
    });
    diasPorInstancia(
      m,
      itens.map(t => [-1, t.naFaixaDoDesvio ? fimLimpeza : NUNCA])
    );
    m.castShadow = false;
    m.receiveShadow = true;
    m.userData.info = nome;
    m.userData.chaves = itens.map(t => t.k);
    LAY.entorno.add(m);
    malhas.push(m);
    return m;
  };
  const info_ = {
    t: 'Vegetação existente',
    d: { Situação: 'Preservada; só as árvores da faixa de desvio são removidas na limpeza', Posição: 'Ilustrativa, nas matas e áreas verdes do OpenStreetMap' }
  };
  const tronco = new THREE.CylinderGeometry(0.18, 0.28, 1, 7);
  tronco.translate(0, 0.5, 0);
  montar(
    tronco,
    mat(0x5b4632).clone(),
    lista,
    (t, o, w, y) => {
      o.position.set(w.x, y, w.z);
      o.rotation.set(0, t.rot, 0);
      o.scale.set(t.palma ? 0.7 : 1, t.h * (t.palma ? 0.9 : 0.45), t.palma ? 0.7 : 1);
    },
    info_
  );
  const copa = new THREE.IcosahedronGeometry(1, 1);
  const redondas = lista.filter(t => !t.palma);
  for (const cor of [true, false])
    montar(
      copa,
      mat(cor ? 0x4c6e35 : 0x5a7d3c, { flatShading: true }).clone(),
      redondas.filter(t => t.cor === cor),
      (t, o, w, y) => {
        o.position.set(w.x, y + t.h * 0.7, w.z);
        o.rotation.set(0, t.rot, 0);
        o.scale.set(t.h * 0.38, t.h * 0.32, t.h * 0.38);
      },
      info_
    );
  const folha = new THREE.BoxGeometry(2.6, 0.05, 0.5);
  folha.translate(1.1, 0, 0);
  const palmas = lista.filter(t => t.palma).flatMap(t => Array.from({ length: 7 }, (_, k) => ({ ...t, k })));
  montar(
    folha,
    mat(0x4f7a3a).clone(),
    palmas,
    (t, o, w, y) => {
      o.position.set(w.x, y + t.h * 0.9, w.z);
      o.rotation.set(0, -t.k + t.rot, -0.35);
      o.scale.set(1, 1, 1);
    },
    info_
  );
  registrarVegetacao((frac, sombra) => {
    for (const m of malhas) {
      const ch = m.userData.chaves;
      let n = 0;
      while (n < ch.length && ch[n] < frac) n++;
      m.count = n;
      m.castShadow = sombra;
    }
  });
}

export function buildSurroundings() {
  // sem os dados do local (modo de reserva) não há entorno: só o terreno fictício
  if (!D.local) return;
  const LAY = cena.LAY;
  construirVias(LAY);
  construirEdificacoes(LAY);
  construirVegetacao(LAY);
}

export function updateTrees() {}
