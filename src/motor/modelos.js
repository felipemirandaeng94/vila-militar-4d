// Modelos procedurais dos equipamentos e das construções (frente = +x, origem no chão).
// Os modelos reais (GLB) entram na Fase 7; estes continuam como alternativa.
import * as THREE from 'three';
import { mat, C, bx, cy, wheel } from './base.js';

export function mkTruck(kind = 'bascula', col = C.olive) {
  const g = new THREE.Group(),
    m = mat(col),
    mk = mat(C.black);
  g.add(bx(7.4, 0.35, 1.0, mk, -0.4, 1.0, 0));
  g.add(bx(1.6, 1.9, 2.45, m, 2.65, 2.05, 0)); // cabine
  g.add(bx(0.06, 0.8, 2.1, mat(C.glass, { roughness: 0.2, metalness: 0.3 }), 3.46, 2.45, 0));
  g.add(bx(0.4, 0.5, 2.5, mk, 3.4, 1.15, 0));
  const beacon = bx(0.25, 0.18, 0.25, mat(C.yellow, { emissive: 0x6b4a00 }), 2.65, 3.1, 0);
  g.add(beacon);
  [[2.75], [-1.3], [-2.65]].forEach(([x]) => {
    g.add(wheel(0.52, 0.42, x, 0.52, 1.03));
    g.add(wheel(0.52, 0.42, x, 0.52, -1.03));
  });
  if (kind === 'bascula' || kind === 'cbuq') {
    const piv = new THREE.Group();
    piv.position.set(-3.45, 1.22, 0);
    g.add(piv);
    const bed = new THREE.Group();
    piv.add(bed);
    const bm = mat(col === C.olive ? C.oliveD : col);
    bed.add(bx(5.1, 0.12, 2.4, bm, 2.55, 0.06, 0));
    bed.add(bx(5.1, 1.2, 0.1, bm, 2.55, 0.66, 1.17));
    bed.add(bx(5.1, 1.2, 0.1, bm, 2.55, 0.66, -1.17));
    bed.add(bx(0.12, 1.45, 2.4, bm, 5.1, 0.78, 0));
    bed.add(bx(0.1, 1.15, 2.3, bm, 0.02, 0.62, 0));
    const load = bx(4.9, 1.0, 2.2, mat(0x7a5a3a), 2.55, 0.62, 0);
    load.castShadow = false;
    bed.add(load);
    const tarp = bx(5.2, 0.05, 2.5, mat(0x3f5a32), 2.55, 1.4, 0);
    tarp.visible = false;
    bed.add(tarp);
    g.userData = { piv, load, tarp, beacon };
  } else if (kind === 'pipa' || kind === 'espargidor') {
    const t = cy(1.05, 1.05, 4.9, mat(kind === 'pipa' ? col : 0x2a2a2a, { metalness: 0.3, roughness: 0.5 }), 20);
    t.rotation.z = Math.PI / 2;
    t.position.set(-0.9, 2.25, 0);
    g.add(t);
    g.add(bx(0.2, 0.12, kind === 'espargidor' ? 3.6 : 2.6, mat(C.steel), -3.6, 0.75, 0));
    g.userData = { spray: kind };
  } else if (kind === 'munck') {
    g.add(bx(5.4, 0.2, 2.4, mat(C.oliveD), -1.0, 1.3, 0));
    const boom = bx(5.5, 0.35, 0.35, mat(C.yellow), -0.4, 2.6, 0);
    boom.rotation.z = 0.32;
    g.add(boom);
    g.add(bx(0.6, 1.2, 0.6, mat(C.yellow), 1.6, 1.9, 0));
  } else if (kind === 'prova') {
    g.add(bx(5.0, 1.3, 2.4, mat(C.oliveD), -1.0, 1.9, 0));
    const vb = bx(3.6, 0.08, 0.12, mat(C.white), -5.0, 0.12, 0.6);
    g.add(vb);
  }
  return g;
}
export function mkExcavator() {
  const g = new THREE.Group(),
    m = mat(C.olive),
    mk = mat(C.black);
  g.add(bx(4.6, 0.9, 0.7, mk, 0, 0.45, 1.25));
  g.add(bx(4.6, 0.9, 0.7, mk, 0, 0.45, -1.25));
  g.add(bx(2.2, 0.4, 1.8, mk, 0, 1.0, 0));
  const up = new THREE.Group();
  up.position.y = 1.2;
  g.add(up);
  up.add(bx(3.4, 1.2, 2.6, m, -0.5, 0.6, 0));
  up.add(bx(1.2, 1.5, 1.0, m, 0.7, 1.95, 0.75));
  up.add(bx(0.05, 0.9, 0.85, mat(C.glass, { roughness: 0.2 }), 1.31, 2.1, 0.75));
  up.add(bx(1.0, 0.6, 2.4, mat(C.oliveD), -2.1, 1.0, 0));
  const b1 = new THREE.Group();
  b1.position.set(0.9, 1.0, -0.2);
  up.add(b1);
  b1.add(bx(5.6, 0.55, 0.5, m, 2.8, 0, 0));
  const b2 = new THREE.Group();
  b2.position.set(5.6, 0, 0);
  b1.add(b2);
  b2.add(bx(3.0, 0.42, 0.42, m, 1.5, 0, 0));
  const bk = new THREE.Group();
  bk.position.set(3.0, 0, 0);
  b2.add(bk);
  bk.add(bx(1.0, 0.9, 1.1, mk, 0.35, -0.35, 0));
  g.userData = { up, b1, b2, bk };
  return g;
}
export function mkGrader() {
  const g = new THREE.Group(),
    m = mat(C.olive),
    mk = mat(C.black);
  g.add(bx(2.6, 1.3, 2.2, m, -2.6, 1.4, 0));
  g.add(bx(1.4, 1.6, 2.0, m, -0.9, 2.5, 0));
  g.add(bx(0.05, 1.0, 1.8, mat(C.glass, { roughness: 0.2 }), -0.18, 2.7, 0));
  g.add(bx(5.2, 0.45, 0.6, m, 2.0, 1.55, 0));
  g.add(bx(1.0, 0.8, 2.0, m, 4.3, 1.3, 0));
  const bl = bx(0.18, 0.6, 3.7, mat(C.steel, { metalness: 0.5 }), 1.4, 0.45, 0);
  bl.rotation.y = 0.45;
  g.add(bl);
  [[4.3], [-2.0], [-3.4]].forEach(([x]) => {
    g.add(wheel(0.65, 0.5, x, 0.65, 1.05));
    g.add(wheel(0.65, 0.5, x, 0.65, -1.05));
  });
  g.add(bx(0.25, 0.18, 0.25, mat(C.yellow, { emissive: 0x6b4a00 }), -0.9, 3.4, 0));
  return g;
}
export function mkRoller(kind) {
  const g = new THREE.Group(),
    m = mat(C.olive),
    mk = mat(C.black);
  if (kind === 'pneus') {
    g.add(bx(4.4, 1.3, 2.1, m, 0, 1.25, 0));
    g.add(bx(1.2, 1.3, 1.4, m, -0.6, 2.55, 0));
    g.add(bx(1.3, 0.08, 1.6, mk, -0.6, 3.25, 0));
    for (let i = 0; i < 4; i++) g.add(wheel(0.5, 0.36, -1.5, 0.5, -0.85 + i * 0.57));
    for (let i = 0; i < 3; i++) g.add(wheel(0.5, 0.36, 1.5, 0.5, -0.57 + i * 0.57));
    return g;
  }
  const drum = x => {
    const d = new THREE.Group();
    d.position.set(x, 0.75, 0);
    const c = cy(0.75, 0.75, 2.1, mat(C.steel, { metalness: 0.45, roughness: 0.4 }), 24);
    c.rotation.x = Math.PI / 2;
    d.add(c);
    if (kind === 'pe') {
      const pm = mat(C.greyD);
      for (let a = 0; a < 16; a++)
        for (let j = 0; j < 5; j++) {
          const p = bx(0.16, 0.18, 0.16, pm);
          const an = (a / 16) * Math.PI * 2 + j * 0.2;
          p.position.set(Math.cos(an) * 0.82, Math.sin(an) * 0.82, -0.85 + j * 0.42);
          p.rotation.z = an;
          p.castShadow = false;
          d.add(p);
        }
    }
    g.add(d);
    return d;
  };
  if (kind === 'tandem') {
    const d1 = drum(1.5),
      d2 = drum(-1.5);
    g.add(bx(2.0, 1.0, 1.7, m, 0, 1.55, 0));
    g.add(bx(1.0, 1.1, 1.2, m, 0, 2.6, 0));
    g.add(bx(1.2, 0.08, 1.5, mk, 0, 3.2, 0));
    g.userData = { drums: [d1, d2] };
  } else {
    const d1 = drum(1.8);
    g.add(bx(0.4, 1.3, 2.4, m, 1.8, 1.25, 0));
    g.add(bx(2.8, 1.4, 1.9, m, -1.0, 1.35, 0));
    g.add(bx(1.1, 1.3, 1.4, m, -0.6, 2.7, 0));
    g.add(bx(1.3, 0.08, 1.6, mk, -0.6, 3.4, 0));
    g.add(wheel(0.75, 0.55, -1.7, 0.75, 0.85));
    g.add(wheel(0.75, 0.55, -1.7, 0.75, -0.85));
    g.userData = { drums: [d1] };
  }
  return g;
}
export function mkPaver() {
  const g = new THREE.Group(),
    m = mat(C.olive),
    mk = mat(C.black);
  g.add(bx(3.4, 0.8, 0.5, mk, 0.2, 0.4, 1.0));
  g.add(bx(3.4, 0.8, 0.5, mk, 0.2, 0.4, -1.0));
  g.add(bx(3.6, 1.2, 2.5, m, -0.2, 1.4, 0));
  const hop = new THREE.Group();
  hop.position.set(2.4, 0.9, 0);
  g.add(hop);
  hop.add(bx(1.8, 0.1, 2.0, mat(C.oliveD), 0, 0, 0));
  const w1 = bx(1.8, 0.9, 0.1, mat(C.oliveD), 0, 0.4, 1.4);
  w1.rotation.x = 0.55;
  hop.add(w1);
  const w2 = bx(1.8, 0.9, 0.1, mat(C.oliveD), 0, 0.4, -1.4);
  w2.rotation.x = -0.55;
  hop.add(w2);
  const mass = bx(1.6, 0.4, 2.2, mat(0x202020), 0, 0.25, 0);
  hop.add(mass);
  g.add(bx(1.0, 0.12, 2.6, mk, -0.7, 3.0, 0));
  [
    [0.3, 1.2],
    [-1.6, 1.2],
    [0.3, -1.2],
    [-1.6, -1.2]
  ].forEach(([x, z]) => g.add(bx(0.08, 1.0, 0.08, mk, x, 2.5, z)));
  g.add(bx(0.8, 0.6, 3.5, mat(C.yellow), -2.35, 0.35, 0)); // mesa
  g.add(bx(0.6, 0.3, 3.5, mk, -2.4, 0.85, 0));
  g.userData = { mass };
  return g;
}
export function mkDozer() {
  const g = new THREE.Group(),
    m = mat(C.olive),
    mk = mat(C.black);
  g.add(bx(3.4, 0.8, 0.6, mk, 0, 0.4, 1.0));
  g.add(bx(3.4, 0.8, 0.6, mk, 0, 0.4, -1.0));
  g.add(bx(2.6, 1.3, 1.6, m, 0.2, 1.4, 0));
  g.add(bx(1.2, 1.3, 1.5, m, -0.7, 2.6, 0));
  g.add(bx(0.3, 1.2, 3.2, mat(C.steel, { metalness: 0.5 }), 2.4, 0.7, 0));
  return g;
}
export function mkLoader() {
  const g = new THREE.Group(),
    m = mat(C.olive);
  g.add(bx(2.8, 1.3, 2.0, m, -1.2, 1.4, 0));
  g.add(bx(1.2, 1.4, 1.5, m, 0.2, 2.6, 0));
  g.add(bx(0.06, 0.9, 1.3, mat(C.glass, { roughness: 0.2 }), 0.82, 2.7, 0));
  g.add(bx(2.2, 0.3, 0.3, m, 1.7, 1.5, 0.75));
  g.add(bx(2.2, 0.3, 0.3, m, 1.7, 1.5, -0.75));
  g.add(bx(1.0, 1.0, 2.6, mat(C.steel, { metalness: 0.5 }), 3.0, 0.9, 0));
  [[1.3], [-1.8]].forEach(([x]) => {
    g.add(wheel(0.8, 0.55, x, 0.8, 1.0));
    g.add(wheel(0.8, 0.55, x, 0.8, -1.0));
  });
  return g;
}
export function mkTractor(tool) {
  const g = new THREE.Group(),
    m = mat(C.olive);
  g.add(bx(2.4, 1.0, 1.2, m, 0.4, 1.2, 0));
  g.add(bx(1.0, 1.2, 1.3, m, -0.6, 2.2, 0));
  g.add(wheel(0.45, 0.35, 1.2, 0.45, 0.8));
  g.add(wheel(0.45, 0.35, 1.2, 0.45, -0.8));
  g.add(wheel(0.8, 0.45, -0.9, 0.8, 0.85));
  g.add(wheel(0.8, 0.45, -0.9, 0.8, -0.85));
  if (tool === 'grade') {
    for (let i = 0; i < 8; i++) {
      const d = cy(0.32, 0.32, 0.05, mat(C.steel), 14);
      d.rotation.x = Math.PI / 2;
      d.rotation.y = 0.3;
      d.position.set(-3.0, 0.32, -1.4 + i * 0.4);
      g.add(d);
    }
    g.add(bx(0.2, 0.15, 3.2, mat(C.black), -3.0, 0.7, 0));
  }
  if (tool === 'vassoura') {
    const b = cy(0.4, 0.4, 2.2, mat(0x8a6d3b), 14);
    b.rotation.x = Math.PI / 2;
    b.position.set(2.2, 0.4, 0);
    g.add(b);
    g.userData = { brush: b };
  }
  return g;
}
export function mkMill() {
  const g = new THREE.Group(),
    m = mat(C.olive);
  g.add(bx(5.5, 1.6, 2.2, m, 0, 1.2, 0));
  g.add(bx(0.4, 0.4, 0.9, mat(C.black), 0, 0.2, 0));
  const cv = bx(5.0, 0.3, 0.8, mat(C.black), 4.6, 2.2, 0);
  cv.rotation.z = 0.35;
  g.add(cv);
  g.add(bx(1.2, 1.0, 1.4, m, -1.2, 2.5, 0));
  return g;
}
export function mkTripod() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const l = cy(0.02, 0.03, 1.6, mat(0xc89d4a), 6);
    const a = (i / 3) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.3, 0.75, Math.sin(a) * 0.3);
    l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(l);
  }
  g.add(bx(0.25, 0.3, 0.2, mat(C.yellow), 0, 1.65, 0));
  return g;
}

// ---------- construções do canteiro e do entorno ----------
export function mkContainer(col) {
  const g = new THREE.Group();
  g.add(bx(6.06, 2.6, 2.44, mat(col), 0, 1.3 + 0.3, 0));
  g.add(bx(6.3, 0.12, 2.7, mat(0x6f7570), 0, 2.98, 0));
  g.add(bx(1.4, 0.9, 0.05, mat(C.glass, { roughness: 0.2 }), 1.2, 1.9, 1.23));
  g.add(bx(0.9, 2.0, 0.05, mat(0x5e665f), -1.8, 1.3, 1.23));
  [-2.6, 2.6].forEach(x => g.add(bx(0.3, 0.3, 2.4, mat(C.conc), x, 0.15, 0)));
  return g;
}
export function mkTree(R, h) {
  const g = new THREE.Group();
  const t = cy(0.18, 0.28, h * 0.45, mat(0x5b4632), 7);
  t.position.y = h * 0.22;
  g.add(t);
  const kind = R() < 0.25 ? 'palm' : 'round';
  if (kind === 'palm') {
    t.scale.set(0.7, 2.0, 0.7);
    t.position.y = h * 0.45;
    for (let i = 0; i < 7; i++) {
      const f = bx(2.6, 0.05, 0.5, mat(0x4f7a3a));
      f.position.set(Math.cos(i) * 1.1, h * 0.9, Math.sin(i) * 1.1);
      f.rotation.y = -i;
      f.rotation.z = -0.35;
      f.castShadow = true;
      g.add(f);
    }
  } else {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.38, 1), mat(R() < 0.5 ? 0x4c6e35 : 0x5a7d3c, { flatShading: true }));
    c.position.y = h * 0.7;
    c.scale.y = 0.85;
    c.castShadow = true;
    g.add(c);
  }
  return g;
}
export function mkBuilding(w, d, floors) {
  const g = new THREE.Group();
  const h = floors * 3.2;
  g.add(bx(w, h, d, mat(C.cream), 0, h / 2, 0));
  for (let i = 0; i < Math.floor(w / 3); i++)
    for (let f = 0; f < floors; f++) {
      g.add(bx(1.2, 1.3, 0.06, mat(0x6d5a44), -w / 2 + 1.8 + i * 3, 1.8 + f * 3.2, d / 2 + 0.02));
      g.add(bx(1.2, 1.3, 0.06, mat(0x6d5a44), -w / 2 + 1.8 + i * 3, 1.8 + f * 3.2, -d / 2 - 0.02));
    }
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2 - 0.5, 0);
  sh.lineTo(0, 2.6);
  sh.lineTo(d / 2 + 0.5, 0);
  sh.lineTo(-d / 2 - 0.5, 0);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: w + 1, bevelEnabled: false });
  rg.translate(0, 0, -(w + 1) / 2);
  const r = new THREE.Mesh(rg, mat(C.roof));
  r.rotation.y = Math.PI / 2;
  r.position.y = h;
  r.castShadow = true;
  r.receiveShadow = true;
  g.add(r);
  return g;
}
export function mkFlag() {
  const g = new THREE.Group();
  const p = cy(0.06, 0.08, 9, mat(C.white), 8);
  p.position.y = 4.5;
  g.add(p);
  const f = new THREE.Group();
  f.position.set(1.2, 8.2, 0);
  g.add(f);
  const pl = (w, h, c, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.z = z;
    return m;
  };
  f.add(pl(2.2, 1.55, 0x1f8a3c, 0));
  const rh = pl(1.6, 1.0, 0xf2c522, 0.01);
  rh.geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.85, 0, 0),
    new THREE.Vector3(0, 0.55, 0),
    new THREE.Vector3(0.85, 0, 0),
    new THREE.Vector3(-0.85, 0, 0),
    new THREE.Vector3(0.85, 0, 0),
    new THREE.Vector3(0, -0.55, 0)
  ]);
  rh.geometry.computeVertexNormals();
  f.add(rh);
  const ci = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), new THREE.MeshStandardMaterial({ color: 0x1c3f8f, side: THREE.DoubleSide }));
  ci.position.z = 0.02;
  f.add(ci);
  g.userData.flag = f;
  return g;
}
