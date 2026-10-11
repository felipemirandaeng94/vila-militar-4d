// Terreno. Com o local real: grade de 4 m sobre o relevo (MDT Lidar 2019, IPP) com cores pelo uso do solo (OSM) e uma faixa
// fina ao longo do eixo, em coordenadas da obra, com a pista existente, os passeios e a caixa do pavimento. Dentro da caixa o
// terreno fica rebaixado e escondido pelas faixas do pavimento (pavimento.js), que mostram a demolição e as camadas novas.
// Sem o local real, terreno fictício ao longo do eixo reto.
import * as THREE from 'three';
import { P, nat, sg } from '../dominio/geometria.js';
import { cotaTerreno, gradeDoTerreno, temTerreno, obraDeLocal, localDeObra } from '../dominio/local.js';
import { rng } from '../dominio/util.js';
import { D } from '../estado.js';
import { wy, C, mundo, mundoDeLocal } from './base.js';
import { cena } from './renderizador.js';
import { pbr, T } from './superficies.js';

let terr = null;
const malhas = [];
export const malhaTerreno = () => terr;
export const resetTerrKey = () => {};

// faixa do eixo coberta pela malha fina (coordenadas da obra)
const FAIXA = { s0: -40, z: 24 };

// cota exibida num ponto local: na faixa do eixo e no canteiro segue nat (plataforma da via e pátio); fora, o relevo
export function cotaNoLocal(x, y) {
  const o = obraDeLocal(x, y, true);
  if (o && o.s > FAIXA.s0 - 20 && o.s < P.L - FAIXA.s0 + 20 && Math.abs(o.z) < 40) return nat(o.s, o.z);
  if (perto_do_canteiro(x, y)) {
    const c = obraDeLocal(x, y);
    return nat(c.s, c.z);
  }
  return cotaTerreno(x, y);
}
let CBOX = null;
function perto_do_canteiro(x, y) {
  if (!CBOX) {
    const c = P.CANT,
      xs = [],
      ys = [];
    for (const s of [c.s0 - 15, c.s1 + 15])
      for (const z of [c.z0 - 15, c.z1 + 15]) {
        const [a, b] = localDeObra(s, z);
        xs.push(a);
        ys.push(b);
      }
    CBOX = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  }
  return x >= CBOX[0] && x <= CBOX[1] && y >= CBOX[2] && y <= CBOX[3];
}

// ---------- cores pelo uso do solo ----------
const COR = {
  chao: [0.62, 0.6, 0.5],
  verde: [0.45, 0.56, 0.31],
  mata: [0.3, 0.42, 0.22],
  quadra: [0.72, 0.6, 0.42],
  campo: [0.5, 0.6, 0.34],
  agua: [0.35, 0.5, 0.58],
  estacionamento: [0.55, 0.55, 0.53],
  pista: [0.33, 0.34, 0.35],
  passeio: [0.74, 0.72, 0.68],
  patio: C.pad
};
// textura PBR de cada uso do solo (superficies.js); a cor acima é a cor-alvo da textura
const TEX = {
  chao: 'solo',
  verde: 'grama',
  mata: 'grama',
  quadra: 'argila',
  campo: 'grama',
  agua: 'solo',
  estacionamento: 'asfalto_usado',
  pista: 'asfalto_usado',
  passeio: 'concreto',
  patio: 'brita'
};
function preparoAreas(areas) {
  return areas.map(a => {
    const xs = a.pts.map(p => p[0]),
      ys = a.pts.map(p => p[1]);
    return { tipo: a.tipo, pts: a.pts, bb: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] };
  });
}
function dentro(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
// prioridade: água e quadras sobre matas, matas sobre áreas verdes
const ORDEM = ['agua', 'quadra', 'estacionamento', 'mata', 'campo', 'verde'];
function usoNoPonto(areas, x, y) {
  let melhor = null;
  for (const a of areas) {
    if (x < a.bb[0] || x > a.bb[1] || y < a.bb[2] || y > a.bb[3]) continue;
    if (!dentro(a.pts, x, y)) continue;
    if (!melhor || ORDEM.indexOf(a.tipo) < ORDEM.indexOf(melhor)) melhor = a.tipo;
  }
  return melhor || 'chao';
}
// cor-alvo (linear) e peso 1 na textura do uso; os pesos se misturam entre vértices vizinhos de usos diferentes
function pintar(col, k, cc, ruido, uso) {
  const m = 0.05 * (ruido - 0.5);
  const t = T[TEX[uso]];
  (t < 4 ? col.pa : col.pb)[k * 4 + (t % 4)] = 1;
  col[k * 3] = Math.pow(Math.max(0, cc[0] + m), 2.2);
  col[k * 3 + 1] = Math.pow(Math.max(0, cc[1] + m), 2.2);
  col[k * 3 + 2] = Math.pow(Math.max(0, cc[2] + m), 2.2);
}
// cores (3 por vértice) e pesos das texturas (aPesoA e aPesoB, 4 + 4 por vértice)
function cores(n) {
  const c = new Float32Array(n * 3);
  c.pa = new Float32Array(n * 4);
  c.pb = new Float32Array(n * 4);
  return c;
}
function malha(pos, col, idx, material) {
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPesoA', new THREE.BufferAttribute(col.pa, 4));
  geo.setAttribute('aPesoB', new THREE.BufferAttribute(col.pb, 4));
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, material);
  o.receiveShadow = true;
  o.userData.terrain = 1;
  malhas.push(o);
  cena.LAY.terreno.add(o);
  return o;
}

function noCanteiroLocal(s, z) {
  const c = P.CANT;
  return s > c.s0 - 4 && s < c.s1 + 4 && z > c.z0 - 4 && z < c.z1 + 4;
}

function terrenoReal(material) {
  const T = gradeDoTerreno(),
    areas = preparoAreas(D.local.areas || []),
    R = rng(77),
    k = 2,
    nx = Math.floor((T.nx - 1) / k) + 1,
    ny = Math.floor((T.ny - 1) / k) + 1;
  const pos = new Float32Array(nx * ny * 3),
    col = cores(nx * ny),
    oz = new Float32Array(nx * ny),
    os = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = j * nx + i,
        x = T.x0 + i * k * T.passo,
        y = T.y0 + j * k * T.passo;
      const o = obraDeLocal(x, y, true);
      os[v] = o ? o.s : -1e9;
      oz[v] = o ? o.z : 1e9;
      // a malha geral fica 5 cm abaixo junto à faixa do eixo, para não disputar com a malha fina
      const h = cotaNoLocal(x, y) - (o && Math.abs(o.z) < FAIXA.z + 4 ? 0.05 : 0);
      const w = mundoDeLocal(x, y);
      pos[v * 3] = w.x;
      pos[v * 3 + 1] = wy(h);
      pos[v * 3 + 2] = w.z;
      let uso = usoNoPonto(areas, x, y);
      if (perto_do_canteiro(x, y)) {
        const c = obraDeLocal(x, y);
        if (noCanteiroLocal(c.s, c.z)) uso = 'patio';
      }
      pintar(col, v, COR[uso], R(), uso);
    }
  const idx = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i,
        b = a + 1,
        c = a + nx,
        d = c + 1;
      // buraco sob a malha fina do eixo
      const ms = (os[a] + os[d]) / 2,
        mz = (oz[a] + oz[d]) / 2;
      if (Math.abs(mz) < FAIXA.z - 3 && ms > FAIXA.s0 + 4 && ms < P.L - FAIXA.s0 - 4) continue;
      // no mundo z = −y: (a, b, c) fica no sentido anti-horário visto de cima (normal para cima)
      idx.push(a, b, c, b, d, c);
    }
  return malha(pos, col, idx, material);
}

function faixaDoEixo(material) {
  const areas = preparoAreas(D.local.areas || []),
    R = rng(78),
    hW = P.W_CX / 2,
    zv = P.Z_VIA;
  const S = [],
    Z = [];
  for (let s = FAIXA.s0; s <= P.L - FAIXA.s0 + 1e-6; s += 2) S.push(s);
  for (let z = -FAIXA.z; z <= FAIXA.z + 1e-6; z += 0.5) Z.push(z);
  const nS = S.length,
    nZ = Z.length;
  const pos = new Float32Array(nS * nZ * 3),
    col = cores(nS * nZ);
  for (let i = 0; i < nS; i++)
    for (let j = 0; j < nZ; j++) {
      const v = i * nZ + j,
        s = S[i],
        z = Z[j],
        az = Math.abs(z);
      const naCaixa = s >= -0.5 && s <= P.L + 0.5 && az <= hW + 0.05;
      const p = mundo(s, z);
      pos[v * 3] = p.x;
      pos[v * 3 + 1] = wy(naCaixa ? sg(s) - 1.3 : nat(s, z));
      pos[v * 3 + 2] = p.z;
      let uso;
      if (az <= zv + 0.01) uso = 'pista';
      else if (az <= zv + 2.2) uso = 'passeio';
      else uso = usoNoPonto(areas, ...localDeObra(s, z));
      pintar(col, v, COR[uso], R(), uso);
    }
  const idx = [];
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < nZ - 1; j++) {
      const a = i * nZ + j,
        b = a + nZ;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  return malha(pos, col, idx, material);
}

// terreno fictício ao longo do eixo reto (sem os dados do local)
function grade() {
  const S = [],
    Z = [];
  for (let s = -150; s <= P.L + 150; s += 4) S.push(s);
  for (let z = -150; z < -24; z += 3) Z.push(z);
  for (let z = -24; z < 24; z += 0.5) Z.push(z);
  for (let z = 24; z <= 90; z += 3) Z.push(z);
  return { S, Z };
}
function terrenoFicticio(material) {
  const G = grade();
  const nS = G.S.length,
    nZ = G.Z.length;
  const pos = new Float32Array(nS * nZ * 3),
    col = cores(nS * nZ),
    idx = [];
  const R = rng(77),
    hW = P.W_CX / 2;
  for (let i = 0; i < nS; i++)
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j,
        s = G.S[i],
        z = G.Z[j];
      const naCaixa = s >= -0.5 && s <= P.L + 0.5 && Math.abs(z) <= hW + 0.05;
      const p = mundo(s, z);
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = wy(naCaixa ? sg(s) - 1.3 : nat(s, z));
      pos[k * 3 + 2] = p.z;
      const nz = R();
      let cc = nz < 0.5 ? C.soilNat : C.grass2,
        uso = nz < 0.5 ? 'chao' : 'verde';
      if (noCanteiroLocal(s, z)) [cc, uso] = [C.pad, 'patio'];
      // passeios de concreto junto à via
      if (Math.abs(z) > hW && Math.abs(z) < hW + 2.2 && s > -20 && s < P.L + 20) [cc, uso] = [COR.passeio, 'passeio'];
      pintar(col, k, cc, 0.5 + 1.2 * (nz - 0.5), uso);
    }
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < nZ - 1; j++) {
      const a = i * nZ + j,
        b = a + nZ;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  return malha(pos, col, idx, material);
}

export function buildTerrain() {
  for (const o of malhas) {
    cena.LAY.terreno.remove(o);
    o.geometry.dispose();
  }
  malhas.length = 0;
  CBOX = null;
  // rugosidade 1: a do mapa ARM de cada textura
  const material = pbr(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), { pesos: true });
  if (temTerreno() && D.local) {
    terrenoReal(material);
    terr = faixaDoEixo(material);
  } else terr = terrenoFicticio(material);
}

export function updateTerrain() {}
