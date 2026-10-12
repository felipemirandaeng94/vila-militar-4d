// Som ambiente da obra (Fase 8): motores a diesel, bipe de ré, rolo vibratório e usina, com volume pela distância à
// câmera e posição esquerda/direita na tela. Nada é criado nem baixado antes do clique no botão de som (política de
// reprodução automática dos navegadores e escolha do usuário). Os áudios são CC0 do Freesound (public/sons/, créditos
// em assets/CREDITOS.md); se um arquivo faltar, só aquele som fica mudo.
//
// Cada som tem poucas vozes em laço (loop) fixas; a cada 0,25 s as vozes são atribuídas às fontes ativas mais próximas
// da câmera, e o volume e a posição mudam com rampas curtas (sem estalos).
import * as THREE from 'three';
import { ST } from '../estado.js';
import { cena } from './renderizador.js';
import { USI } from './canteiro.js';
import { EQ, OPER } from './equipamentos.js';
import { volumePelaDistancia } from './efeitosRegras.js';

const BASE = import.meta.env.BASE_URL + 'sons/';
// arquivo, número de vozes, volume relativo, distância de referência e alcance (m)
const SONS = {
  diesel: { arquivo: 'motor-diesel.mp3', vozes: 4, ganho: 0.5, ref: 15, max: 400 },
  re: { arquivo: 'bipe-re.mp3', vozes: 2, ganho: 0.35, ref: 12, max: 350 },
  rolo: { arquivo: 'rolo-vibratorio.mp3', vozes: 2, ganho: 0.45, ref: 12, max: 350 },
  usina: { arquivo: 'usina.mp3', vozes: 1, ganho: 0.6, ref: 40, max: 900 }
};
const VIBRA = new Set(['pe', 'liso', 'tandem', 'placa']);
const SEM_MOTOR = new Set(['tripod', 'prisma', 'tripeRe']);
const PESADA = new Set(['exc', 'dozer', 'mill', 'paver', 'grader', 'loader']);

// carregados: sons decodificados; ativos: vozes com volume no último passo (inspeção e testes de navegador)
export const som = { ligado: false, volume: 0.7, carregando: false, carregados: [], ativos: 0 };
let ctx = null,
  mestre = null;
const vozes = {};
let espera = 0;

async function carregar(nome) {
  const s = SONS[nome];
  try {
    const r = await fetch(BASE + s.arquivo);
    if (!r.ok) throw new Error(r.status);
    const buf = await ctx.decodeAudioData(await r.arrayBuffer());
    vozes[nome] = Array.from({ length: s.vozes }, (_, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      const pan = ctx.createStereoPanner();
      src.connect(g).connect(pan).connect(mestre);
      // vozes do mesmo som começam em pontos diferentes do laço: não soam em fase
      src.start(0, (buf.duration * i) / s.vozes);
      return { src, g, pan };
    });
    som.carregados.push(nome);
  } catch (e) {
    console.warn(`Som "${nome}" indisponível (${s.arquivo}):`, e.message || e);
    vozes[nome] = [];
  }
}

/** Liga ou desliga o som; a primeira vez cria o contexto de áudio e carrega os arquivos (chamar num clique). */
export async function definirSom(on) {
  som.ligado = on;
  if (!on) {
    if (ctx) await ctx.suspend();
    return;
  }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      som.ligado = false;
      return;
    }
    ctx = new AC();
    mestre = ctx.createGain();
    mestre.gain.value = som.volume;
    mestre.connect(ctx.destination);
    som.carregando = true;
    await Promise.all(Object.keys(SONS).map(carregar));
    som.carregando = false;
  }
  if (som.ligado) await ctx.resume();
}
export function definirVolume(v) {
  som.volume = v;
  if (mestre) mestre.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

// fontes ativas de cada som: { p (posição no mundo), k (volume relativo), taxa (velocidade de reprodução) }
const _f = new THREE.Vector3();
function fontes() {
  const out = { diesel: [], re: [], rolo: [], usina: [] };
  for (const e of EQ) {
    if (!e.o.visible || !e.o.userData.ativo || SEM_MOTOR.has(e.tipo)) continue;
    const p = e.o.position;
    // máquinas pesadas soam mais graves e mais altas
    out.diesel.push({ p, k: PESADA.has(e.tipo) ? 1 : 0.75, taxa: PESADA.has(e.tipo) ? 0.85 : 1 });
    if (VIBRA.has(e.tipo) && ST.playing) out.rolo.push({ p, k: 1, taxa: 1 });
    // ré: deslocamento contra a frente da máquina (+x local)
    if (ST.playing && e.sx != null) {
      _f.set(1, 0, 0).applyQuaternion(e.o.quaternion);
      const dx = p.x - e.sx,
        dz = p.z - e.sz;
      if (Math.hypot(dx, dz) > 0.01 && dx * _f.x + dz * _f.z < 0) out.re.push({ p, k: 1, taxa: 1 });
    }
    e.sx = p.x;
    e.sz = p.z;
  }
  if (OPER.usina && USI.g) out.usina.push({ p: USI.g.position, k: 1, taxa: 1 });
  return out;
}

const _d = new THREE.Vector3(),
  _r = new THREE.Vector3();
export function atualizarSom(dt) {
  if (!ctx || !som.ligado || ctx.state !== 'running') return;
  espera -= dt;
  if (espera > 0) return;
  espera = 0.25;
  const cam = cena.camera;
  _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
  const t = ctx.currentTime;
  const fs = fontes();
  som.ativos = 0;
  for (const [nome, s] of Object.entries(SONS)) {
    const vs = vozes[nome];
    if (!vs || !vs.length) continue;
    // fontes mais próximas da câmera ficam com as vozes
    const lista = fs[nome]
      .map(f => ({ ...f, dist: cam.position.distanceTo(f.p) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, vs.length);
    vs.forEach((v, i) => {
      const f = lista[i];
      const alvo = f && !(ST.lay.equip === false && nome !== 'usina') ? s.ganho * f.k * volumePelaDistancia(f.dist, s.ref, s.max) : 0;
      v.g.gain.setTargetAtTime(alvo, t, 0.12);
      if (alvo > 0.001) som.ativos++;
      if (f) {
        _d.copy(f.p).sub(cam.position).normalize();
        v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, _d.dot(_r))) * 0.8, t, 0.12);
        v.src.playbackRate.setTargetAtTime(f.taxa, t, 0.3);
      }
    });
  }
}
