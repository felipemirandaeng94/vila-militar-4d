// Fase 7 (complemento): miniaturas dos modelos 3D em navegador headless (Playwright + three.js).
// Para cada modelo renderiza 3 vistas: 3/4 (de +X, +Y, +Z), olhando de +Z (câmera em +Z) e olhando de +X (câmera em
// +X), com eixos (X vermelho, Y verde, Z azul) e uma grade no plano y = mínimo do modelo para ver base flutuando.
// Também mede a cor predominante numa passada sem luz (albedo) na vista 3/4: cor média e frações de pixels
// amarelo/laranja, verde-oliva e escuros.
//
// Uso:
//   node scripts/assets/miniaturas-modelos.mjs                      originais de assets/brutos/modelos -> assets/miniaturas/originais
//   node scripts/assets/miniaturas-modelos.mjs --lod0 id1 id2 ...    public/modelos/<id>_lod0.glb -> assets/miniaturas/lod0
// Saída: <slug>_34.webp, <slug>_z.webp, <slug>_x.webp, <slug>.webp (as três lado a lado) e cores.json.
// as funções passadas a pg.evaluate rodam na página do navegador
/* global window, document */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const slug = s =>
  s
    .replace(/\.(glb|gltf)$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const args = process.argv.slice(2);
const modoLod = args[0] === '--lod0';
let alvos;
if (modoLod) {
  alvos = args.slice(1).map(id => ({ id, arq: resolve(RAIZ, 'public/modelos', id + '_lod0.glb') }));
} else {
  const dir = resolve(RAIZ, 'assets/brutos/modelos');
  alvos = readdirSync(dir)
    .filter(f => /\.glb$/i.test(f))
    .map(f => ({ id: slug(f), arq: resolve(dir, f) }));
  if (args.length) alvos = alvos.filter(a => args.includes(a.id));
}
const SAIDA = resolve(RAIZ, 'assets/miniaturas', modoLod ? 'lod0' : 'originais');
mkdirSync(SAIDA, { recursive: true });

// servidor local: three.js do node_modules e os modelos pedidos (/m/<n>)
const PAGINA = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body style="margin:0;background:#fff"><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const W = 512;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, W);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
window.renderizar = async url => {
  const gltf = await loader.loadAsync(url);
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const tam = box.getSize(new THREE.Vector3()), cen = box.getCenter(new THREE.Vector3());
  const R = Math.max(tam.x, tam.y, tam.z);
  const cena = new THREE.Scene();
  cena.add(obj);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(1, 2, 1.4);
  cena.add(sol);
  // grade na base do modelo e eixos na origem
  const grade = new THREE.GridHelper(R * 1.6, 16, 0x888888, 0xcccccc);
  grade.position.set(cen.x, box.min.y, cen.z);
  cena.add(grade);
  const eixos = new THREE.AxesHelper(R * 0.75);
  eixos.position.set(box.min.x, box.min.y, box.min.z);
  eixos.material.depthTest = false;
  eixos.renderOrder = 9;
  cena.add(eixos);
  const vistas = {};
  const tirar = (cam, nome) => {
    renderer.setClearColor(0xf4f4f0, 1);
    renderer.render(cena, cam);
    vistas[nome] = renderer.domElement.toDataURL('image/png');
  };
  const persp = new THREE.PerspectiveCamera(30, 1, R / 100, R * 20);
  const d = R * 2.3;
  persp.position.copy(cen).add(new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(d));
  persp.lookAt(cen);
  tirar(persp, '34');
  const h = R * 0.62;
  const orto = new THREE.OrthographicCamera(-h, h, h, -h, R / 100, R * 20);
  orto.position.set(cen.x, cen.y, cen.z + R * 3);
  orto.lookAt(cen);
  tirar(orto, 'z');
  orto.position.set(cen.x + R * 3, cen.y, cen.z);
  orto.lookAt(cen);
  tirar(orto, 'x');
  // albedo sem luz na vista 3/4 para a cor predominante
  grade.visible = eixos.visible = false;
  obj.traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: o.material.color });
  });
  renderer.setClearColor(0x000000, 0);
  renderer.render(cena, persp);
  const gl = renderer.getContext();
  const px = new Uint8Array(W * W * 4);
  gl.readPixels(0, 0, W, W, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0, r = 0, g = 0, b = 0, amarelo = 0, oliva = 0, escuro = 0, verde = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const R_ = px[i] / 255, G_ = px[i + 1] / 255, B_ = px[i + 2] / 255;
    n++; r += R_; g += G_; b += B_;
    const mx = Math.max(R_, G_, B_), mn = Math.min(R_, G_, B_), s = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx !== mn) {
      if (mx === R_) hue = 60 * (((G_ - B_) / (mx - mn)) % 6);
      else if (mx === G_) hue = 60 * ((B_ - R_) / (mx - mn) + 2);
      else hue = 60 * ((R_ - G_) / (mx - mn) + 4);
    }
    if (hue < 0) hue += 360;
    if (mx < 0.18) escuro++;
    else if (s > 0.45 && mx > 0.45 && hue >= 18 && hue < 60) amarelo++;
    else if (s > 0.2 && hue >= 45 && hue < 100 && mx < 0.6) oliva++;
    else if (s > 0.2 && hue >= 100 && hue < 170) verde++;
  }
  const f = v => +(v / Math.max(1, n)).toFixed(3);
  const hex = '#' + [r, g, b].map(v => Math.round((v / Math.max(1, n)) * 255).toString(16).padStart(2, '0')).join('');
  return { vistas, cor: { media: hex, amareloLaranja: f(amarelo), oliva: f(oliva), verde: f(verde), escuro: f(escuro) },
    caixa: { min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)) } };
};
window.pronto = true;
</script></body></html>`;

const arquivos = new Map();
const servidor = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = null;
  if (u === '/') return res.end(PAGINA);
  if (u.startsWith('/three/')) p = resolve(RAIZ, 'node_modules', u.slice(1));
  else if (u.startsWith('/m/')) p = arquivos.get(u.slice(3));
  if (!p || !existsSync(p)) {
    res.statusCode = 404;
    return res.end();
  }
  const tipos = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
  res.setHeader('Content-Type', tipos[extname(p)] || 'application/octet-stream');
  res.end(readFileSync(p));
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;

// navegador do Playwright; se a versão instalada não for a esperada pelo pacote, usa o Chromium mais novo baixado
async function abrirNavegador() {
  const args = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  try {
    return await chromium.launch({ args });
  } catch (e) {
    const base = resolve(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const exe = existsSync(base)
      ? readdirSync(base)
          .filter(d => /^chromium-\d+$/.test(d))
          .sort()
          .reverse()
          .map(d => resolve(base, d, 'chrome-win64/chrome.exe'))
          .find(existsSync)
      : null;
    if (!exe) throw e;
    console.warn('usando', exe);
    return chromium.launch({ args, executablePath: exe });
  }
}
const nav = await abrirNavegador();
const pg = await nav.newPage({ viewport: { width: 512, height: 512 } });
pg.on('pageerror', e => console.error('erro na página:', e.message));
await pg.goto(`http://127.0.0.1:${porta}/`);
await pg.waitForFunction(() => window.pronto);

const arqCores = resolve(SAIDA, 'cores.json');
const cores = existsSync(arqCores) ? JSON.parse(readFileSync(arqCores, 'utf8')) : {};
for (const a of alvos) {
  if (!existsSync(a.arq)) {
    console.warn('ausente:', relative(RAIZ, a.arq));
    continue;
  }
  arquivos.set(a.id, a.arq);
  const t0 = Date.now();
  const r = await pg.evaluate(id => window.renderizar('/m/' + encodeURIComponent(id)), a.id);
  const bufs = {};
  for (const [k, v] of Object.entries(r.vistas)) {
    bufs[k] = Buffer.from(v.split(',')[1], 'base64');
    await sharp(bufs[k])
      .resize(384)
      .webp({ quality: 78 })
      .toFile(resolve(SAIDA, `${a.id}_${k}.webp`));
  }
  // folha com as três vistas lado a lado, com legenda
  const leg = n =>
    Buffer.from(
      `<svg width="512" height="28"><rect width="512" height="28" fill="#222"/><text x="8" y="20" font-family="Arial" font-size="16" fill="#fff">${n}</text></svg>`
    );
  const pecas = await Promise.all(
    [
      ['34', `${a.id} · 3/4 (+X+Y+Z)`],
      ['z', 'olhando de +Z (X à direita)'],
      ['x', 'olhando de +X (Z à esquerda)']
    ].map(async ([k, n]) =>
      sharp({ create: { width: 512, height: 540, channels: 3, background: '#fff' } })
        .composite([
          { input: bufs[k], top: 28, left: 0 },
          { input: leg(n), top: 0, left: 0 }
        ])
        .png()
        .toBuffer()
    )
  );
  await sharp({ create: { width: 1536, height: 540, channels: 3, background: '#fff' } })
    .composite(pecas.map((input, i) => ({ input, top: 0, left: i * 512 })))
    .webp({ quality: 80 })
    .toFile(resolve(SAIDA, `${a.id}.webp`));
  cores[a.id] = { ...r.cor, caixa: r.caixa, mb: +(statSync(a.arq).size / 1048576).toFixed(2) };
  console.log(`${a.id.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)} s  cor ${r.cor.media}  amarelo ${r.cor.amareloLaranja}  oliva ${r.cor.oliva}`);
  writeFileSync(arqCores, JSON.stringify(cores, null, 1));
}
const gpu = await pg.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '';
});
console.log('GPU:', gpu);
await nav.close();
servidor.close();
