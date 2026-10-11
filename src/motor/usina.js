// Usina de CBUQ contínua (tambor secador-misturador), montada em etapas (userData.stage = fração da montagem).
import * as THREE from 'three';
import { mat, C, bx, cy, mkPile } from './base.js';
import { mkContainer } from './modelos.js';

export function mkUsina() {
  const g = new THREE.Group();
  const gr_ = mat(0x9ea69a),
    dk = mat(0x4a5048),
    og = mat(C.orange),
    st = mat(C.steel, { metalness: 0.5, roughness: 0.45 });
  const parts = {};
  let STG = 0;
  const gadd = o => {
    o.userData.stage = STG;
    g.add(o);
    return o;
  };
  // silos dosadores frios (4)
  STG = 0.35;
  for (let i = 0; i < 4; i++) {
    const sg_ = new THREE.Group();
    sg_.position.set(20 + i * 3.6, 0, 0);
    const hop = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.5, 2.6, 4, 1), gr_);
    hop.rotation.y = Math.PI / 4;
    hop.position.y = 4.6;
    hop.castShadow = true;
    sg_.add(hop);
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ].forEach(([a, b]) => sg_.add(bx(0.18, 3.4, 0.18, dk, a * 1.1, 1.7, b * 1.1)));
    const fill = mkPile(1.3, 0.9, [0x8d8f8c, 0xa8aaa6, 0xc7c6c0, 0xcdb88d][i]);
    fill.position.y = 5.7;
    sg_.add(fill);
    gadd(sg_);
  }
  // correia coletora até o tambor
  STG = 0.45;
  const belt = bx(20, 0.25, 0.9, dk, 15.5, 1.9, 1.8);
  belt.rotation.z = 0.12;
  gadd(belt);
  // tambor secador-misturador
  STG = 0.6;
  const drumG = new THREE.Group();
  drumG.position.set(2, 3.0, 1.8);
  drumG.rotation.z = -0.07;
  gadd(drumG);
  const drum = cy(1.25, 1.25, 11, og, 24);
  drum.rotation.order = 'ZYX';
  drum.rotation.z = Math.PI / 2;
  drumG.add(drum);
  for (let i = 0; i < 3; i++) {
    const r = cy(1.38, 1.38, 0.35, dk, 24);
    r.rotation.z = Math.PI / 2;
    r.position.x = -4 + i * 4;
    drumG.add(r);
  }
  parts.drum = drum;
  gadd(bx(11, 1.6, 2.6, dk, 2, 0.8, 1.8));
  const burner = cy(0.7, 0.9, 1.8, st, 16);
  burner.rotation.z = Math.PI / 2;
  burner.position.set(-4.6, 2.7, 1.8);
  gadd(burner);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.0 }));
  flame.position.set(-3.7, 2.75, 1.8);
  gadd(flame);
  parts.flame = flame;
  // filtro de mangas e chaminé
  STG = 0.75;
  gadd(bx(4.2, 5.2, 3.2, gr_, 10, 4.3, -3.6));
  gadd(bx(4.6, 0.3, 3.6, dk, 10, 6.95, -3.6));
  const duct = cy(0.5, 0.5, 6, st, 12);
  duct.rotation.x = Math.PI / 2;
  duct.position.set(7.4, 4.0, -0.6);
  gadd(duct);
  const ch = cy(0.55, 0.65, 13, st, 14);
  ch.position.set(12.8, 6.5, -3.6);
  gadd(ch);
  parts.chimney = new THREE.Vector3(12.8, 13.2, -3.6);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ].forEach(([a, b]) => gadd(bx(0.2, 1.8, 0.2, dk, 10 + a * 1.9, 0.9, -3.6 + b * 1.4)));
  // elevador e silo de massa (o caminhão passa por baixo)
  STG = 0.88;
  const elev = bx(0.9, 10.5, 0.9, gr_, -8.0, 5.2, 1.8);
  elev.rotation.z = 0.62;
  gadd(elev);
  const silo = new THREE.Group();
  silo.position.set(-12.5, 0, 1.8);
  gadd(silo);
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ].forEach(([a, b]) => silo.add(bx(0.25, 5.2, 0.25, dk, a * 1.5, 2.6, b * 1.7)));
  const sb = cy(1.7, 1.7, 3.6, gr_, 20);
  sb.position.y = 7.6;
  silo.add(sb);
  const sc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.45, 1.8, 20), gr_);
  sc.position.y = 4.9;
  sc.castShadow = true;
  silo.add(sc);
  silo.add(bx(3.6, 0.15, 4.0, dk, 0, 9.5, 0));
  parts.siloPos = new THREE.Vector3(-12.5, 0, 1.8);
  // tanques de CAP aquecidos
  STG = 0.2;
  for (let i = 0; i < 2; i++) {
    const t = cy(1.35, 1.35, 10, mat(0x2b2d2b, { metalness: 0.3, roughness: 0.5 }), 20);
    t.rotation.z = Math.PI / 2;
    t.position.set(4 + i * 0.0, 1.8, -11 - i * 3.4);
    gadd(t);
    gadd(bx(9, 0.5, 2.8, mat(C.conc), 4, 0.25, -11 - i * 3.4));
  }
  gadd(bx(14, 0.6, 9.6, mat(C.conc), 4, 0.3, -12.7)); // bacia de contenção (mureta)
  // cabine de comando
  STG = 0.3;
  const cab = mkContainer(0xd7dbd2);
  cab.position.set(-5, 0, -8);
  cab.rotation.y = Math.PI / 2;
  gadd(cab);
  STG = 0.04;
  gadd(bx(46, 0.15, 14, mat(C.conc), 4, 0.07, -2)); // base de concreto
  return { g, parts };
}
