// Vistas da câmera, animação entre vistas, corte em perfil e acompanhamento da frente de serviço.
import * as THREE from 'three';
import { lerp } from '../dominio/util.js';
import { activeSvc } from '../dominio/cronograma.js';
import { stateAt } from '../dominio/frentes.js';
import { M, ST, emit } from '../estado.js';
import { wx, wy } from './base.js';
import { cena } from './renderizador.js';
import { malhaTerreno } from './terreno.js';
import { PAV, surfC } from './pavimento.js';
import { liftFront, tri, frac } from './equipamentos.js';

let camAnim = null;
const CLIPZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const VIEWS = () => ({
  iso: { p: [-205, 125, 215], t: [5, 0, -18] },
  top: { p: [0.01, 470, 0.01], t: [0, 0, -30] },
  perfil: { p: [0, 22, 290], t: [0, 14, 0] },
  usina: { p: [wx(115), 34, -28], t: [wx(52), 4, -82] },
  frente: null
});

// vista em perfil: corta o modelo no eixo e esconde o entorno, o canteiro e a usina
export function setProfileClip(on) {
  ST.profile = on;
  const apply = m => {
    if (!m) return;
    const cp = (m.clippingPlanes || []).filter(p => p !== CLIPZ);
    if (on) cp.push(CLIPZ);
    m.clippingPlanes = cp;
    m.needsUpdate = true;
  };
  apply(malhaTerreno().material);
  for (const k in PAV) {
    if (PAV[k].material) apply(PAV[k].material);
  }
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

// anima a câmera até olhar para o alvo, com o deslocamento informado
export function animarPara(target, desloc) {
  const { camera, controls } = cena;
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p: target.clone().add(desloc), t: target, k: 0 };
}

// posiciona a câmera de imediato olhando para a estaca s e o afastamento z
export function camAt(s, z, dx, dy, dz) {
  const { camera, controls } = cena;
  camAnim = null;
  ST.follow = false;
  const y = wy(surfC(s, z, stateAt(M.frentes, ST.day)));
  controls.target.set(wx(s), y, z);
  camera.position.set(wx(s) + dx, y + dy, z + dz);
  controls.update();
}

// frente de serviço ativa no estado st (para o rótulo e para a câmera que segue a frente)
export function frontPoint(st) {
  const d = st.d;
  const pick_ = [
    ['S15', () => Math.max(st.rvBD, 0)],
    ['S14', () => 0],
    ['S13', () => 0],
    ['S12', () => st.ba],
    ['S11', () => st.sb],
    ['S09', () => st.reg],
    ['S08', () => lerp(M.q.sFill0, M.q.sFill1, frac(st.cf))],
    ['S07', () => liftFront(st)],
    ['S06', () => 8 + 116 * tri(st.pc * 3)],
    ['S04', () => st.limp]
  ];
  for (const [id, fn] of pick_) {
    const a = activeSvc(M.svc, id, d);
    if (!a) continue;
    let s = fn();
    if (a.lane) s = st[(id === 'S15' ? 'rv' : id === 'S14' ? 'pin' : 'imp') + a.lane];
    return { s, nome: a.s.nome, id };
  }
  const a5 = activeSvc(M.svc, 'S05', d);
  if (a5 || activeSvc(M.svc, 'S10', d)) return { s: 60, z: -80, nome: a5 ? 'Montagem da usina' : 'Calibração da usina', id: a5 ? 'S05' : 'S10' };
  return null;
}

// câmera acompanha a frente ativa
export function seguirFrente(st, fp) {
  if (!ST.follow || !fp) return;
  const { camera, controls } = cena;
  const tg = new THREE.Vector3(wx(fp.s), wy(surfC(fp.s, fp.z || 0, st)), fp.z || 0);
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

// aproxima a câmera de um ponto da obra (estaca s, cota y, afastamento z)
export function focarPonto(s, y, z) {
  animarPara(new THREE.Vector3(wx(s), wy(y), z), new THREE.Vector3(-22, 16, 26));
}
