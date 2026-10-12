// Renderizador, cena, câmera, controles de órbita, luzes, céu, sombras, pós-processamento e qualidade.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { css } from './base.js';
import { ceu, iniciarCeu, fundoDoCeu, corDaNevoa, DENSIDADE_NEVOA } from './ceu.js';
import { configurarPos, ajustarPos, renderizarPos } from './posprocessamento.js';
import { carregarTexturas, definirRelevo, definirAntirepeticao } from './superficies.js';
import { PERFIS, Medidor, perfilPelaGpu, ajustePelaTaxa, nomeDaGpu } from './qualidade.js';
import { ST } from '../estado.js';

// objetos centrais do motor, preenchidos em iniciarRenderizador
export const cena = { renderer: null, lr: null, scene: null, camera: null, controls: null, root: null, LAY: {}, vp: null, sol: null };

// estado da renderização: perfil em uso, escolha (auto ou manual), exposição e medidor de quadros
export const visual = { perfil: 'media', escolha: 'auto', exposicao: 0.95, medidor: new Medidor(), gpu: '', aoMudar: null };
let hemi = null,
  fill = null,
  // carga do céu e do fundo em andamento: a medição automática da taxa de quadros espera por elas
  carregando = Promise.resolve();
// direção do sol (unitária, do chão para o sol); sem o HDRI, a da versão anterior
const SOL = new THREE.Vector3(-60, 110, 190).normalize();
// a vegetação é montada depois do renderizador (as árvores, depois de carregar o modelo); entorno.js registra aqui os
// ajustes de densidade, sombra, níveis de detalhe e gramado, chamados com o perfil em uso e a cada troca de perfil
const ajustesVegetacao = [];
export function registrarVegetacao(f) {
  ajustesVegetacao.push(f);
  f(PERFIS[visual.perfil]);
}

export function iniciarRenderizador(vp) {
  cena.vp = vp;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // AgX foi comparado com o ACES: o AgX dessatura o céu e acinzenta o verde da vegetação e o oliva das máquinas; o ACES
  // mantém o contraste do asfalto novo contra o solo e a cor das cores de sinalização
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = visual.exposicao;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  vp.appendChild(renderer.domElement);
  const lr = new CSS2DRenderer();
  lr.domElement.style.position = 'absolute';
  lr.domElement.style.inset = '0';
  lr.domElement.style.pointerEvents = 'none';
  vp.appendChild(lr.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 6;
  controls.maxDistance = 2200;
  // iluminação física (r155+): intensidades × π mantêm o resultado da versão original (r128). A hemisférica e a de
  // preenchimento só valem até o céu HDRI carregar (ou se ele faltar); depois a luz do céu vem do ambiente (PMREM).
  hemi = new THREE.HemisphereLight(0xdfe9f3, 0x4a5236, 0.55 * Math.PI);
  scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xfff1dc, 1.9 * Math.PI);
  scene.add(sunL);
  scene.add(sunL.target);
  sunL.castShadow = true;
  fill = new THREE.DirectionalLight(0xcfe0ff, 0.25 * Math.PI);
  fill.position.set(140, 80, -160);
  scene.add(fill);
  const root = new THREE.Group();
  scene.add(root);
  for (const k of ['terreno', 'entorno', 'pavimento', 'canteiro', 'usina', 'equip', 'ensaios', 'rotulos']) {
    cena.LAY[k] = new THREE.Group();
    root.add(cena.LAY[k]);
  }
  Object.assign(cena, { renderer, lr, scene, camera, controls, root, sol: sunL });
  visual.gpu = nomeDaGpu(renderer.getContext());
  applyTheme();
  const ro = new ResizeObserver(resize);
  ro.observe(vp);
  resize();
}

// liga o céu HDRI quando ele carrega; até lá vale a iluminação simples
export function carregarCeu() {
  carregando = iniciarCeu(cena.renderer, cena.scene).then(async ok => {
    if (!ok) return false;
    SOL.copy(ceu.sol);
    hemi.visible = false;
    fill.visible = false;
    // o sol do HDRI (48°) é mais alto que o da versão anterior (29°): a intensidade menor mantém a mesma iluminância no
    // chão, com o sol cerca de 4 vezes mais forte que o céu
    cena.sol.intensity = 1.45 * Math.PI;
    await trocarFundo();
    applyTheme();
    return true;
  });
  return carregando;
}
async function trocarFundo() {
  const t = await fundoDoCeu(PERFIS[visual.perfil].ceu);
  if (t) cena.scene.background = t;
}

// fundo e névoa: com o HDRI, céu e névoa da cor do horizonte (iguais nos dois temas, a obra é de dia); sem ele, a cor
// de cena do tema (claro ou escuro), que já entra linear pelo ColorManagement
export function applyTheme() {
  if (ceu.pronto) {
    cena.scene.fog = new THREE.FogExp2(corDaNevoa(), DENSIDADE_NEVOA);
    return;
  }
  const bg = new THREE.Color(css('--scene') || '#dfe6dd');
  cena.scene.background = bg;
  cena.scene.fog = new THREE.Fog(bg.clone(), 900, 3200);
}

export function resize() {
  const w = cena.vp.clientWidth,
    h = cena.vp.clientHeight;
  cena.renderer.setSize(w, h);
  cena.lr.setSize(w, h);
  cena.camera.aspect = w / h;
  cena.camera.updateProjectionMatrix();
  ajustarPos(cena.renderer);
}

// ---------- qualidade ----------
export function aplicarQualidade(nome) {
  const p = PERFIS[nome] || PERFIS.media;
  visual.perfil = PERFIS[nome] ? nome : 'media';
  const { renderer, scene, camera, sol } = cena;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
  if (sol.shadow.mapSize.x !== p.sombra) {
    sol.shadow.mapSize.set(p.sombra, p.sombra);
    if (sol.shadow.map) {
      sol.shadow.map.dispose();
      sol.shadow.map = null;
    }
  }
  sol.shadow.radius = p.filtro;
  camera.far = p.distancia;
  camera.updateProjectionMatrix();
  configurarPos(renderer, scene, camera, p.pos);
  resize();
  for (const f of ajustesVegetacao) f(p);
  // texturas PBR (superficies.js): resolução, relevo e disfarce de repetição do perfil; a medição da taxa de quadros
  // espera a carga
  definirRelevo(p.relevo);
  definirAntirepeticao(p.antirepeticao);
  const cargas = [carregando, carregarTexturas(renderer, p.texturas)];
  if (ceu.pronto) cargas.push(trocarFundo());
  carregando = Promise.all(cargas);
  if (visual.aoMudar) visual.aoMudar();
}

// escolha 'auto' ou um perfil; no automático, parte da GPU e desce um perfil se a taxa dos primeiros segundos ficar baixa
export function escolherQualidade(escolha) {
  visual.escolha = escolha;
  if (escolha !== 'auto') {
    visual.medidor.cancelar();
    aplicarQualidade(escolha);
    return;
  }
  aplicarQualidade(perfilPelaGpu(visual.gpu));
  avaliar();
}
function avaliar() {
  // depois da carga do céu, espera 1,5 s (compilação de shaders) e mede por 3 s
  const perfil = visual.perfil;
  carregando.finally(() => {
    if (visual.escolha !== 'auto' || visual.perfil !== perfil) return;
    visual.medidor.medir(
      1500,
      3000,
      fps => {
        if (visual.escolha !== 'auto') return;
        visual.fpsMedido = fps;
        if (visual.aoMudar) visual.aoMudar();
        const novo = ajustePelaTaxa(fps, visual.perfil);
        if (novo) {
          aplicarQualidade(novo);
          avaliar();
        }
      },
      performance.now()
    );
  });
}
export function definirExposicao(v) {
  visual.exposicao = v;
  cena.renderer.toneMappingExposure = v;
}

// ---------- sombra ajustada à câmera ----------
// a câmera de sombra cobre um quadrado em torno do alvo da órbita, deslocado para além dele (nas vistas oblíquas o chão
// visível se estende para trás do alvo), com lado proporcional à distância da câmera (em degraus de 25%, para não tremer
// ao aproximar) e limitado pelo perfil; o centro é alinhado à grade de texels do mapa
const _t = new THREE.Vector3(),
  _x = new THREE.Vector3(),
  _y = new THREE.Vector3(),
  _c = new THREE.Vector3();
const DIST_SOL = 900;
function ajustarSombra() {
  const { sol, camera, controls } = cena;
  const p = PERFIS[visual.perfil];
  const d = camera.position.distanceTo(controls.target);
  let r = Math.min(p.alcanceSombra, Math.max(40, d * 1.4));
  r = 40 * Math.pow(1.25, Math.ceil(Math.log(r / 40) / Math.log(1.25)));
  _t.copy(controls.target).sub(camera.position).setY(0);
  const h = _t.length();
  const t = h > 1 ? _t.multiplyScalar((0.35 * r * Math.min(1, h / d)) / h).add(controls.target) : _t.copy(controls.target);
  const texel = (2 * r) / sol.shadow.mapSize.x;
  // base da câmera de sombra (mesma do lookAt com o "para cima" em Y)
  _x.set(0, 1, 0).cross(SOL).normalize();
  _y.copy(SOL).cross(_x);
  const a = t.dot(_x),
    b = t.dot(_y);
  _c.copy(t)
    .addScaledVector(_x, Math.round(a / texel) * texel - a)
    .addScaledVector(_y, Math.round(b / texel) * texel - b);
  sol.target.position.copy(_c);
  sol.position.copy(_c).addScaledVector(SOL, DIST_SOL);
  const sc = sol.shadow.camera;
  if (sc.right !== r) {
    sc.left = sc.bottom = -r;
    sc.right = sc.top = r;
    sc.near = DIST_SOL - 450;
    sc.far = DIST_SOL + 450;
    sc.updateProjectionMatrix();
  }
  // viés proporcional ao texel: de 1,5 a 2 texels em profundidade (cresce com o raio do filtro PCF) e 1,5 texel ao longo
  // da normal. Com o sol a 48° a superfície varia quase 1 texel de profundidade por texel; menos que isso dá acne nos
  // telhados e paredes, e mais descola a sombra do pé das máquinas e do meio-fio ("peter panning")
  sol.shadow.bias = -(texel * (1 + p.filtro * 0.5)) / (sc.far - sc.near);
  sol.shadow.normalBias = texel * 1.5;
}

export function renderizar() {
  visual.medidor.quadro(performance.now());
  cena.controls.update();
  // o plano distante acompanha a vista: a planta de todo o trecho precisa ver o terreno inteiro
  const { camera, controls } = cena;
  const far = Math.max(PERFIS[visual.perfil].distancia, camera.position.distanceTo(controls.target) + 1500);
  if (camera.far !== far) {
    camera.far = far;
    camera.updateProjectionMatrix();
  }
  ajustarSombra();
  // no corte em perfil a oclusão de ambiente fica desligada (o corte expõe faces internas)
  if (!renderizarPos(ST.profile)) cena.renderer.render(cena.scene, cena.camera);
  cena.lr.render(cena.scene, cena.camera);
}
