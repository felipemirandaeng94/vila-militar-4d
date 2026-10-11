// Materiais, cores e formas básicas do modelo 3D; conversão das coordenadas da obra para o mundo 3D.
import * as THREE from 'three';
import { P } from '../dominio/geometria.js';

// Mundo 3D: X = s − L/2, Y = cota − Y0, Z = z
export const wx = s => s - P.L / 2;
export const wy = c => c - P.Y0;

export const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// materiais compartilhados por cor e opções (as cores hexadecimais são sRGB; o ColorManagement converte para linear)
const MAT = {};
export function mat(c, o = {}) {
  const k = c + JSON.stringify(o);
  if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.82, metalness: 0.05 }, o));
  return MAT[k];
}
export const C = {
  olive: 0x5a6340,
  oliveD: 0x434a30,
  black: 0x1d1f1f,
  tire: 0x222222,
  steel: 0x8a9095,
  glass: 0x9fb8c4,
  yellow: 0xd9a21b,
  orange: 0xd9692a,
  white: 0xe9ebe6,
  grey: 0xa3a7a3,
  greyD: 0x6c706d,
  cream: 0xe4d6b0,
  roof: 0xa65a3c,
  conc: 0xbfbcb2,
  asphalt: 0x3d4042,
  // cores do terreno em sRGB (0 a 1), convertidas para linear ao preencher a malha
  soilNat: [0.47, 0.58, 0.33],
  grass2: [0.4, 0.52, 0.29],
  soilClear: [0.6, 0.47, 0.32],
  soilCut: [0.7, 0.45, 0.3],
  soilCutT: [0.55, 0.33, 0.22],
  fillCorpo: [0.63, 0.52, 0.38],
  fillCF: [0.72, 0.56, 0.38],
  reg: [0.78, 0.64, 0.46],
  pad: [0.62, 0.6, 0.55],
  hydro: [0.45, 0.6, 0.3]
};

export function bx(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  return o;
}
export function cy(rt, rb, h, m, seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.castShadow = o.receiveShadow = true;
  return o;
}
export function wheel(r, w, x, y, z, m) {
  const o = cy(r, r, w, m || mat(C.tire), 18);
  o.rotation.x = Math.PI / 2;
  o.position.set(x, y, z);
  return o;
}
// informação mostrada ao clicar no objeto
export function info(o, t, d) {
  o.traverse(c => {
    if (c.isMesh) c.userData.info = { t, d };
  });
  return o;
}
export function mkPile(r, h, col) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18), mat(col, { flatShading: true }));
  c.position.y = h / 2;
  c.castShadow = c.receiveShadow = true;
  return c;
}
