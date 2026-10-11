// Seleção por clique no modelo: ensaio, equipamento, terreno ou objeto com informação.
// O motor não mexe nos painéis: ele emite eventos que a interface trata ('info', 'selecionarEnsaio', 'semSelecao').
import * as THREE from 'three';
import { P, nat, sg, dFill } from '../dominio/geometria.js';
import { nf } from '../dominio/util.js';
import { estStr } from '../dominio/calendario.js';
import { activeSvc } from '../dominio/cronograma.js';
import { stateAt } from '../dominio/frentes.js';
import { terrainC } from '../dominio/cotas.js';
import { M, ST, emit } from '../estado.js';
import { cena } from './renderizador.js';
import { setFollow } from './camera.js';

const ray = new THREE.Raycaster(),
  mouse = new THREE.Vector2();

export function iniciarSelecao() {
  const el = cena.renderer.domElement;
  let pd = null;
  el.addEventListener('pointerdown', e => {
    pd = [e.clientX, e.clientY];
  });
  el.addEventListener('pointerup', e => {
    if (pd && Math.hypot(e.clientX - pd[0], e.clientY - pd[1]) < 5) pick(e);
  });
  // girar a câmera com o mouse interrompe o acompanhamento da frente
  cena.controls.addEventListener('start', () => {
    if (ST.follow) setFollow(false);
  });
}

function pick(e) {
  const { renderer, camera, root } = cena;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const objs = [];
  root.traverseVisible(o => {
    if (o.isMesh) objs.push(o);
  });
  // ignora a parte de uma camada que ainda não foi executada (além do plano de corte)
  const hits = ray
    .intersectObjects(objs, false)
    .filter(
      h =>
        !(
          h.object.material &&
          h.object.material.clippingPlanes &&
          h.object.material.clippingPlanes[0] &&
          h.point.x > h.object.material.clippingPlanes[0].constant + 0.01
        )
    );
  if (!hits.length) {
    emit('semSelecao');
    return;
  }
  const o = hits[0].object;
  if (o.userData.test) {
    emit('selecionarEnsaio', o.userData.test, false);
    return;
  }
  let p = o;
  while (p && !p.userData.eq && p.parent) p = p.parent;
  if (p && p.userData.eq) {
    infoEquipamento(p.userData.eq);
    return;
  }
  if (o.userData.terrain) {
    infoTerreno(hits[0].point);
    return;
  }
  if (o.userData.info) emit('info', o.userData.info.t, o.userData.info.d);
}

function infoTerreno(pt) {
  const s = pt.x + P.L / 2,
    z = pt.z,
    st = stateAt(M.frentes, ST.day),
    n = nat(s, z),
    y = terrainC(M.q, s, z, st);
  const d = {
    Estaca: s >= 0 && s <= P.L ? estStr(s) : 'fora do trecho',
    Afastamento: nf(z, 1) + ' m',
    'Cota do terreno natural': nf(n, 2) + ' m',
    'Cota atual': nf(y, 2) + ' m'
  };
  let t = 'Terreno natural';
  if (s >= 0 && s <= P.L && Math.abs(z) < 15) {
    d['Cota de projeto (subleito)'] = nf(sg(s), 2) + ' m';
    const h = n - sg(s);
    t = h > 0 ? 'Seção em corte' : 'Seção em aterro';
    d[h > 0 ? 'Altura de corte no eixo' : 'Altura de aterro no eixo'] = nf(Math.abs(nat(s, 0) - sg(s)), 2) + ' m';
    if (y > n + 0.02)
      d.Camada = st.cf > 0 && y > dFill(s, z) - P.E_CF + 0.01 ? 'Camada final do aterro (solo de jazida)' : 'Corpo do aterro (material do corte)';
  }
  emit('info', t, d);
}

function infoEquipamento(e) {
  const d = {};
  const svcs = e.use.map(id => M.svc.find(s => s.id === id)).filter(Boolean);
  const now = svcs.find(s => activeSvc(M.svc, s.id, ST.day));
  d.Situação = now ? 'Em serviço: ' + now.nome : 'Estacionado no canteiro';
  d['Usado em'] = svcs.map(s => s.id).join(', ');
  emit('info', e.nome, d);
}
