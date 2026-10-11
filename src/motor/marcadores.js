// Marcadores dos pontos de ensaio de campo (verde conforme, vermelho não conforme) e anel de seleção.
import * as THREE from 'three';
import { P } from '../dominio/geometria.js';
import { M, ST } from '../estado.js';
import { wx, wy, mat, css } from './base.js';
import { cena } from './renderizador.js';

let markers = [],
  selRing = null;

export function buildMarkers() {
  const LAY = cena.LAY;
  markers.forEach(m => LAY.ensaios.remove(m));
  markers = [];
  const EXAG = ST.exag;
  const stem = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
    head = new THREE.SphereGeometry(0.42, 16, 12);
  for (const t of M.ensaios) {
    if (t.s == null) continue;
    const g = new THREE.Group();
    const c = t.ok ? css('--ok') : css('--bad');
    const st_ = new THREE.Mesh(stem, mat(0xf2f0e6));
    st_.position.y = 0.8;
    g.add(st_);
    const hd = new THREE.Mesh(head, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 }));
    hd.position.y = 1.75;
    g.add(hd);
    g.position.set(wx(t.s), wy(t.y), t.z);
    // os marcadores acompanham a espessura exagerada das camadas do pavimento
    const ex =
      t.layer === 'sb'
        ? P.E_SB * (EXAG - 1)
        : t.layer === 'ba' || t.layer === 'imp'
          ? (P.E_SB + P.E_BA) * (EXAG - 1)
          : t.layer === 'rv' || t.layer === 'pin'
            ? (t.layer === 'rv' ? P.E_PAV : P.E_SB + P.E_BA) * (EXAG - 1)
            : 0;
    g.position.y += ex;
    g.traverse(o => {
      if (o.isMesh) o.userData.test = t;
    });
    g.userData.test = t;
    g.userData.head = hd;
    markers.push(g);
    LAY.ensaios.add(g);
  }
  if (!selRing) {
    selRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    selRing.rotation.x = Math.PI / 2;
    LAY.ensaios.add(selRing);
  }
}

export function updateMarkers(st, clk) {
  const d = st.d;
  for (const g of markers) {
    const t = g.userData.test;
    const vis = d >= t.day && (t.until == null || d < t.until || ST.sel === t);
    g.visible = vis;
    if (vis) {
      const a = Math.min(1, (d - t.day) * 6);
      g.scale.setScalar(0.4 + 0.6 * a);
    }
  }
  // ensaios de laboratório ou de usina em andamento (o rótulo do laboratório pulsa)
  ST.labPulse = M.ensaios.filter(t => t.s == null && Math.abs(t.day - d) < 0.35).length;
  if (ST.sel && ST.sel.s != null) {
    const g = markers.find(m => m.userData.test === ST.sel);
    selRing.visible = !!g && g.visible;
    if (g) {
      selRing.position.set(g.position.x, g.position.y + 0.05, g.position.z);
      selRing.scale.setScalar(1 + 0.25 * Math.sin(clk * 5));
    }
  } else selRing.visible = false;
}
