// Terreno em grade estruturada: cotas e cores mudam com o avanço da limpeza, do corte, do aterro e da regularização.
import * as THREE from 'three';
import { P, nat, dCut, dFill, endW, sg } from '../dominio/geometria.js';
import { clamp, lerp, rng } from '../dominio/util.js';
import { M } from '../estado.js';
import { wx, wy, C } from './base.js';
import { cena } from './renderizador.js';
import { updateTrees } from './entorno.js';

let terr = null,
  terrGeo = null,
  TG = null,
  lastTerrKey = '';

export const malhaTerreno = () => terr;
// força a atualização do terreno no próximo quadro (troca de cenário ou de exagero)
export const resetTerrKey = () => {
  lastTerrKey = '';
};

function terrainGrid() {
  const S = [],
    Z = [];
  for (let s = -90; s <= 390; s += 2) S.push(s);
  for (let z = -150; z < -24; z += 2) Z.push(z);
  for (let z = -24; z < 24; z += 0.5) Z.push(z);
  for (let z = 24; z <= 90; z += 2) Z.push(z);
  return { S, Z };
}

export function buildTerrain() {
  TG = terrainGrid();
  const nS = TG.S.length,
    nZ = TG.Z.length;
  terrGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(nS * nZ * 3),
    col = new Float32Array(nS * nZ * 3),
    idx = [];
  for (let i = 0; i < nS; i++)
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j;
      pos[k * 3] = wx(TG.S[i]);
      pos[k * 3 + 2] = TG.Z[j];
    }
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < nZ - 1; j++) {
      const a = i * nZ + j,
        b = a + nZ;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  terrGeo.setIndex(idx);
  terrGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  terr = new THREE.Mesh(terrGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terr.receiveShadow = true;
  terr.userData.terrain = 1;
  cena.LAY.terreno.add(terr);
  // ruído determinístico para variar a grama
  TG.noise = new Float32Array(nS * nZ);
  const R = rng(77);
  for (let k = 0; k < TG.noise.length; k++) TG.noise[k] = R();
}

function terrainPrep() {
  const nS = TG.S.length,
    nZ = TG.Z.length,
    N = nS * nZ;
  TG.N = new Float32Array(N);
  TG.DC = new Float32Array(N);
  TG.DF = new Float32Array(N);
  for (let i = 0; i < nS; i++) {
    const s = TG.S[i],
      sc = clamp(s, 0, P.L);
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j,
        z = TG.Z[j];
      TG.N[k] = nat(s, z);
      TG.DC[k] = dCut(sc, z);
      TG.DF[k] = dFill(sc, z);
    }
  }
  TG.W = TG.S.map(endW);
  TG.SG = TG.S.map(s => sg(clamp(s, 0, P.L)));
  TG.i0 = TG.S.findIndex(s => s >= -26);
  TG.i1 = TG.S.length - 1 - [...TG.S].reverse().findIndex(s => s <= P.L + 26);
  TG.j0 = TG.Z.findIndex(z => z >= -15);
  TG.j1 = TG.Z.length - 1 - [...TG.Z].reverse().findIndex(z => z <= 15);
  TG.full = true;
}

export function updateTerrain(st) {
  const key = [st.limp, st.pc, st.ck, st.cf, st.reg, st.hydro].map(v => v.toFixed(3)).join('|');
  if (key === lastTerrKey) return;
  lastTerrKey = key;
  if (!TG.N) terrainPrep();
  const nS = TG.S.length,
    nZ = TG.Z.length,
    pos = terrGeo.attributes.position.array,
    col = terrGeo.attributes.color.array,
    nor = terrGeo.attributes.normal ? terrGeo.attributes.normal.array : null;
  const full = TG.full || !nor;
  TG.full = false;
  const I0 = full ? 0 : TG.i0,
    I1 = full ? nS - 1 : TG.i1,
    J0 = full ? 0 : TG.j0,
    J1 = full ? nZ - 1 : TG.j1;
  const c = P.CANT,
    minN = M.q.minNat,
    halfB = P.halfB;
  const corpoTop = minN + P.LIFT * st.ck;
  for (let i = I0; i <= I1; i++) {
    const s = TG.S[i],
      w = TG.W[i],
      sgv = TG.SG[i];
    for (let j = J0; j <= J1; j++) {
      const z = TG.Z[j],
        k = i * nZ + j,
        n = TG.N[k],
        dc = TG.DC[k],
        df = TG.DF[k];
      let y = n;
      if (w > 0) {
        if (n > dc) y = n - st.pc * (n - dc) * w;
        else if (n < df) {
          const top = st.cf > 0 ? df - P.E_CF + P.LIFT_CF * st.cf : Math.min(corpoTop, df - P.E_CF);
          y = Math.max(n, n + (Math.min(df, top) - n) * w);
        }
      }
      pos[k * 3 + 1] = wy(y);
      const nz = TG.noise[k];
      let cc = nz < 0.5 ? C.soilNat : C.grass2;
      const mixN = 0.06 * (nz - 0.5);
      if (s > c.s0 - 4 && s < c.s1 + 4 && z > c.z0 - 4 && z < c.z1 + 4) cc = C.pad;
      if (s >= -28 && s <= P.L + 6 && s <= st.limp && Math.abs(z) <= (s < 0 ? 5 : 7.5 + Math.abs(sgv - n) * 1.6)) cc = C.soilClear;
      if (w > 0) {
        const tal = Math.abs(z) > halfB + 0.25;
        if (n > dc && st.pc > 0.01) cc = tal ? C.soilCutT : C.soilCut;
        else if (n < df && y > n + 0.03) {
          cc = st.cf > 0 && y > df - P.E_CF + 0.02 ? C.fillCF : C.fillCorpo;
          if (tal) cc = [cc[0] * 0.86, cc[1] * 0.84, cc[2] * 0.84];
        }
        if (Math.abs(z) <= halfB + 0.3 && s >= 0 && s <= P.L && s <= st.reg && Math.abs(y - sgv) < 0.05) cc = C.reg;
        if (st.hydro > 0 && Math.abs(z) > halfB + 0.6 && (n > dc + 0.05 || (n < df && y > n + 0.05))) {
          const t = st.hydro;
          cc = [lerp(cc[0], C.hydro[0], t), lerp(cc[1], C.hydro[1], t), lerp(cc[2], C.hydro[2], t)];
        }
      }
      const dep = n - y;
      if (dep > 0.02 || dep < -0.02) {
        const f = dep > 0 ? 1 - 0.16 * Math.min(1, dep / 2.5) : 1 + 0.05 * Math.min(1, -dep / 2.5);
        cc = [cc[0] * f, cc[1] * f, cc[2] * f];
      }
      // cores sRGB convertidas para linear (atributo de cor de vértice é linear)
      col[k * 3] = Math.pow(cc[0] + mixN, 2.2);
      col[k * 3 + 1] = Math.pow(cc[1] + mixN, 2.2);
      col[k * 3 + 2] = Math.pow(cc[2] + mixN, 2.2);
    }
  }
  // normais por diferenças centrais na grade estruturada
  if (!nor) terrGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nS * nZ * 3), 3));
  const nn = terrGeo.attributes.normal.array;
  for (let i = Math.max(0, I0 - 1); i <= Math.min(nS - 1, I1 + 1); i++) {
    const ia = Math.max(0, i - 1),
      ib = Math.min(nS - 1, i + 1),
      dx = TG.S[ib] - TG.S[ia];
    for (let j = Math.max(0, J0 - 1); j <= Math.min(nZ - 1, J1 + 1); j++) {
      const ja = Math.max(0, j - 1),
        jb = Math.min(nZ - 1, j + 1),
        dz = TG.Z[jb] - TG.Z[ja];
      const gx = (pos[(ib * nZ + j) * 3 + 1] - pos[(ia * nZ + j) * 3 + 1]) / dx,
        gz = (pos[(i * nZ + jb) * 3 + 1] - pos[(i * nZ + ja) * 3 + 1]) / dz;
      const l = Math.hypot(gx, 1, gz),
        k = (i * nZ + j) * 3;
      nn[k] = -gx / l;
      nn[k + 1] = 1 / l;
      nn[k + 2] = -gz / l;
    }
  }
  terrGeo.attributes.position.needsUpdate = true;
  terrGeo.attributes.color.needsUpdate = true;
  terrGeo.attributes.normal.needsUpdate = true;
  if (full) terrGeo.computeBoundingSphere();
  updateTrees(st);
}
