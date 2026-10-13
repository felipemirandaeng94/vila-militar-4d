// Materiais PBR do terreno e do pavimento (Fase 5). Onze texturas (Poly Haven, CC0, e as geradas por IA preparadas por
// scripts/assets/preparar-texturas.py; origem de cada uma em public/texturas/texturas.json) ficam em três
// arrays de textura (cor, normal e ARM = oclusão, rugosidade, metal), uma camada por material, compartilhados por todas
// as superfícies. O shader (MeshStandardMaterial com onBeforeCompile) projeta as texturas pela posição no mundo,
// triplanar nos taludes e nas faces laterais das camadas (sem esticar), e recolore a textura para a cor-alvo de cada
// camada da obra: o detalhe vem da foto e a cor média é a da camada, o que preserva a leitura no corte em perfil.
// Estados da obra no shader: superfície molhada pelo pipa que seca com o tempo, marcas de pneu e de rolo que surgem
// junto da frente de serviço, junta longitudinal do CBUQ e ranhuras da fresagem.
import * as THREE from 'three';
import { uDia } from './dias.js';
import { buscar } from '../carga.js';
import { carregadorKTX2 } from './ktx2.js';

// ordem das camadas nos arrays
// o terreno mistura até 8 camadas por vértice (aPesoA e aPesoB): as que ele usa ficam nas 8 primeiras posições
export const TEXTURAS = [
  'argila',
  'solo',
  'brita',
  'asfalto_novo',
  'asfalto_usado',
  'grama',
  'concreto',
  'saibro',
  'asfalto_solto',
  // material solto: leiras, montes e camada espalhada antes da compactação (soltos.js)
  'solo_solto',
  'cascalho_solto'
];
export const T = Object.fromEntries(TEXTURAS.map((n, i) => [n, i]));
// lado real de cada textura (m), do manifesto public/texturas/texturas.json
export const TAMANHO = {
  argila: 2,
  solo: 3,
  brita: 2.46,
  asfalto_novo: 1,
  asfalto_usado: 3,
  grama: 2,
  concreto: 2.5,
  saibro: 2,
  asfalto_solto: 1,
  solo_solto: 2,
  cascalho_solto: 2
};
// CBUQ solto (camada asfalto_solto) atrás da vibroacabadora: idade (dias) em que a rolagem começa a fechar a superfície
// e em que ela fica com o aspecto do compactado
export const SOLTO = [0.02, 0.06];

// uniformes compartilhados: trocar a textura troca em todos os materiais
const U = {
  tCor: { value: null },
  tNormal: { value: null },
  tArm: { value: null },
  uMedia: { value: TEXTURAS.map(() => new THREE.Vector3(0.5, 0.5, 0.5)) },
  uEscala: { value: TEXTURAS.map(n => 1 / TAMANHO[n]) },
  uDia
};
const materiais = new Set();
// chaves do perfil de qualidade que viram defines do shader em todos os materiais
const opcoes = { RELEVO: true, ANTIREPETICAO: true };

// arrays provisórios de 1 × 1 (cinza neutro, normal plana, ARM médio): a superfície mostra a cor-alvo até as fotos chegarem
function provisorio(rgba, srgb) {
  const n = TEXTURAS.length,
    d = new Uint8Array(4 * n);
  for (let i = 0; i < n; i++) d.set(rgba, i * 4);
  const t = new THREE.DataArrayTexture(d, 1, 1, n);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
U.tCor.value = provisorio([128, 128, 128, 255], true);
U.tNormal.value = provisorio([128, 128, 255, 255], false);
U.tArm.value = provisorio([255, 200, 0, 255], false);
// média provisória: o cinza 128 em linear
const CINZA = Math.pow(128 / 255, 2.2);
U.uMedia.value.forEach(v => v.setScalar(CINZA));

// ---------- carga dos arrays KTX2 ----------
// public/texturas/1k/{cor,normal,arm}.ktx2 e 2k/cor.ktx2 (scripts/assets/texturas-ktx2.py): uma camada por material na
// ordem de TEXTURAS, mipmaps prontos e emenda medida. A cor média (linear) de cada material vem do manifesto.
const BASE = import.meta.env.BASE_URL + 'texturas/';
let manifesto = null;
const medias = () => (manifesto = manifesto || buscar(BASE + 'texturas.json'));

/** Arquivos do lado pedido: a cor de 2K só na qualidade alta; normal e ARM sempre de 1K (os de 2K em UASTC não cabem). */
export const arquivosDasTexturas = lado => ({ cor: (lado > 1024 ? '2k' : '1k') + '/cor.ktx2', normal: '1k/normal.ktx2', arm: '1k/arm.ktx2' });

// ajusta o array transcodificado: repetição, anisotropia e, no lado 512, sem o nível 0 de 1024 px (menos memória de vídeo)
function prepararArray(renderer, t, lado) {
  if (t.image.width > lado && t.mipmaps.length > 1) {
    const n = Math.round(Math.log2(t.image.width / lado));
    t.mipmaps = t.mipmaps.slice(n);
    t.image.width = t.mipmaps[0].width;
    t.image.height = t.mipmaps[0].height;
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  renderer.initTexture(t);
  // depois do envio à GPU a cópia na CPU não serve mais (o three só reenvia com needsUpdate)
  for (const m of t.mipmaps) m.data = null;
  return t;
}

let carga = 0;
export const texturasCarregadas = { lado: 0 };
/**
 * Carrega as texturas no lado pedido (512, 1024 ou 2048 px). Sem os arquivos (scripts/assets/texturas-ktx2.py não
 * rodou) ou sem o transcodificador, as superfícies ficam com as cores.
 */
export async function carregarTexturas(renderer, lado) {
  if (texturasCarregadas.lado === lado) return true;
  const minha = ++carga;
  const arq = arquivosDasTexturas(lado);
  const ktx2 = carregadorKTX2(renderer);
  let novos, man;
  try {
    [man, ...novos] = await Promise.all([medias(), ...['cor', 'normal', 'arm'].map(m => ktx2.loadAsync(BASE + arq[m]))]);
  } catch (e) {
    console.warn('Texturas PBR indisponíveis (rode scripts/assets/texturas-ktx2.py); mantendo as cores.', e);
    return false;
  }
  // outra troca de qualidade começou durante a carga
  if (minha !== carga) {
    novos.forEach(t => t.dispose());
    return false;
  }
  const camadas = (man.ktx2 && man.ktx2.camadas) || [];
  if (camadas.join() !== TEXTURAS.join() || novos.some(t => t.image.depth !== TEXTURAS.length)) {
    console.warn('Texturas PBR fora da ordem de TEXTURAS (rode scripts/assets/texturas-ktx2.py); mantendo as cores.');
    novos.forEach(t => t.dispose());
    return false;
  }
  novos.forEach(t => prepararArray(renderer, t, lado));
  const antigos = [U.tCor.value, U.tNormal.value, U.tArm.value];
  [U.tCor.value, U.tNormal.value, U.tArm.value] = novos;
  TEXTURAS.forEach((n, i) => {
    const m = man.materiais[n] && man.materiais[n].media;
    if (m) U.uMedia.value[i].fromArray(m);
  });
  antigos.forEach(t => t.dispose());
  texturasCarregadas.lado = lado;
  return true;
}

function definirOpcao(nome, on) {
  if (opcoes[nome] === on) return;
  opcoes[nome] = on;
  for (const m of materiais) {
    if (on) m.defines[nome] = '';
    else delete m.defines[nome];
    m.needsUpdate = true;
  }
}
/** Relevo (mapas de normais e projeção triplanar) liga ou desliga em todas as superfícies (qualidade baixa: desligado). */
export const definirRelevo = on => definirOpcao('RELEVO', on);
/** Disfarce de repetição (amostragem estocástica em planta) em todas as superfícies (qualidade baixa: desligado). */
export const definirAntirepeticao = on => definirOpcao('ANTIREPETICAO', on);

// ---------- shader ----------
const VERT_PARS = /* glsl */ `
varying vec3 vMundo;
varying vec3 vNormalMundo;
#ifdef PESOS
attribute vec4 aPesoA;
attribute vec4 aPesoB;
varying vec4 vPesoA;
varying vec4 vPesoB;
#endif
#ifdef SZ
attribute vec2 aSZ;
varying vec2 vSZ;
#endif
#ifdef ESPALHADO
// camada espalhada e ainda não compactada: entre o rolo (uSolto.x) e a frente de espalhamento (uSolto.y), em estacas
uniform vec2 uSolto;
float espalhado(float s) {
  return smoothstep(uSolto.x - 1.0, uSolto.x + 1.0, s) * (1.0 - smoothstep(uSolto.y + 0.5, uSolto.y + 1.5, s));
}
#endif
#ifdef ESPALHADO
// espessura da camada nos vértices do topo (0 na base)
attribute float aEsp;
#endif
`;
// material solto antes da compactação: cerca de 25 % mais espesso que a camada compactada
const VERT_ESPALHADO = /* glsl */ `
#ifdef ESPALHADO
transformed.y += 0.25 * aEsp * espalhado(aSZ.x);
#endif
`;
const VERT_MAIN = /* glsl */ `
{
  vec4 pm = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  pm = instanceMatrix * pm;
  #endif
  vMundo = (modelMatrix * pm).xyz;
  // normal no mundo: a normal de vista volta pela transposta da matriz de vista (ortonormal)
  vNormalMundo = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
  #ifdef PESOS
  vPesoA = aPesoA;
  vPesoB = aPesoB;
  #endif
  #ifdef SZ
  vSZ = aSZ;
  #endif
}
`;
const FRAG_PARS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray tCor;
uniform sampler2DArray tNormal;
uniform sampler2DArray tArm;
uniform vec3 uMedia[${TEXTURAS.length}];
uniform float uEscala[${TEXTURAS.length}];
uniform float uCamada;
uniform float uMolhar;
uniform float uSecagem;
uniform float uCamadaSolta;
#ifdef ESPALHADO
// camada espalhada e ainda não compactada: entre o rolo (uSolto.x) e a frente de espalhamento (uSolto.y), em estacas
uniform vec2 uSolto;
float espalhado(float s) {
  return smoothstep(uSolto.x - 1.0, uSolto.x + 1.0, s) * (1.0 - smoothstep(uSolto.y + 0.5, uSolto.y + 1.5, s));
}
#endif
varying vec3 vMundo;
varying vec3 vNormalMundo;
#ifdef PESOS
varying vec4 vPesoA;
varying vec4 vPesoB;
#endif
#ifdef SZ
varying vec2 vSZ;
#endif

// ruído de valor suave (0 a 1)
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// disfarce de repetição (técnica de amostragem de I. Quilez): um ruído suave em unidades de textura escolhe, ponto a
// ponto, uma de 6 variações (cada uma desloca a textura por um vetor pseudoaleatório) e mistura duas variações vizinhas
// numa faixa estreita guiada pelo contraste entre elas. Sem eixo girado, a normal das duas amostras fica no mesmo
// referencial. Custo: duas leituras por mapa nas faces em planta
vec2 desvio(float i) {
  return fract(sin(vec2(3.0, 7.0) * i + 0.5) * 43758.5453);
}

// amostra uma camada pela posição no mundo: planta nas faces horizontais, triplanar nas inclinadas e nas laterais.
// As amostras ficam dentro de ramos que variam por pixel (pesos, faces): textureGrad recebe as derivadas da posição
// (dx, dy), calculadas fora dos ramos, para o mipmap não ficar indefinido nas divisas
#define TX(t, uv, gx, gy) textureGrad(t, uv, gx, gy)
void amostra(float c, vec3 p, vec3 dx, vec3 dy, vec3 w, inout vec3 cor, inout vec3 dn, inout vec2 ar, float peso) {
  int ci = int(c + 0.5);
  float e = uEscala[ci];
  vec3 m = uMedia[ci];
  vec3 cc = vec3(0.0), nn = vec3(0.0);
  vec2 aa = vec2(0.0);
  if (w.y > 0.01) {
    vec3 uv = vec3(p.xz * e, c);
    vec2 gx = dx.xz * e, gy = dy.xz * e;
    #ifdef ANTIREPETICAO
    float v = ruido(uv.xy * 0.45 + c * 7.3) * 6.0;
    float ia = floor(v);
    vec3 uva = vec3(uv.xy + desvio(ia), c), uvb = vec3(uv.xy + desvio(ia + 1.0), c);
    vec3 ca = TX(tCor, uva, gx, gy).rgb, cb = TX(tCor, uvb, gx, gy).rgb;
    // o grão mais claro (mais alto) de cada variação vence na faixa de mistura: troca nítida, sem lavar o contraste
    float k = smoothstep(0.4, 0.6, fract(v) - 0.2 * dot(ca - cb, vec3(0.333)) / max(0.02, dot(m, vec3(0.333))));
    vec3 c1 = mix(ca, cb, k);
    vec2 a1 = mix(TX(tArm, uva, gx, gy).rg, TX(tArm, uvb, gx, gy).rg, k);
    #ifdef RELEVO
    vec2 t = mix(TX(tNormal, uva, gx, gy).xy, TX(tNormal, uvb, gx, gy).xy, k) * 2.0 - 1.0;
    #endif
    #else
    vec3 c1 = TX(tCor, uv, gx, gy).rgb;
    vec2 a1 = TX(tArm, uv, gx, gy).rg;
    #ifdef RELEVO
    vec2 t = TX(tNormal, uv, gx, gy).xy * 2.0 - 1.0;
    #endif
    #endif
    #ifdef RELEVO
    nn += vec3(t.x, 0.0, t.y) * w.y;
    #endif
    cc += c1 * w.y;
    aa += a1 * w.y;
  }
  #ifdef RELEVO
  if (w.x > 0.01) {
    vec3 uv = vec3(p.zy * e, c);
    vec2 gx = dx.zy * e, gy = dy.zy * e;
    cc += TX(tCor, uv, gx, gy).rgb * w.x;
    aa += TX(tArm, uv, gx, gy).rg * w.x;
    vec2 t = TX(tNormal, uv, gx, gy).xy * 2.0 - 1.0;
    nn += vec3(0.0, t.y, t.x) * w.x;
  }
  if (w.z > 0.01) {
    vec3 uv = vec3(p.xy * e, c);
    vec2 gx = dx.xy * e, gy = dy.xy * e;
    cc += TX(tCor, uv, gx, gy).rgb * w.z;
    aa += TX(tArm, uv, gx, gy).rg * w.z;
    vec2 t = TX(tNormal, uv, gx, gy).xy * 2.0 - 1.0;
    nn += vec3(t.x, t.y, 0.0) * w.z;
  }
  #endif
  // variação de grande escala (a mesma foto, 12 vezes maior) quebra a repetição vista de longe
  float em = e * 0.083;
  float macro = dot(TX(tCor, vec3(p.xz * em, c), dx.xz * em, dy.xz * em).rgb, vec3(0.333)) / max(0.02, dot(m, vec3(0.333)));
  macro = mix(1.0, macro, 0.35);
  #ifdef ANTIREPETICAO
  // manchas de 15 a 40 m (umidade, segregação, poeira) que não seguem o passo da textura
  macro *= 0.9 + 0.2 * ruido(p.xz * 0.05 + c * 3.1) * (0.6 + 0.4 * ruido(p.xz * 0.023 - c));
  #endif
  cor += cc / max(m, vec3(0.02)) * macro * peso;
  dn += nn * peso;
  ar += aa * peso;
}
`;
const FRAG_MAP = /* glsl */ `
vec3 sCor = vec3(0.0), sDn = vec3(0.0), sNormalW;
vec2 sAr = vec2(0.0);
{
  vec3 dpx = dFdx(vMundo), dpy = dFdy(vMundo);
  #ifdef NORMAL_GEOMETRICA
  // faces planas das camadas (os vértices do topo e das laterais são compartilhados): normal pelas derivadas
  vec3 ng = normalize(cross(dpx, dpy));
  if (dot(ng, cameraPosition - vMundo) < 0.0) ng = -ng;
  #else
  vec3 ng = normalize(vNormalMundo) * (gl_FrontFacing ? 1.0 : -1.0);
  #endif
  #ifdef RELEVO
  vec3 w = pow(abs(ng), vec3(6.0));
  w /= (w.x + w.y + w.z);
  #else
  vec3 w = vec3(0.0, 1.0, 0.0);
  #endif
  #ifdef PESOS
  float pesos[8] = float[8](vPesoA.x, vPesoA.y, vPesoA.z, vPesoA.w, vPesoB.x, vPesoB.y, vPesoB.z, vPesoB.w);
  float soma = 0.0;
  for (int i = 0; i < 8; i++) {
    if (pesos[i] > 0.02) {
      amostra(float(i), vMundo, dpx, dpy, w, sCor, sDn, sAr, pesos[i]);
      soma += pesos[i];
    }
  }
  sCor /= max(soma, 1e-3);
  sDn /= max(soma, 1e-3);
  sAr /= max(soma, 1e-3);
  #elif defined(SOLTO)
  // CBUQ recém-espalhado: textura solta e brilhante atrás da vibroacabadora, compactada pela rolagem
  float kSolto = 1.0 - smoothstep(${SOLTO[0].toFixed(3)}, ${SOLTO[1].toFixed(3)}, uDia - vDias.x);
  if (kSolto < 0.99) amostra(uCamada, vMundo, dpx, dpy, w, sCor, sDn, sAr, 1.0 - kSolto);
  if (kSolto > 0.01) amostra(${TEXTURAS.indexOf('asfalto_solto')}.0, vMundo, dpx, dpy, w, sCor, sDn, sAr, kSolto);
  sCor *= 1.0 - 0.15 * kSolto;
  #elif defined(ESPALHADO)
  // material espalhado: mais claro e, com relevo, com a textura solta, mais áspero e de normal mais forte; o rolo o
  // leva ao aspecto compactado. Na qualidade baixa (sem RELEVO) muda só a cor e a altura (vértice)
  float kEsp = espalhado(vSZ.x);
  #ifdef RELEVO
  if (kEsp < 0.99) amostra(uCamada, vMundo, dpx, dpy, w, sCor, sDn, sAr, 1.0 - kEsp);
  if (kEsp > 0.01) amostra(uCamadaSolta, vMundo, dpx, dpy, w, sCor, sDn, sAr, kEsp);
  sDn *= 1.0 + 0.9 * kEsp;
  sAr.y = min(1.0, sAr.y * (1.0 + 0.3 * kEsp));
  #else
  amostra(uCamada, vMundo, dpx, dpy, w, sCor, sDn, sAr, 1.0);
  #endif
  sCor *= 1.0 + 0.2 * kEsp;
  #else
  amostra(uCamada, vMundo, dpx, dpy, w, sCor, sDn, sAr, 1.0);
  #endif
  sNormalW = normalize(ng + sDn);
  #ifdef SZ
  float s = vSZ.x, z = vSZ.y;
  #if defined(MOLHAR) || defined(MARCAS_PNEU) || defined(MARCAS_ROLO)
  float idade = uDia - vDias.x;
  #endif
  #ifdef FRESADO
  // ranhuras longitudinais do tambor fresador (passo de 1,5 cm), suavizadas quando ficam menores que o pixel
  float fr = 0.5 + 0.5 * sin(z * 418.9);
  float nit = 1.0 - smoothstep(0.004, 0.02, fwidth(z));
  sCor *= 1.0 - 0.35 * fr * nit;
  sAr.y = min(1.0, sAr.y * (1.0 + 0.2 * fr * nit));
  // passadas do tambor de 1,0 m: degrau escuro entre faixas fresadas, visível de longe
  float kf = fract(z + 0.5);
  sCor *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.04, min(kf, 1.0 - kf)));
  #endif
  #ifdef MARCAS_PNEU
  // trilhas de rodas (caminhões, motoniveladora, rolo de pneus) a 0,95 m e 2,55 m do eixo, com desenho da banda
  float d1 = abs(abs(z) - 0.95), d2 = abs(abs(z) - 2.55);
  float tr = 1.0 - smoothstep(0.14, 0.26, min(d1, d2));
  float banda = 0.75 + 0.25 * sin(s * 31.4);
  float fresco = 1.0 - 0.6 * smoothstep(0.0, 3.0, idade);
  sCor *= 1.0 - 0.38 * tr * banda * fresco;
  sAr.y *= 1.0 - 0.3 * tr * fresco;
  #endif
  #ifdef MARCAS_ROLO
  // passadas do rolo de 2,1 m com sobreposição: linhas de borda a cada 1,75 m e brilho do CBUQ recém-compactado
  float k = fract((z + 3.5) / 1.75);
  float borda = 1.0 - smoothstep(0.0, 0.025, min(k, 1.0 - k));
  float novo = 1.0 - smoothstep(0.0, 2.0, idade);
  #ifdef ESPALHADO
  // camada granular: as marcas surgem onde o rolo já passou
  borda *= 1.0 - kEsp;
  novo *= 1.0 - kEsp;
  #endif
  sCor *= 1.0 - 0.1 * borda;
  sAr.y *= mix(1.0, 0.8, novo) * (1.0 + 0.15 * borda);
  #endif
  #ifdef JUNTA
  // junta longitudinal entre as duas faixas do CBUQ
  float jn = 1.0 - smoothstep(0.02, 0.05, abs(z));
  sCor *= 1.0 - 0.4 * jn;
  sAr.y = mix(sAr.y, 1.0, 0.5 * jn);
  #endif
  #ifdef MOLHAR
  // água do caminhão-pipa: escurece e dá brilho; seca em uSecagem dias
  float mol = uMolhar * (1.0 - smoothstep(0.0, uSecagem, idade));
  sCor *= mix(1.0, 0.55, mol);
  sAr.y = mix(sAr.y, 0.22, mol);
  #endif
  #endif
}
diffuseColor.rgb *= sCor;
`;

function aplicarShader(sh) {
  Object.assign(sh.uniforms, U, {
    uCamada: { value: this.userData.camada ?? 0 },
    uMolhar: { value: this.userData.molhar ? 1 : 0 },
    uSecagem: { value: this.userData.secagem ?? 0.8 }
  });
  const esp = this.userData.espalhado;
  if (esp) Object.assign(sh.uniforms, { uSolto: { value: esp.frente }, uCamadaSolta: { value: T[esp.camada] } });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_PARS)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_ESPALHADO)
    .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + VERT_MAIN);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * sAr.y;')
    .replace(
      '#include <normal_fragment_maps>',
      '#if defined(RELEVO) || defined(NORMAL_GEOMETRICA)\nnormal = normalize((viewMatrix * vec4(sNormalW, 0.0)).xyz);\n#endif'
    )
    .replace('#include <aomap_fragment>', '{ float ao = mix(1.0, sAr.x, 0.8); reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao; }');
}

/**
 * Prepara um MeshStandardMaterial como superfície PBR. o: { camada (nome em TEXTURAS) | pesos (terreno, atributos
 * aPesoA/aPesoB), sz (atributo aSZ com estaca e afastamento), geometrica (normal pelas derivadas), molhar, secagem,
 * marcas: 'pneu' | 'rolo' | ['pneu', 'rolo'], junta, fresado, solto (CBUQ: textura solta logo após o espalhamento),
 * espalhado: { camada (textura do material solto), frente (Vector2: estacas do rolo e da frente, soltos.js) } (camada
 * granular espalhada e não compactada; a geometria precisa do atributo aEsp) }. Encadeia com um onBeforeCompile já existente (comDias), que deve ser aplicado
 * antes, porque os estados da obra usam a varying vDias.
 */
export function pbr(material, o = {}) {
  const anterior = material.onBeforeCompile,
    chaveAnterior = material.customProgramCacheKey;
  material.userData.camada = o.camada != null ? T[o.camada] : 0;
  material.userData.molhar = !!o.molhar;
  material.userData.secagem = o.secagem;
  const d = (material.defines = material.defines || {});
  if (o.pesos) d.PESOS = '';
  if (o.sz) d.SZ = '';
  if (o.geometrica) d.NORMAL_GEOMETRICA = '';
  if (o.molhar) d.MOLHAR = '';
  const marcas = [].concat(o.marcas || []);
  if (marcas.includes('pneu')) d.MARCAS_PNEU = '';
  if (marcas.includes('rolo')) d.MARCAS_ROLO = '';
  if (o.espalhado) {
    d.ESPALHADO = '';
    material.userData.espalhado = o.espalhado;
  }
  if (o.junta) d.JUNTA = '';
  if (o.fresado) d.FRESADO = '';
  if (o.solto) d.SOLTO = '';
  for (const [nome, on] of Object.entries(opcoes)) if (on) d[nome] = '';
  material.onBeforeCompile = function (sh, r) {
    if (anterior) anterior.call(this, sh, r);
    aplicarShader.call(this, sh);
  };
  const chave = 'sup' + Object.keys(d).sort().join(',');
  material.customProgramCacheKey = function () {
    const op = Object.keys(opcoes).filter(n => this.defines && n in this.defines);
    return (chaveAnterior ? chaveAnterior.call(this) : '') + chave + op.join('');
  };
  material.map = null;
  materiais.add(material);
  return material;
}
