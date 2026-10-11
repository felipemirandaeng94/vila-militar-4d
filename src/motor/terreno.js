// Terreno em grade estruturada ao longo do trecho. Fora da caixa do pavimento ele não muda com a obra; dentro dela fica
// rebaixado e escondido pelas faixas do pavimento (pavimento.js), que mostram a demolição e as camadas novas.
import * as THREE from 'three';
import { P, nat, sg } from '../dominio/geometria.js';
import { rng } from '../dominio/util.js';
import { wx, wy, C } from './base.js';
import { cena } from './renderizador.js';

let terr = null;
export const malhaTerreno = () => terr;
export const resetTerrKey = () => {};

function grade() {
  const S = [],
    Z = [];
  for (let s = -150; s <= P.L + 150; s += 4) S.push(s);
  for (let z = -150; z < -24; z += 3) Z.push(z);
  for (let z = -24; z < 24; z += 0.5) Z.push(z);
  for (let z = 24; z <= 90; z += 3) Z.push(z);
  return { S, Z };
}

export function buildTerrain() {
  const G = grade();
  const nS = G.S.length,
    nZ = G.Z.length;
  const pos = new Float32Array(nS * nZ * 3),
    col = new Float32Array(nS * nZ * 3),
    idx = [];
  const R = rng(77),
    c = P.CANT,
    hW = P.W_CX / 2;
  for (let i = 0; i < nS; i++)
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j,
        s = G.S[i],
        z = G.Z[j];
      const naCaixa = s >= -0.5 && s <= P.L + 0.5 && Math.abs(z) <= hW + 0.05;
      const y = naCaixa ? sg(s) - 1.3 : nat(s, z);
      pos[k * 3] = wx(s);
      pos[k * 3 + 1] = wy(y);
      pos[k * 3 + 2] = z;
      const nz = R();
      let cc = nz < 0.5 ? C.soilNat : C.grass2;
      if (s > c.s0 - 4 && s < c.s1 + 4 && z > c.z0 - 4 && z < c.z1 + 4) cc = C.pad;
      // passeios de concreto junto à via
      if (Math.abs(z) > hW && Math.abs(z) < hW + 2.2 && s > -20 && s < P.L + 20) cc = [0.74, 0.72, 0.68];
      const mixN = 0.06 * (nz - 0.5);
      col[k * 3] = Math.pow(cc[0] + mixN, 2.2);
      col[k * 3 + 1] = Math.pow(cc[1] + mixN, 2.2);
      col[k * 3 + 2] = Math.pow(cc[2] + mixN, 2.2);
    }
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < nZ - 1; j++) {
      const a = i * nZ + j,
        b = a + nZ;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  terr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terr.receiveShadow = true;
  terr.userData.terrain = 1;
  cena.LAY.terreno.add(terr);
}

export function updateTerrain() {}
