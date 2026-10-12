// Gramado (Fase 6): tufos de grama instanciados só perto do alvo da câmera, com densidade e raio do perfil de qualidade.
// O chão é dividido em ladrilhos de 12 m gerados sob demanda (semente por ladrilho, resultado sempre igual) e guardados;
// a cada deslocamento do alvo, os tufos dentro do raio vão para um único InstancedMesh. Os tufos encolhem perto da
// borda do raio (sem saltos), balançam com o vento e os da faixa de desvio somem na limpeza (S04).
import * as THREE from 'three';
import { comDias } from './dias.js';
import { uVento } from './arvores.js';
import { rng } from '../dominio/util.js';

const LADO = 12;
// densidade máxima dos ladrilhos (tufos/m²); o perfil desenha a fração densidade ÷ máxima
const DENS_MAX = 2.6;

// tufo: 7 folhas finas, cada uma com dois segmentos (curva), da base escura à ponta clara; normais para cima, como o chão
function tufo() {
  const pos = [],
    cor = [],
    nor = [],
    idx = [];
  const R = rng(91);
  for (let f = 0; f < 7; f++) {
    const az = (f / 7) * Math.PI * 2 + R() * 0.6,
      inc = 0.25 + R() * 0.45,
      h = 0.6 + R() * 0.4,
      w = 0.022 + R() * 0.012;
    const dx = Math.cos(az),
      dz = Math.sin(az),
      lx = -dz,
      lz = dx;
    const b = pos.length / 3;
    const ponto = (t, lado) => {
      const curva = inc * t * t;
      const larg = w * (1 - t * 0.85) * lado;
      return [dx * curva * 0.5 + lx * larg + dx * 0.03, h * t * (1 - 0.15 * inc * t), dz * curva * 0.5 + lz * larg + dz * 0.03];
    };
    for (const t of [0, 0.55]) for (const lado of [-1, 1]) pos.push(...ponto(t, lado));
    pos.push(...ponto(1, 0));
    for (let i = 0; i < 5; i++) {
      const t = [0, 0, 0.55, 0.55, 1][i];
      // cores lineares: verde escuro na base, verde-amarelado na ponta
      cor.push(0.07 + 0.16 * t, 0.11 + 0.2 * t, 0.03 + 0.05 * t);
      nor.push(dx * 0.25, 1, dz * 0.25);
    }
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b + 2, b + 3, b + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.normalizeNormals();
  g.setIndex(idx);
  // altura unitária: a escala da instância dá a altura do tufo
  return g;
}

const uCentro = { value: new THREE.Vector3() },
  uRaio = { value: 50 };
function material() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uVento, uCentro, uRaio });
    sh.vertexShader =
      'uniform float uVento;\nuniform vec3 uCentro;\nuniform float uRaio;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 pi = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          // encolhe na borda do raio
          float f = 1.0 - smoothstep(0.72 * uRaio, uRaio, distance(pi.xz, uCentro.xz));
          transformed *= f;
          // rajadas que correm pelo gramado
          float h = transformed.y;
          float onda = sin(dot(pi.xz, vec2(0.11, 0.07)) - uVento * 1.9) * 0.6 + sin(uVento * 3.3 + pi.x * 0.9) * 0.25;
          transformed.x += 0.18 * h * h * onda;
          transformed.z += 0.1 * h * h * onda;
        }`
      );
    // normais para cima nas duas faces (o tufo se ilumina como o chão)
    sh.fragmentShader = sh.fragmentShader.replace('normal *= faceDirection;', '');
  };
  m.customProgramCacheKey = () => 'gramado';
  return comDias(m);
}

const est = {
  malha: null,
  pai: null,
  geo: null,
  mat: null,
  op: null,
  perfil: null,
  ladrilhos: new Map(),
  ultimo: new THREE.Vector3(1e9, 0, 0),
  sujo: true
};

/**
 * op: { densidade(x, y) → 0 a 1 (fração da densidade máxima no ponto local), cota(x, y) → altura do chão exibido (mundo),
 * mundo(x, y) → {x, z}, local(X, Z) → [x, y], removido(x, y) → dia em que some (limpeza) ou null }.
 */
export function criarGramado(pai, op) {
  est.pai = pai;
  est.op = op;
  est.geo = tufo();
  est.mat = material();
}

/** Raio e densidade do perfil; refaz a malha com a capacidade necessária. */
export function ajustarGramado(perfil) {
  est.perfil = perfil.gramado;
  if (!est.pai) return;
  if (est.malha) {
    est.pai.remove(est.malha);
    est.malha.dispose();
  }
  const cap = Math.ceil(Math.PI * est.perfil.raio * est.perfil.raio * est.perfil.densidade * 1.15) + 64;
  const g = est.geo.clone();
  g.setAttribute('aDias', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2));
  const m = new THREE.InstancedMesh(g, est.mat, cap);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  m.count = 0;
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = true;
  // os tufos não são selecionáveis (o clique vai para o terreno)
  m.raycast = () => {};
  est.malha = m;
  est.pai.add(m);
  uRaio.value = est.perfil.raio;
  est.sujo = true;
}

// ladrilho: tufos com posição no mundo, rotação, altura, cor, dias e chave de densidade
function ladrilho(i, j) {
  const k = i + ',' + j;
  let t = est.ladrilhos.get(k);
  if (t) return t;
  const R = rng(((i * 73856093) ^ (j * 19349663)) | 0);
  const op = est.op,
    n = Math.round(LADO * LADO * DENS_MAX);
  // cotas nos cantos de uma grade de 4 m (a do terreno exibido) e interpolação bilinear
  const x0 = i * LADO,
    y0 = j * LADO,
    passo = 4,
    nc = LADO / passo + 1;
  const cotas = [];
  for (let b = 0; b < nc; b++) for (let a = 0; a < nc; a++) cotas.push(op.cota(x0 + a * passo, y0 + b * passo));
  const cota = (x, y) => {
    const u = (x - x0) / passo,
      v = (y - y0) / passo;
    const a = Math.min(nc - 2, Math.floor(u)),
      b = Math.min(nc - 2, Math.floor(v)),
      fu = u - a,
      fv = v - b;
    const c = (aa, bb) => cotas[bb * nc + aa];
    return (c(a, b) * (1 - fu) + c(a + 1, b) * fu) * (1 - fv) + (c(a, b + 1) * (1 - fu) + c(a + 1, b + 1) * fu) * fv;
  };
  const d = [];
  for (let q = 0; q < n; q++) {
    const x = x0 + R() * LADO,
      y = y0 + R() * LADO,
      chave = R(),
      rot = R() * 6.283,
      alt = 0.22 + R() * 0.28,
      seco = R();
    const dens = op.densidade(x, y);
    if (dens <= 0 || R() > dens) continue;
    const w = op.mundo(x, y);
    const fim = op.removido(x, y);
    d.push({ X: w.x, Y: cota(x, y) - 0.02, Z: w.z, rot, alt, seco, chave, fim });
  }
  t = d;
  est.ladrilhos.set(k, t);
  // memória limitada: descarta os ladrilhos mais antigos
  if (est.ladrilhos.size > 900) est.ladrilhos.delete(est.ladrilhos.keys().next().value);
  return t;
}

const NUNCA = 1e6;
/** Recoloca os tufos em torno do alvo da câmera quando ele anda mais de 3 m; some quando a câmera está longe. */
export function atualizarGramado(camera, alvo) {
  const m = est.malha;
  if (!m) return;
  const R = est.perfil.raio;
  const perto = camera.position.distanceTo(alvo) < R * 2.6;
  m.visible = perto && R > 0;
  if (!m.visible) return;
  if (!est.sujo && alvo.distanceToSquared(est.ultimo) < 9) return;
  est.sujo = false;
  est.ultimo.copy(alvo);
  uCentro.value.copy(alvo);
  const [cx, cy] = est.op.local(alvo.x, alvo.z);
  const frac = est.perfil.densidade / DENS_MAX;
  const ma = m.instanceMatrix.array,
    co = m.instanceColor.array,
    di = m.geometry.attributes.aDias.array,
    cap = m.instanceMatrix.count;
  let n = 0;
  const i0 = Math.floor((cx - R) / LADO),
    i1 = Math.floor((cx + R) / LADO),
    j0 = Math.floor((cy - R) / LADO),
    j1 = Math.floor((cy + R) / LADO);
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      // ladrilho fora do círculo
      const qx = Math.max(i * LADO, Math.min(cx, (i + 1) * LADO)),
        qy = Math.max(j * LADO, Math.min(cy, (j + 1) * LADO));
      if (Math.hypot(qx - cx, qy - cy) > R) continue;
      for (const t of ladrilho(i, j)) {
        if (t.chave >= frac || n >= cap) continue;
        const dx = t.X - alvo.x,
          dz = t.Z - alvo.z;
        if (dx * dx + dz * dz > R * R) continue;
        const c = Math.cos(t.rot),
          s = Math.sin(t.rot),
          e = n * 16,
          h = t.alt;
        ma[e] = c * h;
        ma[e + 1] = 0;
        ma[e + 2] = -s * h;
        ma[e + 3] = 0;
        ma[e + 4] = 0;
        ma[e + 5] = h;
        ma[e + 6] = 0;
        ma[e + 7] = 0;
        ma[e + 8] = s * h;
        ma[e + 9] = 0;
        ma[e + 10] = c * h;
        ma[e + 11] = 0;
        ma[e + 12] = t.X;
        ma[e + 13] = t.Y;
        ma[e + 14] = t.Z;
        ma[e + 15] = 1;
        // verde a verde-palha (capim seco do inverno carioca)
        co[n * 3] = 0.85 + 0.5 * t.seco;
        co[n * 3 + 1] = 0.95 + 0.15 * t.seco;
        co[n * 3 + 2] = 0.8 + 0.1 * t.seco;
        di[n * 2] = -1;
        di[n * 2 + 1] = t.fim ?? NUNCA;
        n++;
      }
    }
  m.count = n;
  m.instanceMatrix.needsUpdate = true;
  m.instanceColor.needsUpdate = true;
  m.geometry.attributes.aDias.needsUpdate = true;
}

/** Tufos desenhados agora (indicador e testes de navegador). */
export const tufosDesenhados = () => (est.malha && est.malha.visible ? est.malha.count : 0);
