// Seleção por clique no modelo: ensaio, equipamento, camada, elemento instanciado ou terreno.
// O motor não mexe nos painéis: emite eventos que a interface trata ('info', 'selecionarEnsaio', 'semSelecao').
import * as THREE from 'three';
import { P, nat, gr, sg } from '../dominio/geometria.js';
import { nf } from '../dominio/util.js';
import { estStr } from '../dominio/calendario.js';
import { activeSvc } from '../dominio/cronograma.js';
import { diaDoServico, frenteDaEstaca, estadoDoDesvio } from '../dominio/frentes.js';
import { M, ST, D, emit } from '../estado.js';
import { cena } from './renderizador.js';
import { obraDoMundo } from './base.js';
import { setFollow } from './camera.js';
import { repsDaEquipe } from './equipamentos.js';

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

const visivelNoDia = h => {
  const o = h.object,
    d = ST.day;
  if (o.userData.diasInst && h.instanceId != null) {
    const [a, b] = o.userData.diasInst[h.instanceId];
    return d >= a && d < b;
  }
  if (o.userData.tests && h.instanceId != null) {
    const t = o.userData.tests[h.instanceId];
    return d >= t.day && (t.until == null || d < t.until || ST.sel === t);
  }
  if (o.userData.dias) {
    const [a, b] = o.userData.dias(h.point.x + P.L / 2);
    return d >= a && d < b;
  }
  return true;
};

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
  const hits = ray.intersectObjects(objs, false).filter(visivelNoDia);
  if (!hits.length) {
    emit('semSelecao');
    return;
  }
  const h = hits[0],
    o = h.object;
  if (o.userData.tests && h.instanceId != null) {
    emit('selecionarEnsaio', o.userData.tests[h.instanceId], false);
    return;
  }
  let p = o;
  while (p && !p.userData.eq && p.parent) p = p.parent;
  if (p && p.userData.eq) {
    infoEquipamento(p.userData.eq);
    return;
  }
  const { s, z } = obraDoMundo(h.point.x, h.point.z);
  if (o.userData.terrain || (o.userData.info && s >= 0 && s <= P.L && Math.abs(z) <= P.W_CX / 2 && o.userData.dias)) {
    infoEstaca(h.point, o.userData.info);
    return;
  }
  if (o.userData.info) emit('info', o.userData.info.t, { ...o.userData.info.d, ...(s >= 0 && s <= P.L ? { Estaca: estStr(s) } : {}) });
}

// situação da estaca clicada: frente, desvio e serviços já executados ali
function infoEstaca(pt, camada) {
  const { s, z } = obraDoMundo(pt.x, pt.z),
    d = ST.day;
  const dados = { Estaca: s >= 0 && s <= P.L ? estStr(s) : 'fora do trecho', Afastamento: nf(z, 1) + ' m' };
  if (s < 0 || s > P.L || Math.abs(z) > P.W_CX / 2 + 3) {
    dados['Cota do terreno'] = nf(nat(s, z), 2) + ' m';
    if (D.local) dados.Fonte = 'MDT Lidar 2019 (IPP), suavizado';
    emit('info', 'Terreno natural', dados);
    return;
  }
  const f = frenteDaEstaca(M.frentes, s);
  if (f) {
    dados.Frente = `${f.nome} (est. ${estStr(f.s0)} a ${estStr(f.s1)})`;
    dados['Tráfego'] = D.servicos.frentes.desvio.estados[estadoDoDesvio(f, d)];
  }
  dados['Cota do pavimento'] = nf(gr(s), 2) + ' m';
  dados['Cota do subleito'] = nf(sg(s), 2) + ' m';
  const feitos = M.svc.filter(v => v.meta && v.meta.escopo === 'frente' && diaDoServico(M.svc, v.id, s) <= d);
  dados['Serviços executados aqui'] = feitos.length ? feitos.map(v => v.meta.curto || v.id).join(', ') : 'nenhum (pavimento existente)';
  emit('info', camada ? camada.t : 'Pista em obra', dados);
}

function infoEquipamento(e) {
  const reps = repsDaEquipe(e.equipe);
  const em = M.svc.filter(v => v.meta && reps.includes(v.meta.representacao) && activeSvc(M.svc, v.id, ST.day));
  emit('info', e.nome, {
    Situação: e.o.userData.ativo ? 'Em serviço' + (em.length ? ': ' + em.map(v => v.nome).join('; ') : '') : 'Estacionado no pátio do canteiro',
    Equipe: reps
      .map(r => (M.svc.find(v => v.meta && v.meta.representacao === r) || {}).id)
      .filter(Boolean)
      .join(', ')
  });
}
