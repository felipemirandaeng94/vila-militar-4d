// Modelos 3D (GLB) dos equipamentos, do canteiro, da usina, da drenagem e da sinalização (Fase 7, complemento).
// O catálogo é dados/modelos.json; os arquivos vêm de scripts/otimizar-modelos.mjs (public/modelos/<id>_lod0.glb e
// _lod1.glb, com frente em -Z, base em Y = 0 e metros) e o manifesto (public/modelos/manifesto.json) diz quais existem
// e onde ficam os giroflex. Cada objeto continua com o modelo procedural até o GLB chegar (primeiro todos os níveis 1,
// pequenos, depois os níveis 0); se o arquivo faltar ou falhar, o procedural fica e um aviso vai para o console.
// Os níveis são clones que compartilham geometria e material; a troca entre nível 0 e 1 é pela distância à câmera
// (THREE.LOD, distância do perfil de qualidade).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buscar, gerenciador } from '../carga.js';
import catalogo from '../../dados/modelos.json';
import { cena, registrarVegetacao } from './renderizador.js';

const BASE = import.meta.env.BASE_URL + 'modelos/';
export const CATALOGO = Object.fromEntries(catalogo.modelos.map(m => [m.id, m]));
// distância (m) a partir da qual entra o nível 1; ajustada pelo perfil de qualidade
let distanciaLod = 70;
const LODS = new Set();
// arquivos carregados: id -> { 0: Promise<Object3D>, 1: Promise<Object3D> }
const cache = {};
let manifesto = null;
let carregador = null;
// fila com poucas cargas simultâneas: níveis 1 antes dos níveis 0
const fila = [];
let ativos = 0;
const SIMULTANEOS = 4;

function iniciar() {
  if (carregador) return;
  carregador = new GLTFLoader(gerenciador).setMeshoptDecoder(MeshoptDecoder);
  if (cena.renderer) carregador.setKTX2Loader(new KTX2Loader(gerenciador).setTranscoderPath(BASE + 'basis/').detectSupport(cena.renderer));
  manifesto = buscar(BASE + 'manifesto.json').catch(() => ({ modelos: {} }));
  registrarVegetacao(p => {
    distanciaLod = (p.modelos && p.modelos.lod1) || 70;
    for (const l of LODS) if (l.levels.length > 1) l.levels[1].distance = distanciaLod;
  });
}
function proximo() {
  while (ativos < SIMULTANEOS && fila.length) {
    fila.sort((a, b) => a.nivel - b.nivel || a.ordem - b.ordem);
    const t = fila.shift();
    ativos++;
    carregador.load(
      BASE + t.id + '_lod' + t.nivel + '.glb',
      g => {
        ativos--;
        g.scene.traverse(o => {
          if (o.isMesh) o.castShadow = o.receiveShadow = true;
        });
        t.ok(g.scene);
        proximo();
      },
      undefined,
      e => {
        ativos--;
        t.falha(e);
        proximo();
      }
    );
  }
}
let ordem = 0;
function carregar(id, nivel) {
  iniciar();
  cache[id] = cache[id] || {};
  if (!cache[id][nivel])
    cache[id][nivel] = manifesto.then(
      man =>
        new Promise((ok, falha) => {
          if (!man.modelos[id]) return falha(new Error('fora do manifesto (rode npm run modelos)'));
          fila.push({ id, nivel, ok, falha, ordem: ordem++ });
          proximo();
        })
    );
  return cache[id][nivel];
}
const avisados = new Set();
function avisar(id, e) {
  if (avisados.has(id)) return;
  avisados.add(id);
  console.warn(`Modelo 3D "${id}" indisponível; usando o modelo procedural.`, e && e.message ? e.message : e);
}

/** Dados do manifesto de um modelo (giroflex, tamanho), depois da carga. */
export async function infoModelo(id) {
  iniciar();
  const man = await manifesto;
  return man.modelos[id] || null;
}

/**
 * LOD de um modelo do catálogo. Fica vazio até o nível 1 chegar; com o nível 0, passa a trocar pela distância.
 * aoChegar(lod) é chamado na primeira vez que algo aparece (para esconder o procedural).
 */
export function criarLod(id, aoChegar, info) {
  const lod = new THREE.LOD();
  // clone do nível com a informação do clique do objeto
  const clonar = m => {
    const c = m.clone();
    if (info)
      c.traverse(x => {
        if (x.isMesh) x.userData.info = info;
      });
    return c;
  };
  lod.name = 'glb:' + id;
  let mostrou = false;
  const mostrar = () => {
    if (!mostrou && aoChegar) aoChegar(lod);
    mostrou = true;
  };
  const p1 = carregar(id, 1);
  const p0 = carregar(id, 0);
  p1.then(m1 => {
    if (lod.levels.length) return;
    lod.addLevel(clonar(m1), 0);
    mostrar();
  }).catch(() => {});
  Promise.all([p0, p1.catch(() => null)])
    .then(([m0, m1]) => {
      // troca só os níveis (o giroflex e outros filhos ficam)
      for (const l of lod.levels) lod.remove(l.object);
      lod.levels.length = 0;
      lod.addLevel(clonar(m0), 0);
      if (m1) lod.addLevel(clonar(m1), distanciaLod);
      LODS.add(lod);
      mostrar();
    })
    .catch(e => avisar(id, e));
  return lod;
}

/**
 * Veste um objeto procedural com o GLB: o LOD entra num suporte filho de "o" (rotação e posição no referencial do
 * procedural) e, quando chega, os filhos procedurais saem (exceto os de "manter"). Devolve o suporte.
 * variantes: { estado: id } troca o modelo pelo estado (o primeiro é o inicial); ver definirVariante.
 */
export function vestir(o, variantes, { rot = -Math.PI / 2, pos = [0, 0, 0], manter = [], info: infoDada = null } = {}) {
  if (typeof variantes === 'string') variantes = { base: variantes };
  const proc = o.children.filter(c => !manter.includes(c));
  const sup = new THREE.Group();
  sup.name = 'glb';
  sup.rotation.y = rot;
  sup.position.set(...pos);
  o.add(sup);
  const lods = {};
  let info = infoDada;
  o.traverse(c => {
    if (!info && c.isMesh && c.userData.info) info = c.userData.info;
  });
  const nomes = Object.keys(variantes);
  sup.userData = { lods, atual: nomes[0], pronto: false };
  for (const [estado, id] of Object.entries(variantes)) {
    const lod = criarLod(
      id,
      () => {
        if (!sup.userData.pronto) {
          sup.userData.pronto = true;
          for (const c of proc) c.visible = false;
        }
        atualizarVariantes(sup);
      },
      info
    );
    lod.visible = false;
    lods[estado] = lod;
    sup.add(lod);
  }
  return sup;
}
// mostra a variante atual entre as que já chegaram (a primeira serve enquanto a pedida não chega)
function atualizarVariantes(sup) {
  const { lods, atual } = sup.userData;
  const chegou = k => lods[k] && lods[k].levels.length > 0;
  const k = chegou(atual) ? atual : Object.keys(lods).find(chegou);
  for (const [e, l] of Object.entries(lods)) l.visible = e === k;
}
/** Troca o estado de um objeto vestido com variantes (ex.: basculante vazio, carregado ou basculando). */
export function definirVariante(sup, estado) {
  if (!sup || sup.userData.atual === estado || !sup.userData.lods[estado]) return;
  sup.userData.atual = estado;
  atualizarVariantes(sup);
}

/** Giroflex do modelo (posições do manifesto, no referencial do GLB) como malhas filhas de sup (o LOD); entram em lista. */
const GEO_LUZ = new THREE.SphereGeometry(0.11, 10, 8);
export function giroflex(sup, id, material, lista = []) {
  const geo = GEO_LUZ;
  infoModelo(id).then(inf => {
    for (const p of (inf && inf.giroflex) || []) {
      const m = new THREE.Mesh(geo, material);
      m.position.set(p[0], p[1] + 0.05, p[2]);
      m.castShadow = false;
      sup.add(m);
      lista.push(m);
    }
  });
  return lista;
}

/**
 * Geometria única (em Float32, sem a quantização do arquivo) e material de um nível, com as transformações dos nós
 * aplicadas. Para InstancedMesh (cones, barreiras, bocas de lobo).
 */
export async function geometriaPlana(id, nivel = 1) {
  const cena3d = await carregar(id, nivel);
  cena3d.updateMatrixWorld(true);
  let malha = null;
  cena3d.traverse(o => {
    if (o.isMesh && !malha) malha = o;
  });
  const g = new THREE.BufferGeometry();
  for (const nome of ['position', 'normal', 'uv']) {
    const a = malha.geometry.getAttribute(nome);
    if (!a) continue;
    const n = a.itemSize,
      arr = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) arr[i * n + k] = a.getComponent(i, k);
    g.setAttribute(nome, new THREE.BufferAttribute(arr, n));
  }
  g.setIndex(malha.geometry.index ? Array.from(malha.geometry.index.array) : null);
  g.applyMatrix4(malha.matrixWorld);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return { geometria: g, material: malha.material };
}

/**
 * Troca a geometria e o material de um InstancedMesh pelos do GLB, preservando os atributos por instância (aDias).
 * prepararMaterial(m) recebe o material clonado (ex.: comDias); matrizes(i, geometria) devolve a nova matriz da
 * instância i, ou null.
 */
export function instanciasDoModelo(mesh, id, prepararMaterial, matrizes) {
  if (!mesh) return Promise.resolve(false);
  return geometriaPlana(id, 1)
    .then(({ geometria, material }) => {
      const g = geometria.clone();
      for (const [nome, a] of Object.entries(mesh.geometry.attributes)) if (a.isInstancedBufferAttribute) g.setAttribute(nome, a);
      mesh.geometry = g;
      mesh.material = prepararMaterial(material.clone());
      if (matrizes)
        for (let i = 0; i < mesh.count; i++) {
          const m = matrizes(i, g);
          if (m) mesh.setMatrixAt(i, m);
        }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      return true;
    })
    .catch(e => {
      avisar(id, e);
      return false;
    });
}
