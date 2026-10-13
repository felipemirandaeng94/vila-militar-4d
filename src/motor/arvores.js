// Árvores do entorno (Fase 6): jacarandá do Poly Haven (CC0, reduzido por scripts/assets/arvores.mjs) com tons de copa
// variados (jacarandá, oiti e ficus, comuns na arborização do Rio) e palmeira-imperial gerada aqui, com a textura de
// folha do mesmo modelo. Cada espécie tem três níveis de detalhe: modelo perto, modelo reduzido e impostor longe
// (três planos com vistas do modelo renderizadas no navegador). Cada nível é um InstancedMesh por parte; as instâncias
// mudam de nível pela distância à câmera, e a densidade do perfil de qualidade desenha só as árvores com chave k menor
// que a fração. O atributo aDias de cada instância remove as árvores da faixa de desvio na limpeza (S04).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gerenciador } from '../carga.js';
import { comDias } from './dias.js';
import { nivelDeDetalhe } from './entornoGeo.js';
import { rng } from '../dominio/util.js';

const BASE = import.meta.env.BASE_URL + 'modelos/arvores/';
// tempo do vento (s), compartilhado com o gramado
export const uVento = { value: 0 };

// ---------- materiais ----------
// balanço da copa: deslocamento horizontal que cresce com a altura no modelo (y), com fase pela posição da instância
const VENTO_GLSL = /* glsl */ `
{
  vec3 pi = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  float fase = dot(pi.xz, vec2(0.071, 0.053));
  float h = clamp(transformed.y / uAltura, 0.0, 1.0);
  float a = uAmplitude * h * h;
  transformed.x += a * (sin(uVento * 1.3 + fase) + 0.35 * sin(uVento * 3.1 + fase * 2.0 + transformed.z * 0.4));
  transformed.z += a * 0.7 * cos(uVento * 1.1 + fase * 1.3);
}
`;
function comVento(material, altura, amplitude) {
  const anterior = material.onBeforeCompile;
  material.onBeforeCompile = function (sh, r) {
    if (anterior) anterior.call(this, sh, r);
    sh.uniforms.uVento = uVento;
    sh.uniforms.uAltura = { value: altura };
    sh.uniforms.uAmplitude = { value: amplitude };
    sh.vertexShader =
      'uniform float uVento;\nuniform float uAltura;\nuniform float uAmplitude;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VENTO_GLSL);
  };
  const chave = material.customProgramCacheKey;
  material.customProgramCacheKey = () => (chave ? chave.call(material) : '') + 'vento';
  return material;
}
// folhas: normais já apontam para fora da copa (não são invertidas na face de trás) e luz que atravessa a folha
function folhagem(material) {
  const anterior = material.onBeforeCompile;
  material.onBeforeCompile = function (sh, r) {
    if (anterior) anterior.call(this, sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('normal *= faceDirection;', '')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * 0.12;');
  };
  const chave = material.customProgramCacheKey;
  material.customProgramCacheKey = () => (chave ? chave.call(material) : '') + 'folha';
  return material;
}
// sombra das folhas e do impostor recortada pelo alfa, e sem as árvores removidas
function profundidade(map) {
  return comDias(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 }));
}

function textura(arquivo, renderer, srgb = true) {
  return new Promise((ok, falha) =>
    new THREE.TextureLoader(gerenciador).load(
      BASE + arquivo,
      t => {
        // coordenadas do glTF (origem no canto superior esquerdo)
        t.flipY = false;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        ok(t);
      },
      undefined,
      falha
    )
  );
}

// ---------- palmeira-imperial ----------
// regiões da textura de folhas (coordenadas do glTF): a folha composta de cima, com a raque em v = 0,255
const FOLHA = { u0: 0.165, u1: 0.985, v0: 0.03, vR: 0.255, v1: 0.47 };
function palmeira(fronds, segs, R) {
  const H = 16; // altura de referência (m); a instância escala
  // estipe: coluna lisa e cinza com leve bojo, anéis e o palmito verde no topo
  const tronco = new THREE.LatheGeometry(
    Array.from({ length: 14 }, (_, i) => {
      const t = i / 13,
        y = t * (H - 1.2);
      const r = 0.24 + 0.08 * Math.exp(-Math.pow((t - 0.35) / 0.25, 2)) - 0.04 * t + (t > 0.78 ? 0.05 : 0);
      return new THREE.Vector2(i === 0 ? r * 1.25 : r, y);
    }),
    10
  );
  const cor = [],
    pt = tronco.attributes.position;
  for (let i = 0; i < pt.count; i++) {
    const y = pt.getY(i) / (H - 1.2);
    const c = y > 0.78 ? [0.32, 0.42, 0.22] : [0.6 - 0.08 * (1 - y), 0.59 - 0.08 * (1 - y), 0.55 - 0.08 * (1 - y)];
    cor.push(...c);
  }
  tronco.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  // folhas: faixas arqueadas com dobra em V na raque, presas no topo do palmito
  const pos = [],
    nor = [],
    uv = [],
    cr = [],
    idx = [];
  const topo = new THREE.Vector3(0, H - 1.0, 0);
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + R() * 0.3;
    const sobe = 0.25 + (f % 3) * 0.28 + R() * 0.15; // ângulo inicial acima da horizontal (rad)
    const L = 4.2 + R() * 0.8,
      W = 1.1;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const lado = new THREE.Vector3(-dir.z, 0, dir.x);
    const base = pos.length / 3;
    let p = topo.clone(),
      ang = sobe;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      if (i > 0) {
        ang -= (1.25 / segs) * (0.6 + t);
        const passo = L / segs;
        p = p.clone().addScaledVector(dir, Math.cos(ang) * passo);
        p.y += Math.sin(ang) * passo;
      }
      const w = W * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) + 0.05;
      const u = FOLHA.u0 + (FOLHA.u1 - FOLHA.u0) * t;
      const queda = 0.35 * w; // dobra em V: as bordas caem
      const amb = 0.55 + 0.45 * t;
      for (const [sd, v] of [
        [-1, FOLHA.v0],
        [0, FOLHA.vR],
        [1, FOLHA.v1]
      ]) {
        const q = p.clone().addScaledVector(lado, sd * w);
        if (sd) q.y -= queda;
        pos.push(q.x, q.y, q.z);
        const n = new THREE.Vector3(0, 1, 0)
          .addScaledVector(dir, 0.3)
          .addScaledVector(lado, sd * 0.4)
          .normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(u, v);
        cr.push(amb, amb, amb);
      }
      if (i > 0) {
        const a = base + (i - 1) * 3,
          b = base + i * 3;
        idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
    }
  }
  const folhas = new THREE.BufferGeometry();
  folhas.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  folhas.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  folhas.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  folhas.setAttribute('color', new THREE.Float32BufferAttribute(cr, 3));
  folhas.setIndex(idx);
  return { tronco, folhas, altura: H };
}

// ---------- impostor ----------
// três vistas do modelo (de frente, de lado e de cima) numa textura de 3 × 1 células, sem luz (cor e oclusão), e três
// planos cruzados com as normais abertas para fora (sombreamento arredondado de copa)
function impostor(renderer, partes, caixa) {
  const lado = 256;
  const rt = new THREE.WebGLRenderTarget(lado * 3, lado, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    samples: 4
  });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const cena = new THREE.Scene();
  for (const { geo, mat } of partes) {
    const m = new THREE.MeshBasicMaterial({ map: mat.map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, color: mat.color });
    cena.add(new THREE.Mesh(geo, m));
  }
  const tam = new THREE.Vector3(),
    cen = new THREE.Vector3();
  caixa.getSize(tam);
  caixa.getCenter(cen);
  const R = Math.max(tam.x, tam.z) / 2 + 0.2,
    H = tam.y + 0.2;
  const cam = new THREE.OrthographicCamera(-R, R, H, 0, 0.1, 200);
  const antes = { cor: renderer.getClearColor(new THREE.Color()), alfa: renderer.getClearAlpha(), alvo: renderer.getRenderTarget(), auto: renderer.autoClear };
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.clear();
  const vistas = [
    [new THREE.Vector3(cen.x, 0, cen.z + 80), new THREE.Vector3(cen.x, 0, cen.z)],
    [new THREE.Vector3(cen.x + 80, 0, cen.z), new THREE.Vector3(cen.x, 0, cen.z)]
  ];
  vistas.forEach(([o, a], i) => {
    cam.position.copy(o);
    cam.up.set(0, 1, 0);
    cam.lookAt(a);
    cam.left = -R;
    cam.right = R;
    cam.top = H;
    cam.bottom = 0;
    cam.updateProjectionMatrix();
    // no alvo de renderização vale a janela do próprio alvo, não a do renderizador
    rt.viewport.set(i * lado, 0, lado, lado);
    renderer.setRenderTarget(rt);
    renderer.render(cena, cam);
  });
  // de cima
  cam.position.set(cen.x, 100, cen.z);
  cam.up.set(0, 0, -1);
  cam.lookAt(cen.x, 0, cen.z);
  cam.left = -R;
  cam.right = R;
  cam.top = R;
  cam.bottom = -R;
  cam.updateProjectionMatrix();
  rt.viewport.set(2 * lado, 0, lado, lado);
  renderer.setRenderTarget(rt);
  renderer.render(cena, cam);
  renderer.setRenderTarget(antes.alvo);
  renderer.setClearColor(antes.cor, antes.alfa);
  renderer.autoClear = antes.auto;
  cena.traverse(o => o.material && o.material.dispose());

  // planos: frente (XY), lado (ZY) e de cima (XZ, na altura média da copa)
  const pos = [],
    nor = [],
    uv = [],
    idx = [];
  const yc = cen.y + tam.y * 0.1;
  const quad = (cantos, uvs, normais) => {
    const b = pos.length / 3;
    cantos.forEach((c, i) => {
      pos.push(...c);
      nor.push(...normais[i]);
      uv.push(...uvs[i]);
    });
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const aberta = (x, y, z) => {
    const v = new THREE.Vector3(x - cen.x, (y - yc) * 0.8, z - cen.z)
      .normalize()
      .multiplyScalar(0.6)
      .add(new THREE.Vector3(0, 0.55, 0))
      .normalize();
    return [v.x, v.y, v.z];
  };
  const c = (k, u, v) => [(k + u) / 3, v];
  // a textura do alvo de renderização tem a origem embaixo; o impostor usa flipY = false (coordenada v para cima)
  const frente = [
    [cen.x - R, 0, cen.z],
    [cen.x + R, 0, cen.z],
    [cen.x + R, H, cen.z],
    [cen.x - R, H, cen.z]
  ];
  quad(
    frente,
    [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)],
    frente.map(p => aberta(...p))
  );
  const lateral = [
    [cen.x, 0, cen.z + R],
    [cen.x, 0, cen.z - R],
    [cen.x, H, cen.z - R],
    [cen.x, H, cen.z + R]
  ];
  quad(
    lateral,
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)],
    lateral.map(p => aberta(...p))
  );
  const cima = [
    [cen.x - R, yc, cen.z + R],
    [cen.x + R, yc, cen.z + R],
    [cen.x + R, yc, cen.z - R],
    [cen.x - R, yc, cen.z - R]
  ];
  quad(
    cima,
    [c(2, 0, 0), c(2, 1, 0), c(2, 1, 1), c(2, 0, 1)],
    cima.map(() => [0, 1, 0])
  );
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
  return { geo, mat: folhagem(mat), folha: true };
}

// ---------- espécies ----------
async function carregarEspecies(renderer) {
  const [gltf, casca, galhos, folhas] = await Promise.all([
    new GLTFLoader(gerenciador).loadAsync(BASE + 'jacaranda.glb'),
    textura('casca.webp', renderer),
    textura('galhos.webp', renderer),
    textura('folhas.webp', renderer)
  ]);
  const altura = gltf.scene.userData.altura || 19.3;
  const mCasca = new THREE.MeshStandardMaterial({ map: casca, vertexColors: true, roughness: 0.95, metalness: 0 });
  const mGalhos = new THREE.MeshStandardMaterial({ map: galhos, vertexColors: true, roughness: 0.95, metalness: 0 });
  const mFolhas = () =>
    folhagem(
      comVento(
        new THREE.MeshStandardMaterial({ map: folhas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 }),
        altura,
        0.18
      )
    );
  const parte = nome => gltf.scene.getObjectByName(nome).geometry;
  const jac = [0, 1].map(n => [
    { geo: parte('tronco_' + n), mat: mCasca },
    { geo: parte('galhos_' + n), mat: mGalhos },
    { geo: parte('folhas_' + n), mat: mFolhas(), folha: true }
  ]);
  const R = rng(5);
  const pf = [palmeira(16, 7, R), palmeira(10, 4, R)];
  const mEstipe = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  const mPalma = folhagem(
    comVento(new THREE.MeshStandardMaterial({ map: folhas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 }), 16, 0.12)
  );
  const palm = pf.map(p => [
    { geo: p.tronco, mat: mEstipe },
    { geo: p.folhas, mat: mPalma, folha: true }
  ]);
  const especie = (niveis, alturaModelo) => {
    const cx = new THREE.Box3();
    for (const { geo } of niveis[1]) {
      geo.computeBoundingBox();
      cx.union(geo.boundingBox);
    }
    return { niveis: [...niveis, [impostor(renderer, niveis[1], cx)]], altura: alturaModelo };
  };
  return { jacaranda: especie(jac, altura), palmeira: especie(palm, 16) };
}
// reserva sem os arquivos do modelo: tronco e copa simples (a versão anterior)
function especiesDeReserva() {
  const tronco = new THREE.CylinderGeometry(0.18, 0.28, 1, 7).translate(0, 0.5, 0).scale(1, 5, 1);
  const copa = new THREE.IcosahedronGeometry(1, 1).scale(4, 3.4, 4).translate(0, 7.5, 0);
  for (const g of [tronco, copa]) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
  const nivel = [
    { geo: tronco, mat: new THREE.MeshStandardMaterial({ color: 0x5b4632, vertexColors: true }) },
    { geo: copa, mat: new THREE.MeshStandardMaterial({ color: 0x4c6e35, vertexColors: true, flatShading: true }), folha: true }
  ];
  const e = { niveis: [nivel, nivel, nivel], altura: 10 };
  return { jacaranda: e, palmeira: e };
}

// ---------- instâncias e níveis de detalhe ----------
const estado = { grupos: [], fracao: 1, sombra: false, perto: 90, medio: 300, ultima: new THREE.Vector3(1e9, 0, 0), sujo: true };
const _v = new THREE.Vector3();

/**
 * Cria as árvores. lista: [{ especie: 'jacaranda' | 'palmeira', p: Vector3 (base no mundo), rot, h (altura, m), largura
 * (fator horizontal), tom: Color (multiplica a copa), dias: [aparece, some], k (0 a 1, ordem da densidade) }].
 */
export async function criarArvores(lista, pai, renderer, info) {
  let especies;
  try {
    especies = await carregarEspecies(renderer);
  } catch (e) {
    console.warn('Modelo das árvores indisponível (rode scripts/assets/baixar_modelos.py e arvores.mjs); usando árvores simples.', e);
    especies = especiesDeReserva();
  }
  for (const [nome, esp] of Object.entries(especies)) {
    const itens = lista.filter(t => t.especie === nome).sort((a, b) => a.k - b.k);
    if (!itens.length) continue;
    const n = itens.length;
    const mats = new Float32Array(n * 16),
      cores = new Float32Array(n * 3),
      dias = new Float32Array(n * 2);
    const o = new THREE.Object3D();
    itens.forEach((t, i) => {
      const s = t.h / esp.altura;
      o.position.copy(t.p);
      o.rotation.set(0, t.rot, 0);
      o.scale.set(s * t.largura, s, s * t.largura);
      o.updateMatrix();
      o.matrix.toArray(mats, i * 16);
      t.tom.toArray(cores, i * 3);
      dias[i * 2] = t.dias[0];
      dias[i * 2 + 1] = t.dias[1];
    });
    const niveis = esp.niveis.map(partes =>
      partes.map(({ geo, mat, folha }) => {
        const g = geo.clone();
        g.setAttribute('aDias', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
        const m = new THREE.InstancedMesh(g, comDias(mat), n);
        m.count = 0;
        if (folha) {
          m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
          m.customDepthMaterial = profundidade(mat.map);
        } else m.customDepthMaterial = comDias(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.userData.info = info;
        m.userData.diasInst = [];
        pai.add(m);
        return m;
      })
    );
    estado.grupos.push({ itens, mats, cores, dias, niveis, pos: itens.map(t => t.p) });
  }
  estado.sujo = true;
}

/** Densidade e alcance dos níveis pelo perfil de qualidade. */
export function ajustarArvores(perfil) {
  estado.fracao = perfil.vegetacao;
  estado.sombra = perfil.sombraVegetacao;
  estado.perto = perfil.arvores.perto;
  estado.medio = perfil.arvores.medio;
  estado.sujo = true;
}

/** Redistribui as instâncias entre os níveis quando a câmera anda mais de 2 m (ou o perfil muda). */
export function atualizarArvores(camera) {
  if (!estado.sujo && camera.position.distanceToSquared(estado.ultima) < 4) return;
  estado.ultima.copy(camera.position);
  estado.sujo = false;
  for (const g of estado.grupos) {
    const conta = g.niveis.map(() => 0);
    for (let i = 0; i < g.itens.length; i++) {
      // as instâncias estão em ordem da chave k: a fração do perfil desenha o começo da lista
      if (g.itens[i].k >= estado.fracao) break;
      const nv = nivelDeDetalhe(_v.copy(g.pos[i]).distanceTo(camera.position), estado.perto, estado.medio);
      const j = conta[nv]++;
      for (const m of g.niveis[nv]) {
        m.instanceMatrix.array.set(g.mats.subarray(i * 16, i * 16 + 16), j * 16);
        m.geometry.attributes.aDias.array.set(g.dias.subarray(i * 2, i * 2 + 2), j * 2);
        if (m.instanceColor) m.instanceColor.array.set(g.cores.subarray(i * 3, i * 3 + 3), j * 3);
        m.userData.diasInst[j] = g.itens[i].dias;
      }
    }
    g.niveis.forEach((partes, nv) =>
      partes.forEach(m => {
        m.count = conta[nv];
        m.userData.diasInst.length = conta[nv];
        m.instanceMatrix.needsUpdate = true;
        m.geometry.attributes.aDias.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        // só o modelo perto faz sombra (se o perfil permitir): a sombra do reduzido custa quase o mesmo (a área das folhas é
        // igual) e o impostor daria uma mancha com o plano de cima
        m.castShadow = estado.sombra && nv === 0;
        m.visible = conta[nv] > 0;
      })
    );
  }
}
