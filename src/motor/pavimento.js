// Camadas do pavimento como faixas com plano de corte: o plano acompanha a frente de serviço de cada camada.
import * as THREE from 'three';
import { P, sg } from '../dominio/geometria.js';
import { terrainC } from '../dominio/cotas.js';
import { M, ST } from '../estado.js';
import { wx, wy, mat, bx } from './base.js';
import { cena } from './renderizador.js';

export const PAV = {};

// cota do topo do pavimento já executado em (s, z), com o exagero de espessura da exibição, ou null
export function layerTop(s, z, st) {
  if (s < 0 || s > P.L) return null;
  const E = ST.exag;
  const a = Math.abs(z),
    b = sg(s);
  const ln = z >= 0 ? 'BD' : 'BE';
  if (a <= P.W_RV / 2 && s <= st['rv' + ln]) return b + P.E_PAV * E;
  if (a <= P.W_BA / 2 && s <= st.ba) return b + (P.E_SB + P.E_BA) * E;
  if (a <= P.W_SB / 2 && s <= st.sb) return b + P.E_SB * E;
  return null;
}
// cota da superfície (pavimento ou terreno trabalhado)
export function surfC(s, z, st) {
  const t = layerTop(s, z, st);
  return t != null ? t : terrainC(M.q, s, z, st);
}

function strip(z0, z1, bot, top, m) {
  const geo = new THREE.BufferGeometry(),
    pos = [],
    idx = [];
  const st = 2;
  let n = 0;
  for (let s = 0; s <= P.L; s += st) {
    const b = wy(bot(s)),
      t = wy(top(s)),
      x = wx(s);
    pos.push(x, t, z0, x, t, z1, x, b, z1, x, b, z0);
    n++;
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4,
      b = a + 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // topo
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // lado z1
    idx.push(a + 3, b + 3, a, a, b + 3, b); // lado z0
  }
  idx.push(0, 1, 3, 1, 2, 3); // testa
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m);
  o.castShadow = false;
  o.receiveShadow = true;
  return o;
}

export function buildPavement() {
  const LAY = cena.LAY;
  for (const k in PAV) {
    LAY.pavimento.remove(PAV[k]);
    if (PAV[k].geometry) PAV[k].geometry.dispose();
  }
  const E = ST.exag;
  const mk = (k, z0, z1, bot, top, color, opts, nome, d) => {
    const m = new THREE.MeshStandardMaterial(
      Object.assign(
        {
          color,
          roughness: 0.9,
          metalness: 0,
          clippingPlanes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), -999)],
          clipShadows: true,
          side: THREE.DoubleSide
        },
        opts
      )
    );
    const o = strip(z0, z1, bot, top, m);
    o.userData.info = { t: nome, d };
    PAV[k] = o;
    LAY.pavimento.add(o);
  };
  const b0 = s => sg(s),
    b1 = s => sg(s) + P.E_SB * E,
    b2 = s => sg(s) + (P.E_SB + P.E_BA) * E,
    b3 = s => sg(s) + P.E_PAV * E;
  mk('sb', -P.W_SB / 2, P.W_SB / 2, b0, b1, 0xb79a72, {}, 'Sub-base de solo-brita', {
    Espessura: '20 cm',
    Largura: '8,0 m',
    Norma: 'DNIT 139/2010-ES',
    'GC mínimo': '100 %'
  });
  mk('ba', -P.W_BA / 2, P.W_BA / 2, b1, b2, 0x9d9d97, {}, 'Base de brita graduada', {
    Espessura: '15 cm',
    Largura: '7,6 m',
    Norma: 'DNIT 141/2022-ES',
    'GC mínimo': '100 %'
  });
  const film = 0.012 * Math.max(1, E);
  mk('impBD', 0, P.W_BA / 2, b2, s => b2(s) + film, 0x5a3d26, { roughness: 0.5 }, 'Imprimação com CM-30 (bordo direito)', {
    Taxa: '1,20 L/m²',
    Norma: 'DNIT 144/2014-ES'
  });
  mk('impBE', -P.W_BA / 2, 0, b2, s => b2(s) + film, 0x5a3d26, { roughness: 0.5 }, 'Imprimação com CM-30 (bordo esquerdo)', {
    Taxa: '1,20 L/m²',
    Norma: 'DNIT 144/2014-ES'
  });
  mk('pinBD', 0, P.W_RV / 2, b2, s => b2(s) + film * 1.6, 0x231d19, { roughness: 0.5, metalness: 0 }, 'Pintura de ligação RR-1C (BD)', {
    Taxa: '0,90 L/m² diluída 1:1',
    Norma: 'DNIT 145/2012-ES'
  });
  mk('pinBE', -P.W_RV / 2, 0, b2, s => b2(s) + film * 1.6, 0x231d19, { roughness: 0.5, metalness: 0 }, 'Pintura de ligação RR-1C (BE)', {
    Taxa: '0,90 L/m² diluída 1:1',
    Norma: 'DNIT 145/2012-ES'
  });
  mk('rvBD', 0, P.W_RV / 2, b2, b3, 0x2e3133, { roughness: 0.78 }, 'Revestimento em CBUQ (faixa direita)', {
    Espessura: '5 cm',
    Faixa: 'C-12,5',
    Ligante: 'CAP 50/70 · 5,6 %',
    Norma: 'DNIT 031/2024-ES'
  });
  mk('rvBE', -P.W_RV / 2, 0, b2, b3, 0x2e3133, { roughness: 0.78 }, 'Revestimento em CBUQ (faixa esquerda)', {
    Espessura: '5 cm',
    Faixa: 'C-12,5',
    Ligante: 'CAP 50/70 · 5,6 %',
    Norma: 'DNIT 031/2024-ES'
  });
  // faixa central e bordas (após o controle final)
  const lines = new THREE.Group();
  lines.name = 'sinal';
  for (let s = 4; s < P.L; s += 12) {
    const d = bx(4, 0.02, 0.12, mat(0xf2f0e6, { roughness: 0.6 }), wx(s), wy(b3(s)) + 0.012, 0);
    d.castShadow = false;
    lines.add(d);
  }
  [-1, 1].forEach(sd => {
    const l = bx(P.L, 0.02, 0.1, mat(0xf2f0e6), 0, 0, sd * (P.W_RV / 2 - 0.15));
    l.castShadow = false;
    l.position.set(0, wy(b3(150)) + 0.012, sd * (P.W_RV / 2 - 0.15));
    l.rotation.z = Math.atan(P.GRI);
    lines.add(l);
  });
  PAV.sinal = lines;
  LAY.pavimento.add(lines);
}

export function updatePavement(st) {
  const cut = (k, f) => {
    const p = PAV[k];
    p.material.clippingPlanes[0].constant = f <= 0.01 ? -999 : wx(f);
    p.visible = f > 0.01;
  };
  cut('sb', st.sb);
  cut('ba', st.ba);
  // a imprimação some sob a pintura, e a pintura some sob o CBUQ
  cut('impBD', st.impBD);
  cut('impBE', st.impBE);
  cut('pinBD', st.pinBD);
  cut('pinBE', st.pinBE);
  cut('rvBD', st.rvBD);
  cut('rvBE', st.rvBE);
  const s16 = M.svc.find(s => s.id === 'S16');
  PAV.sinal.visible = st.d >= s16.b - 0.3;
}
