// Entorno fictício da Vila Militar ao longo do trecho: avenida e ruas transversais, edificações e vegetação
// (substituído pelo local real na Fase 3). Árvores e janelas usam InstancedMesh para manter o desempenho em 1,6 km.
import * as THREE from 'three';
import { P, nat } from '../dominio/geometria.js';
import { rng } from '../dominio/util.js';
import { wx, wy, mat, bx, info, C } from './base.js';
import { cena } from './renderizador.js';
import { comDias, NUNCA, diasPorInstancia } from './dias.js';
import { M } from '../estado.js';

// faixa que acompanha o terreno natural. pts: [[s, z], ...]
export function ribbon(pts, w, m, lift = 0.06) {
  const geo = new THREE.BufferGeometry(),
    pos = [],
    idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [s, z] = pts[i],
      [s2, z2] = pts[Math.min(i + 1, pts.length - 1)],
      [s0, z0] = pts[Math.max(i - 1, 0)];
    const dx = s2 - s0,
      dz = z2 - z0;
    const l = Math.hypot(dx, dz) || 1;
    const nx = ((-dz / l) * w) / 2,
      nz = ((dx / l) * w) / 2;
    for (const sg_ of [-1, 1]) {
      const ps = s + nx * sg_,
        pz = z + nz * sg_;
      pos.push(wx(ps), wy(nat(ps, pz)) + lift, pz);
    }
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m);
  o.receiveShadow = true;
  return o;
}

// edificação simples: volume, faixas de janelas por pavimento e telhado de duas águas
function predio(w, d, floors) {
  const g = new THREE.Group();
  const h = floors * 3.2;
  g.add(bx(w, h, d, mat(C.cream), 0, h / 2, 0));
  for (let f = 0; f < floors; f++)
    for (const sd of [-1, 1]) {
      const j = bx(w - 2.4, 1.2, 0.06, mat(0x6d5a44), 0, 1.8 + f * 3.2, sd * (d / 2 + 0.02));
      j.castShadow = false;
      g.add(j);
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
  g.add(r);
  return g;
}

// ruas existentes (estacas); calculadas depois de configurar a geometria
export const RUAS = () => [-30, 500, 1000, P.L + 32];
const livreDeRua = (s, folga) => RUAS().every(r => Math.abs(s - r) > folga);

export function buildSurroundings() {
  const LAY = cena.LAY;
  const asf = mat(0x55595a, { roughness: 0.92 }),
    dash = mat(0xe8c34a, { roughness: 0.6 });
  // avenida no início, ruas transversais e rua no fim do trecho (só fora da caixa da obra)
  RUAS().forEach((sx, i) => {
    for (const lado of [-1, 1]) {
      const pts = [];
      const z0 = lado < 0 ? -150 : P.W_CX / 2 + 2.5,
        z1 = lado < 0 ? -(P.W_CX / 2 + 2.5) : 90;
      for (let z = z0; z <= z1; z += 3) pts.push([sx, z]);
      if (pts.length < 2) continue;
      LAY.entorno.add(
        info(ribbon(pts, 9, asf), i === 0 ? 'Avenida existente da Vila Militar' : 'Rua transversal existente', {
          Uso: i === 0 ? 'Acesso ao canteiro e à usina' : 'Via existente, fora da obra',
          Pavimento: 'CBUQ existente'
        })
      );
      for (let z = z0 + 4; z <= z1 - 4; z += 8) {
        const d = bx(0.15, 0.03, 4, dash, wx(sx), wy(nat(sx, z)) + 0.09, z);
        d.castShadow = false;
        LAY.entorno.add(d);
      }
    }
  });
  // acesso do canteiro à avenida
  const ac = [];
  for (let s = -30; s <= 6; s += 2) ac.push([s, -86]);
  LAY.entorno.add(ribbon(ac, 8, mat(0x8b8577, { roughness: 1 }), 0.05));
  // edificações dos dois lados, fora do canteiro e das ruas
  const R = rng(9);
  const blds = [];
  for (let s = 30; s < P.L + 60; s += 64) {
    for (const lado of [1, -1]) {
      const z = lado * (34 + R() * 16);
      const c = P.CANT;
      if (lado < 0 && s > c.s0 - 30 && s < c.s1 + 30) continue;
      if (!livreDeRua(s, 24)) continue;
      const w = 26 + R() * 12,
        d = 12 + R() * 2,
        f = R() < 0.3 ? 1 : 2;
      blds.push([s, z, w, d]);
      const b = predio(w, d, f);
      b.position.set(wx(s), wy(nat(s, z)), z);
      LAY.entorno.add(
        info(b, 'Edificação existente da Vila Militar', { Uso: 'Instalações militares e residências', Interferência: 'Nenhuma; fora da faixa da obra' })
      );
    }
  }
  // vegetação instanciada (troncos e copas); as árvores na faixa do desvio saem com a limpeza
  const RT = rng(31);
  const lista = [];
  for (let i = 0; i < 900; i++) {
    const s = -120 + RT() * (P.L + 240),
      z = -145 + RT() * 230;
    if (!livreDeRua(s, 8)) continue;
    const c = P.CANT;
    if (s > c.s0 - 8 && s < c.s1 + 8 && z > c.z0 - 8 && z < c.z1 + 8) continue;
    if (blds.some(([bs, bz, w, d]) => Math.abs(s - bs) < w / 2 + 4 && Math.abs(z - bz) < d / 2 + 4)) continue;
    if (Math.abs(z + 86) < 6 && s < 10 && s > -30) continue;
    if (Math.abs(z) < P.W_CX / 2 + 3) continue;
    const naFaixaDoDesvio = z < -5 && z > -12 && s > -30 && s < P.L + 30;
    lista.push({ s, z, h: 6 + RT() * 7, rot: RT() * 6, palma: RT() < 0.22, cor: RT() < 0.5, naFaixaDoDesvio });
  }
  const limpeza = M.svc.find(x => x.meta && x.meta.representacao === 'limpeza');
  const fimLimpeza = limpeza ? limpeza.b : NUNCA;
  const o = new THREE.Object3D();
  const montar = (geo, material, itens, f, nome) => {
    const m = new THREE.InstancedMesh(geo, comDias(material), itens.length);
    itens.forEach((t, i) => {
      f(t, o);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    diasPorInstancia(
      m,
      itens.map(t => [-1, t.naFaixaDoDesvio ? fimLimpeza : NUNCA])
    );
    m.castShadow = false;
    m.receiveShadow = true;
    m.userData.info = nome;
    LAY.entorno.add(m);
    return m;
  };
  const info_ = { t: 'Vegetação existente', d: { Situação: 'Preservada; só as árvores da faixa de desvio são removidas na limpeza' } };
  const tronco = new THREE.CylinderGeometry(0.18, 0.28, 1, 7);
  tronco.translate(0, 0.5, 0);
  montar(
    tronco,
    mat(0x5b4632).clone(),
    lista,
    (t, ob) => {
      ob.position.set(wx(t.s), wy(nat(t.s, t.z)) - 0.1, t.z);
      ob.rotation.set(0, t.rot, 0);
      ob.scale.set(t.palma ? 0.7 : 1, t.h * (t.palma ? 0.9 : 0.45), t.palma ? 0.7 : 1);
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
      (t, ob) => {
        ob.position.set(wx(t.s), wy(nat(t.s, t.z)) - 0.1 + t.h * 0.7, t.z);
        ob.rotation.set(0, t.rot, 0);
        ob.scale.set(t.h * 0.38, t.h * 0.32, t.h * 0.38);
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
    (t, ob) => {
      ob.position.set(wx(t.s), wy(nat(t.s, t.z)) - 0.1 + t.h * 0.9, t.z);
      ob.rotation.set(0, -t.k + t.rot, -0.35);
      ob.scale.set(1, 1, 1);
    },
    info_
  );
}

export function updateTrees() {}
