// Vistas da câmera, animação entre vistas, corte em perfil e acompanhamento da frente de serviço.
import * as THREE from 'three';
import { P, gr, noCanteiro } from '../dominio/geometria.js';
import { M, ST, emit } from '../estado.js';
import { wy, mundo, girar } from './base.js';
import { cena } from './renderizador.js';
import { malhaTerreno } from './terreno.js';
import { CAMADAS, superficie } from './pavimento.js';
import { frentesAtivas } from './equipamentos.js';
import { SOLTOS } from './soltos.js';

let camAnim = null;
// plano do corte em perfil: vertical, pela corda do eixo (início → fim); some o lado direito
const CLIPZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
function ajustarCorte() {
  const a = mundo(0),
    b = mundo(P.L),
    l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  // normal à direita da corda: (-tz, tx); o plano passa pelo meio do eixo (origem do mundo)
  const nx = -(b.z - a.z) / l,
    nz = (b.x - a.x) / l;
  CLIPZ.normal.set(-nx, 0, -nz);
  CLIPZ.constant = 0;
}
// ponto do mundo na estaca s, afastamento z e altura y
const pm = (s, z, y) => {
  const p = mundo(s, z);
  return [p.x, y, p.z];
};
// câmera a partir do alvo, com o deslocamento (dx ao longo do eixo, dz à direita) girado pelo rumo na estaca s
const desde = (t, s, dx, dy, dz) => {
  const g = girar(s, dx, dz);
  return [t[0] + g.x, t[1] + dy, t[2] + g.z];
};
// vistas: início do trecho (canteiro e frente 1), planta de todo o trecho, perfil e usina
const VIEWS = () => {
  const yc = wy(P.CANT.cota),
    // vista inicial: canteiro e usina (a noroeste) e o início do trecho
    iso = pm((P.CANT.s1 + 120) / 2, (P.CANT.z0 + P.CANT.z1) / 3, wy(gr(0))),
    perfil = pm(220, 0, wy(gr(220)) + 8),
    u = noCanteiro(52, -82),
    ucam = noCanteiro(115, -28),
    usina = pm(u.s, u.z, yc - 1.3);
  return {
    iso: { p: desde(iso, 0, -220, 210, 330), t: iso },
    top: { p: [0.01, 1350, 0.01], t: [0, 0, -30] },
    perfil: { p: desde(perfil, 220, 0, 8, 290), t: perfil },
    usina: { p: pm(ucam.s, ucam.z, yc + 28.7), t: usina },
    frente: null
  };
};

// vista em perfil: corta o modelo no eixo e esconde o entorno, o canteiro e a usina
export function setProfileClip(on) {
  ST.profile = on;
  ajustarCorte();
  const apply = m => {
    if (!m) return;
    const cp = (m.clippingPlanes || []).filter(p => p !== CLIPZ);
    if (on) cp.push(CLIPZ);
    m.clippingPlanes = cp;
    m.needsUpdate = true;
  };
  apply(malhaTerreno().material);
  for (const o of CAMADAS) apply(o.material);
  // leiras compartilham o material por serviço: aplicar uma vez basta
  for (const m of new Set(SOLTOS.map(o => o.material))) apply(m);
  ['entorno', 'canteiro', 'usina'].forEach(k => (cena.LAY[k].visible = !on && ST.lay[k] !== false));
}

export function setFollow(on) {
  ST.follow = on;
  emit('seguir', on);
}

export function setView(v, instant) {
  const { camera, controls } = cena;
  ST.view = v;
  const vv = VIEWS()[v];
  ST.vexag = v === 'perfil' ? 4 : 1;
  setProfileClip(v === 'perfil');
  if (v === 'frente') {
    setFollow(true);
    return;
  }
  const p = new THREE.Vector3(...vv.p),
    t = new THREE.Vector3(...vv.t);
  if (instant) {
    camera.position.copy(p);
    controls.target.copy(t);
    camera.up.set(0, 1, 0);
    controls.update();
    return;
  }
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p, t, k: 0 };
}

export function animarPara(target, desloc) {
  const { camera, controls } = cena;
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p: target.clone().add(desloc), t: target, k: 0 };
}
// aproxima a câmera de um ponto da obra (estaca s, cota y, afastamento z)
export function focarPonto(s, y, z) {
  const p = mundo(s, z),
    g = girar(s, -22, 26);
  animarPara(new THREE.Vector3(p.x, wy(y), p.z), new THREE.Vector3(g.x, 16, g.z));
}

// posiciona a câmera de imediato olhando para a estaca s e o afastamento z
export function camAt(s, z, dx, dy, dz) {
  const { camera, controls } = cena;
  camAnim = null;
  ST.follow = false;
  const y = wy(superficie(s, z, ST.day)),
    p = mundo(s, z),
    g = girar(s, dx, dz);
  controls.target.set(p.x, y, p.z);
  camera.position.set(p.x + g.x, y + dy, p.z + g.z);
  controls.update();
}

// frente de serviço principal ativa no dia (para o rótulo e para a câmera que segue a frente)
export function frontPoint(st) {
  const a = frentesAtivas(st.d)[0];
  if (a) return { s: a.s, z: 0, nome: a.svc.nome, id: a.svc.id };
  const us = M.svc.find(s => s.meta && ['usina', 'dosagem'].includes(s.meta.representacao) && st.d >= s.a && st.d < s.b);
  if (us) {
    const c = noCanteiro(60, -80);
    return { s: c.s, z: c.z, nome: us.nome, id: us.id };
  }
  return null;
}

// câmera acompanha a frente ativa
export function seguirFrente(st, fp) {
  if (!ST.follow || !fp) return;
  const { camera, controls } = cena;
  const p = mundo(fp.s, fp.z || 0);
  const tg = new THREE.Vector3(p.x, wy(superficie(fp.s, fp.z || 0, st.d)), p.z);
  const off = camera.position.clone().sub(controls.target);
  controls.target.lerp(tg, 0.08);
  camera.position.copy(controls.target).add(off);
}

// passo da animação da câmera e do exagero vertical (a cada quadro)
export function passoCamera(dt) {
  const { camera, controls, root } = cena;
  if (camAnim) {
    camAnim.k = Math.min(1, camAnim.k + dt * 1.4);
    const e = camAnim.k < 0.5 ? 2 * camAnim.k * camAnim.k : 1 - Math.pow(-2 * camAnim.k + 2, 2) / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t, e);
    if (camAnim.k >= 1) camAnim = null;
  }
  root.scale.y += (ST.vexag - root.scale.y) * 0.1;
}
export const extensaoDoTrecho = () => P.L;
