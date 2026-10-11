// Rótulos 2D sobre o modelo: estacas, áreas do canteiro, frente ativa e laboratório em ensaio.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { P, nat, sg } from '../dominio/geometria.js';
import { ST } from '../estado.js';
import { wx, wy, mat, bx } from './base.js';
import { cena } from './renderizador.js';
import { surfC } from './pavimento.js';

export let labels = [];
let frontLbl = null,
  labLbl = null;

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
  labels = [];
  for (let e = 0; e <= P.L / P.EST; e++) {
    const s = e * P.EST;
    const stake = new THREE.Group();
    const p = bx(0.1, 1.2, 0.1, mat(0xd9a21b), 0, 0.6, 0);
    stake.add(p);
    stake.position.set(wx(s), wy(nat(s, 7.2)), 7.2);
    LAY.rotulos.add(stake);
    const L = lbl('Est. ' + e + (e === 0 ? ' <small>0+00</small>' : ''));
    L.position.set(0, 1.8, 0);
    stake.add(L);
    labels.push(L);
    stake.userData.s = s;
  }
  const add = (txt, x, y, z, cls, site) => {
    const L = lbl(txt, cls);
    L.position.set(x, y, z);
    L.userData.site = !!site;
    LAY.rotulos.add(L);
    labels.push(L);
    return L;
  };
  add('Usina de CBUQ', wx(60), wy(P.CANT.cota) + 15, -80, 'room', 1);
  add('Laboratório', wx(20), wy(P.CANT.cota) + 4.6, -48, 'room', 1);
  add('Estoques de agregados', wx(112), wy(P.CANT.cota) + 5, -94, '', 1);
  add('Jazida de empréstimo e pedreira ↑', wx(-30), wy(nat(-30, 84)) + 4, 84, '', 1);
  add('Avenida existente', wx(-30), wy(nat(-30, -130)) + 3, -130, '', 1);
  add('Trecho em corte', wx(60), wy(nat(60, 0)) + 4, 9, '');
  add('Trecho em aterro', wx(215), wy(sg(215)) + 3, 9, '');
  frontLbl = add('', 0, 0, 0, 'front');
  frontLbl.element.style.display = 'none';
  labLbl = add('', wx(20), wy(P.CANT.cota) + 9.5, -48, 'lab', 1);
  labLbl.element.style.display = 'none';
}

export function mostrarRotulos(on) {
  labels.forEach(l => (l.visible = on));
}

// fp: frente ativa ({ s, z, nome, id }) ou null; curto: nome curto do serviço
export function updateLabels(st, fp, curto) {
  if (fp && ST.lay.rotulos !== false) {
    const s = fp.s,
      z = fp.z || 0;
    frontLbl.position.set(wx(s), wy(surfC(s, z, st)) + 7, z);
    frontLbl.element.textContent = curto || fp.nome;
    frontLbl.element.style.display = '';
    frontLbl.visible = true;
  } else {
    frontLbl.visible = false;
  }
  labLbl.visible = !!ST.labPulse && ST.lay.rotulos !== false && !ST.profile;
  for (const L of labels) if (L.userData.site && L !== labLbl) L.visible = ST.lay.rotulos !== false && !ST.profile;
  labLbl.element.textContent = 'Ensaio em andamento';
}
