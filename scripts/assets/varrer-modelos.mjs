// Fase 7 (complemento), etapa 1: varredura dos modelos brutos em assets/brutos/modelos (sem alterar nada).
// Para cada .glb/.gltf registra tamanho, malhas, nós, vértices, triângulos, materiais, texturas (formato e resolução),
// extensões e caixa envolvente (no espaço da cena, com as transformações dos nós). Lê só o JSON e as imagens do
// arquivo, sem decodificar a geometria. Saída: assets/miniaturas/inventario.json e tabela no console.
//
// Uso: node scripts/assets/varrer-modelos.mjs
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BRUTOS = resolve(RAIZ, 'assets/brutos/modelos');
const SAIDA = resolve(RAIZ, 'assets/miniaturas/inventario.json');

function listar(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...listar(p));
    else if (/\.(glb|gltf)$/i.test(e.name)) out.push(p);
  }
  return out.sort();
}

// JSON e binário de um .glb ou .gltf (com buffers externos)
function ler(arq) {
  const buf = readFileSync(arq);
  if (extname(arq).toLowerCase() === '.gltf') {
    const json = JSON.parse(buf.toString('utf8'));
    const bins = (json.buffers || []).map(b => readFileSync(resolve(dirname(arq), decodeURIComponent(b.uri))));
    return { json, bins, dir: dirname(arq) };
  }
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  let off = 20 + len;
  const bins = [];
  while (off < buf.length) {
    const l = buf.readUInt32LE(off),
      tipo = buf.readUInt32LE(off + 4);
    if (tipo === 0x004e4942) bins.push(buf.subarray(off + 8, off + 8 + l));
    off += 8 + l;
  }
  return { json, bins, dir: dirname(arq) };
}

// matrizes 4x4 (coluna maior, como no glTF)
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mult(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
}
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1
  ];
}
const aplicar = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

async function imagem(g, img) {
  let dados = null;
  if (img.bufferView != null) {
    const v = g.json.bufferViews[img.bufferView];
    dados = g.bins[v.buffer || 0].subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  } else if (img.uri && !img.uri.startsWith('data:')) dados = readFileSync(resolve(g.dir, decodeURIComponent(img.uri)));
  if (!dados) return { formato: img.mimeType || '?', largura: 0, altura: 0, kb: 0 };
  try {
    const m = await sharp(dados).metadata();
    return { formato: m.format, largura: m.width, altura: m.height, kb: Math.round(dados.length / 1024) };
  } catch {
    return { formato: img.mimeType || '?', largura: 0, altura: 0, kb: Math.round(dados.length / 1024) };
  }
}

async function varrer(arq) {
  const g = ler(arq),
    J = g.json;
  let vertices = 0,
    triangulos = 0;
  const mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  // percorre a cena com as transformações; a caixa usa os 8 cantos de min/max de cada primitiva
  const visitar = (i, pai) => {
    const n = J.nodes[i],
      m = mult(pai, local(n));
    if (n.mesh != null)
      for (const p of J.meshes[n.mesh].primitives) {
        const a = J.accessors[p.attributes.POSITION];
        vertices += a.count;
        const modo = p.mode == null ? 4 : p.mode;
        const ni = p.indices != null ? J.accessors[p.indices].count : a.count;
        if (modo === 4) triangulos += ni / 3;
        else if (modo === 5 || modo === 6) triangulos += ni - 2;
        if (a.min && a.max)
          for (let c = 0; c < 8; c++) {
            const q = aplicar(m, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]);
            for (let k = 0; k < 3; k++) {
              mn[k] = Math.min(mn[k], q[k]);
              mx[k] = Math.max(mx[k], q[k]);
            }
          }
      }
    for (const f of n.children || []) visitar(f, m);
  };
  const cena = J.scenes ? J.scenes[J.scene || 0] : { nodes: J.nodes.map((_, i) => i) };
  for (const r of cena.nodes) visitar(r, ident());
  const texturas = [];
  for (const img of J.images || []) texturas.push(await imagem(g, img));
  const usoMat = (J.materials || []).map(m => ({
    nome: m.name || '',
    cor: m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor,
    mapas: Object.keys(m)
      .filter(k => /Texture$/.test(k))
      .concat(Object.keys(m.pbrMetallicRoughness || {}).filter(k => /Texture$/.test(k))),
    extensoes: Object.keys(m.extensions || {})
  }));
  return {
    arquivo: relative(BRUTOS, arq).replace(/\\/g, '/'),
    mb: +(statSync(arq).size / 1048576).toFixed(1),
    gerador: (J.asset && J.asset.generator) || '',
    malhas: (J.meshes || []).length,
    primitivas: (J.meshes || []).reduce((s, m) => s + m.primitives.length, 0),
    nos: (J.nodes || []).length,
    vertices,
    triangulos: Math.round(triangulos),
    materiais: usoMat,
    texturas,
    extensoesUsadas: J.extensionsUsed || [],
    extensoesObrigatorias: J.extensionsRequired || [],
    caixa: { min: mn.map(v => +v.toFixed(4)), max: mx.map(v => +v.toFixed(4)), tamanho: mx.map((v, k) => +(v - mn[k]).toFixed(4)) }
  };
}

const arquivos = listar(BRUTOS);
const lista = [];
for (const a of arquivos) {
  const r = await varrer(a);
  lista.push(r);
  const t = r.texturas.map(x => `${x.formato} ${x.largura}x${x.altura}`).join(', ');
  console.log(
    `${r.arquivo.padEnd(40)} ${String(r.mb).padStart(5)} MB  malhas ${r.malhas} nós ${r.nos}  v ${r.vertices}  t ${r.triangulos}  mat ${r.materiais.length}  tex [${t}]  ext [${r.extensoesUsadas.join(' ')}]  caixa ${r.caixa.tamanho.join(' x ')}`
  );
}
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify({ geradoEm: new Date().toISOString().slice(0, 10), modelos: lista }, null, 1));
console.log(`\n${lista.length} arquivos; inventário em ${relative(RAIZ, SAIDA)}`);
