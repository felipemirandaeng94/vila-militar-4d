// Equipamentos: posição e animação de cada máquina conforme os serviços ativos no dia.
import * as THREE from 'three';
import { P, gr } from '../dominio/geometria.js';
import { clamp, lerp } from '../dominio/util.js';
import { activeSvc } from '../dominio/cronograma.js';
import { extensoesDasCamadas } from '../dominio/quantitativos.js';
import { M, ST } from '../estado.js';
import { wx, wy, mat, C, info } from './base.js';
import { mkTruck, mkExcavator, mkGrader, mkRoller, mkPaver, mkDozer, mkLoader, mkTractor, mkMill, mkTripod } from './modelos.js';
import { surfC } from './pavimento.js';
import { USI, SITE } from './canteiro.js';
import { cena } from './renderizador.js';

export const EQ = [];
const steam = [];
const PARK = [];
for (let i = 0; i < 22; i++) PARK.push([40 + (i % 11) * 6.5, i < 11 ? -48 : -60]);

// extensão de cada camada do corpo do aterro (para posicionar a frente)
let LIFTX = [];
export function liftExtents() {
  LIFTX = extensoesDasCamadas(M.q).map(e => e || [M.q.sFill0, M.q.sFill1]);
}

function addEq(id, nome, model, park, use) {
  const o = model;
  o.userData.eqId = id;
  info(o, nome, {});
  o.userData.nome = nome;
  cena.LAY.equip.add(o);
  const e = { id, nome, o, park: PARK[park], use, mk: o.userData };
  e.o.userData.eq = e;
  EQ.push(e);
  return e;
}
export function buildEquipment() {
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
    cena.LAY.equip.add(p);
  }
}

export const tri = t => {
  const f = ((t % 2) + 2) % 2;
  return f < 1 ? f : 2 - f;
};
export const frac = t => t - Math.floor(t);
const act_ = (id, d) => activeSvc(M.svc, id, d);
export function liftFront(st) {
  const k = Math.min(M.q.nLifts - 1, Math.floor(st.ck));
  const [a, b] = LIFTX[Math.max(0, k)];
  return lerp(a, b, frac(st.ck));
}

// trajeto com paradas: pts = [{s,z,stop?,rev?,tag?}]; devolve a pose ao longo do ciclo u ∈ [0,1)
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
// caminhão em ciclo: carrega no ponto marcado com load e descarrega no ponto marcado com dump
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

export function updateEquipment(st, clk) {
  const d = st.d;
  const used = new Set();
  const SVC = M.svc;
  const act = id => act_(id, d);
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
    const f = lerp(M.q.sFill0, M.q.sFill1, frac(st.cf));
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
      put('prova', p, Math.floor(p / 20) % 2 ? -1.75 : 1.75, 0);
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
    put('esp', f + 3.5, z, 0);
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
      // ajusta o ponto de ré: rev se aplica ao trecho que chega ao ponto de descarga
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
    e.o.visible = ST.lay.equip !== false && (e.id !== 'mill' || used.has('mill') || M.opt.rwCbuq) && (!e.id.startsWith('topo') || used.has(e.id));
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
