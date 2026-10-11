// Pós-processamento (EffectComposer): cena em meio-float com textura de profundidade, oclusão de ambiente GTAO,
// OutputPass (mapeamento de tons e sRGB) e antisserrilhado SMAA ou FXAA. Na qualidade baixa o composer não é usado:
// a cena vai direto para a tela com o MSAA do próprio WebGL.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';

let composer = null,
  gtao = null,
  smaa = null,
  fxaa = null,
  config = null;

// parâmetros do GTAO na escala da obra (metros): raio de 2,5 m pega o pé de meio-fio, máquinas e edificações
const AO = { radius: 2.5, distanceExponent: 1.5, thickness: 1.5, scale: 1.1, samples: 16, distanceFallOff: 1 };

function criar(renderer, scene, camera) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 1, 1);
  // profundidade da própria passagem da cena (respeita o descarte por dia e o corte em perfil) e normais
  // reconstruídas da profundidade: não há segunda renderização da cena
  gtao.setGBuffer(rt.depthTexture);
  gtao.updateGtaoMaterial(AO);
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  const renderGtao = gtao.render.bind(gtao),
    tamanhoGtao = gtao.setSize.bind(gtao);
  gtao.render = (r, w, rb, ...x) => {
    gtao.gtaoMaterial.uniforms.tDepth.value = rb.depthTexture;
    gtao.pdMaterial.uniforms.tDepth.value = rb.depthTexture;
    renderGtao(r, w, rb, ...x);
  };
  // meia resolução na qualidade média
  gtao.setSize = (w, h) => tamanhoGtao(Math.max(1, Math.round(w * gtao.escala)), Math.max(1, Math.round(h * gtao.escala)));
  gtao.escala = 1;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  smaa = new SMAAPass();
  fxaa = new FXAAPass();
  composer.addPass(smaa);
  composer.addPass(fxaa);
}

/**
 * Configura o pós-processamento. p: { ao: 0 (sem), 0,5 (meia resolução) ou 1; aa: 'smaa' | 'fxaa' }; null desliga.
 */
export function configurarPos(renderer, scene, camera, p) {
  config = p;
  if (!p) return;
  if (!composer) criar(renderer, scene, camera);
  gtao.enabled = p.ao > 0;
  gtao.escala = p.ao || 1;
  smaa.enabled = p.aa === 'smaa';
  fxaa.enabled = p.aa === 'fxaa';
  ajustarPos(renderer);
}

// tamanho e densidade de pixels do composer seguem os do renderizador
export function ajustarPos(renderer) {
  if (!composer || !config) return;
  const v = renderer.getSize(new THREE.Vector2());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(v.x, v.y);
}

// desenha o quadro; devolve false quando o pós-processamento está desligado (o chamador renderiza direto)
export function renderizarPos(semAO) {
  if (!composer || !config) return false;
  const ao = gtao.enabled;
  if (semAO) gtao.enabled = false;
  composer.render();
  gtao.enabled = ao;
  return true;
}
