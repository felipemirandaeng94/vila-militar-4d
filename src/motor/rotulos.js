// Rótulos 2D sobre o modelo: estacas a cada 100 m, frentes de serviço com o estado do desvio, áreas do canteiro,
// frente ativa e laboratório em ensaio.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { P, nat, gr, noCanteiro, acessoDoCanteiro } from '../dominio/geometria.js';
import { estadoDoDesvio } from '../dominio/frentes.js';
import { M, ST, D } from '../estado.js';
import { wy, mat, mundo } from './base.js';
import { cena } from './renderizador.js';
import { superficie } from './pavimento.js';

export let labels = [];
let frontLbl = null,
  labLbl = null,
  frentesLbl = [];

function lbl(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.innerHTML = text;
  return new CSS2DObject(el);
}

export function buildLabels() {
  const LAY = cena.LAY;
  labels.forEach(l => {
    l.parent && l.parent.remove(l);
  });
  LAY.rotulos.clear();
  labels = [];
  // piquetes a cada estaca (instanciados) e rótulo a cada 100 m
  const n = Math.floor(P.L / P.EST) + 1;
  const piq = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), mat(0xd9a21b), n);
  const o = new THREE.Object3D();
  const zp = P.W_CX / 2 + 3;
  for (let e = 0; e < n; e++) {
    const s = e * P.EST,
      p = mundo(s, zp);
    o.position.set(p.x, wy(nat(s, zp)) + 0.6, p.z);
    o.updateMatrix();
    piq.setMatrixAt(e, o.matrix);
    if (e % 5 === 0) {
      const L = lbl('Est. ' + e + (e === 0 ? ' <small>0+00</small>' : ''));
      L.position.set(p.x, wy(nat(s, zp)) + 1.8, p.z);
      LAY.rotulos.add(L);
      labels.push(L);
    }
  }
  piq.castShadow = false;
  LAY.rotulos.add(piq);
  // rótulo na estaca s e afastamento z (coordenadas da obra), y no mundo
  const add = (txt, s, y, z, cls, site) => {
    const L = lbl(txt, cls);
    const p = mundo(s, z);
    L.position.set(p.x, y, p.z);
    L.userData.site = !!site;
    LAY.rotulos.add(L);
    labels.push(L);
    return L;
  };
  const yc = wy(P.CANT.cota);
  const noC = (txt, s, dy, z, cls) => {
    const c = noCanteiro(s, z);
    return add(txt, c.s, yc + dy, c.z, cls, 1);
  };
  noC('Usina de CBUQ', 60, 15, -80, 'room');
  noC('Laboratório', 20, 4.6, -48, 'room');
  noC('Estoques de agregados', 112, 5, -94, '');
  noC('Estoque de fresado', 22, 5, -104, '');
  const acs = acessoDoCanteiro(),
    ac = acs[Math.floor(acs.length / 2)];
  add('Acesso ao canteiro', ac.s, wy(nat(ac.s, ac.z)) + 4, ac.z, '', 1);
  add(D.local ? D.local.meta.via : 'Via existente', -40, wy(nat(-40, 0)) + 6, 0, '', 1);
  // uma etiqueta por frente, com o estado do desvio de tráfego
  frentesLbl = M.frentes.map(f => {
    const s = (f.s0 + f.s1) / 2;
    const L = add('', s, wy(gr(s)) + 9, -P.W_CX / 2 - 6, 'frente', 1);
    L.userData.frente = f;
    return L;
  });
  frontLbl = add('', 0, 0, 0, 'front');
  frontLbl.element.style.display = 'none';
  labLbl = noC('', 20, 9.5, -48, 'lab');
  labLbl.element.style.display = 'none';
}

export function mostrarRotulos(on) {
  labels.forEach(l => (l.visible = on));
}

// fp: frente ativa ({ s, z, nome }) ou null; curto: nome curto do serviço
export function updateLabels(st, fp, curto) {
  const ligado = ST.lay.rotulos !== false;
  if (fp && ligado) {
    const s = fp.s,
      z = fp.z || 0;
    const p = mundo(s, z);
    frontLbl.position.set(p.x, wy(superficie(s, z, st.d)) + 7, p.z);
    frontLbl.element.textContent = curto || fp.nome;
    frontLbl.element.style.display = '';
    frontLbl.visible = true;
  } else frontLbl.visible = false;
  labLbl.visible = !!ST.labPulse && ligado && !ST.profile;
  for (const L of labels) if (L.userData.site && L !== labLbl) L.visible = ligado && !ST.profile;
  labLbl.element.textContent = 'Ensaio em andamento';
  const nomes = D.servicos.frentes.desvio.estados;
  for (const L of frentesLbl) {
    const f = L.userData.frente,
      e = estadoDoDesvio(f, st.d);
    const txt = `${f.nome} · ${nomes[e]}`;
    if (L.element.textContent !== txt) {
      L.element.textContent = txt;
      L.element.dataset.estado = e;
    }
  }
}
