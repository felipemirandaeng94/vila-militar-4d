import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { P, clamp, dCut, dFill, endW, estStr, gr, halfB, lerp, nat, nf, sg } from './geo.js';
import { CENARIOS, OBRA, OBRA_Q, USINA, buildFronts, buildSchedule, buildTests, rng } from './data.js';
import {
  C,
  EXAG,
  bx,
  info,
  lin,
  mat,
  mkBuilding,
  mkContainer,
  mkDozer,
  mkExcavator,
  mkFlag,
  mkGrader,
  mkLoader,
  mkMill,
  mkPaver,
  mkPile,
  mkRoller,
  mkTractor,
  mkTree,
  mkTripod,
  mkTruck,
  mkUsina,
  stateAt,
  surfC,
  terrainC,
  terrainGrid,
  wx,
  wy
} from './scene.js';
import { hideInfo, selectTest, showInfo } from './ui.js';
import { GAME } from './game.js';

// ==APLICAÇÃO 3D==
let Q,
  SVC,
  F,
  TT,
  DB,
  DF,
  END = 34,
  CEN = 'nenhum',
  OPT = {};
// módulos ES não reatribuem variáveis importadas: as escritas vindas de outros módulos passam por estas funções
const setQ = v => {
  Q = v;
};
const setCEN = v => {
  CEN = v;
};
const resetTerrKey = () => {
  lastTerrKey = '';
};
const setCamAnim = v => {
  camAnim = v;
};
const ST = { day: END, playing: false, speed: 1, follow: false, view: 'iso', sel: null, lay: {}, vexag: 1 };

function rebuild() {
  OPT = typeof GAME !== 'undefined' && GAME.on ? GAME.opt() : CENARIOS[CEN].opt;
  SVC = buildSchedule(OPT);
  F = buildFronts(SVC, Q);
  const r = buildTests(SVC, Q, OPT, F);
  TT = r.T;
  DB = r.dBase;
  DF = r.dFin;
  END = Math.max(...SVC.map(s => s.b));
}

// extensão de cada camada do corpo do aterro (para posicionar a frente)
let LIFTX = [];
function liftExtents() {
  LIFTX = [];
  for (let k = 0; k < Q.nLifts; k++) {
    const lvl = Q.minNat + P.LIFT * (k + 1);
    let a = null,
      b = null;
    for (let s = 0; s <= P.L; s += 2)
      if (nat(s, 0) < Math.min(lvl, sg(s) - P.E_CF) - 0.05) {
        if (a == null) a = s;
        b = s;
      }
    LIFTX.push(a == null ? [Q.sFill0, Q.sFill1] : [a, b]);
  }
}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let renderer, lr, scene, camera, controls, root, sunL;
let terr,
  terrGeo,
  TG,
  lastTerrKey = '';
const LAY = {}; // grupos de camadas
const PAV = {}; // malhas de pavimento
const EQ = []; // equipamentos
let USI,
  markers = [],
  labels = [],
  trees = [],
  steam = [],
  selRing;
const ray = new THREE.Raycaster(),
  mouse = new THREE.Vector2();

function initScene() {
  const vp = document.getElementById('viewport');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  vp.appendChild(renderer.domElement);
  lr = new CSS2DRenderer();
  lr.domElement.style.position = 'absolute';
  lr.domElement.style.inset = '0';
  lr.domElement.style.pointerEvents = 'none';
  vp.appendChild(lr.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 3000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 6;
  controls.maxDistance = 900;
  scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x4a5236, 0.55 * Math.PI));
  sunL = new THREE.DirectionalLight(0xfff1dc, 1.9 * Math.PI);
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
  root = new THREE.Group();
  scene.add(root);
  ['terreno', 'entorno', 'pavimento', 'canteiro', 'usina', 'equip', 'ensaios', 'rotulos'].forEach(k => {
    LAY[k] = new THREE.Group();
    root.add(LAY[k]);
  });
  applyTheme();
  buildTerrain();
  buildSurroundings();
  buildPavement();
  buildCanteiro();
  buildEquipment();
  buildMarkers();
  buildLabels();
  const ro = new ResizeObserver(resize);
  ro.observe(vp);
  resize();
  setView('iso', true);
  renderer.domElement.addEventListener('pointerdown', e => {
    ST._pd = [e.clientX, e.clientY];
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (ST._pd && Math.hypot(e.clientX - ST._pd[0], e.clientY - ST._pd[1]) < 5) pick(e);
  });
  controls.addEventListener('start', () => {
    if (ST.follow) {
      ST.follow = false;
      const ck = document.getElementById('optFollow');
      if (ck) ck.checked = false;
    }
  });
}
function applyTheme() {
  const bg = new THREE.Color(css('--scene') || '#dfe6dd');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg.clone(), 420, 1100); // a cor já entra linear (ColorManagement)
}
function resize() {
  const vp = document.getElementById('viewport');
  const w = vp.clientWidth,
    h = vp.clientHeight;
  renderer.setSize(w, h);
  lr.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ---------- terreno ----------
function buildTerrain() {
  TG = terrainGrid();
  const nS = TG.S.length,
    nZ = TG.Z.length;
  terrGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(nS * nZ * 3),
    col = new Float32Array(nS * nZ * 3),
    idx = [];
  for (let i = 0; i < nS; i++)
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j;
      pos[k * 3] = wx(TG.S[i]);
      pos[k * 3 + 2] = TG.Z[j];
    }
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < nZ - 1; j++) {
      const a = i * nZ + j,
        b = a + nZ;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  terrGeo.setIndex(idx);
  terrGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  terr = new THREE.Mesh(terrGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terr.receiveShadow = true;
  terr.userData.terrain = 1;
  LAY.terreno.add(terr);
  // noise determinístico para variar a grama
  TG.noise = new Float32Array(nS * nZ);
  const R = rng(77);
  for (let k = 0; k < TG.noise.length; k++) TG.noise[k] = R();
}
function terrainPrep() {
  const nS = TG.S.length,
    nZ = TG.Z.length,
    N = nS * nZ;
  TG.N = new Float32Array(N);
  TG.DC = new Float32Array(N);
  TG.DF = new Float32Array(N);
  for (let i = 0; i < nS; i++) {
    const s = TG.S[i],
      sc = clamp(s, 0, P.L);
    for (let j = 0; j < nZ; j++) {
      const k = i * nZ + j,
        z = TG.Z[j];
      TG.N[k] = nat(s, z);
      TG.DC[k] = dCut(sc, z);
      TG.DF[k] = dFill(sc, z);
    }
  }
  TG.W = TG.S.map(endW);
  TG.SG = TG.S.map(s => sg(clamp(s, 0, P.L)));
  TG.i0 = TG.S.findIndex(s => s >= -26);
  TG.i1 = TG.S.length - 1 - [...TG.S].reverse().findIndex(s => s <= P.L + 26);
  TG.j0 = TG.Z.findIndex(z => z >= -15);
  TG.j1 = TG.Z.length - 1 - [...TG.Z].reverse().findIndex(z => z <= 15);
  TG.full = true;
}
function updateTerrain(st) {
  const key = [st.limp, st.pc, st.ck, st.cf, st.reg, st.hydro].map(v => v.toFixed(3)).join('|');
  if (key === lastTerrKey) return;
  lastTerrKey = key;
  if (!TG.N) terrainPrep();
  const nS = TG.S.length,
    nZ = TG.Z.length,
    pos = terrGeo.attributes.position.array,
    col = terrGeo.attributes.color.array,
    nor = terrGeo.attributes.normal ? terrGeo.attributes.normal.array : null;
  const full = TG.full || !nor;
  TG.full = false;
  const I0 = full ? 0 : TG.i0,
    I1 = full ? nS - 1 : TG.i1,
    J0 = full ? 0 : TG.j0,
    J1 = full ? nZ - 1 : TG.j1;
  const c = P.CANT,
    minN = OBRA_Q.minNat;
  const corpoTop = minN + P.LIFT * st.ck;
  for (let i = I0; i <= I1; i++) {
    const s = TG.S[i],
      w = TG.W[i],
      sgv = TG.SG[i];
    for (let j = J0; j <= J1; j++) {
      const z = TG.Z[j],
        k = i * nZ + j,
        n = TG.N[k],
        dc = TG.DC[k],
        df = TG.DF[k];
      let y = n;
      if (w > 0) {
        if (n > dc) y = n - st.pc * (n - dc) * w;
        else if (n < df) {
          const top = st.cf > 0 ? df - P.E_CF + P.LIFT_CF * st.cf : Math.min(corpoTop, df - P.E_CF);
          y = Math.max(n, n + (Math.min(df, top) - n) * w);
        }
      }
      pos[k * 3 + 1] = wy(y);
      const nz = TG.noise[k];
      let cc = nz < 0.5 ? C.soilNat : C.grass2;
      const mixN = 0.06 * (nz - 0.5);
      if (s > c.s0 - 4 && s < c.s1 + 4 && z > c.z0 - 4 && z < c.z1 + 4) cc = C.pad;
      if (s >= -28 && s <= P.L + 6 && s <= st.limp && Math.abs(z) <= (s < 0 ? 5 : 7.5 + Math.abs(sgv - n) * 1.6)) cc = C.soilClear;
      if (w > 0) {
        const tal = Math.abs(z) > halfB + 0.25;
        if (n > dc && st.pc > 0.01) cc = tal ? C.soilCutT : C.soilCut;
        else if (n < df && y > n + 0.03) {
          cc = st.cf > 0 && y > df - P.E_CF + 0.02 ? C.fillCF : C.fillCorpo;
          if (tal) cc = [cc[0] * 0.86, cc[1] * 0.84, cc[2] * 0.84];
        }
        if (Math.abs(z) <= halfB + 0.3 && s >= 0 && s <= P.L && s <= st.reg && Math.abs(y - sgv) < 0.05) cc = C.reg;
        if (st.hydro > 0 && Math.abs(z) > halfB + 0.6 && (n > dc + 0.05 || (n < df && y > n + 0.05))) {
          const t = st.hydro;
          cc = [lerp(cc[0], C.hydro[0], t), lerp(cc[1], C.hydro[1], t), lerp(cc[2], C.hydro[2], t)];
        }
      }
      const dep = n - y;
      if (dep > 0.02 || dep < -0.02) {
        const f = dep > 0 ? 1 - 0.16 * Math.min(1, dep / 2.5) : 1 + 0.05 * Math.min(1, -dep / 2.5);
        cc = [cc[0] * f, cc[1] * f, cc[2] * f];
      }
      col[k * 3] = Math.pow(cc[0] + mixN, 2.2);
      col[k * 3 + 1] = Math.pow(cc[1] + mixN, 2.2);
      col[k * 3 + 2] = Math.pow(cc[2] + mixN, 2.2);
    }
  }
  // normais por diferenças centrais na grade estruturada
  if (!nor) terrGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nS * nZ * 3), 3));
  const nn = terrGeo.attributes.normal.array;
  for (let i = Math.max(0, I0 - 1); i <= Math.min(nS - 1, I1 + 1); i++) {
    const ia = Math.max(0, i - 1),
      ib = Math.min(nS - 1, i + 1),
      dx = TG.S[ib] - TG.S[ia];
    for (let j = Math.max(0, J0 - 1); j <= Math.min(nZ - 1, J1 + 1); j++) {
      const ja = Math.max(0, j - 1),
        jb = Math.min(nZ - 1, j + 1),
        dz = TG.Z[jb] - TG.Z[ja];
      const gx = (pos[(ib * nZ + j) * 3 + 1] - pos[(ia * nZ + j) * 3 + 1]) / dx,
        gz = (pos[(i * nZ + jb) * 3 + 1] - pos[(i * nZ + ja) * 3 + 1]) / dz;
      const l = Math.hypot(gx, 1, gz),
        k = (i * nZ + j) * 3;
      nn[k] = -gx / l;
      nn[k + 1] = 1 / l;
      nn[k + 2] = -gz / l;
    }
  }
  terrGeo.attributes.position.needsUpdate = true;
  terrGeo.attributes.color.needsUpdate = true;
  terrGeo.attributes.normal.needsUpdate = true;
  if (full) terrGeo.computeBoundingSphere();
  // árvores removidas pela limpeza
  for (const t of trees) t.visible = !(t.userData.inFoot && st.limp >= t.userData.s);
}

// ---------- vias existentes, edificações e vegetação ----------
function ribbon(pts, w, m, lift = 0.06) {
  // pts: [[s,z],...]; segue o terreno natural
  const geo = new THREE.BufferGeometry(),
    pos = [],
    idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [s, z] = pts[i],
      [s2, z2] = pts[Math.min(i + 1, pts.length - 1)],
      [s0, z0] = pts[Math.max(i - 1, 0)];
    let dx = s2 - s0,
      dz = z2 - z0;
    const l = Math.hypot(dx, dz) || 1;
    const nx = ((-dz / l) * w) / 2,
      nz = ((dx / l) * w) / 2;
    for (const sg_ of [-1, 1]) {
      const ps = s + nx * sg_,
        pz = z + nz * sg_;
      pos.push(wx(ps), wy(nat(ps, pz)) + lift, pz);
    }
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m);
  o.receiveShadow = true;
  return o;
}
function buildSurroundings() {
  const asf = mat(0x55595a, { roughness: 0.92 }),
    side = mat(0xbdb8aa);
  const av = [];
  for (let z = -150; z <= 90; z += 3) av.push([-30, z]);
  LAY.entorno.add(
    info(ribbon(av, 9, asf), 'Avenida existente da Vila Militar', { Uso: 'Acesso do canteiro, da jazida e da pedreira', Pavimento: 'CBUQ existente' })
  );
  LAY.entorno.add(
    ribbon(
      av.map(([s, z]) => [s - 6, z]),
      2.2,
      side,
      0.12
    )
  );
  LAY.entorno.add(
    ribbon(
      av.map(([s, z]) => [s + 6, z]),
      2.2,
      side,
      0.12
    )
  );
  const av2 = [];
  for (let z = -150; z <= 90; z += 3) av2.push([332, z]);
  LAY.entorno.add(info(ribbon(av2, 9, asf), 'Rua existente da Vila Militar', { Uso: 'Saída leste da via nova' }));
  // faixa central tracejada
  const dash = mat(0xe8c34a, { roughness: 0.6 });
  for (const sx of [-30, 332])
    for (let z = -146; z <= 86; z += 8) {
      const d = bx(0.15, 0.03, 4, dash, wx(sx), wy(nat(sx, z)) + 0.09, z);
      d.castShadow = false;
      LAY.entorno.add(d);
    }
  // acesso do canteiro à avenida
  const ac = [];
  for (let s = -30; s <= 6; s += 2) ac.push([s, -86]);
  LAY.entorno.add(ribbon(ac, 8, mat(0x8b8577, { roughness: 1 }), 0.05));
  // edificações (casario e quartéis no padrão da Vila Militar)
  const R = rng(9);
  const blds = [
    [40, 64, 34, 12, 2],
    [95, 66, 30, 12, 2],
    [150, 62, 36, 12, 2],
    [215, 66, 32, 12, 2],
    [272, 62, 30, 12, 2],
    [-70, 20, 28, 14, 2],
    [-72, -40, 30, 14, 1],
    [372, 10, 26, 14, 2],
    [370, -55, 30, 12, 2],
    [205, -70, 40, 14, 2],
    [262, -96, 30, 12, 1]
  ];
  for (const [s, z, w, d, f] of blds) {
    const b = mkBuilding(w, d, f);
    b.position.set(wx(s), wy(nat(s, z)), z);
    b.rotation.y = R() < 0.5 ? 0 : 0.0;
    LAY.entorno.add(info(b, 'Edificação existente da Vila Militar', { Uso: 'Instalações militares', Interferência: 'Nenhuma; fora da faixa da obra' }));
  }
  // vegetação
  const RT = rng(31);
  for (let i = 0; i < 230; i++) {
    const s = -85 + RT() * 470,
      z = -145 + RT() * 230;
    if (Math.abs(s + 30) < 10 || Math.abs(s - 332) < 10) continue;
    const c = P.CANT;
    if (s > c.s0 - 8 && s < c.s1 + 8 && z > c.z0 - 8 && z < c.z1 + 8) continue;
    if (blds.some(([bs, bz, w, d]) => Math.abs(s - bs) < w / 2 + 4 && Math.abs(z - bz) < d / 2 + 4)) continue;
    if (Math.abs(z + 86) < 6 && s < 10 && s > -30) continue;
    const inFoot = s > -4 && s < P.L + 4 && Math.abs(z) < 11;
    if (!inFoot && Math.abs(z) < 16 && s > -10 && s < P.L + 10) continue;
    const t = mkTree(RT, 6 + RT() * 7);
    t.position.set(wx(s), wy(nat(s, z)) - 0.1, z);
    t.rotation.y = RT() * 6;
    t.userData = { s, inFoot };
    info(
      t,
      inFoot ? 'Árvore na faixa da obra' : 'Vegetação existente',
      inFoot ? { Serviço: 'Removida na limpeza (S04)', Norma: 'DNIT 104/2009-ES' } : { Situação: 'Preservada' }
    );
    trees.push(t);
    LAY.entorno.add(t);
  }
}

// ---------- pavimento (malhas com plano de corte = frente de serviço) ----------
function strip(z0, z1, bot, top, m) {
  const geo = new THREE.BufferGeometry(),
    pos = [],
    idx = [];
  const st = 2;
  let n = 0;
  for (let s = 0; s <= P.L; s += st) {
    const b = wy(bot(s)),
      t = wy(top(s)),
      x = wx(s);
    pos.push(x, t, z0, x, t, z1, x, b, z1, x, b, z0);
    n++;
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4,
      b = a + 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // topo
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // lado z1
    idx.push(a + 3, b + 3, a, a, b + 3, b); // lado z0
  }
  idx.push(0, 1, 3, 1, 2, 3); // testa
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m);
  o.castShadow = false;
  o.receiveShadow = true;
  return o;
}
function buildPavement() {
  for (const k in PAV) {
    LAY.pavimento.remove(PAV[k]);
    PAV[k].geometry.dispose();
  }
  const E = EXAG;
  const mk = (k, z0, z1, bot, top, color, opts, nome, d) => {
    const m = lin(
      new THREE.MeshStandardMaterial(
        Object.assign(
          {
            color,
            roughness: 0.9,
            metalness: 0,
            clippingPlanes: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), -999)],
            clipShadows: true,
            side: THREE.DoubleSide
          },
          opts
        )
      )
    );
    const o = strip(z0, z1, bot, top, m);
    o.userData.info = { t: nome, d };
    PAV[k] = o;
    LAY.pavimento.add(o);
  };
  const b0 = s => sg(s),
    b1 = s => sg(s) + P.E_SB * E,
    b2 = s => sg(s) + (P.E_SB + P.E_BA) * E,
    b3 = s => sg(s) + P.E_PAV * E;
  mk('sb', -P.W_SB / 2, P.W_SB / 2, b0, b1, 0xb79a72, {}, 'Sub-base de solo-brita', {
    Espessura: '20 cm',
    Largura: '8,0 m',
    Norma: 'DNIT 139/2010-ES',
    'GC mínimo': '100 %'
  });
  mk('ba', -P.W_BA / 2, P.W_BA / 2, b1, b2, 0x9d9d97, {}, 'Base de brita graduada', {
    Espessura: '15 cm',
    Largura: '7,6 m',
    Norma: 'DNIT 141/2022-ES',
    'GC mínimo': '100 %'
  });
  const film = 0.012 * Math.max(1, E);
  mk('impBD', 0, P.W_BA / 2, b2, s => b2(s) + film, 0x5a3d26, { roughness: 0.5 }, 'Imprimação com CM-30 (bordo direito)', {
    Taxa: '1,20 L/m²',
    Norma: 'DNIT 144/2014-ES'
  });
  mk('impBE', -P.W_BA / 2, 0, b2, s => b2(s) + film, 0x5a3d26, { roughness: 0.5 }, 'Imprimação com CM-30 (bordo esquerdo)', {
    Taxa: '1,20 L/m²',
    Norma: 'DNIT 144/2014-ES'
  });
  mk('pinBD', 0, P.W_RV / 2, b2, s => b2(s) + film * 1.6, 0x231d19, { roughness: 0.5, metalness: 0 }, 'Pintura de ligação RR-1C (BD)', {
    Taxa: '0,90 L/m² diluída 1:1',
    Norma: 'DNIT 145/2012-ES'
  });
  mk('pinBE', -P.W_RV / 2, 0, b2, s => b2(s) + film * 1.6, 0x231d19, { roughness: 0.5, metalness: 0 }, 'Pintura de ligação RR-1C (BE)', {
    Taxa: '0,90 L/m² diluída 1:1',
    Norma: 'DNIT 145/2012-ES'
  });
  mk('rvBD', 0, P.W_RV / 2, b2, b3, 0x2e3133, { roughness: 0.78 }, 'Revestimento em CBUQ (faixa direita)', {
    Espessura: '5 cm',
    Faixa: 'C-12,5',
    Ligante: 'CAP 50/70 · 5,6 %',
    Norma: 'DNIT 031/2024-ES'
  });
  mk('rvBE', -P.W_RV / 2, 0, b2, b3, 0x2e3133, { roughness: 0.78 }, 'Revestimento em CBUQ (faixa esquerda)', {
    Espessura: '5 cm',
    Faixa: 'C-12,5',
    Ligante: 'CAP 50/70 · 5,6 %',
    Norma: 'DNIT 031/2024-ES'
  });
  // faixa central (após o controle final)
  const lines = new THREE.Group();
  lines.name = 'sinal';
  for (let s = 4; s < P.L; s += 12) {
    const d = bx(4, 0.02, 0.12, mat(0xf2f0e6, { roughness: 0.6 }), wx(s), wy(b3(s)) + 0.012, 0);
    d.castShadow = false;
    lines.add(d);
  }
  [-1, 1].forEach(sd => {
    const l = bx(P.L, 0.02, 0.1, mat(0xf2f0e6), 0, 0, sd * (P.W_RV / 2 - 0.15));
    l.castShadow = false;
    l.position.set(0, wy(b3(150)) + 0.012, sd * (P.W_RV / 2 - 0.15));
    l.rotation.z = Math.atan(P.GRI);
    lines.add(l);
  });
  PAV.sinal = lines;
  LAY.pavimento.add(lines);
}
function updatePavement(st) {
  const cut = (k, f) => {
    const p = PAV[k];
    p.material.clippingPlanes[0].constant = f <= 0.01 ? -999 : wx(f);
    p.visible = f > 0.01;
  };
  cut('sb', st.sb);
  cut('ba', st.ba);
  // imprimação some sob a pintura; pintura some sob o CBUQ
  cut('impBD', st.impBD);
  cut('impBE', st.impBE);
  cut('pinBD', st.pinBD);
  cut('pinBE', st.pinBE);
  cut('rvBD', st.rvBD);
  cut('rvBE', st.rvBE);
  const s16 = SVC.find(s => s.id === 'S16');
  PAV.sinal.visible = st.d >= s16.b - 0.3;
}

// ---------- canteiro ----------
const SITE = {};
function placeOn(o, s, z, rot = 0) {
  o.position.set(wx(s), wy(nat(s, z)), z);
  o.rotation.y = rot;
  return o;
}
function buildCanteiro() {
  const cs = [
    [
      'Escritório da obra e da fiscalização',
      0xe6e8e2,
      12,
      -48,
      { Uso: 'Engenheiro residente, fiscalização e arquivo técnico', Documentos: 'Diário de obra, BLC, notas de serviço' }
    ],
    [
      'Laboratório de solos e asfalto',
      0xdfe8e1,
      20,
      -48,
      { Uso: 'Ensaios de campo e de laboratório', Equipamentos: 'Estufa, balanças, frasco de areia, Speedy, prensa CBR, compactador Marshall, Rotarex' }
    ],
    ['Almoxarifado', 0xc9cec5, 28, -48, { Uso: 'Ferramentas, EPI, peças e lonas' }],
    ['Refeitório', 0xe6e8e2, 12, -56, { Uso: 'Efetivo da obra' }],
    ['Sanitários e vestiário', 0xe6e8e2, 20, -56, { Uso: 'Efetivo da obra' }]
  ];
  cs.forEach(([n, c, s, z, d], i) => {
    const o = mkContainer(c);
    placeOn(o, s, z);
    info(o, n, d);
    o.userData.mob = 0.08 + i * 0.12;
    LAY.canteiro.add(o);
    if (n.startsWith('Lab')) SITE.lab = o;
  });
  const fl = mkFlag();
  placeOn(fl, 4, -46);
  info(fl, 'Mastro com a Bandeira Nacional', { Local: 'Entrada do canteiro' });
  fl.userData.mob = 0.7;
  LAY.canteiro.add(fl);
  SITE.flag = fl.userData.flag;
  const pl = new THREE.Group();
  pl.add(bx(0.15, 3.2, 0.15, mat(C.greyD), -1.8, 1.6, 0));
  pl.add(bx(0.15, 3.2, 0.15, mat(C.greyD), 1.8, 1.6, 0));
  pl.add(bx(4.2, 2.2, 0.08, mat(0xf4f1e8), 0, 3.0, 0));
  pl.add(bx(4.2, 0.5, 0.09, mat(0x2f5c3a), 0, 3.85, 0));
  placeOn(pl, -6, -41, Math.PI / 2);
  info(pl, 'Placa da obra', { Obra: 'Implantação de via interna em CBUQ', Local: 'Vila Militar, Deodoro (RJ)', Execução: OBRA.om });
  pl.userData.mob = 0.8;
  LAY.canteiro.add(pl);
  // baias de agregados (alimentação da usina)
  const piles = [
    ['Brita 1', 0x8d8f8c, 5.2, 3.0],
    ['Brita 0', 0xa8aaa6, 5.0, 2.8],
    ['Pó de pedra', 0xc7c6c0, 5.2, 2.6],
    ['Areia média', 0xcdb88d, 5.0, 2.4],
    ['Brita graduada (base)', 0x9d9d97, 6.0, 3.0],
    ['Solo-brita (sub-base)', 0xb79a72, 6.0, 2.8]
  ];
  piles.forEach(([n, c, r, h], i) => {
    const p = mkPile(r, h, c);
    const s = 100 + (i % 3) * 12,
      z = -100 + Math.floor(i / 3) * 12;
    placeOn(p, s, z);
    p.position.y += 0;
    info(p, 'Estoque: ' + n, { Uso: i < 4 ? 'Agregado do CBUQ' : 'Material de camada granular', Controle: 'Granulometria a cada 4 h na produção' });
    p.userData.mob = 0.86 + i * 0.02;
    LAY.canteiro.add(p);
  });
  for (let i = 0; i < 4; i++) {
    const w = bx(0.4, 1.6, 12, mat(C.conc), wx(94 + i * 12), wy(22.6) + 0.8, -100);
    w.userData.mob = 0.84;
    LAY.canteiro.add(w);
  }
  // usina
  USI = mkUsina();
  USI.g.position.set(wx(60), wy(P.CANT.cota), -80);
  LAY.usina.add(
    info(USI.g, 'Usina de CBUQ contínua (tambor secador-misturador)', {
      Produção: '60 t/h',
      Ligante: 'CAP 50/70',
      Mistura: 'Faixa C-12,5 · 5,6 %',
      Norma: 'DNIT 031/2024-ES'
    })
  );
  const part = (o, n, d) => {
    o.traverse(c => {
      if (c.isMesh) c.userData.info = { t: n, d };
    });
  };
  part(USI.parts.drum, 'Tambor secador-misturador', { Função: USINA[2][1] });
  USI.g.children.forEach((c, i) => {
    if (i < 4) part(c, 'Silo dosador frio ' + (i + 1), { Material: ['Brita 1', 'Brita 0', 'Pó de pedra', 'Areia média'][i], Função: USINA[0][1] });
  });
  USI.siloS = 60 + USI.parts.siloPos.x;
  USI.siloZ = -80 + USI.parts.siloPos.z;
  // pátio de estacionamento
  for (let i = 0; i < 8; i++) {
    const l = bx(0.12, 0.02, 5, mat(0xf2f0e6), wx(64 + i * 5), wy(22.6) + 0.04, -52);
    l.castShadow = false;
    LAY.canteiro.add(l);
  }
}

function winProg(id, d) {
  const v = SVC.find(x => x.id === id);
  if (!v) return 1;
  const w = v.win ? [v.win[0][0], v.win[v.win.length - 1][1]] : [v.a, v.b];
  return clamp((d - w[0]) / (w[1] - w[0]), 0, 1);
}
function updateSite(st) {
  const d = st.d,
    pin = winProg('S01', d),
    pu = winProg('S05', d),
    pout = winProg('S17', d);
  for (const o of LAY.canteiro.children) {
    const k = o.userData.mob;
    if (k == null) continue;
    o.visible = pin >= k && pout < 1 - k * 0.5;
  }
  for (const o of USI.g.children) {
    const k = o.userData.stage;
    if (k == null) continue;
    o.visible = pu >= k && pout < 1 - k;
  }
  USI.ready = pu >= 1 && pout < 0.1;
}

// ---------- equipamentos ----------
const PARK = [];
for (let i = 0; i < 22; i++) PARK.push([40 + (i % 11) * 6.5, i < 11 ? -48 : -60]);
function addEq(id, nome, model, park, use) {
  const o = model;
  o.userData.eqId = id;
  info(o, nome, {});
  o.userData.nome = nome;
  LAY.equip.add(o);
  const e = { id, nome, o, park: PARK[park], use, mk: o.userData };
  e.o.userData.eq = e;
  EQ.push(e);
  return e;
}
function buildEquipment() {
  addEq('dozer', 'Trator de esteiras', mkDozer(), 0, ['S04', 'S06']);
  addEq('exc', 'Escavadeira hidráulica 20 t', mkExcavator(), 1, ['S06']);
  for (let i = 0; i < 4; i++) addEq('bas' + i, 'Caminhão basculante ' + (i + 1), mkTruck('bascula'), 2 + i, ['S04', 'S06', 'S08', 'S11', 'S12', 'S15', 'R2']);
  addEq('grader', 'Motoniveladora', mkGrader(), 6, ['S07', 'S08', 'S09', 'S11', 'S12', 'R1']);
  addEq('pe', 'Rolo pé-de-carneiro vibratório', mkRoller('pe'), 7, ['S07', 'S08', 'S09']);
  addEq('liso', 'Rolo liso vibratório', mkRoller('liso'), 8, ['S08', 'S09', 'S11', 'S12', 'R1']);
  addEq('pneus', 'Rolo de pneus', mkRoller('pneus'), 9, ['S11', 'S12', 'S15']);
  addEq('tandem', 'Rolo tandem vibratório', mkRoller('tandem'), 10, ['S15']);
  addEq('pipa', 'Caminhão-pipa 10 000 L', mkTruck('pipa'), 11, ['S07', 'S08', 'S09', 'S11', 'S12', 'R1']);
  addEq('grade', 'Trator com grade de discos', mkTractor('grade'), 12, ['S07']);
  addEq('esp', 'Caminhão espargidor', mkTruck('espargidor', 0x3a3d33), 13, ['S13', 'S14']);
  addEq('vass', 'Vassoura mecânica', mkTractor('vassoura'), 14, ['S13', 'S14']);
  addEq('paver', 'Vibroacabadora de esteiras', mkPaver(), 15, ['S15']);
  addEq('loader', 'Pá carregadeira', mkLoader(), 16, ['S01', 'S05', 'S10', 'S15', 'S17']);
  addEq('munck', 'Caminhão guindauto (munck)', mkTruck('munck'), 17, ['S01', 'S05', 'S17']);
  addEq('prova', 'Caminhão de prova 8,2 t + viga Benkelman', mkTruck('prova'), 18, ['S12', 'S16']);
  addEq('mill', 'Fresadora', mkMill(), 19, ['R2']);
  addEq('topo1', 'Estação total (topografia)', mkTripod(), 20, ['S02']);
  addEq('topo2', 'Nível digital (topografia)', mkTripod(), 21, ['S02']);
  // vapor sobre o CBUQ recém-lançado e na chaminé
  const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), sm.clone());
    p.visible = false;
    steam.push(p);
    LAY.equip.add(p);
  }
}
const tri = t => {
  const f = ((t % 2) + 2) % 2;
  return f < 1 ? f : 2 - f;
};
const frac = t => t - Math.floor(t);
function activeSvc(id, d) {
  const s = SVC.find(x => x.id === id);
  if (!s) return null;
  if (s.win) {
    for (const w of s.win) if (d >= w[0] && d < w[1]) return { s, w };
    return null;
  }
  for (const k in s.lanes) {
    const w = s.lanes[k];
    if (d >= w[0] && d < w[1]) return { s, w, lane: k };
  }
  return null;
}
function liftFront(st) {
  const k = Math.min(Q.nLifts - 1, Math.floor(st.ck));
  const [a, b] = LIFTX[Math.max(0, k)];
  return lerp(a, b, frac(st.ck));
}

// trajeto com paradas: pts = [{s,z,stop?,rev?,tag?}], devolve pose ao longo do ciclo u ∈ [0,1)
function pathPose(pts, u) {
  const segs = [];
  let T = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    if (a.stop) {
      segs.push({ t0: T, dt: a.stop, a, b: a, stop: a, i });
      T += a.stop;
    }
    const L = Math.hypot(b.s - a.s, b.z - a.z);
    const dt = L / 30;
    segs.push({ t0: T, dt, a, b, rev: b.rev, i });
    T += dt;
  }
  const t = frac(u) * T;
  for (const sgm of segs)
    if (t <= sgm.t0 + sgm.dt) {
      const f = sgm.dt ? (t - sgm.t0) / sgm.dt : 0;
      if (sgm.stop) return { s: sgm.a.s, z: sgm.a.z, h: sgm.a.h != null ? sgm.a.h : null, tag: sgm.stop.tag, f, i: sgm.i };
      const s = lerp(sgm.a.s, sgm.b.s, f),
        z = lerp(sgm.a.z, sgm.b.z, f);
      let h = Math.atan2(-(sgm.b.z - sgm.a.z), sgm.b.s - sgm.a.s);
      if (sgm.rev) h += Math.PI;
      return { s, z, h, moving: 1, i: sgm.i };
    }
  return { s: pts[0].s, z: pts[0].z, h: 0 };
}
function setPose(e, s, z, h, st, yOff = 0) {
  const y = surfC(s, z, st);
  e.o.position.set(wx(s), wy(y) + yOff, z);
  if (h != null) {
    let dh = h - e.o.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    // mudança de sentido maior que 120°: a máquina anda de ré em vez de girar no lugar
    if (Math.abs(dh) > 2.1 && e.kind !== 'tri') {
      dh = Math.atan2(Math.sin(dh + Math.PI), Math.cos(dh + Math.PI));
    }
    const mx = ST.playing ? 0.05 : 9;
    e.o.rotation.y += clamp(dh, -mx, mx);
  }
}
function truckLoad(e, frac_, color, tarp) {
  const u = e.mk;
  if (!u.load) return;
  u.load.visible = frac_ > 0.02;
  u.load.scale.y = Math.max(0.02, frac_);
  u.load.position.y = 0.12 + 0.5 * frac_;
  u.load.material = mat(color);
  if (u.tarp) u.tarp.visible = !!tarp && frac_ > 0.5;
}
function tilt(e, a) {
  if (e.mk.piv) e.mk.piv.rotation.z = -a;
}
// caminhão em ciclo: carrega no ponto li, descarrega no ponto di
function cycleTruck(put, id, pts, u, color, tarp, tiltMax = 0.9) {
  const li = pts.findIndex(p => p.tag === 'load'),
    di = pts.findIndex(p => p.tag === 'dump');
  const p = pathPose(pts, u);
  const e = put(id, p.s, p.z, p.h);
  if (!e) return;
  let lf;
  if (p.tag === 'load') lf = p.f;
  else if (p.tag === 'dump') lf = 1 - p.f;
  else if (li < 0)
    lf = p.i < di ? 1 : 0; // vem carregado de fora
  else lf = (li < di ? p.i >= li && p.i < di : p.i >= li || p.i < di) ? 1 : 0;
  truckLoad(e, lf, color, tarp);
  tilt(e, p.tag === 'dump' ? Math.sin((Math.min(1, p.f * 1.4) * Math.PI) / 2) * tiltMax * (p.f < 0.85 ? 1 : (1 - p.f) / 0.15) : 0);
  return e;
}

function updateEquipment(st, clk) {
  const d = st.d;
  const used = new Set();
  const act = id => activeSvc(id, d);
  const put = (id, s, z, h, yo) => {
    const e = EQ.find(x => x.id === id);
    if (!e) return;
    used.add(id);
    setPose(e, clamp(s, -40, P.L + 40), z, h, st, yo);
    return e;
  };
  const CL = { solo: 0x8a5a3a, corte: 0x9a5b38, jaz: 0xa9784a, brita: 0x8e8f8b, sb: 0xa58d6a, cbuq: 0x1f1f1f };
  // limpeza
  if (act('S04')) {
    const f = st.limp;
    put('dozer', f - 3, 4 * Math.sin(clk * 0.7), 0);
    for (let i = 0; i < 2; i++)
      cycleTruck(
        put,
        'bas' + i,
        [
          { s: f - 10, z: 3, stop: 6, tag: 'load', h: Math.PI },
          { s: -6, z: 2 },
          { s: -30, z: 10 },
          { s: -30, z: 90, stop: 2, tag: 'dump', h: Math.PI / 2 },
          { s: -28, z: 90 },
          { s: -28, z: 0 },
          { s: -4, z: -2 }
        ],
        clk / 34 + i * 0.5,
        0x6d5636,
        false,
        0.6
      );
  }
  // corte e transporte
  const a6 = act('S06'),
    a7 = act('S07');
  if (a6) {
    const sx = 8 + 116 * tri(st.pc * 3);
    const ex = put('exc', sx, 0, 0);
    const cyc = frac(clk / 7);
    const sw = cyc < 0.45 ? 0 : cyc < 0.6 ? ((cyc - 0.45) / 0.15) * 1.57 : cyc < 0.8 ? 1.57 : 1.57 - ((cyc - 0.8) / 0.2) * 1.57;
    ex.mk.up.rotation.y = -sw;
    ex.mk.b1.rotation.z = cyc < 0.45 ? -0.35 + Math.sin((cyc / 0.45) * Math.PI) * 0.2 : 0.25;
    ex.mk.b2.rotation.z = cyc < 0.45 ? -1.6 + cyc * 1.6 : -1.1;
    ex.mk.bk.rotation.z = cyc < 0.45 ? -0.6 : cyc < 0.7 ? -0.4 : 0.9;
    const sf = a7 ? liftFront(st) : 200;
    for (let i = 0; i < 4; i++) {
      const pts = [
        { s: sx + 0.5, z: 4.4, stop: 6, tag: 'load', h: 0 },
        { s: sx + 10, z: 3.5 },
        { s: sf - 10, z: 2.6 },
        { s: sf + 2, z: 0 },
        { s: sf - 4, z: -2.6, stop: 3, tag: 'dump', h: Math.PI },
        { s: sx - 12, z: -2.6 },
        { s: sx - 16, z: 1.5 },
        { s: sx - 8, z: 4.4 }
      ];
      cycleTruck(put, 'bas' + i, pts, clk / 30 + i / 4, CL.corte, false);
    }
    if (!act('S04')) put('dozer', (a7 ? liftFront(st) : 200) + 8 * Math.sin(clk * 0.5), 2.5, 0);
  }
  // corpo do aterro
  if (a7) {
    const f = liftFront(st);
    put('grader', f - 4 - 14 * tri(clk / 9), -1.5, 0);
    put('pe', f - 10 - 16 * tri(clk / 7 + 0.3), 1.6, 0);
    put('pipa', f + 6 + 10 * tri(clk / 11), -2.8, 0);
    put('grade', f - 22 - 8 * tri(clk / 8), 2.6, 0);
  }
  // camada final (material da jazida)
  const a8 = act('S08');
  if (a8) {
    const f = lerp(Q.sFill0, Q.sFill1, frac(st.cf));
    put('grader', f - 4 - 14 * tri(clk / 9), -1.5, 0);
    put('pe', f - 12 - 16 * tri(clk / 7), 1.8, 0);
    put('liso', f - 30 - 12 * tri(clk / 8), -1.6, 0);
    put('pipa', f + 8 + 10 * tri(clk / 11), 2.8, 0);
    for (let i = 0; i < 3; i++)
      cycleTruck(
        put,
        'bas' + i,
        [
          { s: -31.5, z: 95 },
          { s: -31.5, z: 4 },
          { s: 0, z: 2.6 },
          { s: f + 8, z: 2.6 },
          { s: f + 16, z: 0 },
          { s: f + 10, z: -2.6, stop: 3, tag: 'dump', h: Math.PI },
          { s: 0, z: -2.6 },
          { s: -28.5, z: -4 },
          { s: -28.5, z: 95, stop: 3, tag: 'fora' }
        ],
        clk / 40 + i / 3,
        CL.jaz,
        false
      );
  }
  // regularização
  if (act('S09')) {
    const f = st.reg;
    put('grader', Math.max(5, f + 2 - 12 * tri(clk / 9)), 0, 0);
    put('pe', Math.max(4, f - 12 - 14 * tri(clk / 7)), 1.8, 0);
    put('liso', Math.max(3, f - 30 - 12 * tri(clk / 8)), -1.6, 0);
    put('pipa', f + 10 + 8 * tri(clk / 10), 2.8, 0);
  }
  // sub-base e base
  for (const [id, key, col] of [
    ['S11', 'sb', CL.sb],
    ['S12', 'ba', CL.brita]
  ]) {
    if (!act(id)) continue;
    const f = st[key];
    const s12 = id === 'S12' ? SVC.find(s => s.id === 'S12').win[0] : null;
    if (s12 && d >= s12[1] - 0.5) {
      const p = ((d - (s12[1] - 0.5)) / 0.5) * P.L;
      const e = put('prova', p, Math.floor(p / 20) % 2 ? -1.75 : 1.75, 0);
      continue;
    }
    put('grader', Math.max(5, f + 2 - 12 * tri(clk / 9)), 0, 0);
    put('liso', Math.max(4, f - 10 - 12 * tri(clk / 7)), 1.6, 0);
    put('pneus', Math.max(3, f - 28 - 10 * tri(clk / 8)), -1.6, 0);
    put('pipa', f + 12 + 6 * tri(clk / 10), -2.6, 0);
    for (let i = 0; i < 3; i++)
      cycleTruck(
        put,
        'bas' + i,
        [
          { s: -31.5, z: 95 },
          { s: -31.5, z: 4 },
          { s: 0, z: 2.6 },
          { s: f + 12, z: 2.6 },
          { s: f + 20, z: 0 },
          { s: f + 14, z: -2.6, stop: 3, tag: 'dump', h: Math.PI },
          { s: 0, z: -2.6 },
          { s: -28.5, z: -4 },
          { s: -28.5, z: 95, stop: 3, tag: 'fora' }
        ],
        clk / 40 + i / 3,
        col,
        false
      );
  }
  // retrabalho na base
  if (act('R1')) {
    put('grader', 180 + 8 * Math.sin(clk * 0.6), -1.8, 0);
    put('pipa', 196, -2.2, Math.PI);
    put('liso', 170 + 10 * tri(clk / 6), -1.9, 0);
  }
  // imprimação e pintura (meia pista)
  for (const [id, k] of [
    ['S13', 'imp'],
    ['S14', 'pin']
  ]) {
    const a = act(id);
    if (!a) continue;
    const z = a.lane === 'BD' ? 1.9 : -1.9;
    const f = st[k + a.lane];
    const e = put('esp', f + 3.5, z, 0);
    put('vass', f + 18 + 4 * tri(clk / 3), z, 0);
  }
  // CBUQ
  const a15 = act('S15'),
    aR2 = act('R2');
  const s15 = SVC.find(s => s.id === 'S15');
  const fl = s15.falha;
  const paving = a15 || (fl && d >= fl.a && d < fl.b);
  if (paving) {
    const lane = a15 ? a15.lane : 'BD',
      z = lane === 'BD' ? 1.75 : -1.75,
      zf = -z;
    const f = st['rv' + lane];
    put('paver', f + 2.4, z, 0);
    put('pneus', Math.max(4, f - 8 - 10 * tri(clk / 5)), z, 0);
    put('tandem', Math.max(3, f - 24 - 10 * tri(clk / 6 + 0.4)), z, 0);
    put('loader', USI.siloS + 34 + 3 * Math.sin(clk * 0.8), -66 + 4 * tri(clk / 4), Math.PI / 2);
    const si = USI.siloS,
      sz = USI.siloZ;
    for (let i = 0; i < 4; i++) {
      const pts = [
        { s: si, z: sz, stop: 5, tag: 'load', h: Math.PI },
        { s: si - 20, z: sz },
        { s: -10, z: -86 },
        { s: -28.5, z: -84 },
        { s: -28.5, z: -8 },
        { s: -10, z: zf * 1.1 },
        { s: 0, z: zf },
        { s: f + 20, z: zf },
        { s: f + 27, z: z },
        { s: f + 9.2, z, rev: 1, stop: 4, tag: 'dump', h: 0 },
        { s: f + 22, z },
        { s: f + 30, z: 0 },
        { s: f + 22, z: zf * 1.15 },
        { s: 2, z: zf * 1.15 },
        { s: -20, z: -3 },
        { s: -31.5, z: -12 },
        { s: -31.5, z: -90 },
        { s: -10, z: -92 },
        { s: si + 22, z: -92 },
        { s: si + 28, z: sz }
      ];
      // ajusta o ponto de ré: rev se aplica ao trecho que chega no ponto de descarga
      pts[8].rev = 0;
      pts[9].rev = 1;
      cycleTruck(put, 'bas' + i, pts, clk / 52 + i / 4, 0x1d1d1d, true, 0.75);
    }
  }
  if (aR2) {
    put('mill', 28.6 * tri(clk / 10), 1.75, 0);
  }
  // pá carregadeira na usina
  if (!used.has('loader') && (act('S10') || act('S05') || act('S01') || act('S17')))
    put(
      'loader',
      act('S01') || act('S17') ? 30 + 6 * Math.sin(clk * 0.5) : USI.siloS + 34 + 3 * Math.sin(clk * 0.8),
      act('S01') || act('S17') ? -66 : -66 + 4 * tri(clk / 4),
      Math.PI / 2
    );
  if (act('S01') || act('S05') || act('S17')) put('munck', act('S05') ? 54 + 10 * tri(clk / 14) : 24, act('S05') ? -66 : -64, 0);
  if (act('S02')) {
    const a = act('S02');
    const t = (d - a.w[0]) / (a.w[1] - a.w[0]);
    put('topo1', Math.round(t * 15) * 20, 6, 0);
    put('topo2', Math.round(t * 15) * 20 + 40, -6, 0);
  }
  if (act('S16')) {
    const a = act('S16');
    const t = (d - a.w[0]) / (a.w[1] - a.w[0]);
    put('prova', clamp(t * 2, 0, 1) * P.L, Math.floor(t * 30) % 2 ? 1.75 : -1.75, 0);
  }
  // estacionados
  for (const e of EQ) {
    e.o.visible = ST.lay.equip !== false && (e.id !== 'mill' || used.has('mill') || OPT.rwCbuq) && (!e.id.startsWith('topo') || used.has(e.id));
    if (!used.has(e.id)) {
      setPose(e, e.park[0], e.park[1], Math.PI / 2, st);
      e.o.rotation.y = Math.PI / 2;
      tilt(e, 0);
      truckLoad(e, 0, 0x777777);
      if (e.mk.up) {
        e.mk.up.rotation.y = 0;
      }
    }
    e.o.userData.ativo = used.has(e.id);
    if (e.mk.beacon)
      e.mk.beacon.material = used.has(e.id) && Math.sin(clk * 8) > 0 ? mat(0xffc533, { emissive: 0xffa500 }) : mat(C.yellow, { emissive: 0x2a1d00 });
    if (e.mk.drums && used.has(e.id)) e.mk.drums.forEach(dr => (dr.rotation.z -= 0.05));
    if (e.mk.brush && used.has(e.id)) e.mk.brush.rotation.y += 0.3;
  }
  // usina operando
  const on = !!(paving || (act('S10') && d > SVC.find(s => s.id === 'S10').win[0][1] - 2)) && USI.ready;
  USI.parts.drum.rotation.y += on ? 0.03 : 0;
  USI.parts.flame.material.opacity = on ? 0.55 + 0.25 * Math.sin(clk * 9) : 0;
  // vapor
  let si = 0;
  const puff = (x, y, z, sz, ph) => {
    const p = steam[si++];
    if (!p) return;
    const t = frac(clk / 3 + ph);
    p.visible = true;
    p.position.set(x + t * 1.5, y + t * 6, z);
    p.scale.setScalar(sz * (0.6 + t));
    p.material.opacity = 0.16 * (1 - t);
  };
  if (on)
    for (let i = 0; i < 8; i++) {
      const v = USI.parts.chimney;
      puff(USI.g.position.x + v.x, USI.g.position.y + v.y, USI.g.position.z + v.z, 1.3, i / 8);
    }
  if (paving) {
    const lane = a15 ? a15.lane : 'BD',
      z = lane === 'BD' ? 1.75 : -1.75,
      f = st['rv' + lane];
    for (let i = 0; i < 12; i++) {
      const ss = f - 2 - (i / 12) * 26;
      puff(wx(ss), wy(gr(Math.max(0, ss))) + 0.3, z + ((i % 3) - 1) * 1.1, 0.9, i * 0.37);
    }
  }
  for (; si < steam.length; si++) steam[si].visible = false;
  if (SITE.flag) SITE.flag.rotation.y = Math.sin(clk * 1.3) * 0.15;
}

// ---------- marcadores de ensaio ----------
function buildMarkers() {
  markers.forEach(m => LAY.ensaios.remove(m));
  markers = [];
  const stem = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
    head = new THREE.SphereGeometry(0.42, 16, 12);
  for (const t of TT) {
    if (t.s == null) continue;
    const g = new THREE.Group();
    const c = t.ok ? css('--ok') : css('--bad');
    const st_ = new THREE.Mesh(stem, mat(0xf2f0e6));
    st_.position.y = 0.8;
    g.add(st_);
    const hd = new THREE.Mesh(head, lin(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 })));
    hd.position.y = 1.75;
    g.add(hd);
    g.position.set(wx(t.s), wy(t.y) + (t.layer === 'rv' ? 0 : 0), t.z);
    const ex =
      t.layer === 'sb'
        ? P.E_SB * (EXAG - 1)
        : t.layer === 'ba' || t.layer === 'imp'
          ? (P.E_SB + P.E_BA) * (EXAG - 1)
          : t.layer === 'rv' || t.layer === 'pin'
            ? (t.layer === 'rv' ? P.E_PAV : P.E_SB + P.E_BA) * (EXAG - 1)
            : 0;
    g.position.y += ex;
    g.traverse(o => {
      if (o.isMesh) o.userData.test = t;
    });
    g.userData.test = t;
    g.userData.head = hd;
    markers.push(g);
    LAY.ensaios.add(g);
  }
  if (!selRing) {
    selRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    selRing.rotation.x = Math.PI / 2;
    LAY.ensaios.add(selRing);
  }
}
function updateMarkers(st, clk) {
  const d = st.d;
  for (const g of markers) {
    const t = g.userData.test;
    const vis = d >= t.day && (t.until == null || d < t.until || ST.sel === t);
    g.visible = vis;
    if (vis) {
      const a = Math.min(1, (d - t.day) * 6);
      g.scale.setScalar(0.4 + 0.6 * a);
    }
  }
  // laboratório / usina pulsam quando há ensaio no dia
  const near = TT.filter(t => t.s == null && Math.abs(t.day - d) < 0.35);
  ST.labPulse = near.length;
  if (ST.sel && ST.sel.s != null) {
    const g = markers.find(m => m.userData.test === ST.sel);
    selRing.visible = !!g && g.visible;
    if (g) {
      selRing.position.set(g.position.x, g.position.y + 0.05, g.position.z);
      selRing.scale.setScalar(1 + 0.25 * Math.sin(clk * 5));
    }
  } else selRing.visible = false;
}

// ---------- rótulos ----------
function lbl(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.innerHTML = text;
  return new CSS2DObject(el);
}
function buildLabels() {
  labels.forEach(l => {
    l.parent && l.parent.remove(l);
  });
  labels = [];
  for (let e = 0; e <= 15; e++) {
    const s = e * 20;
    const stake = new THREE.Group();
    const p = bx(0.1, 1.2, 0.1, mat(0xd9a21b), 0, 0.6, 0);
    stake.add(p);
    stake.position.set(wx(s), wy(nat(s, 7.2)), 7.2);
    LAY.rotulos.add(stake);
    const L = lbl('Est. ' + e + (e === 0 ? ' <small>0+00</small>' : ''));
    L.position.set(0, 1.8, 0);
    stake.add(L);
    labels.push(L);
    stake.userData.s = s;
  }
  const add = (txt, x, y, z, cls, site) => {
    const L = lbl(txt, cls);
    L.position.set(x, y, z);
    L.userData.site = !!site;
    LAY.rotulos.add(L);
    labels.push(L);
    return L;
  };
  add('Usina de CBUQ', wx(60), wy(P.CANT.cota) + 15, -80, 'room', 1);
  add('Laboratório', wx(20), wy(P.CANT.cota) + 4.6, -48, 'room', 1);
  add('Estoques de agregados', wx(112), wy(P.CANT.cota) + 5, -94, '', 1);
  add('Jazida de empréstimo e pedreira ↑', wx(-30), wy(nat(-30, 84)) + 4, 84, '', 1);
  add('Avenida existente', wx(-30), wy(nat(-30, -130)) + 3, -130, '', 1);
  add('Trecho em corte', wx(60), wy(nat(60, 0)) + 4, 9, '');
  add('Trecho em aterro', wx(215), wy(sg(215)) + 3, 9, '');
  ST.frontLbl = add('', 0, 0, 0, 'front');
  ST.frontLbl.element.style.display = 'none';
  ST.labLbl = add('', wx(20), wy(P.CANT.cota) + 9.5, -48, 'lab', 1);
  ST.labLbl.element.style.display = 'none';
}

// ---------- câmera e vistas ----------
// criado sob demanda: wx vem de scene.js, que pode ainda não ter sido avaliado na carga circular dos módulos
let VIEWS_ = null;
const VIEWS = () =>
  VIEWS_ ||
  (VIEWS_ = {
    iso: { p: [-205, 125, 215], t: [5, 0, -18] },
    top: { p: [0.01, 470, 0.01], t: [0, 0, -30] },
    perfil: { p: [0, 22, 290], t: [0, 14, 0] },
    usina: { p: [wx(115), 34, -28], t: [wx(52), 4, -82] },
    frente: null
  });
let camAnim = null;
const CLIPZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
function setProfileClip(on) {
  ST.profile = on;
  const apply = m => {
    if (!m) return;
    const cp = (m.clippingPlanes || []).filter(p => p !== CLIPZ);
    if (on) cp.push(CLIPZ);
    m.clippingPlanes = cp;
    m.needsUpdate = true;
  };
  apply(terr.material);
  for (const k in PAV) {
    if (PAV[k].material) apply(PAV[k].material);
  }
  ['entorno', 'canteiro', 'usina'].forEach(k => (LAY[k].visible = !on && ST.lay[k] !== false));
}
function setView(v, instant) {
  ST.view = v;
  const vv = VIEWS()[v];
  ST.vexag = v === 'perfil' ? 4 : 1;
  setProfileClip(v === 'perfil');
  if (v === 'frente') {
    ST.follow = true;
    const ck = document.getElementById('optFollow');
    if (ck) ck.checked = true;
    return;
  }
  const p = new THREE.Vector3(...vv.p),
    t = new THREE.Vector3(...vv.t);
  if (instant) {
    camera.position.copy(p);
    controls.target.copy(t);
    camera.up.set(0, 1, 0);
    controls.update();
    return;
  }
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p, t, k: 0 };
}
function frontPoint(st) {
  const d = st.d;
  const pick_ = [
    ['S15', () => Math.max(st.rvBD, 0)],
    ['S14', () => 0],
    ['S13', () => 0],
    ['S12', () => st.ba],
    ['S11', () => st.sb],
    ['S09', () => st.reg],
    ['S08', () => lerp(Q.sFill0, Q.sFill1, frac(st.cf))],
    ['S07', () => liftFront(st)],
    ['S06', () => 8 + 116 * tri(st.pc * 3)],
    ['S04', () => st.limp]
  ];
  for (const [id, fn] of pick_) {
    const a = activeSvc(id, d);
    if (!a) continue;
    let s = fn();
    if (a.lane) s = st[(id === 'S15' ? 'rv' : id === 'S14' ? 'pin' : 'imp') + a.lane];
    return { s, nome: a.s.nome, id };
  }
  if (activeSvc('S05', d) || activeSvc('S10', d))
    return { s: 60, z: -80, nome: activeSvc('S05', d) ? 'Montagem da usina' : 'Calibração da usina', id: activeSvc('S05', d) ? 'S05' : 'S10' };
  return null;
}

// ---------- seleção ----------
const camAt = (s, z, dx, dy, dz) => {
  camAnim = null;
  ST.follow = false;
  const y = wy(surfC(s, z, stateAt(ST.day)));
  controls.target.set(wx(s), y, z);
  camera.position.set(wx(s) + dx, y + dy, z + dz);
  controls.update();
};
window.camAt = camAt;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const objs = [];
  root.traverseVisible(o => {
    if (o.isMesh) objs.push(o);
  });
  const hits = ray
    .intersectObjects(objs, false)
    .filter(
      h =>
        !(
          h.object.material &&
          h.object.material.clippingPlanes &&
          h.object.material.clippingPlanes[0] &&
          h.point.x > h.object.material.clippingPlanes[0].constant + 0.01
        )
    );
  if (!hits.length) {
    hideInfo();
    return;
  }
  const o = hits[0].object;
  if (o.userData.test) {
    selectTest(o.userData.test, false);
    return;
  }
  let p = o;
  while (p && !p.userData.eq && p.parent) p = p.parent;
  if (p && p.userData.eq) {
    showEqInfo(p.userData.eq);
    return;
  }
  if (o.userData.terrain) {
    showTerrainInfo(hits[0].point);
    return;
  }
  if (o.userData.info) showInfo(o.userData.info.t, o.userData.info.d);
}
function showTerrainInfo(pt) {
  const s = pt.x + P.L / 2,
    z = pt.z,
    st = stateAt(ST.day),
    n = nat(s, z),
    y = terrainC(s, z, st);
  const d = {
    Estaca: s >= 0 && s <= P.L ? estStr(s) : 'fora do trecho',
    Afastamento: nf(z, 1) + ' m',
    'Cota do terreno natural': nf(n, 2) + ' m',
    'Cota atual': nf(y, 2) + ' m'
  };
  let t = 'Terreno natural';
  if (s >= 0 && s <= P.L && Math.abs(z) < 15) {
    d['Cota de projeto (subleito)'] = nf(sg(s), 2) + ' m';
    const h = n - sg(s);
    t = h > 0 ? 'Seção em corte' : 'Seção em aterro';
    d[h > 0 ? 'Altura de corte no eixo' : 'Altura de aterro no eixo'] = nf(Math.abs(nat(s, 0) - sg(s)), 2) + ' m';
    if (y > n + 0.02)
      d.Camada = st.cf > 0 && y > dFill(s, z) - P.E_CF + 0.01 ? 'Camada final do aterro (solo de jazida)' : 'Corpo do aterro (material do corte)';
  }
  showInfo(t, d);
}
function showEqInfo(e) {
  const d = {};
  const svcs = e.use.map(id => SVC.find(s => s.id === id)).filter(Boolean);
  const now = svcs.find(s => activeSvc(s.id, ST.day));
  d.Situação = now ? 'Em serviço: ' + now.nome : 'Estacionado no canteiro';
  d['Usado em'] = svcs.map(s => s.id).join(', ');
  showInfo(e.nome, d);
}

export {
  camAt,
  setQ,
  setCEN,
  resetTerrKey,
  setCamAnim,
  Q,
  SVC,
  F,
  TT,
  DB,
  DF,
  END,
  CEN,
  OPT,
  ST,
  rebuild,
  LIFTX,
  liftExtents,
  css,
  renderer,
  lr,
  scene,
  camera,
  controls,
  root,
  sunL,
  terr,
  terrGeo,
  TG,
  lastTerrKey,
  LAY,
  PAV,
  EQ,
  USI,
  markers,
  labels,
  trees,
  steam,
  selRing,
  ray,
  mouse,
  initScene,
  applyTheme,
  resize,
  buildTerrain,
  terrainPrep,
  updateTerrain,
  ribbon,
  buildSurroundings,
  strip,
  buildPavement,
  updatePavement,
  SITE,
  placeOn,
  buildCanteiro,
  winProg,
  updateSite,
  PARK,
  addEq,
  buildEquipment,
  tri,
  frac,
  activeSvc,
  liftFront,
  pathPose,
  setPose,
  truckLoad,
  tilt,
  cycleTruck,
  updateEquipment,
  buildMarkers,
  updateMarkers,
  lbl,
  buildLabels,
  VIEWS,
  camAnim,
  CLIPZ,
  setProfileClip,
  setView,
  frontPoint,
  pick,
  showTerrainInfo,
  showEqInfo
};
