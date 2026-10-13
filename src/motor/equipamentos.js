// Equipamentos: cada equipe tem as suas máquinas, que vão para a frente ativa do serviço que a equipe executa
// e voltam ao pátio do canteiro quando ela está parada. O serviço é localizado pela "representacao" (dados/servicos.json).
import * as THREE from 'three';
import { P, nat, bocasDeLobo, pocosDeVisita, noCanteiro, acessoDoCanteiro } from '../dominio/geometria.js';
import { clamp, lerp } from '../dominio/util.js';
import { trechosRuins } from '../dominio/quantitativos.js';
import { ST, D } from '../estado.js';
import { wy, mat, C, info, mundo, rumo, colocar } from './base.js';
import {
  mkTruck,
  mkExcavator,
  mkGrader,
  mkRoller,
  mkPaver,
  mkDozer,
  mkLoader,
  mkTractor,
  mkMill,
  mkTripod,
  mkBetoneira,
  mkExtrusora,
  mkPlaca
} from './modelos.js';
import { superficie, ativas, servicoRep } from './pavimento.js';
import { USI, SITE } from './canteiro.js';
import { cena } from './renderizador.js';
import { vestir, definirVariante, giroflex, criarLod, CATALOGO } from './modelos3d.js';

export const EQ = [];
// estado da operação no quadro atual, lido pelos efeitos e pelo som: usina produzindo e frente do CBUQ em execução
export const OPER = { usina: false, paving: null };

// tipos de máquina: fábrica do modelo e nome
const TIPOS = {
  bascula: [() => mkTruck('bascula'), 'Caminhão basculante'],
  pipa: [() => mkTruck('pipa'), 'Caminhão-pipa 10 000 L'],
  espargidor: [() => mkTruck('espargidor', 0x3a3d33), 'Caminhão espargidor'],
  faixas: [() => mkTruck('espargidor', 0xd8d6cf), 'Caminhão de pintura de faixas'],
  munck: [() => mkTruck('munck'), 'Caminhão guindauto (munck)'],
  apoio: [() => mkTruck('munck', 0x8a7a2a), 'Caminhão de apoio da sinalização'],
  prova: [() => mkTruck('prova'), 'Caminhão de prova 8,2 t + viga Benkelman'],
  exc: [mkExcavator, 'Escavadeira hidráulica 20 t'],
  grader: [mkGrader, 'Motoniveladora'],
  pe: [() => mkRoller('pe'), 'Rolo pé-de-carneiro vibratório'],
  liso: [() => mkRoller('liso'), 'Rolo liso vibratório'],
  pneus: [() => mkRoller('pneus'), 'Rolo de pneus'],
  tandem: [() => mkRoller('tandem'), 'Rolo tandem vibratório'],
  paver: [mkPaver, 'Vibroacabadora de esteiras'],
  dozer: [mkDozer, 'Trator de esteiras'],
  loader: [mkLoader, 'Pá carregadeira'],
  vassoura: [() => mkTractor('vassoura'), 'Vassoura mecânica'],
  mill: [mkMill, 'Fresadora a frio de 1,0 m'],
  tripod: [mkTripod, 'Estação total / nível (topografia)'],
  prisma: [mkTripod, 'Auxiliar de topografia com bastão e prisma'],
  tripeRe: [mkTripod, 'Tripé com base nivelante (ponto de ré)'],
  betoneira: [mkBetoneira, 'Caminhão betoneira'],
  extrusora: [mkExtrusora, 'Extrusora de sarjeta'],
  placa: [mkPlaca, 'Compactador de placa vibratória']
};
// modelos GLB por tipo (dados/modelos.json); sem entrada, o tipo fica com o modelo procedural. variantes: estados
// trocados durante o ciclo (basculante) ou pelo serviço (espargidor); manter: partes procedurais que ficam
const GLB = {
  bascula: { variantes: { vazio: 'basculante', carregado: 'basculante-carregado', basculando: 'basculante-basculando' } },
  prova: { variantes: 'basculante-carregado', manter: o => [o.userData.viga] },
  munck: { variantes: 'caminhao-munck' },
  apoio: { variantes: 'caminhao-munck' },
  espargidor: { variantes: { cm30: 'espargidor-cm30', rr: 'espargidor-rr' } },
  exc: { variantes: 'escavadeira' },
  grader: { variantes: 'motoniveladora' },
  pe: { variantes: 'rolo-pe-de-carneiro', vibra: true },
  liso: { variantes: 'rolo-liso', vibra: true },
  pneus: { variantes: 'rolo-pneus' },
  tandem: { variantes: 'rolo-tandem', vibra: true },
  paver: { variantes: 'vibroacabadora' },
  dozer: { variantes: 'trator-esteiras' },
  loader: { variantes: 'pa-carregadeira' },
  mill: { variantes: 'fresadora' },
  pipa: { variantes: 'caminhao-pipa' },
  betoneira: { variantes: 'caminhao-betoneira' },
  faixas: { variantes: 'caminhao-pintura-faixas' },
  extrusora: { variantes: 'extrusora-sarjeta' },
  placa: { variantes: 'placa-vibratoria', vibra: true },
  tripod: { variantes: 'topografo-estacao-total' },
  prisma: { variantes: 'auxiliar-prisma' },
  tripeRe: { variantes: 'tripe-re' },
  // vassoura rebocável atrás do trator procedural, que perde só a escova frontal
  vassoura: { variantes: 'vassoura-mecanica', pos: [-3.75, 0, 0], manter: o => o.children.filter(c => c !== o.userData.brush) }
};
// giroflex dos GLB: um material aceso e um apagado, compartilhados
const LUZ = {
  acesa: new THREE.MeshStandardMaterial({ color: 0xffc533, emissive: 0xffa500, emissiveIntensity: 2 }),
  apagada: new THREE.MeshStandardMaterial({ color: 0xd9a21b, emissive: 0x2a1d00, roughness: 0.4 })
};
// comprimento (m) de cada tipo para as vagas do pátio: o do GLB ou o do procedural
export function comprimento(tipo) {
  const g = GLB[tipo];
  const id = g && (typeof g.variantes === 'string' ? g.variantes : Object.values(g.variantes)[0]);
  if (id && CATALOGO[id]) return CATALOGO[id].comprimento_m + (tipo === 'vassoura' ? 3.5 : 0);
  return { tripod: 1, prisma: 1, tripeRe: 1, placa: 2, extrusora: 3, betoneira: 8, pipa: 8, faixas: 8 }[tipo] || 7.5;
}
// carga sob demanda (Fase 10): o nível 0 do GLB de uma máquina só é baixado quando ela entra em serviço ou quando a
// câmera chega a menos de PERTO m dela; até lá fica o nível 1 (no pátio, visto de longe, a diferença é pequena)
const PERTO = 160;
const _p = new THREE.Vector3();
const precisa = e => () => e.o.userData.ativo || (e.o.visible && e.o.getWorldPosition(_p).distanceTo(cena.camera.position) < PERTO);
function vestirEquipamento(e) {
  const g = GLB[e.tipo];
  if (!g) return;
  const variantes = typeof g.variantes === 'string' ? { base: g.variantes } : g.variantes;
  if (!Object.values(variantes).every(id => CATALOGO[id])) return;
  const quando = precisa(e);
  e.sup = vestir(e.o, variantes, { pos: g.pos, manter: g.manter ? g.manter(e.o) : [], quando });
  e.vibra = !!g.vibra;
  e.luzes = [];
  for (const [estado, id] of Object.entries(variantes)) giroflex(e.sup.userData.lods[estado], id, LUZ.apagada, e.luzes);
  // placa vibratória: o executor atrás do guidão (a placa tem 1,5 m com o guidão; frente do procedural em +x)
  if (e.tipo === 'placa' && CATALOGO.executor) {
    const op = criarLod('executor', null, { t: e.nome, d: { Operador: 'Militar executor' } }, quando);
    op.position.set(-1.1, 0, 0);
    op.rotation.y = -Math.PI / 2;
    e.o.add(op);
  }
  // caminhão de prova: a viga Benkelman GLB no lugar da procedural, com a ponta de prova (+z do GLB) voltada para o
  // eixo traseiro (+x do procedural)
  const vb = e.tipo === 'prova' && e.o.userData.viga;
  if (vb && CATALOGO['viga-benkelman']) {
    const viga = criarLod('viga-benkelman', () => (vb.visible = false), { t: 'Viga Benkelman', d: { Ensaio: 'Deflexão recuperável, DNER-ME 024/94' } }, quando);
    viga.position.set(vb.position.x, 0, vb.position.z);
    viga.rotation.y = Math.PI / 2;
    e.o.add(viga);
  }
}
// equipamentos sem equipe no cronograma, estacionados no pátio, e o engenheiro residente
const EXTRAS = [
  ['retroescavadeira', 'Retroescavadeira (reserva)'],
  ['minicarregadeira', 'Minicarregadeira (apoio no canteiro)'],
  ['comboio-combustivel', 'Caminhão comboio de combustível']
];
let engenheiro = null,
  encarregado = null;
// soldados do efetivo da frente principal (o mesmo GLB, em duas posições)
const soldados = [];

// equipes (conjuntos de máquinas) e representações atendidas por cada uma
const EQUIPES = {
  sinalizacaoObra: { nome: 'Sinalização de obra', maq: ['apoio'] },
  sinalizacaoVertical: { nome: 'Sinalização vertical', maq: ['apoio'] },
  topografia: { nome: 'Topografia', maq: ['tripod', 'prisma'] },
  interferencias: { nome: 'Interferências', maq: ['tripod', 'tripeRe'] },
  limpeza: { nome: 'Limpeza', maq: ['dozer', 'bascula'] },
  fresagem: { nome: 'Fresagem', maq: ['mill', 'bascula', 'bascula', 'vassoura'], reps: ['fresagem', 'retrabalhoCbuq'] },
  estoqueFresado: { nome: 'Estoque de fresado', maq: ['loader'] },
  vala: { nome: 'Rede de drenagem', maq: ['exc', 'munck', 'placa'] },
  bocasDeLobo: { nome: 'Bocas de lobo', maq: ['munck', 'betoneira'] },
  pocosDeVisita: { nome: 'Poços de visita', maq: ['munck'] },
  desague: { nome: 'Deságue', maq: ['exc'] },
  remocao: { nome: 'Remoção de base', maq: ['exc', 'bascula', 'bascula', 'bascula'] },
  substituicao: { nome: 'Substituição de solo', maq: ['exc', 'pe', 'bascula'] },
  regularizacao: { nome: 'Regularização', maq: ['grader', 'pe', 'liso', 'pipa'] },
  meioFio: { nome: 'Meio-fio', maq: ['munck'] },
  sarjeta: { nome: 'Sarjeta', maq: ['extrusora', 'betoneira'] },
  granular: { nome: 'Sub-base e base', maq: ['grader', 'liso', 'pneus', 'pipa', 'bascula', 'bascula'], reps: ['subBase', 'base', 'retrabalhoBase'] },
  ligante: { nome: 'Imprimação e pintura', maq: ['espargidor', 'vassoura'], reps: ['imprimacao', 'pintura'] },
  cbuq: { nome: 'CBUQ', maq: ['paver', 'pneus', 'tandem', 'bascula', 'bascula', 'bascula', 'bascula'] },
  controle: { nome: 'Controle de aceitação', maq: ['prova'] },
  pinturaFaixas: { nome: 'Sinalização horizontal', maq: ['faixas'], reps: ['sinalizacaoHorizontal'] },
  canteiro: { nome: 'Canteiro e usina', maq: ['loader', 'munck'], reps: ['mobilizacao', 'usina', 'dosagem', 'desmobilizacao'] }
};
export const repsDaEquipe = k => (EQUIPES[k] ? EQUIPES[k].reps || [k] : []);
const TIME = {};
for (const k of Object.keys(EQUIPES)) TIME[k] = [];

// equipamentos de topografia: só aparecem em serviço (não ficam no pátio)
const TOPOGRAFIA = new Set(['tripod', 'prisma', 'tripeRe']);
// vagas do pátio de máquinas no canteiro (início do trecho), no arranjo de referência do canteiro: fileiras com as
// máquinas lado a lado, atravessadas (comprimento em z); as fileiras A e B recebem as mais longas, a C (atrás das
// outras, ao lado das baias) as mais curtas
const PARK = [];
const FILEIRAS = [
  { z: -49, s0: 34, s1: 134, max: 13 },
  { z: -63, s0: 34, s1: 134, max: 10 },
  { z: -75.5, s0: 90, s1: 134, max: 7.5 }
];

export function buildEquipment() {
  PARK.length = 0;
  const vagas = FILEIRAS.flatMap(f => {
    const v = [];
    for (let s = f.s0; s <= f.s1; s += 4.6) v.push({ ...noCanteiro(s, f.z), max: f.max });
    return v;
  });
  for (const [k, e] of Object.entries(EQUIPES)) {
    for (const tipo of e.maq) {
      const [fab, nome] = TIPOS[tipo];
      const o = fab();
      const n = `${nome} · equipe ${e.nome.toLowerCase()}`;
      info(o, n, {});
      cena.LAY.equip.add(o);
      const eq = { id: k + TIME[k].length, tipo, nome: n, equipe: k, o, park: null, mk: o.userData };
      o.userData.eq = eq;
      vestirEquipamento(eq);
      EQ.push(eq);
      TIME[k].push(eq);
    }
  }
  // vagas: as máquinas mais longas primeiro, cada uma na primeira vaga que comporta o comprimento
  const fila = EQ.filter(e => !TOPOGRAFIA.has(e.tipo)).sort((a, b) => comprimento(b.tipo) - comprimento(a.tipo));
  const livre = vagas.slice();
  const vaga = L => {
    const i = livre.findIndex(v => v.max >= L);
    return i >= 0 ? livre.splice(i, 1)[0] : livre.shift() || vagas[0];
  };
  for (const e of fila) {
    const v = vaga(comprimento(e.tipo));
    e.park = [v.s, v.z];
  }
  for (const e of EQ) if (!e.park) e.park = [vagas[0].s, vagas[0].z];
  for (const [id, nome] of EXTRAS) {
    if (!CATALOGO[id]) continue;
    const v = vaga(CATALOGO[id].comprimento_m);
    const g = new THREE.Group();
    g.add(new THREE.Object3D());
    vestir(g, id, { info: { t: nome, d: { Situação: 'Estacionado no pátio do canteiro' } } });
    const p = mundo(v.s, v.z);
    g.position.set(p.x, wy(P.CANT.cota), p.z);
    g.rotation.y = Math.PI / 2 + rumo(v.s);
    g.userData.mob = 0.5;
    cena.LAY.canteiro.add(g);
  }
  // viatura administrativa junto ao escritório e gerador atrás dos contêineres
  for (const [id, nome, s, z, rot] of [
    ['viatura-administrativa', 'Viatura administrativa', 4, -57, Math.PI / 2],
    ['gerador', 'Grupo gerador do canteiro', 14, -63.5, 0]
  ]) {
    if (!CATALOGO[id]) continue;
    const g = new THREE.Group();
    g.add(new THREE.Object3D());
    vestir(g, id, { info: { t: nome, d: { Local: 'Canteiro de obras' } } });
    const c = noCanteiro(s, z);
    colocar(g, c.s, c.z, wy(P.CANT.cota), rot);
    g.userData.mob = 0.3;
    cena.LAY.canteiro.add(g);
  }
  // engenheiro residente: na frente principal ou, sem frente ativa, junto ao escritório
  if (CATALOGO.engenheiro) {
    engenheiro = new THREE.Group();
    engenheiro.add(new THREE.Object3D());
    vestir(engenheiro, 'engenheiro', { rot: 0, info: { t: 'Engenheiro residente', d: { Função: 'Acompanha a frente de serviço principal' } } });
    cena.LAY.equip.add(engenheiro);
  }
  // sargento encarregado da frente, ao lado do engenheiro
  if (CATALOGO.encarregado) {
    encarregado = new THREE.Group();
    encarregado.add(new THREE.Object3D());
    vestir(encarregado, 'encarregado', { rot: 0, info: { t: 'Encarregado da frente', d: { Função: 'Coordena as equipes da frente de serviço' } } });
    cena.LAY.equip.add(encarregado);
  }
  // dois soldados do efetivo, depois do encarregado
  soldados.length = 0;
  if (CATALOGO.soldado)
    for (let i = 0; i < 2; i++) {
      const o = new THREE.Group();
      o.add(new THREE.Object3D());
      vestir(o, 'soldado', { rot: 0, info: { t: 'Soldado do efetivo', d: { Função: 'Execução e apoio na frente de serviço' } } });
      cena.LAY.equip.add(o);
      soldados.push(o);
    }
}
export function liftExtents() {}

export const tri = t => {
  const f = ((t % 2) + 2) % 2;
  return f < 1 ? f : 2 - f;
};
export const frac = t => t - Math.floor(t);

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
// h: rumo da máquina no referencial da obra (0 = sentido do estaqueamento); no mundo soma o rumo do eixo
function setPose(e, s, z, h, d, yOff = 0) {
  const y = superficie(s, z, d),
    p = mundo(s, z);
  // estaca e afastamento da máquina (efeitos.js: chão sob ela)
  e.s = s;
  e.z = z;
  e.o.position.set(p.x, wy(y) + yOff, p.z);
  if (h != null) {
    h += rumo(s);
    let dh = h - e.o.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    // mudança de sentido maior que 120°: a máquina anda de ré em vez de girar no lugar
    if (Math.abs(dh) > 2.1) dh = Math.atan2(Math.sin(dh + Math.PI), Math.cos(dh + Math.PI));
    const mx = ST.playing ? 0.05 : 9;
    e.o.rotation.y += clamp(dh, -mx, mx);
  }
}
function truckLoad(e, f, color, tarp) {
  const u = e.mk;
  if (!u.load) return;
  u.load.visible = f > 0.02;
  u.load.scale.y = Math.max(0.02, f);
  u.load.position.y = 0.12 + 0.5 * f;
  u.load.material = mat(color);
  if (u.tarp) u.tarp.visible = !!tarp && f > 0.5;
}
function tilt(e, a) {
  if (e.mk.piv) e.mk.piv.rotation.z = -a;
}
// caminhão em ciclo: carrega no ponto "load" e descarrega no ponto "dump"
function cycleTruck(put, e, pts, u, color, tarp, tiltMax = 0.9) {
  const li = pts.findIndex(p => p.tag === 'load'),
    di = pts.findIndex(p => p.tag === 'dump');
  const p = pathPose(pts, u);
  put(e, p.s, p.z, p.h);
  let lf;
  if (p.tag === 'load') lf = p.f;
  else if (p.tag === 'dump') lf = 1 - p.f;
  else lf = (li < di ? p.i >= li && p.i < di : p.i >= li || p.i < di) ? 1 : 0;
  truckLoad(e, lf, color, tarp);
  tilt(e, p.tag === 'dump' ? Math.sin((Math.min(1, p.f * 1.4) * Math.PI) / 2) * tiltMax * (p.f < 0.85 ? 1 : (1 - p.f) / 0.15) : 0);
}
// ida e volta entre a frente e um ponto do canteiro (ou do bota-fora), pelo desvio lateral
const ZD = -8.5;
// saída do canteiro: pátio interno, portão e vias existentes até a avenida (faixa do desvio)
function portao(saindo) {
  const a = noCanteiro(22, -44),
    ac = acessoDoCanteiro(),
    g = ac[0],
    fim = ac[ac.length - 1];
  const pts = [{ s: a.s, z: a.z }, { s: g.s, z: a.z }, ...ac.map(p => ({ s: p.s, z: p.z })), { s: fim.s, z: ZD }];
  return saindo ? pts : pts.reverse();
}
// bota-fora e jazida: fora da área, pela avenida no sentido oposto ao trecho
const foraDaArea = () => Math.min(-60, P.CANT.s0 - 60);
// destino: [s, z] no arranjo de referência do canteiro, ou 'fora' (bota-fora ou jazida)
function rota(sF, zF, destino, carregaNaFrente) {
  const naFrente = { s: sF, z: zF, stop: 5, tag: carregaNaFrente ? 'load' : 'dump', h: 0 };
  const tagDestino = carregaNaFrente ? 'dump' : 'load';
  if (destino === 'fora') return [naFrente, { s: sF + 6, z: ZD }, { s: foraDaArea(), z: ZD, stop: 4, tag: tagDestino, h: Math.PI }, { s: sF - 6, z: ZD }];
  const c = noCanteiro(destino[0], destino[1]);
  return [
    naFrente,
    { s: sF + 6, z: ZD },
    ...portao(false),
    { s: c.s, z: c.z, stop: 4, tag: tagDestino, h: Math.PI / 2 },
    ...portao(true),
    { s: sF - 6, z: ZD }
  ];
}
function escavar(ex, clk) {
  const cyc = frac(clk / 7);
  const sw = cyc < 0.45 ? 0 : cyc < 0.6 ? ((cyc - 0.45) / 0.15) * 1.57 : cyc < 0.8 ? 1.57 : 1.57 - ((cyc - 0.8) / 0.2) * 1.57;
  ex.mk.up.rotation.y = -sw;
  ex.mk.b1.rotation.z = cyc < 0.45 ? -0.35 + Math.sin((cyc / 0.45) * Math.PI) * 0.2 : 0.25;
  ex.mk.b2.rotation.z = cyc < 0.45 ? -1.6 + cyc * 1.6 : -1.1;
  ex.mk.bk.rotation.z = cyc < 0.45 ? -0.6 : cyc < 0.7 ? -0.4 : 0.9;
}

// fração do avanço de uma janela no dia d
const fr = (w, d) => clamp((d - w.a) / (w.b - w.a || 1), 0, 1);

export function updateEquipment(st, clk) {
  const d = st.d;
  const used = new Set();
  const put = (e, s, z, h, yo) => {
    used.add(e);
    setPose(e, clamp(s, Math.min(-60, P.CANT.s0 - 80), P.L + 60), z, h, d, yo);
    return e;
  };
  const T = k => TIME[k];
  const at = r => ativas(r, d);
  const CL = { solo: 0x8a5a3a, fresado: 0x2f3031, brita: 0x8e8f8b, sb: 0xa58d6a, jaz: 0xa9784a };
  const zr = P.DRN.afastamentoRede;

  // sinalização de obra e vertical: caminhão de apoio percorre a frente
  for (const [r, k] of [
    ['sinalizacaoObra', 'sinalizacaoObra'],
    ['sinalizacaoVertical', 'sinalizacaoVertical']
  ])
    for (const a of at(r).slice(0, 1)) put(T(k)[0], a.s, P.W_CX / 2 + 1.8, 0);
  // interferências: topografia sobre o eixo da rede
  for (const a of at('interferencias').slice(0, 1)) {
    put(T('interferencias')[0], a.s, zr, 0);
    put(T('interferencias')[1], a.s + 25, zr + 1.5, 0);
  }
  // topografia (global): tripés percorrendo o trecho
  const topo = servicoRep('topografia');
  if (topo && d >= topo.a && d < topo.b) {
    const t = (d - topo.a) / (topo.b - topo.a);
    put(T('topografia')[0], Math.round(t * (P.L / P.EST)) * P.EST, 5.5, 0);
    put(T('topografia')[1], Math.round(t * (P.L / P.EST)) * P.EST + 60, -5.5, Math.PI);
  }
  // limpeza (global): faixa lateral do desvio
  const limp = servicoRep('limpeza');
  if (limp && d >= limp.a && d < limp.b) {
    const t = (d - limp.a) / (limp.b - limp.a);
    put(T('limpeza')[0], t * P.L, -8.5 + 1.5 * Math.sin(clk * 0.7), 0);
    cycleTruck(put, T('limpeza')[1], rota(t * P.L - 12, -8.5, 'fora', true), clk / 60, 0x6d5636, false, 0.6);
  }
  // fresagem: fresadora com a esteira carregando o basculante à frente
  for (const a of at('fresagem').slice(0, 1)) {
    const [mill, b1, b2, vass] = T('fresagem');
    const z = Math.floor(fr(a.w, d) * 8) % 2 ? -1.75 : 1.75;
    put(mill, a.s, z, 0);
    put(b1, a.s + 9.5, z, 0);
    truckLoad(b1, 0.3 + 0.7 * frac(clk / 20), CL.fresado);
    put(vass, Math.max(a.w.s0, a.s - 14 - 4 * tri(clk / 3)), z, 0);
    cycleTruck(put, b2, rota(a.s - 6, z, [20, -92], true), clk / 70, CL.fresado, false, 0.7);
  }
  // retrabalho do CBUQ: fresadora no trecho rejeitado
  for (const a of at('retrabalhoCbuq').slice(0, 1)) {
    const cb = servicoRep('cbuq');
    const fl = cb && cb.falha;
    if (fl) put(T('fresagem')[0], fl.s0 + (fl.s - fl.s0) * tri(clk / 10), fl.faixa === 'BD' ? 1.75 : -1.75, 0);
    void a;
  }
  // estoque de fresado: pá carregadeira na baia do canteiro
  if (at('estoqueFresado').length) {
    const c = noCanteiro(26 + 4 * Math.sin(clk * 0.6), -96 + 3 * tri(clk / 5));
    put(T('estoqueFresado')[0], c.s, c.z, Math.PI / 2);
  }
  // rede de drenagem: escavação na frente, assentamento atrás e compactação do reaterro
  for (const a of at('vala').slice(0, 1)) {
    const w = a.w,
      lag = Math.min(0.5, (w.b - w.a) / 2),
      L = w.s1 - w.s0,
      span = w.b - w.a - lag;
    const pos = off => w.s0 + clamp((d - w.a - off) / span, 0, 1) * L;
    const [ex, munck, placa] = T('vala');
    put(ex, pos(0) + 1, -1.2, -Math.PI / 2);
    escavar(ex, clk);
    put(munck, pos(lag * 0.4) - 2, -1.6, 0);
    put(placa, pos(lag) + 1.2 * Math.sin(clk * 1.5), zr, 0, 0.0);
  }
  // bocas de lobo e poços de visita: unidade em execução
  for (const [r, k, lista, dz] of [
    ['bocasDeLobo', 'bocasDeLobo', bocasDeLobo(), 5.8],
    ['pocosDeVisita', 'pocosDeVisita', pocosDeVisita(), -3.2]
  ])
    for (const a of at(r).slice(0, 1)) {
      const u = lista.filter(b => b.s >= a.w.s0 && b.s <= a.w.s1);
      if (!u.length) continue;
      const it = u[Math.min(u.length - 1, Math.floor(fr(a.w, d) * u.length))];
      const lado = it.z >= 0 ? 1 : -1;
      put(T(k)[0], it.s - 3, r === 'bocasDeLobo' ? lado * dz : dz, 0);
      if (T(k)[1]) {
        put(T(k)[1], it.s + 6, lado * dz, 0);
        if (T(k)[1].mk.tambor) T(k)[1].mk.tambor.rotation.x += 0.08;
      }
    }
  // deságue no fim do trecho
  for (const a of at('desague').slice(0, 1)) {
    put(T('desague')[0], P.L + 8, zr, Math.PI);
    escavar(T('desague')[0], clk);
    void a;
  }
  // remoção da base e da sub-base: escavadeira e basculantes para o bota-fora
  for (const a of at('remocao').slice(0, 1)) {
    const [ex, ...bs] = T('remocao');
    put(ex, a.s + 3, 0, 0);
    escavar(ex, clk);
    bs.forEach((b, i) => cycleTruck(put, b, rota(a.s - 5, i % 2 ? -2.4 : 2.4, 'fora', true), clk / 80 + i / 3, CL.solo, false));
  }
  // substituição de solo no trecho de solo mole
  for (const a of at('substituicao').slice(0, 1)) {
    const t = trechosRuins(D.obra, a.w.s0, a.w.s1)[0];
    if (!t) continue;
    const [ex, pe, b] = T('substituicao');
    const s = lerp(t.de, t.ate, fr(a.w, d));
    put(ex, s + 4, -2, 0);
    escavar(ex, clk);
    put(pe, s - 6 - 8 * tri(clk / 7), 1.6, 0);
    cycleTruck(put, b, rota(s - 2, 2.4, 'fora', false), clk / 80, CL.jaz, false);
  }
  // regularização do subleito
  for (const a of at('regularizacao').slice(0, 1)) {
    const [g, pe, liso, pipa] = T('regularizacao'),
      f = a.s;
    put(g, Math.max(a.w.s0 + 5, f + 2 - 12 * tri(clk / 9)), 0, 0);
    put(pe, Math.max(a.w.s0 + 4, f - 12 - 14 * tri(clk / 7)), 1.8, 0);
    put(liso, Math.max(a.w.s0 + 3, f - 30 - 12 * tri(clk / 8)), -1.6, 0);
    put(pipa, f + 10 + 8 * tri(clk / 10), 2.8, 0);
  }
  // meio-fio e sarjeta (um lado de cada vez)
  for (const a of at('meioFio').slice(0, 1)) put(T('meioFio')[0], a.s, (fr(a.w, d) < 0.5 ? 1 : -1) * (P.W_CX / 2 + 1.6), 0);
  for (const a of at('sarjeta').slice(0, 1)) {
    const lado = fr(a.w, d) < 0.5 ? 1 : -1;
    put(T('sarjeta')[0], a.s, lado * P.Z_SAR, 0);
    put(T('sarjeta')[1], a.s + 7, lado * (P.W_CX / 2 + 1.6), 0);
    T('sarjeta')[1].mk.tambor.rotation.x += 0.08;
  }
  // sub-base, base e retrabalho na base
  for (const r of ['subBase', 'base']) {
    for (const a of at(r).slice(0, 1)) {
      const [g, liso, pneus, pipa, b1, b2] = T('granular'),
        f = a.s;
      put(g, Math.max(a.w.s0 + 5, f + 2 - 12 * tri(clk / 9)), 0, 0);
      put(liso, Math.max(a.w.s0 + 4, f - 10 - 12 * tri(clk / 7)), 1.6, 0);
      put(pneus, Math.max(a.w.s0 + 3, f - 28 - 10 * tri(clk / 8)), -1.6, 0);
      put(pipa, f + 12 + 6 * tri(clk / 10), -2.6, 0);
      [b1, b2].forEach((b, i) =>
        cycleTruck(put, b, rota(f + 14, i ? -2.4 : 2.4, [112, -94], false), clk / 80 + i / 2, r === 'subBase' ? CL.sb : CL.brita, false)
      );
    }
  }
  for (const a of at('retrabalhoBase').slice(0, 1)) {
    const [g, liso, , pipa] = T('granular'),
      s = (a.w.s0 + a.w.s1) / 2;
    put(g, s + 8 * Math.sin(clk * 0.6), -1.8, 0);
    put(pipa, s + 16, -2.2, Math.PI);
    put(liso, s - 10 + 10 * tri(clk / 6), -1.9, 0);
  }
  // imprimação e pintura de ligação (meia pista)
  for (const r of ['imprimacao', 'pintura'])
    for (const a of at(r).slice(0, 1)) {
      const z = a.faixa === 'BD' ? 1.9 : -1.9;
      put(T('ligante')[0], a.s + 3.5, z, 0);
      // CM-30 na imprimação, emulsão RR na pintura de ligação
      T('ligante')[0].variante = r === 'imprimacao' ? 'cm30' : 'rr';
      put(T('ligante')[1], a.s + 18 + 4 * tri(clk / 3), z, 0);
    }
  // CBUQ: vibroacabadora, rolos e caminhões da usina pelo desvio
  const pav = at('cbuq');
  const cb = servicoRep('cbuq');
  let paving = pav[0];
  if (!paving && cb && cb.falha && d >= cb.falha.a && d < cb.falha.b) {
    const fl = cb.falha;
    paving = { s: fl.s0 + (fl.s - fl.s0) * ((d - fl.a) / (fl.b - fl.a)), faixa: fl.faixa, w: { s0: fl.s0 } };
  }
  if (paving) {
    const [paver, pneus, tandem, ...bs] = T('cbuq');
    const z = paving.faixa === 'BD' ? 1.75 : -1.75,
      zf = -z,
      f = paving.s;
    put(paver, f + 2.4, z, 0);
    put(pneus, Math.max(paving.w.s0 + 4, f - 8 - 10 * tri(clk / 5)), z, 0);
    put(tandem, Math.max(paving.w.s0 + 3, f - 24 - 10 * tri(clk / 6 + 0.4)), z, 0);
    const si = USI.siloS,
      sz = USI.siloZ;
    bs.forEach((b, i) => {
      const pts = [
        { s: si, z: sz, stop: 5, tag: 'load', h: Math.PI },
        { s: si - 20, z: sz },
        ...portao(true),
        { s: f + 22, z: ZD },
        { s: f + 27, z: zf },
        { s: f + 9.2, z, rev: 1, stop: 4, tag: 'dump', h: 0 },
        { s: f + 26, z: zf },
        { s: f + 22, z: ZD },
        ...portao(false),
        { s: si + 22, z: noCanteiro(0, -60).z },
        { s: si + 28, z: sz }
      ];
      cycleTruck(put, b, pts, clk / 90 + i / 4, 0x1d1d1d, true, 0.75);
    });
  }
  // controle de aceitação e sinalização horizontal
  for (const a of at('controle').slice(0, 1))
    put(T('controle')[0], a.w.s0 + clamp(fr(a.w, d) * 2, 0, 1) * (a.w.s1 - a.w.s0), Math.floor(fr(a.w, d) * 40) % 2 ? 1.75 : -1.75, 0);
  for (const a of at('sinalizacaoHorizontal').slice(0, 1)) put(T('pinturaFaixas')[0], a.s, 0.4, 0);
  // canteiro e usina: mobilização, montagem, dosagem e desmobilização
  const ativoG = r => {
    const s = servicoRep(r);
    return s && d >= s.a && d < s.b;
  };
  const [loaderU, munckU] = T('canteiro');
  const z66 = noCanteiro(0, -66).z;
  if (paving || ativoG('dosagem')) put(loaderU, USI.siloS + 34 + 3 * Math.sin(clk * 0.8), z66 + 4 * tri(clk / 4), Math.PI / 2);
  else if (ativoG('mobilizacao') || ativoG('desmobilizacao')) put(loaderU, noCanteiro(30 + 6 * Math.sin(clk * 0.5), 0).s, z66, Math.PI / 2);
  if (ativoG('mobilizacao') || ativoG('usina') || ativoG('desmobilizacao')) {
    const c = noCanteiro(ativoG('usina') ? 54 + 10 * tri(clk / 14) : 24, ativoG('usina') ? -66 : -64);
    put(munckU, c.s, c.z, 0);
  }

  // máquinas paradas no pátio; giroflex, tambores e vassouras
  for (const e of EQ) {
    e.o.visible = ST.lay.equip !== false && (!TOPOGRAFIA.has(e.tipo) || used.has(e));
    if (!used.has(e)) {
      setPose(e, e.park[0], e.park[1], Math.PI / 2, d);
      e.o.rotation.y = Math.PI / 2 + rumo(e.park[0]);
      tilt(e, 0);
      truckLoad(e, 0, 0x777777);
      if (e.mk.up) e.mk.up.rotation.y = 0;
    }
    e.o.userData.ativo = used.has(e);
    if (e.mk.beacon)
      e.mk.beacon.material = used.has(e) && Math.sin(clk * 8) > 0 ? mat(0xffc533, { emissive: 0xffa500 }) : mat(C.yellow, { emissive: 0x2a1d00 });
    if (e.mk.drums && used.has(e)) e.mk.drums.forEach(dr => (dr.rotation.z -= 0.05));
    if (e.mk.brush && used.has(e)) e.mk.brush.rotation.y += 0.3;
    // GLB (animação simplificada): estado do basculante, espargidor do serviço, giroflex e vibração dos rolos
    if (e.sup) {
      if (e.tipo === 'bascula') {
        const u = e.mk;
        definirVariante(e.sup, u.piv.rotation.z < -0.05 ? 'basculando' : u.load.visible && u.load.scale.y > 0.5 ? 'carregado' : 'vazio');
      }
      if (e.tipo === 'espargidor') definirVariante(e.sup, e.variante || 'cm30');
      e.variante = null;
      const acesa = used.has(e) && Math.sin(clk * 8) > 0;
      for (const l of e.luzes) l.material = acesa ? LUZ.acesa : LUZ.apagada;
      e.sup.position.y = e.vibra && used.has(e) && ST.playing ? 0.006 * Math.sin(clk * 95) : 0;
    }
  }
  posicionarEngenheiro(d);
  // usina operando (a fumaça da chaminé e o vapor do CBUQ ficam em efeitos.js)
  const dos = servicoRep('dosagem');
  const on = !!(paving || (dos && d >= dos.b - 2 && d < dos.b)) && USI.ready;
  USI.parts.drum.rotation.y += on ? 0.03 : 0;
  USI.parts.flame.material.opacity = on ? 0.55 + 0.25 * Math.sin(clk * 9) : 0;
  OPER.usina = on;
  OPER.paving = paving || null;
  if (SITE.flag) SITE.flag.rotation.y = Math.sin(clk * 1.3) * 0.15;
}

function posicionarEngenheiro(d) {
  const f = frentesAtivas(d)[0];
  // ds e dz: afastamento ao longo do eixo e para fora da pista; dr: giro em relação ao olhar para a pista
  for (const [o, ds, dz, dr] of [
    [engenheiro, 0, 0, 0],
    [encarregado, 1.3, 0, 0],
    [soldados[0], 3.4, 0.4, -0.5],
    [soldados[1], 4.4, -0.2, 0.3]
  ]) {
    if (!o) continue;
    o.visible = ST.lay.equip !== false;
    if (f) {
      // no passeio do lado direito, um pouco atrás da frente, olhando para a pista
      const s = clamp(f.s - 6 + ds, 0, P.L),
        z = P.Z_VIA + 2.2 + dz;
      colocar(o, s, z, wy(nat(s, z)), Math.PI / 2 + dr);
    } else {
      const c = noCanteiro(16 + ds, -51.5 + dz);
      colocar(o, c.s, c.z, wy(P.CANT.cota), dr);
    }
  }
}

// frente principal ativa (para o rótulo e para a câmera que segue a frente)
const PRIORIDADE = [
  'cbuq',
  'pintura',
  'imprimacao',
  'base',
  'subBase',
  'sarjeta',
  'meioFio',
  'regularizacao',
  'substituicao',
  'remocao',
  'vala',
  'fresagem',
  'interferencias',
  'sinalizacaoObra'
];
export function frentesAtivas(d) {
  const out = [];
  for (const r of PRIORIDADE) for (const a of ativas(r, d)) out.push({ s: a.s, z: 0, rep: r, w: a.w, faixa: a.faixa, svc: servicoRep(r) });
  return out;
}
