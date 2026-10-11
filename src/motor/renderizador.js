// Renderizador, cena, câmera, controles de órbita e luzes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { css } from './base.js';

// objetos centrais do motor, preenchidos em iniciarRenderizador
export const cena = { renderer: null, lr: null, scene: null, camera: null, controls: null, root: null, LAY: {}, vp: null, sol: null };

export function iniciarRenderizador(vp) {
  cena.vp = vp;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
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
  // iluminação física (r155+): intensidades × π mantêm o resultado da versão original (r128)
  scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x4a5236, 0.55 * Math.PI));
  const sunL = new THREE.DirectionalLight(0xfff1dc, 1.9 * Math.PI);
  sunL.position.set(-60, 110, 190);
  scene.add(sunL);
  scene.add(sunL.target);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(4096, 4096);
  const sc = sunL.shadow.camera;
  sc.left = -260;
  sc.right = 260;
  sc.top = 200;
  sc.bottom = -200;
  sc.near = 10;
  sc.far = 700;
  sunL.shadow.bias = -0.0004;
  sunL.shadow.normalBias = 0.6;
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.25 * Math.PI);
  fill.position.set(140, 80, -160);
  scene.add(fill);
  const root = new THREE.Group();
  scene.add(root);
  for (const k of ['terreno', 'entorno', 'pavimento', 'canteiro', 'usina', 'equip', 'ensaios', 'rotulos']) {
    cena.LAY[k] = new THREE.Group();
    root.add(cena.LAY[k]);
  }
  Object.assign(cena, { renderer, lr, scene, camera, controls, root, sol: sunL });
  applyTheme();
  const ro = new ResizeObserver(resize);
  ro.observe(vp);
  resize();
}

// fundo e névoa com a cor de cena do tema (claro ou escuro); a cor já entra linear pelo ColorManagement
export function applyTheme() {
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
}
export function renderizar() {
  cena.controls.update();
  // a sombra cobre a região em torno do alvo da câmera (o trecho tem 1,6 km)
  const t = cena.controls.target;
  cena.sol.position.set(t.x - 60, 110, t.z + 190);
  cena.sol.target.position.set(t.x, 0, t.z);
  cena.renderer.render(cena.scene, cena.camera);
  cena.lr.render(cena.scene, cena.camera);
}
