// Entorno fictício da Vila Militar: vias existentes, edificações e vegetação (substituído pelo local real na Fase 3).
import * as THREE from 'three';
import { P, nat } from '../dominio/geometria.js';
import { rng } from '../dominio/util.js';
import { wx, wy, mat, bx, info } from './base.js';
import { mkBuilding, mkTree } from './modelos.js';
import { cena } from './renderizador.js';

// árvores; as que estão na faixa da obra somem com a limpeza (S04)
export const trees = [];

// faixa que acompanha o terreno natural. pts: [[s, z], ...]
export function ribbon(pts, w, m, lift = 0.06) {
  const geo = new THREE.BufferGeometry(),
    pos = [],
    idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [s, z] = pts[i],
      [s2, z2] = pts[Math.min(i + 1, pts.length - 1)],
      [s0, z0] = pts[Math.max(i - 1, 0)];
    let dx = s2 - s0,
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

export function buildSurroundings() {
  const LAY = cena.LAY;
  const asf = mat(0x55595a, { roughness: 0.92 }),
    side = mat(0xbdb8aa);
  const av = [];
  for (let z = -150; z <= 90; z += 3) av.push([-30, z]);
  LAY.entorno.add(
    info(ribbon(av, 9, asf), 'Avenida existente da Vila Militar', { Uso: 'Acesso do canteiro, da jazida e da pedreira', Pavimento: 'CBUQ existente' })
  );
  LAY.entorno.add(
    ribbon(
      av.map(([s, z]) => [s - 6, z]),
      2.2,
      side,
      0.12
    )
  );
  LAY.entorno.add(
    ribbon(
      av.map(([s, z]) => [s + 6, z]),
      2.2,
      side,
      0.12
    )
  );
  const av2 = [];
  for (let z = -150; z <= 90; z += 3) av2.push([332, z]);
  LAY.entorno.add(info(ribbon(av2, 9, asf), 'Rua existente da Vila Militar', { Uso: 'Saída leste da via nova' }));
  // faixa central tracejada
  const dash = mat(0xe8c34a, { roughness: 0.6 });
  for (const sx of [-30, 332])
    for (let z = -146; z <= 86; z += 8) {
      const d = bx(0.15, 0.03, 4, dash, wx(sx), wy(nat(sx, z)) + 0.09, z);
      d.castShadow = false;
      LAY.entorno.add(d);
    }
  // acesso do canteiro à avenida
  const ac = [];
  for (let s = -30; s <= 6; s += 2) ac.push([s, -86]);
  LAY.entorno.add(ribbon(ac, 8, mat(0x8b8577, { roughness: 1 }), 0.05));
  // edificações (casario e quartéis no padrão da Vila Militar)
  const R = rng(9);
  const blds = [
    [40, 64, 34, 12, 2],
    [95, 66, 30, 12, 2],
    [150, 62, 36, 12, 2],
    [215, 66, 32, 12, 2],
    [272, 62, 30, 12, 2],
    [-70, 20, 28, 14, 2],
    [-72, -40, 30, 14, 1],
    [372, 10, 26, 14, 2],
    [370, -55, 30, 12, 2],
    [205, -70, 40, 14, 2],
    [262, -96, 30, 12, 1]
  ];
  for (const [s, z, w, d, f] of blds) {
    const b = mkBuilding(w, d, f);
    b.position.set(wx(s), wy(nat(s, z)), z);
    b.rotation.y = R() < 0.5 ? 0 : 0.0;
    LAY.entorno.add(info(b, 'Edificação existente da Vila Militar', { Uso: 'Instalações militares', Interferência: 'Nenhuma; fora da faixa da obra' }));
  }
  // vegetação
  const RT = rng(31);
  for (let i = 0; i < 230; i++) {
    const s = -85 + RT() * 470,
      z = -145 + RT() * 230;
    if (Math.abs(s + 30) < 10 || Math.abs(s - 332) < 10) continue;
    const c = P.CANT;
    if (s > c.s0 - 8 && s < c.s1 + 8 && z > c.z0 - 8 && z < c.z1 + 8) continue;
    if (blds.some(([bs, bz, w, d]) => Math.abs(s - bs) < w / 2 + 4 && Math.abs(z - bz) < d / 2 + 4)) continue;
    if (Math.abs(z + 86) < 6 && s < 10 && s > -30) continue;
    const inFoot = s > -4 && s < P.L + 4 && Math.abs(z) < 11;
    if (!inFoot && Math.abs(z) < 16 && s > -10 && s < P.L + 10) continue;
    const t = mkTree(RT, 6 + RT() * 7);
    t.position.set(wx(s), wy(nat(s, z)) - 0.1, z);
    t.rotation.y = RT() * 6;
    t.userData = { s, inFoot };
    info(
      t,
      inFoot ? 'Árvore na faixa da obra' : 'Vegetação existente',
      inFoot ? { Serviço: 'Removida na limpeza (S04)', Norma: 'DNIT 104/2009-ES' } : { Situação: 'Preservada' }
    );
    trees.push(t);
    LAY.entorno.add(t);
  }
}

// árvores removidas pela limpeza
export function updateTrees(st) {
  for (const t of trees) t.visible = !(t.userData.inFoot && st.limp >= t.userData.s);
}
