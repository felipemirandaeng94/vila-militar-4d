// Marcadores dos pontos de ensaio de campo (verde conforme, vermelho não conforme) em InstancedMesh, com anel de seleção.
// Cada instância aparece no dia do ensaio e some quando a camada é coberta (campo "until"), exceto o ensaio selecionado.
import * as THREE from 'three';
import { sg } from '../dominio/geometria.js';
import { M, ST } from '../estado.js';
import { wx, wy, mat, css } from './base.js';
import { cena } from './renderizador.js';
import { comDias, NUNCA, diasPorInstancia } from './dias.js';

let hastes = null,
  cabecas = null,
  selRing = null,
  lista = [],
  posicoes = [],
  selAnterior = -1;

// cota exibida: as camadas do pavimento aparecem com a espessura exagerada a partir do subleito
const cotaExibida = t => (t.layer === 'nat' ? t.y : sg(t.s) + (t.y - sg(t.s)) * ST.exag);

export function buildMarkers() {
  const LAY = cena.LAY;
  for (const m of [hastes, cabecas]) if (m) LAY.ensaios.remove(m);
  lista = M.ensaios.filter(t => t.s != null);
  const n = Math.max(1, lista.length);
  const stem = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
  stem.translate(0, 0.8, 0);
  const head = new THREE.SphereGeometry(0.42, 16, 12);
  head.translate(0, 1.75, 0);
  hastes = new THREE.InstancedMesh(stem, comDias(mat(0xf2f0e6).clone(), { crescer: true }), n);
  cabecas = new THREE.InstancedMesh(
    head,
    comDias(new THREE.MeshStandardMaterial({ color: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4 }), { crescer: true }),
    n
  );
  const ok = new THREE.Color(css('--ok') || '#0c7a3a'),
    bad = new THREE.Color(css('--bad') || '#b3261e');
  const o = new THREE.Object3D();
  posicoes = [];
  lista.forEach((t, i) => {
    o.position.set(wx(t.s), wy(cotaExibida(t)), t.z);
    o.updateMatrix();
    posicoes.push(o.position.clone());
    hastes.setMatrixAt(i, o.matrix);
    cabecas.setMatrixAt(i, o.matrix);
    cabecas.setColorAt(i, t.ok ? ok : bad);
  });
  const dias = lista.map(t => [t.day, t.until != null ? t.until : NUNCA]);
  diasPorInstancia(hastes, dias);
  diasPorInstancia(cabecas, dias);
  for (const m of [hastes, cabecas]) {
    m.castShadow = false;
    m.userData.tests = lista;
    LAY.ensaios.add(m);
  }
  selAnterior = -1;
  if (!selRing) {
    selRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    selRing.rotation.x = Math.PI / 2;
    LAY.ensaios.add(selRing);
  }
}

// o ensaio selecionado continua visível depois do "until"
function manterSelecionado(i) {
  if (i === selAnterior) return;
  for (const m of [hastes, cabecas]) {
    const a = m.geometry.attributes.aDias;
    if (selAnterior >= 0) {
      const t = lista[selAnterior];
      a.setY(selAnterior, t.until != null ? t.until : NUNCA);
    }
    if (i >= 0) a.setY(i, NUNCA);
    a.needsUpdate = true;
  }
  selAnterior = i;
}

export function updateMarkers(st, clk) {
  const d = st.d;
  // ensaios de laboratório ou de usina em andamento (o rótulo do laboratório pulsa)
  ST.labPulse = M.ensaios.filter(t => t.s == null && Math.abs(t.day - d) < 0.35).length;
  const i = ST.sel ? lista.indexOf(ST.sel) : -1;
  manterSelecionado(i);
  if (i >= 0 && d >= lista[i].day) {
    selRing.visible = true;
    selRing.position.copy(posicoes[i]).add(new THREE.Vector3(0, 0.05, 0));
    selRing.scale.setScalar(1 + 0.25 * Math.sin(clk * 5));
  } else selRing.visible = false;
}
