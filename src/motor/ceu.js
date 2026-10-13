// Céu HDRI do Poly Haven (public/hdri/, CC0): ambiente por PMREM, fundo com o mesmo céu, sol alinhado ao HDRI e névoa
// com a cor do horizonte. Sem o HDRI (arquivo ausente), o renderizador mantém a luz hemisférica e o fundo do tema.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { gerenciador } from '../carga.js';
import { analisarCeu, limitarSol, preencherChao, azimuteNoMundo } from './ceuHdr.js';
import { D } from '../estado.js';

// sol de uma manhã de junho no Rio (por volta das 10 h): a nordeste, azimute de cerca de 40°. A elevação é a do HDRI
// (48°, um pouco acima dos ~40° reais). O HDRI é girado para que o sol do céu coincida com a luz direcional.
const AZIMUTE_SOL_GEO = 40;
// sem o local real (eixo reto fictício), o azimute do eixo x é desconhecido: usa a direção da versão anterior
function azimuteDoSol() {
  const az = D.local && D.local.meta && D.local.meta.sistema && D.local.meta.sistema.azimute_eixo_x_graus;
  return Number.isFinite(az) ? azimuteNoMundo(AZIMUTE_SOL_GEO, az) : Math.atan2(-60, 190);
}
// radiância média do céu (sem o sol) depois da escala, no ambiente e no fundo. No ambiente, o sol direto (1,45π a 48°) fica
// cerca de 4 vezes mais forte que o céu no chão plano, como num dia claro, e as sombras ficam legíveis; o fundo é mais claro
// que o ambiente para o céu não parecer cinza
const CEU_ALVO = 0.27;
const FUNDO_ALVO = 0.5;
// densidade da névoa exponencial: cerca de 2% a 500 m e 30% a 2 km
export const DENSIDADE_NEVOA = 0.0003;

const base = () => import.meta.env.BASE_URL + 'hdri/';
const cache = {};
function carregar(res) {
  if (!cache[res])
    cache[res] = new HDRLoader(gerenciador).loadAsync(base() + `ceu_${res}.hdr`).then(t => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    });
  return cache[res];
}

// estado do céu depois de carregado
export const ceu = { pronto: false, analise: null, escala: 1, escalaFundo: 1, sol: new THREE.Vector3(), rotacao: 0 };

function dadosDe(tex) {
  return { data: tex.image.data, width: tex.image.width, height: tex.image.height };
}
function texturaDe(img) {
  const t = new THREE.DataTexture(img.data, img.width, img.height, THREE.RGBAFormat, THREE.HalfFloatType);
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.flipY = true;
  t.needsUpdate = true;
  return t;
}

// carrega o céu de 2K, analisa, gera o ambiente por PMREM e aplica na cena; devolve false se o HDRI não existir
export async function iniciarCeu(renderer, scene) {
  let tex;
  try {
    tex = await carregar('2k');
  } catch (e) {
    console.warn('HDRI do céu indisponível (rode scripts/assets/baixar_polyhaven.py); mantendo a luz simples.', e);
    return false;
  }
  const img = dadosDe(tex);
  const a = analisarCeu(img);
  ceu.analise = a;
  ceu.escala = CEU_ALVO / a.mediaCeu;
  ceu.rotacao = azimuteDoSol() - a.azimute;
  // direção do sol no mundo: a do HDRI girada em Y
  ceu.sol
    .set(...a.sol)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), ceu.rotacao)
    .normalize();
  // ambiente: céu com o disco do sol limitado (a luz direcional já ilumina) e chão na cor do horizonte
  const amb = texturaDe(preencherChao(limitarSol(img, a.mediaCeu * 4), a.horizonte));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(amb).texture;
  pmrem.dispose();
  amb.dispose();
  scene.environment = env;
  scene.environmentIntensity = ceu.escala;
  scene.environmentRotation.set(0, ceu.rotacao, 0);
  scene.backgroundRotation.set(0, ceu.rotacao, 0);
  ceu.escalaFundo = FUNDO_ALVO / a.mediaCeu;
  scene.backgroundIntensity = ceu.escalaFundo;
  // fundo de 2K: o chão do céu puro vira horizonte, que se funde com a névoa
  preencherChao(img, a.horizonte);
  tex.needsUpdate = true;
  ceu.fundos = { '2k': tex };
  ceu.pronto = true;
  return true;
}

// troca a resolução do fundo (2K ou 4K); o 4K só é baixado quando a qualidade alta pede
export async function fundoDoCeu(res) {
  if (!ceu.pronto) return null;
  if (!ceu.fundos[res]) {
    try {
      const t = await carregar(res);
      preencherChao(dadosDe(t), ceu.analise.horizonte);
      t.needsUpdate = true;
      ceu.fundos[res] = t;
    } catch (e) {
      console.warn('Céu em ' + res + ' indisponível; mantendo 2K.', e);
      return ceu.fundos['2k'];
    }
  }
  return ceu.fundos[res];
}

// cor da névoa no espaço linear da cena: o horizonte do céu com a mesma escala do fundo
export function corDaNevoa() {
  const h = ceu.analise.horizonte,
    k = ceu.escalaFundo;
  return new THREE.Color().setRGB(h[0] * k, h[1] * k, h[2] * k, THREE.LinearSRGBColorSpace);
}
