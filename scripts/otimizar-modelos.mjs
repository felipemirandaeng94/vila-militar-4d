// Fase 7 (complemento): otimização dos modelos 3D do Tripo AI (assets/brutos/modelos) para o app.
// Para cada modelo aceito em dados/modelos.json gera public/modelos/<id>_lod0.glb e <id>_lod1.glb:
//   - remove extensões não suportadas (KHR_materials_volume; FB_ngon_encoding é ignorada na leitura), nós vazios,
//     materiais e texturas sem uso;
//   - solda os vértices e simplifica (meshoptimizer) até o alvo de triângulos de cada nível;
//   - aplica rotação, escala e base do modelos.json direto na geometria (frente em -Z, Y para cima, base em Y = 0);
//   - recolore para verde-oliva o que vier amarelo ou laranja, quando indicado (pneus, vidros e metais ficam);
//   - texturas reduzidas (1024 no nível 0 e 256 no nível 1, salvo indicação) em KTX2 se o toktx estiver instalado
//     (ETC1S na cor e em metal/rugosidade; UASTC com RDO e Zstandard na normal, com metade do lado), senão em WebP
//     (com aviso);
//   - compressão Meshopt (EXT_meshopt_compression com quantização).
// Idempotente: pula o modelo cujos dois arquivos são mais novos que a origem e foram gerados com a mesma configuração
// (public/modelos/manifesto.json). Meta: nível 0 até 1,5 MB e a pasta public/modelos abaixo de 40 MB; se um nível 0
// passar do limite, reduz primeiro a textura e depois os triângulos.
//
// Uso: npm run modelos [-- id1 id2 ...] [-- --forcar]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, KHRTextureBasisu } from '@gltf-transform/extensions';
import { prune, dedup, meshopt, cloneDocument } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRUTOS = resolve(RAIZ, 'assets/brutos/modelos');
const SAIDA = resolve(RAIZ, 'public/modelos');
const CONFIG = JSON.parse(readFileSync(resolve(RAIZ, 'dados/modelos.json'), 'utf8'));
const MANIFESTO = resolve(SAIDA, 'manifesto.json');
const LIMITE_LOD0 = 1.5 * 1048576;
const LIMITE_PASTA = 40 * 1048576;
// extensões que o app (GLTFLoader do three.js) usa; as outras saem
const SUPORTADAS = new Set(['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_texture_basisu', 'KHR_texture_transform']);

const args = process.argv.slice(2);
const forcar = args.includes('--forcar');
const pedidos = args.filter(a => !a.startsWith('--'));

// ---------- ferramentas externas ----------
// procura o toktx na variável TOKTX, no PATH e em ferramentas/ktx-software/bin (cópia local, fora do git)
function acharToktx() {
  const local = resolve(RAIZ, 'ferramentas/ktx-software/bin', process.platform === 'win32' ? 'toktx.exe' : 'toktx');
  for (const cmd of [process.env.TOKTX, 'toktx', local].filter(Boolean)) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}
const TOKTX = acharToktx();
const KTX2 = TOKTX !== null;
// transcodificador Basis do three.js para o KTX2Loader do app
if (KTX2) {
  const de = resolve(RAIZ, 'node_modules/three/examples/jsm/libs/basis'),
    para = resolve(RAIZ, 'public/modelos/basis');
  mkdirSync(para, { recursive: true });
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) writeFileSync(resolve(para, f), readFileSync(resolve(de, f)));
}
if (!KTX2)
  console.warn(
    'AVISO: toktx (KTX-Software) não está instalado; as texturas saem em WebP. Para KTX2, instale o KTX-Software (https://github.com/KhronosGroup/KTX-Software/releases), ponha o toktx no PATH (ou em ferramentas/ktx-software/bin) e rode npm run modelos -- --forcar.'
  );

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// ---------- geometria ----------
// dados da primitiva (única no Tripo; com várias, cada uma é tratada igual) já no espaço do mundo
function lerPrimitiva(prim, matriz) {
  const pos = prim.getAttribute('POSITION').getArray().slice();
  const nor = prim.getAttribute('NORMAL') ? prim.getAttribute('NORMAL').getArray().slice() : null;
  const uv = prim.getAttribute('TEXCOORD_0') ? prim.getAttribute('TEXCOORD_0').getArray().slice() : null;
  const idx = prim.getIndices() ? Uint32Array.from(prim.getIndices().getArray()) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  const m = matriz;
  for (let i = 0; i < pos.length; i += 3) {
    const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
    pos[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    pos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    pos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (nor) {
      const [a, b, c] = [nor[i], nor[i + 1], nor[i + 2]];
      const nx = m[0] * a + m[4] * b + m[8] * c,
        ny = m[1] * a + m[5] * b + m[9] * c,
        nz = m[2] * a + m[6] * b + m[10] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[i] = nx / l;
      nor[i + 1] = ny / l;
      nor[i + 2] = nz / l;
    }
  }
  return { pos, nor, uv, idx };
}

// solda vértices iguais em posição, normal e coordenada de textura (o Tripo repete vértices por face em alguns trechos)
function soldar(g) {
  const n = g.pos.length / 3,
    mapa = new Map(),
    remap = new Uint32Array(n);
  const k = (a, i, c, q) => Array.from({ length: c }, (_, j) => Math.round(a[i * c + j] * q)).join(',');
  let novos = 0;
  const ordem = [];
  for (let i = 0; i < n; i++) {
    const chave = k(g.pos, i, 3, 1e5) + '|' + (g.nor ? k(g.nor, i, 3, 1e3) : '') + '|' + (g.uv ? k(g.uv, i, 2, 1e5) : '');
    let j = mapa.get(chave);
    if (j === undefined) {
      j = novos++;
      mapa.set(chave, j);
      ordem.push(i);
    }
    remap[i] = j;
  }
  return compactar(
    g,
    g.idx.map(v => ordem[remap[v]])
  );
}
// mantém só os vértices usados pelos índices
function compactar(g, idx) {
  const mapa = new Map(),
    pos = [],
    nor = [],
    uv = [],
    novo = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) {
    const v = idx[t];
    let j = mapa.get(v);
    if (j === undefined) {
      j = pos.length / 3;
      mapa.set(v, j);
      pos.push(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]);
      if (g.nor) nor.push(g.nor[v * 3], g.nor[v * 3 + 1], g.nor[v * 3 + 2]);
      if (g.uv) uv.push(g.uv[v * 2], g.uv[v * 2 + 1]);
    }
    novo[t] = j;
  }
  return { pos: Float32Array.from(pos), nor: g.nor ? Float32Array.from(nor) : null, uv: g.uv ? Float32Array.from(uv) : null, idx: novo };
}
// simplifica até o alvo de triângulos, aumentando o erro aceito; se as costuras da textura travarem, permite
// atravessá-las (Permissive) com o menor erro que alcance o alvo
function simplificar(g, alvo) {
  const tris = g.idx.length / 3;
  if (tris <= alvo) return { g, erro: 0, modo: 'original' };
  let melhor = null;
  for (const modo of [[], ['Permissive']])
    for (const erro of [0.002, 0.005, 0.01, 0.02, 0.04, 0.08, 0.16]) {
      const [idx] = MeshoptSimplifier.simplify(g.idx, g.pos, 3, alvo * 3, erro, modo);
      const r = { idx, erro, modo: modo[0] || 'normal' };
      if (!melhor || idx.length < melhor.idx.length) melhor = r;
      if (idx.length / 3 <= alvo * 1.08) return { g: compactar(g, idx), erro, modo: r.modo };
    }
  return { g: compactar(g, melhor.idx), erro: melhor.erro, modo: melhor.modo + ' (alvo não alcançado)' };
}
// rotação em Y (graus, sentido do three.js), escala pela medida de referência e base em Y = 0, centro em X = Z = 0
function normalizar(g, m) {
  const t = (m.rotacaoY_graus * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  const rot = (a, i) => {
    const x = a[i],
      z = a[i + 2];
    a[i] = x * c + z * s;
    a[i + 2] = -x * s + z * c;
  };
  for (let i = 0; i < g.pos.length; i += 3) {
    rot(g.pos, i);
    if (g.nor) rot(g.nor, i);
  }
  const mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], g.pos[i + k]);
      mx[k] = Math.max(mx[k], g.pos[i + k]);
    }
  const medida = m.referenciaEscala === 'altura' ? mx[1] - mn[1] : Math.max(mx[0] - mn[0], mx[2] - mn[2]);
  const valor = m.referenciaEscala === 'altura' ? m.altura_m : m.comprimento_m;
  const e = valor / medida;
  const cx = (mn[0] + mx[0]) / 2,
    cz = (mn[2] + mx[2]) / 2;
  for (let i = 0; i < g.pos.length; i += 3) {
    g.pos[i] = (g.pos[i] - cx) * e;
    g.pos[i + 1] = (g.pos[i + 1] - mn[1]) * e;
    g.pos[i + 2] = (g.pos[i + 2] - cz) * e;
  }
  return { escala: e, tamanho: [(mx[0] - mn[0]) * e, (mx[1] - mn[1]) * e, (mx[2] - mn[2]) * e].map(v => +v.toFixed(3)) };
}
// normais suaves (média das faces, pesada pela área) para arquivos que vêm sem normais
function normaisSuaves(g) {
  const n = new Float32Array(g.pos.length),
    p = g.pos;
  for (let t = 0; t < g.idx.length; t += 3) {
    const [a, b, c] = [g.idx[t] * 3, g.idx[t + 1] * 3, g.idx[t + 2] * 3];
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
      v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) n[i + k] += f[k];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  g.nor = n;
  return g;
}
// pessoas geradas em pose T: os braços (|x| além do ombro, acima da cintura) giram em torno do ombro até ficarem junto
// ao corpo; uma faixa de transição no ombro evita o rasgo. Depois recentra em X e Z.
function abaixarBracos(g, { ombro: [x0, y0], angulo_graus: ang, transicao_m: tr = 0.08, cintura_m: yc = 0.9 }) {
  for (let i = 0; i < g.pos.length; i += 3) {
    const x = g.pos[i],
      y = g.pos[i + 1];
    const lado = x >= 0 ? 1 : -1,
      ax = Math.abs(x);
    if (y < yc || ax < x0 - tr) continue;
    const u = Math.min(1, (ax - (x0 - tr)) / tr),
      t = u * u * (3 - 2 * u);
    // giro no plano XY, para baixo dos dois lados
    const th = -lado * t * ((ang * Math.PI) / 180),
      c = Math.cos(th),
      s = Math.sin(th);
    const dx = x - lado * x0,
      dy = y - y0;
    g.pos[i] = lado * x0 + dx * c - dy * s;
    g.pos[i + 1] = y0 + dx * s + dy * c;
    if (g.nor) {
      const nx = g.nor[i],
        ny = g.nor[i + 1];
      g.nor[i] = nx * c - ny * s;
      g.nor[i + 1] = nx * s + ny * c;
    }
  }
  const mn = [Infinity, Infinity],
    mx = [-Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3) {
    mn[0] = Math.min(mn[0], g.pos[i]);
    mx[0] = Math.max(mx[0], g.pos[i]);
    mn[1] = Math.min(mn[1], g.pos[i + 2]);
    mx[1] = Math.max(mx[1], g.pos[i + 2]);
  }
  for (let i = 0; i < g.pos.length; i += 3) {
    g.pos[i] -= (mn[0] + mx[0]) / 2;
    g.pos[i + 2] -= (mn[1] + mx[1]) / 2;
  }
}

// ---------- texturas ----------
const OLIVA = [0x5a, 0x63, 0x40];
// amarelo e laranja saturados e claros viram verde-oliva com a mesma variação de luminância; pneus (escuros), vidros
// e metais (pouco saturados) ficam como estão
async function recolorir(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lumO = 0.299 * OLIVA[0] + 0.587 * OLIVA[1] + 0.114 * OLIVA[2];
  let n = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn;
    if (mx < 0.3 || d / mx < 0.4) continue;
    let h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    if (h < 12 || h > 65) continue;
    // transição suave na borda da faixa de matiz
    const w = Math.min(1, (h - 12) / 6, (65 - h) / 6, (d / mx - 0.4) / 0.1);
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const f = Math.min(1.6, (lum / lumO) * 0.55);
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(data[i + k] * (1 - w) + Math.min(255, OLIVA[k] * f) * w);
    n++;
  }
  return { buf: await sharp(data, { raw: info }).png().toBuffer(), fracao: n / (data.length / 3) };
}
async function codificar(buf, lado, tipo) {
  // em KTX2 a normal (UASTC, o mapa mais pesado) sai com metade do lado: mantém a pasta no orçamento de 40 MB
  if (KTX2 && tipo === 'normal') lado = Math.max(128, lado / 2);
  const img = sharp(buf).resize(lado, lado, { fit: 'inside', kernel: 'lanczos3' });
  if (!KTX2) {
    const q = tipo === 'normal' ? 88 : tipo === 'cor' ? 82 : 78;
    return { dados: await img.webp({ quality: q, effort: 5 }).toBuffer(), mime: 'image/webp' };
  }
  const tmp = join(tmpdir(), 'vm4d-' + process.pid + '-' + Math.random().toString(36).slice(2));
  await img.png().toFile(tmp + '.png');
  const opc =
    tipo === 'normal' ? ['--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '1', '--zcmp', '18', '--assign_oetf', 'linear'] : ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '128'];
  if (tipo === 'cor') opc.push('--assign_oetf', 'srgb');
  else if (tipo !== 'normal') opc.push('--assign_oetf', 'linear');
  execFileSync(TOKTX, ['--t2', '--genmipmap', ...opc, tmp + '.ktx2', tmp + '.png']);
  const dados = readFileSync(tmp + '.ktx2');
  rmSync(tmp + '.png');
  rmSync(tmp + '.ktx2');
  return { dados, mime: 'image/ktx2' };
}

// giroflex: vértices cuja cor na textura é âmbar saturado, na parte alta do modelo, agrupados (até 2 pontos)
async function giroflex(g, corBuf) {
  if (!g.uv) return [];
  const { data, info } = await sharp(corBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ymax = 0;
  for (let i = 1; i < g.pos.length; i += 3) ymax = Math.max(ymax, g.pos[i]);
  const pts = [];
  for (let v = 0; v < g.pos.length / 3; v++) {
    const y = g.pos[v * 3 + 1];
    if (y < 0.5 * ymax) continue;
    const px = Math.min(info.width - 1, Math.max(0, Math.floor((g.uv[v * 2] % 1) * info.width)));
    const py = Math.min(info.height - 1, Math.max(0, Math.floor((g.uv[v * 2 + 1] % 1) * info.height)));
    const k = (py * info.width + px) * 3;
    const r = data[k] / 255,
      gg = data[k + 1] / 255,
      b = data[k + 2] / 255;
    const mx = Math.max(r, gg, b),
      d = mx - Math.min(r, gg, b);
    if (mx < 0.7 || d / mx < 0.55) continue;
    let h = mx === r ? 60 * (((gg - b) / d) % 6) : mx === gg ? 60 * ((b - r) / d + 2) : 60 * ((r - gg) / d + 4);
    if (h < 0) h += 360;
    if (h >= 18 && h <= 50) pts.push([g.pos[v * 3], y, g.pos[v * 3 + 2]]);
  }
  const grupos = [];
  for (const p of pts.sort((a, b) => b[1] - a[1])) {
    const gr = grupos.find(q => Math.hypot(q.c[0] - p[0], q.c[1] - p[1], q.c[2] - p[2]) < 0.45);
    if (gr) {
      gr.n++;
      for (let k = 0; k < 3; k++) gr.s[k] += p[k];
    } else grupos.push({ c: p, s: [...p], n: 1 });
  }
  const bons = grupos.filter(q => q.n >= 4).map(q => q.s.map(v => +(v / q.n).toFixed(2)));
  if (!bons.length) return [];
  const topo = Math.max(...bons.map(q => q[1]));
  return bons.filter(q => q[1] > topo - 0.6).slice(0, 2);
}

// ---------- montagem de um nível ----------
async function nivel(doc0, geoms, texturas, lado) {
  const doc = cloneDocument(doc0);
  const root = doc.getRoot();
  // geometria simplificada e normalizada na primitiva; nós sem transformação
  const prims = root.listMeshes().flatMap(m => m.listPrimitives());
  prims.forEach((p, i) => {
    const g = geoms[i];
    const buf = root.listBuffers()[0];
    p.getAttribute('POSITION').setArray(g.pos);
    if (g.nor && p.getAttribute('NORMAL')) p.getAttribute('NORMAL').setArray(g.nor);
    else if (g.nor) p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setBuffer(buf).setArray(g.nor));
    else if (p.getAttribute('NORMAL')) p.setAttribute('NORMAL', null);
    if (g.uv) p.getAttribute('TEXCOORD_0').setArray(g.uv);
    for (const s of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s)) p.setAttribute(s, null);
    const ind = p.getIndices() || doc.createAccessor().setType('SCALAR').setBuffer(buf);
    ind.setArray(g.pos.length / 3 > 65535 ? g.idx : Uint16Array.from(g.idx));
    p.setIndices(ind);
  });
  for (const n of root.listNodes()) n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  // texturas
  for (const [i, t] of root.listTextures().entries()) {
    const fonte = texturas.get(i);
    if (!fonte) continue; // sem uso: sai no prune
    const { dados, mime } = await codificar(fonte.buf, lado, fonte.tipo);
    t.setImage(dados).setMimeType(mime).setURI('');
  }
  if (KTX2) doc.createExtension(KHRTextureBasisu).setRequired(true);
  else doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const ext of root.listExtensionsUsed()) if (!SUPORTADAS.has(ext.extensionName)) ext.dispose();
  await doc.transform(prune({ keepAttributes: false, keepLeaves: false }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  return io.writeBinary(doc);
}

// ---------- modelo ----------
async function processar(m) {
  const origem = resolve(BRUTOS, m.arquivo);
  const tri = Object.assign({}, CONFIG.padroes.triangulos, m.triangulos);
  const tex = Object.assign({}, CONFIG.padroes.textura, m.textura);
  const doc = await io.read(origem);
  const root = doc.getRoot();
  for (const ext of root.listExtensionsUsed()) if (!SUPORTADAS.has(ext.extensionName)) ext.dispose();
  // material sem mapa de metal/rugosidade e sem metallicFactor (padrão 1 no glTF) fica metálico e escuro: vira dielétrico
  for (const mat of root.listMaterials()) if (!mat.getMetallicRoughnessTexture() && mat.getMetallicFactor() === 1) mat.setMetallicFactor(0);
  // geometria no espaço do mundo, soldada
  const geoms = [];
  for (const n of root.listNodes()) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    for (const p of mesh.listPrimitives()) {
      const g = soldar(lerPrimitiva(p, n.getWorldMatrix()));
      geoms.push(g.nor ? g : normaisSuaves(g));
    }
  }
  const triOrig = geoms.reduce((s, g) => s + g.idx.length / 3, 0);
  // texturas de origem, classificadas pelo uso no material (cor, normal ou metal/rugosidade)
  const texturas = new Map();
  for (const mat of root.listMaterials()) {
    const usos = [
      [mat.getBaseColorTexture(), 'cor'],
      [mat.getNormalTexture(), 'normal'],
      [mat.getMetallicRoughnessTexture(), 'mr'],
      [mat.getOcclusionTexture(), 'mr'],
      [mat.getEmissiveTexture(), 'cor']
    ];
    for (const [t, tipo] of usos) {
      if (!t) continue;
      const i = root.listTextures().indexOf(t);
      if (texturas.has(i)) continue;
      let buf = Buffer.from(t.getImage());
      let fracao = 0;
      // reduz antes de recolorir (mais rápido; 2048 é mais que qualquer nível precisa)
      buf = await sharp(buf).resize(2048, 2048, { fit: 'inside' }).png().toBuffer();
      if (tipo === 'cor' && m.recolorir) ({ buf, fracao } = await recolorir(buf));
      texturas.set(i, { buf, tipo, fracao });
    }
  }
  const recolorido = [...texturas.values()].reduce((s, t) => Math.max(s, t.fracao), 0);
  // nível 0: textura e triângulos reduzidos até caber no limite
  let lado0 = tex.lod0,
    alvo0 = tri.lod0,
    g0,
    s0,
    glb0,
    info0;
  for (;;) {
    s0 = geoms.map(g => simplificar(g, Math.round((alvo0 * g.idx.length) / 3 / triOrig)));
    g0 = s0.map(r => ({ ...r.g, pos: r.g.pos.slice(), nor: r.g.nor && r.g.nor.slice() }));
    info0 = g0.map(g => normalizar(g, m))[0];
    if (m.abaixarBracos) {
      g0.forEach(g => abaixarBracos(g, m.abaixarBracos));
      // tamanho final, com os braços junto ao corpo
      const p = g0[0].pos,
        mn = [Infinity, Infinity, Infinity],
        mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i += 3)
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k], p[i + k]);
          mx[k] = Math.max(mx[k], p[i + k]);
        }
      info0.tamanho = mx.map((v, k) => +(v - mn[k]).toFixed(3));
    }
    glb0 = await nivel(doc, g0, texturas, lado0);
    if (glb0.byteLength <= LIMITE_LOD0) break;
    if (lado0 > 512) lado0 /= 2;
    else if (alvo0 > 10000) alvo0 = Math.round(alvo0 * 0.75);
    else break;
    console.log(`  ${m.id}: nível 0 com ${(glb0.byteLength / 1048576).toFixed(2)} MB; refazendo com textura ${lado0} e ${alvo0} triângulos`);
  }
  // giroflex só em veículos (campo veiculo, ou pela categoria): pessoas e objetos ficam de fora
  const VEICULO = (m.veiculo ?? ['terraplenagem', 'pavimentação', 'apoio/viaturas'].includes(m.categoria)) && !m.recolorir;
  const corTex = [...texturas.values()].find(t => t.tipo === 'cor');
  const luzes = VEICULO && corTex ? await giroflex(g0[0], corTex.buf) : [];
  // nível 1 a partir do nível 0 já normalizado
  const g1 = g0.map(g => simplificar(g, Math.round((tri.lod1 * g.idx.length) / 3 / (alvo0 || 1))).g);
  const glb1 = await nivel(doc, g1, texturas, Math.min(tex.lod1, lado0));
  writeFileSync(resolve(SAIDA, m.id + '_lod0.glb'), glb0);
  writeFileSync(resolve(SAIDA, m.id + '_lod1.glb'), glb1);
  const conta = gs => gs.reduce((s, g) => s + g.idx.length / 3, 0);
  return {
    arquivo: m.arquivo,
    mbOrigem: +(statSync(origem).size / 1048576).toFixed(1),
    triOrigem: triOrig,
    tri0: conta(g0),
    tri1: conta(g1),
    mb0: +(glb0.byteLength / 1048576).toFixed(2),
    mb1: +(glb1.byteLength / 1048576).toFixed(2),
    textura0: lado0,
    textura1: Math.min(tex.lod1, lado0),
    formato: KTX2 ? 'KTX2' : 'WebP',
    simplificacao: s0.map(r => `${r.modo}, erro ${r.erro}`).join('; '),
    escala: +info0.escala.toFixed(4),
    tamanho_m: info0.tamanho,
    recolorido: m.recolorir ? +recolorido.toFixed(3) : 0,
    giroflex: luzes
  };
}

// ---------- execução ----------
mkdirSync(SAIDA, { recursive: true });
const manifesto = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, 'utf8')) : { modelos: {} };
const hash = m =>
  createHash('sha1')
    .update(
      JSON.stringify([
        // só os campos que mudam o processamento
        [
          'arquivo',
          'categoria',
          'veiculo',
          'abaixarBracos',
          'comprimento_m',
          'altura_m',
          'referenciaEscala',
          'rotacaoY_graus',
          'recolorir',
          'triangulos',
          'textura'
        ].map(k => m[k]),
        CONFIG.padroes,
        KTX2,
        readFileSync(fileURLToPath(import.meta.url))
      ])
    )
    .digest('hex')
    .slice(0, 12);
const lista = CONFIG.modelos.filter(m => !pedidos.length || pedidos.includes(m.id));
for (const m of lista) {
  const origem = resolve(BRUTOS, m.arquivo);
  const s0 = resolve(SAIDA, m.id + '_lod0.glb'),
    s1 = resolve(SAIDA, m.id + '_lod1.glb');
  if (!existsSync(origem)) {
    if (existsSync(s0) && existsSync(s1)) console.log(`${m.id}: origem ausente, mantendo os arquivos já processados`);
    else console.warn(`${m.id}: origem ausente (${m.arquivo}) e sem arquivos processados; o app usa o modelo procedural`);
    continue;
  }
  const h = hash(m);
  const tOrig = statSync(origem).mtimeMs;
  const atual =
    !forcar &&
    existsSync(s0) &&
    existsSync(s1) &&
    statSync(s0).mtimeMs > tOrig &&
    statSync(s1).mtimeMs > tOrig &&
    manifesto.modelos[m.id] &&
    manifesto.modelos[m.id].hash === h;
  if (atual) {
    console.log(`${m.id}: já processado`);
    continue;
  }
  const t0 = Date.now();
  const r = await processar(m);
  manifesto.modelos[m.id] = { hash: h, ...r };
  console.log(
    `${m.id.padEnd(24)} ${r.triOrigem} -> ${r.tri0} / ${r.tri1} triângulos  ${r.mbOrigem} MB -> ${r.mb0} + ${r.mb1} MB  textura ${r.textura0}/${r.textura1}  ${r.simplificacao}  ${((Date.now() - t0) / 1000).toFixed(0)} s`
  );
  writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 1));
}
// arquivos de modelos que saíram do modelos.json
const ids = new Set(CONFIG.modelos.map(m => m.id));
for (const id of Object.keys(manifesto.modelos)) if (!ids.has(id)) delete manifesto.modelos[id];
manifesto.formatoTexturas = KTX2 ? 'KTX2' : 'WebP';
writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 1));

// orçamento: nível 0 e pasta (sem as árvores da Fase 6, que têm orçamento próprio)
const total = readdirSync(SAIDA)
  .filter(f => f.endsWith('.glb'))
  .reduce((s, f) => s + statSync(resolve(SAIDA, f)).size, 0);
const totalPasta = (function soma(d) {
  return readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? soma(resolve(d, e.name)) : statSync(resolve(d, e.name)).size), 0);
})(SAIDA);
const grandes = Object.entries(manifesto.modelos).filter(([, r]) => r.mb0 * 1048576 > LIMITE_LOD0);
console.log(`\nModelos GLB: ${(total / 1048576).toFixed(1)} MB; pasta public/modelos (com as árvores): ${(totalPasta / 1048576).toFixed(1)} MB (limite 40 MB)`);
if (grandes.length) console.warn('Nível 0 acima de 1,5 MB:', grandes.map(([id]) => id).join(', '));
if (totalPasta > LIMITE_PASTA) {
  console.error('A pasta public/modelos passou de 40 MB: reduza "textura" e depois "triangulos" em dados/modelos.json.');
  process.exitCode = 1;
}
