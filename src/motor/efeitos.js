// Efeitos de partículas (Fase 8): poeira atrás das máquinas em terra ou brita seca, fumaça da chaminé da usina, vapor
// sobre o CBUQ recém-lançado, jato de água do caminhão-pipa, leque de ligante do espargidor e exaustão dos motores.
// Um único THREE.Points com capacidade fixa (máximo do perfil de qualidade) e simulação simples na CPU: cada partícula
// tem posição, velocidade, idade, vida, tamanho inicial e final, cor, opacidade, arrasto e gravidade. O sprite é um disco
// suave desenhado no shader (sem textura); o tamanho é em metros, com perspectiva. As regras de cada efeito (o que
// acontece em cada estado da obra) estão em efeitosRegras.js.
import * as THREE from 'three';
import { P } from '../dominio/geometria.js';
import { ST } from '../estado.js';
import { cena, registrarVegetacao } from './renderizador.js';
import { mundo, wy, girar } from './base.js';
import { diaRep, superficie } from './pavimento.js';
import { USI, chamineDaUsina } from './canteiro.js';
import { EQ, OPER, comprimento } from './equipamentos.js';
import { chao, levantaPoeira, taxaPoeira, vapor, ALCANCE_PIPA } from './efeitosRegras.js';

// ligado pelo usuário (Visualização) e orçamento do perfil
export const efeitos = { ligado: true, max: 1800, taxa: 0.7, vivas: 0 };

// vento leve (m/s, mundo): a fumaça e a poeira derivam para o mesmo lado
const VENTO = new THREE.Vector3(1.8, 0, 0.8);
// tipos de partícula: cor (linear), opacidade, tamanho inicial e final (m), vida (s), arrasto (1/s), gravidade (m/s²) e
// expoente do desvanecimento (padrão 2; 1 = some mais devagar)
const TIPOS = {
  terra: { cor: [0.42, 0.29, 0.2], a: 0.4, t0: 0.7, t1: 4, vida: 2.6, arrasto: 1.6, g: -0.15 },
  brita: { cor: [0.5, 0.47, 0.42], a: 0.36, t0: 0.7, t1: 3.8, vida: 2.4, arrasto: 1.6, g: -0.15 },
  // pluma da chaminé (filtro de mangas): sobretudo vapor d'água, clara, que sobe e se inclina com o vento
  fumaca: { cor: [0.6, 0.6, 0.59], a: 0.36, t0: 1, t1: 7, vida: 14, arrasto: 0.25, g: 0.3, queda: 1 },
  vapor: { cor: [0.95, 0.95, 0.95], a: 0.42, t0: 0.6, t1: 2.8, vida: 2.8, arrasto: 0.8, g: 0.35 },
  agua: { cor: [0.7, 0.76, 0.8], a: 0.5, t0: 0.14, t1: 0.3, vida: 0.7, arrasto: 0.4, g: -9.8 },
  // névoa dos jatos: gotas finas que ficam no ar e tornam o leque visível de longe
  nevoa: { cor: [0.82, 0.85, 0.88], a: 0.2, t0: 0.4, t1: 1.8, vida: 1.3, arrasto: 2, g: -0.8 },
  cm30: { cor: [0.06, 0.045, 0.03], a: 0.6, t0: 0.1, t1: 0.2, vida: 0.4, arrasto: 0.2, g: -9.8 },
  rr: { cor: [0.2, 0.12, 0.06], a: 0.6, t0: 0.1, t1: 0.2, vida: 0.4, arrasto: 0.2, g: -9.8 },
  nevoaLigante: { cor: [0.34, 0.27, 0.2], a: 0.22, t0: 0.3, t1: 1.2, vida: 0.9, arrasto: 2.5, g: -0.6 },
  exaustao: { cor: [0.1, 0.1, 0.1], a: 0.26, t0: 0.25, t1: 1.4, vida: 1.6, arrasto: 0.9, g: 0.4 }
};
const ESPACO = 4000; // capacidade dos buffers (o máximo do perfil alta)

let pontos = null,
  material = null;
// estado das partículas (estrutura de arrays): posição e velocidade (3), idade, vida, tamanhos, opacidade, arrasto, g
const pos = new Float32Array(ESPACO * 3),
  vel = new Float32Array(ESPACO * 3),
  idade = new Float32Array(ESPACO),
  vida = new Float32Array(ESPACO),
  t0 = new Float32Array(ESPACO),
  t1 = new Float32Array(ESPACO),
  a0 = new Float32Array(ESPACO),
  arrasto = new Float32Array(ESPACO),
  grav = new Float32Array(ESPACO),
  queda = new Float32Array(ESPACO);
// atributos enviados à GPU
let aTam = null,
  aCor = null,
  aSem = null,
  aPos = null;
let n = 0;

const VERT = /* glsl */ `
attribute float aTam;
attribute vec4 aCor;
attribute float aSem;
uniform float uEscala;
varying vec4 vCor;
varying float vSem;
#include <common>
#include <fog_pars_vertex>
void main() {
  vCor = aCor;
  vSem = aSem;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aTam * uEscala / max(0.5, -mvPosition.z);
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
varying vec4 vCor;
varying float vSem;
#include <common>
#include <fog_pars_fragment>
float ruidoP(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = dot(c, c);
  if (r > 1.0) discard;
  // disco suave com miolo de ruído (semente por partícula): tufos irregulares, não bolas
  vec2 q = c * 2.2 + vSem * 17.0;
  float nz = 0.65 * ruidoP(q) + 0.35 * ruidoP(q * 2.3 + 5.1);
  float a = vCor.a * (1.0 - smoothstep(0.0, 1.0, r)) * smoothstep(0.15, 0.75, nz + 0.35 * (1.0 - r));
  gl_FragColor = vec4(vCor.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildEfeitos() {
  const geo = new THREE.BufferGeometry();
  aPos = new THREE.BufferAttribute(new Float32Array(ESPACO * 3), 3).setUsage(THREE.DynamicDrawUsage);
  aTam = new THREE.BufferAttribute(new Float32Array(ESPACO), 1).setUsage(THREE.DynamicDrawUsage);
  aCor = new THREE.BufferAttribute(new Float32Array(ESPACO * 4), 4).setUsage(THREE.DynamicDrawUsage);
  aSem = new THREE.BufferAttribute(new Float32Array(ESPACO), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('aSem', aSem);
  geo.setAttribute('aTam', aTam);
  geo.setAttribute('aCor', aCor);
  geo.setDrawRange(0, 0);
  material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uEscala: { value: 500 } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true
  });
  pontos = new THREE.Points(geo, material);
  pontos.frustumCulled = false;
  pontos.renderOrder = 2;
  pontos.name = 'efeitos';
  cena.scene.add(pontos);
  registrarVegetacao(p => {
    efeitos.max = Math.min(ESPACO, (p.efeitos && p.efeitos.max) || 1800);
    efeitos.taxa = (p.efeitos && p.efeitos.taxa) || 0.7;
    if (n > efeitos.max) n = efeitos.max;
  });
}

/** Liga ou desliga os efeitos (escolha do usuário); desligados, as partículas somem e nada é simulado. */
export function definirEfeitos(on) {
  efeitos.ligado = on;
  if (!on) n = 0;
  if (pontos) pontos.visible = on;
}

// ---------- emissão ----------
const R = () => Math.random();
const RS = () => Math.random() * 2 - 1;
function emitir(tipo, x, y, z, vx, vy, vz, escala = 1) {
  if (n >= efeitos.max) return;
  const T = TIPOS[tipo],
    i = n++;
  pos[i * 3] = x;
  pos[i * 3 + 1] = y;
  pos[i * 3 + 2] = z;
  vel[i * 3] = vx;
  vel[i * 3 + 1] = vy;
  vel[i * 3 + 2] = vz;
  idade[i] = 0;
  vida[i] = T.vida * (0.75 + 0.5 * R());
  t0[i] = T.t0 * escala;
  t1[i] = T.t1 * escala * (0.8 + 0.4 * R());
  a0[i] = T.a;
  arrasto[i] = T.arrasto;
  grav[i] = T.g;
  queda[i] = T.queda || 2;
  // variação de tom por partícula (±6%)
  const k = 0.94 + 0.12 * R();
  aCor.array[i * 4] = T.cor[0] * k;
  aCor.array[i * 4 + 1] = T.cor[1] * k;
  aCor.array[i * 4 + 2] = T.cor[2] * k;
  aSem.array[i] = R();
}
// número de partículas a emitir neste quadro para uma taxa (por segundo), com o resto sorteado
const quantas = (taxa, dt) => {
  const q = taxa * dt;
  return Math.floor(q) + (R() < q - Math.floor(q) ? 1 : 0);
};

// ponto no referencial de uma máquina (frente em +x) para o mundo; as camadas da cena não têm transformação, e a matriz
// local da máquina é atualizada uma vez por quadro (em emitirMaquinas)
const _v = new THREE.Vector3(),
  _w = new THREE.Vector3();
const ponto = (e, x, y, z, v = _v) => v.set(x, y, z).applyMatrix4(e.o.matrix);

// chão sob uma estaca e afastamento no dia d (zona e dias das camadas)
function zona(s, z) {
  const c = P.CANT;
  if (s >= c.s0 && s <= c.s1 && z >= Math.min(c.z0, c.z1) && z <= Math.max(c.z0, c.z1)) return 'canteiro';
  if (s < 0 || s > P.L) return 'via';
  const az = Math.abs(z);
  if (az <= P.W_RV / 2) return 'pista';
  if (az <= P.W_CX / 2) return 'lateral';
  // faixa de desvio provisório, sem revestimento, à esquerda da via (equipamentos.js, ZD)
  if (z < -P.Z_VIA && z > -(P.Z_VIA + 9)) return 'desvio';
  return 'via';
}
const CAMADAS = ['remocao', 'regularizacao', 'substituicao', 'subBase', 'base', 'sarjeta'];
function chaoEm(s, z, d) {
  const zn = zona(s, z);
  const dias = {};
  if (zn === 'pista' || zn === 'lateral') {
    for (const k of CAMADAS) dias[k] = diaRep(k, s);
    const fx = z >= 0 ? 'BD' : 'BE';
    for (const k of ['imprimacao', 'pintura', 'cbuq']) dias[k] = diaRep(k, s, fx);
  }
  return chao(zn, dias, d);
}

// máquinas que levantam poeira trabalhando o solo mesmo paradas; as que não têm motor ou não rodam no chão
const TRABALHA = new Set(['exc', 'dozer', 'grader', 'loader']);
const SEM_MOTOR = new Set(['tripod', 'prisma', 'tripeRe']);
const CAMINHAO = new Set(['bascula', 'pipa', 'espargidor', 'faixas', 'munck', 'apoio', 'prova', 'betoneira']);

function emitirMaquinas(d, dt, playing) {
  const taxa = efeitos.taxa;
  // pipas em serviço: molham o chão em torno
  const pipas = EQ.filter(e => e.tipo === 'pipa' && e.o.userData.ativo && e.o.visible);
  for (const e of EQ) {
    const p = e.o.position;
    // velocidade pela distância percorrida no quadro (só com a obra em execução)
    const v = playing && e.px != null && dt > 0 ? Math.hypot(p.x - e.px, p.z - e.pz) / dt : 0;
    e.px = p.x;
    e.pz = p.z;
    if (!e.o.visible || !e.o.userData.ativo || SEM_MOTOR.has(e.tipo)) continue;
    e.o.updateMatrix();
    const L = comprimento(e.tipo),
      cam = CAMINHAO.has(e.tipo);
    // exaustão: chaminé atrás da cabine nos caminhões, no meio da máquina nas demais
    const ex = e.tipo === 'placa' || e.tipo === 'extrusora' ? [0, 0.7, 0.2] : cam ? [L / 2 - 2.2, 3.4, -0.9] : [-L * 0.15, 2.9, 0.5];
    for (let k = quantas((3 + Math.min(6, v)) * taxa, dt); k > 0; k--) {
      const w = ponto(e, ...ex);
      emitir('exaustao', w.x, w.y, w.z, RS() * 0.3, 1.2 + R() * 0.6, RS() * 0.3, e.tipo === 'placa' ? 0.4 : 1);
    }
    // poeira: chão seco sob a máquina (consultado a cada ~0,3 s)
    if (e.s != null && (e._chaoT == null || (e._chaoT -= dt) <= 0)) {
      const molhado = pipas.some(pp => pp !== e && pp.s != null && Math.abs(pp.s - e.s) < ALCANCE_PIPA && zona(pp.s, pp.z) === zona(e.s, e.z));
      const c = chaoEm(e.s, e.z, d);
      e._poeira = levantaPoeira(c, molhado) && e.tipo !== 'pipa' ? c.tipo : null;
      e._chaoT = 0.3;
    }
    if (e._poeira) {
      const trabalhando = TRABALHA.has(e.tipo) && playing;
      for (let k = quantas(taxaPoeira(v, trabalhando, taxa), dt); k > 0; k--) {
        const lado = R() < 0.5 ? -1 : 1;
        const w = ponto(e, -L / 2 + 0.4 + R() * 0.8, 0.25, lado * (0.9 + R() * 0.4));
        emitir(e._poeira, w.x, w.y, w.z, RS() * 0.6 + VENTO.x * 0.3, 0.4 + R() * 0.5, RS() * 0.6 + VENTO.z * 0.3);
      }
    }
    // jato de água do pipa: barra traseira em leque, para os lados e para trás
    if (e.tipo === 'pipa')
      for (let k = quantas(160 * taxa, dt); k > 0; k--) {
        const u = RS();
        const w0 = ponto(e, -L / 2 + 0.2, 0.7, u * 1.1),
          w1 = ponto(e, -L / 2 - 1.2 - R() * 1.5, 1.4 + R() * 0.8, u * 3.2, _w);
        emitir(R() < 0.3 ? 'nevoa' : 'agua', w0.x, w0.y, w0.z, (w1.x - w0.x) * 2.5, (w1.y - w0.y) * 2.5, (w1.z - w0.z) * 2.5);
      }
    // leque de ligante do espargidor: bicos ao longo da barra traseira, jatos para baixo
    if (e.tipo === 'espargidor') {
      // CM-30 na imprimação, emulsão RR na pintura de ligação (variante do GLB)
      const lig = e.sup && e.sup.userData.atual === 'rr' ? 'rr' : 'cm30';
      for (let k = quantas(220 * taxa, dt); k > 0; k--) {
        const u = RS();
        const w0 = ponto(e, -L / 2 + 0.3, 0.55, u * 1.7),
          w1 = ponto(e, -L / 2 - 0.3, -1.8, u * 1.85, _w);
        emitir(R() < 0.25 ? 'nevoaLigante' : lig, w0.x, w0.y, w0.z, (w1.x - w0.x) * 1.2, w1.y - w0.y, (w1.z - w0.z) * 1.2);
      }
    }
  }
}

// fumaça da chaminé da usina e vapor sobre o CBUQ recém-lançado
function emitirUsinaECbuq(d, dt) {
  const taxa = efeitos.taxa;
  if (OPER.usina && USI.g) {
    const ch = chamineDaUsina(),
      g = girar(USI.siloS, ch.x, ch.z);
    const x = USI.g.position.x + g.x,
      y = USI.g.position.y + ch.y,
      z = USI.g.position.z + g.z;
    for (let k = quantas(24 * taxa, dt); k > 0; k--) emitir('fumaca', x + RS() * 0.3, y, z + RS() * 0.3, RS() * 0.4, 2.2 + R(), RS() * 0.4);
  }
  const pv = OPER.paving;
  if (pv) {
    const zf = pv.faixa === 'BD' ? 1.75 : -1.75;
    // amostras no trecho atrás da vibroacabadora; cada uma emite com a intensidade do vapor da idade do CBUQ ali
    for (let k = quantas(220 * taxa, dt); k > 0; k--) {
      const s = pv.s + 1 - R() * 45,
        z = zf + RS() * 1.7;
      const iv = vapor(d - diaRep('cbuq', s, pv.faixa));
      if (iv <= 0 || R() > iv) continue;
      const p = mundo(s, z);
      // nasce acima do chão (meio tamanho): o sprite não é cortado pelo asfalto
      emitir('vapor', p.x, wy(superficie(s, z, d)) + 0.45, p.z, RS() * 0.2, 0.3 + R() * 0.3, RS() * 0.2);
    }
  }
}

// ---------- simulação ----------
export function atualizarEfeitos(st, dt) {
  if (!pontos) return;
  const ligado = efeitos.ligado && ST.lay.equip !== false;
  pontos.visible = ligado;
  if (!ligado) {
    n = 0;
    efeitos.vivas = 0;
    return;
  }
  if (dt > 0) {
    emitirMaquinas(st.d, dt, ST.playing);
    emitirUsinaECbuq(st.d, dt);
  }
  // integração explícita; as mortas são trocadas pela última viva
  const vx = VENTO.x,
    vz = VENTO.z;
  for (let i = 0; i < n;) {
    idade[i] += dt;
    if (idade[i] >= vida[i]) {
      const j = --n;
      if (i !== j) copiar(j, i);
      continue;
    }
    const f = Math.exp(-arrasto[i] * dt);
    const i3 = i * 3;
    // o arrasto puxa a velocidade horizontal para a do vento
    vel[i3] = vx + (vel[i3] - vx) * f;
    vel[i3 + 1] = vel[i3 + 1] * f + grav[i] * dt;
    vel[i3 + 2] = vz + (vel[i3 + 2] - vz) * f;
    pos[i3] += vel[i3] * dt;
    pos[i3 + 1] += vel[i3 + 1] * dt;
    pos[i3 + 2] += vel[i3 + 2] * dt;
    i++;
  }
  // atributos: posição, tamanho (cresce com a idade) e opacidade (entra rápido e some no fim)
  const ap = aPos.array,
    at = aTam.array,
    ac = aCor.array;
  for (let i = 0; i < n; i++) {
    const u = idade[i] / vida[i];
    ap[i * 3] = pos[i * 3];
    ap[i * 3 + 1] = pos[i * 3 + 1];
    ap[i * 3 + 2] = pos[i * 3 + 2];
    at[i] = t0[i] + (t1[i] - t0[i]) * Math.sqrt(u);
    ac[i * 4 + 3] = a0[i] * Math.min(1, u * 8) * Math.pow(1 - u, queda[i]);
  }
  const g = pontos.geometry;
  g.setDrawRange(0, n);
  for (const [a, k] of [
    [aPos, 3],
    [aTam, 1],
    [aCor, 4],
    [aSem, 1]
  ]) {
    a.clearUpdateRanges();
    if (n) a.addUpdateRange(0, n * k);
    a.needsUpdate = true;
  }
  efeitos.vivas = n;
  // escala do tamanho em pixels: altura do buffer de desenho / (2 tan(fov/2))
  const { camera, renderer } = cena;
  material.uniforms.uEscala.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
function copiar(j, i) {
  for (let k = 0; k < 3; k++) {
    pos[i * 3 + k] = pos[j * 3 + k];
    vel[i * 3 + k] = vel[j * 3 + k];
  }
  idade[i] = idade[j];
  vida[i] = vida[j];
  t0[i] = t0[j];
  t1[i] = t1[j];
  a0[i] = a0[j];
  arrasto[i] = arrasto[j];
  grav[i] = grav[j];
  queda[i] = queda[j];
  for (let k = 0; k < 3; k++) aCor.array[i * 4 + k] = aCor.array[j * 4 + k];
  aSem.array[i] = aSem.array[j];
}
