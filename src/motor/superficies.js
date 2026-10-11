// Materiais PBR do terreno e do pavimento (Fase 5). Sete texturas do Poly Haven (CC0, public/texturas/) ficam em três
// arrays de textura (cor, normal e ARM = oclusão, rugosidade, metal), uma camada por material, compartilhados por todas
// as superfícies. O shader (MeshStandardMaterial com onBeforeCompile) projeta as texturas pela posição no mundo,
// triplanar nos taludes e nas faces laterais das camadas (sem esticar), e recolore a textura para a cor-alvo de cada
// camada da obra: o detalhe vem da foto e a cor média é a da camada, o que preserva a leitura no corte em perfil.
// Estados da obra no shader: superfície molhada pelo pipa que seca com o tempo, marcas de pneu e de rolo que surgem
// junto da frente de serviço, junta longitudinal do CBUQ e ranhuras da fresagem.
import * as THREE from 'three';
import { uDia } from './dias.js';

// ordem das camadas nos arrays
export const TEXTURAS = ['argila', 'solo', 'brita', 'asfalto_novo', 'asfalto_usado', 'grama', 'concreto'];
export const T = Object.fromEntries(TEXTURAS.map((n, i) => [n, i]));
// lado real de cada textura (m), do manifesto public/texturas/texturas.json
export const TAMANHO = { argila: 2, solo: 3, brita: 2.46, asfalto_novo: 2, asfalto_usado: 3, grama: 2, concreto: 2.5 };

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
let relevo = true;

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

const srgbParaLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// ---------- carga das fotos ----------
async function bitmap(url, lado) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return createImageBitmap(await r.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
    resizeWidth: lado,
    resizeHeight: lado,
    resizeQuality: 'high'
  });
}
// cor média (linear) de uma foto, por uma cópia de 16 × 16
async function media(bmp) {
  const p = await createImageBitmap(bmp, { resizeWidth: 16, resizeHeight: 16, resizeQuality: 'medium' });
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(p, 0, 0);
  const d = g.getImageData(0, 0, 16, 16).data;
  const s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += srgbParaLinear(d[i + k] / 255);
  p.close();
  return new THREE.Vector3(s[0] / 256, s[1] / 256, s[2] / 256);
}
// array de textura alocado pelo three sem dados; as camadas são enviadas direto das imagens (sem cópia na CPU)
function arrayVazio(renderer, lado, srgb) {
  const t = new THREE.DataArrayTexture(null, lado, lado, TEXTURAS.length);
  t.source.dataReady = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  renderer.initTexture(t);
  return t;
}
function enviar(renderer, t, camada, bmp) {
  const gl = renderer.getContext();
  renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, renderer.properties.get(t).__webglTexture);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, camada, bmp.width, bmp.height, 1, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
}
function mipmaps(renderer, t) {
  const gl = renderer.getContext();
  renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, renderer.properties.get(t).__webglTexture);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
}

let carga = 0;
export const texturasCarregadas = { lado: 0 };
/**
 * Carrega as texturas no lado pedido (512, 1024 ou 2048 px). Os arquivos de 1K servem ao 512 (reduzidos) e ao 1024;
 * os de 2K, ao 2048. Sem os arquivos (scripts/assets/baixar_texturas.py não rodou), as superfícies ficam com as cores.
 */
export async function carregarTexturas(renderer, lado) {
  if (texturasCarregadas.lado === lado) return true;
  const minha = ++carga;
  const res = lado > 1024 ? '2k' : '1k';
  const base = import.meta.env.BASE_URL + 'texturas/';
  let bmps;
  try {
    bmps = await Promise.all(TEXTURAS.map(n => Promise.all(['cor', 'normal', 'arm'].map(m => bitmap(`${base}${n}/${res}/${m}.webp`, lado)))));
  } catch (e) {
    console.warn('Texturas PBR indisponíveis (rode scripts/assets/baixar_texturas.py); mantendo as cores.', e);
    return false;
  }
  // outra troca de qualidade começou durante a carga
  if (minha !== carga) {
    bmps.flat().forEach(b => b.close());
    return false;
  }
  const medias = await Promise.all(bmps.map(b => media(b[0])));
  const novos = [arrayVazio(renderer, lado, true), arrayVazio(renderer, lado, false), arrayVazio(renderer, lado, false)];
  bmps.forEach((b, i) => b.forEach((bmp, k) => enviar(renderer, novos[k], i, bmp)));
  novos.forEach(t => mipmaps(renderer, t));
  bmps.flat().forEach(b => b.close());
  const antigos = [U.tCor.value, U.tNormal.value, U.tArm.value];
  [U.tCor.value, U.tNormal.value, U.tArm.value] = novos;
  medias.forEach((m, i) => U.uMedia.value[i].copy(m));
  antigos.forEach(t => t.dispose());
  texturasCarregadas.lado = lado;
  return true;
}

/** Relevo (mapas de normais e projeção triplanar) liga ou desliga em todas as superfícies (qualidade baixa: desligado). */
export function definirRelevo(on) {
  if (relevo === on) return;
  relevo = on;
  for (const m of materiais) {
    if (on) m.defines.RELEVO = '';
    else delete m.defines.RELEVO;
    m.needsUpdate = true;
  }
}

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
// segunda amostra em planta, girada e deslocada (rotação 3-4-5), misturada à primeira por manchas de ruído: as trincas
// e manchas da foto deixam de se repetir em grade ao longo de 1,6 km
const mat2 GIRO = mat2(0.6, -0.8, 0.8, 0.6);

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
    vec3 c1 = TX(tCor, uv, gx, gy).rgb;
    vec2 a1 = TX(tArm, uv, gx, gy).rg;
    #ifdef RELEVO
    vec2 t = TX(tNormal, uv, gx, gy).xy * 2.0 - 1.0;
    float k = smoothstep(0.35, 0.65, ruido(p.xz * 0.09 + c * 7.3));
    if (k > 0.01) {
      vec3 uv2 = vec3(GIRO * uv.xy + vec2(0.31, 0.57), c);
      vec2 gx2 = GIRO * gx, gy2 = GIRO * gy;
      c1 = mix(c1, TX(tCor, uv2, gx2, gy2).rgb, k);
      a1 = mix(a1, TX(tArm, uv2, gx2, gy2).rg, k);
      // a normal da amostra girada volta para o referencial da planta
      t = mix(t, (TX(tNormal, uv2, gx2, gy2).xy * 2.0 - 1.0) * GIRO, k);
    }
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
  cor += cc / max(m, vec3(0.02)) * mix(1.0, macro, 0.35) * peso;
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
  for (int i = 0; i < ${TEXTURAS.length}; i++) {
    if (pesos[i] > 0.02) {
      amostra(float(i), vMundo, dpx, dpy, w, sCor, sDn, sAr, pesos[i]);
      soma += pesos[i];
    }
  }
  sCor /= max(soma, 1e-3);
  sDn /= max(soma, 1e-3);
  sAr /= max(soma, 1e-3);
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
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_PARS)
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
 * marcas: 'pneu' | 'rolo', junta, fresado }. Encadeia com um onBeforeCompile já existente (comDias), que deve ser aplicado
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
  if (o.marcas === 'pneu') d.MARCAS_PNEU = '';
  if (o.marcas === 'rolo') d.MARCAS_ROLO = '';
  if (o.junta) d.JUNTA = '';
  if (o.fresado) d.FRESADO = '';
  if (relevo) d.RELEVO = '';
  material.onBeforeCompile = function (sh, r) {
    if (anterior) anterior.call(this, sh, r);
    aplicarShader.call(this, sh);
  };
  const chave = 'sup' + Object.keys(d).sort().join(',');
  material.customProgramCacheKey = function () {
    return (chaveAnterior ? chaveAnterior.call(this) : '') + chave + (this.defines && 'RELEVO' in this.defines ? 'R' : '');
  };
  material.map = null;
  materiais.add(material);
  return material;
}
