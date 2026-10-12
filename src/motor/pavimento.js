// Caixa do pavimento ao longo do trecho: pavimento existente (que é fresado e removido), vala da drenagem, subleito,
// sarjeta, meio-fio e camadas novas. Cada faixa tem, por vértice, o dia em que aparece e o dia em que some (dias.js).
// O motor não conhece códigos de serviço: localiza cada serviço pela "representacao" definida em dados/servicos.json.
import * as THREE from 'three';
import { P, sg, nat, diametroRede, larguraVala, profundidadeVala } from '../dominio/geometria.js';
import { diaDoServico, janela } from '../dominio/frentes.js';
import { trechosRuins } from '../dominio/quantitativos.js';
import { M, ST, D } from '../estado.js';
import { wy, mat, mundo, colocar } from './base.js';
import { cena } from './renderizador.js';
import { comDias, NUNCA, finito, diasPorInstancia } from './dias.js';
import { pbr } from './superficies.js';
import { espalhado } from './soltos.js';

export const CAMADAS = []; // malhas com dias (para o corte em perfil e a seleção)

// ---------- serviços por representação ----------
export const servicoRep = rep => M.svc.find(s => s.meta && s.meta.representacao === rep);
export const idRep = rep => (servicoRep(rep) || {}).id;
export const diaRep = (rep, s, faixa) => {
  const id = idRep(rep);
  return id ? diaDoServico(M.svc, id, s, faixa) : Infinity;
};
// vala: a escavação lidera, o assentamento segue e o reaterro fecha a vala até o fim da janela
export function diasDaVala(s) {
  const sv = servicoRep('vala');
  const w = sv && sv.jan.find(w => s >= w.s0 - 1e-6 && s <= w.s1 + 1e-6);
  if (!w) return { esc: Infinity, tubo: Infinity, reat: Infinity };
  const lag = Math.min(0.5, (w.b - w.a) / 2);
  const esc = w.a + ((s - w.s0) / (w.s1 - w.s0)) * (w.b - w.a - lag);
  return { esc, tubo: esc + lag * 0.4, reat: esc + lag };
}

// ---------- alturas exibidas (espessuras multiplicadas pelo exagero) ----------
export function alturas(s) {
  const E = ST.exag,
    b = sg(s);
  return {
    b,
    exSb: b + P.EX_SB * E,
    exBa: b + (P.EX_SB + P.EX_BA) * E,
    exTop: b + P.E_EX * E,
    sb: b + P.E_SB * E,
    ba: b + (P.E_SB + P.E_BA) * E,
    top: b + P.E_PAV * E
  };
}
const fundoDaVala = s => sg(s) - (profundidadeVala(diametroRede(s)) - P.E_EX);

// ---------- construtor de faixas com dias por vértice ----------
// z0, z1, bot, top: números ou funções da estaca; dias(s) -> [aparece, some]; sup: material PBR da camada (superficies.js)
function faixa({ z0, z1, bot, top, dias, cor, opts = {}, sup, nome, info, s0 = 0, s1 = P.L, passo = 2, tampa = true, fundo = false, lados = true }) {
  const f = v => (typeof v === 'function' ? v : () => v);
  const Z0 = f(z0),
    Z1 = f(z1),
    B = f(bot),
    T = f(top);
  const pos = [],
    dd = [],
    sz = [],
    esp = [],
    idx = [];
  const ss = [];
  for (let s = s0; s < s1 - 1e-6; s += passo) ss.push(s);
  ss.push(s1);
  ss.forEach(s => {
    const [a, d] = dias(s);
    const t = wy(T(s)),
      bt = wy(B(s)),
      za = Z0(s),
      zb = Z1(s);
    // vértices sobre o eixo curvo: bordos za e zb da faixa na estaca s
    const pa = mundo(s, za),
      pb = mundo(s, zb);
    pos.push(pa.x, t, pa.z, pb.x, t, pb.z, pb.x, bt, pb.z, pa.x, bt, pa.z);
    sz.push(s, za, s, zb, s, zb, s, za);
    // espessura nos vértices do topo: a camada espalhada fica mais alta (superficies.js, ESPALHADO)
    esp.push(t - bt, t - bt, 0, 0);
    for (let k = 0; k < 4; k++) dd.push(finito(a), finito(d));
  });
  for (let i = 0; i < ss.length - 1; i++) {
    const a = i * 4,
      b = a + 4;
    if (tampa) idx.push(a, b, a + 1, a + 1, b, b + 1);
    if (lados) {
      idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      idx.push(a + 3, b + 3, a, a, b + 3, b);
    }
    if (fundo) idx.push(a + 3, a + 2, b + 3, b + 3, a + 2, b + 2);
  }
  if (tampa && lados) {
    const n = (ss.length - 1) * 4;
    idx.push(0, 1, 3, 1, 2, 3, n, n + 3, n + 1, n + 1, n + 3, n + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDias', new THREE.Float32BufferAttribute(dd, 2));
  geo.setAttribute('aSZ', new THREE.Float32BufferAttribute(sz, 2));
  if (sup && sup.espalhado) geo.setAttribute('aEsp', new THREE.Float32BufferAttribute(esp, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = comDias(new THREE.MeshStandardMaterial(Object.assign({ color: cor, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }, opts)));
  pbr(m, Object.assign({ sz: true, geometrica: true }, sup));
  const o = new THREE.Mesh(geo, m);
  o.castShadow = false;
  o.receiveShadow = true;
  o.name = nome;
  o.userData.info = info;
  o.userData.dias = dias;
  o.userData.sz = sz;
  CAMADAS.push(o);
  cena.LAY.pavimento.add(o);
  return o;
}

export function buildPavement() {
  for (const o of CAMADAS) {
    cena.LAY.pavimento.remove(o);
    o.geometry.dispose();
  }
  CAMADAS.length = 0;
  const hW = P.W_CX / 2,
    hP = P.W_RV / 2,
    zr = P.DRN.afastamentoRede;
  const v0 = s => zr - larguraVala(diametroRede(s)) / 2,
    v1 = s => zr + larguraVala(diametroRede(s)) / 2;
  const h = alturas;
  const rem = s => diaRep('remocao', s),
    fre = s => diaRep('fresagem', s),
    vala = s => diasDaVala(s);
  const mn = (...v) => Math.min(...v.map(finito));
  const nomeSvc = rep => (servicoRep(rep) || {}).nome || '';
  const exInfo = (t, e) => ({ t, d: { Situação: 'Pavimento existente', Espessura: e, Observação: 'Espessuras ilustrativas, a confirmar nas sondagens' } });

  // pavimento existente, dividido em três bandas transversais: à esquerda da vala, na vala e à direita
  const bandas = [
    { z0: -hW, z1: v0, vala: false },
    { z0: v0, z1: v1, vala: true },
    { z0: v1, z1: hW, vala: false }
  ];
  for (const bd of bandas) {
    const ateVala = s => (bd.vala ? vala(s).esc : Infinity);
    faixa({
      z0: bd.z0,
      z1: bd.z1,
      bot: s => h(s).b,
      top: s => h(s).exSb,
      dias: s => [-1, mn(rem(s), ateVala(s))],
      cor: 0xa08a68,
      sup: { camada: 'solo' },
      nome: 'ex-subbase',
      info: exInfo('Sub-base existente', '20 cm')
    });
    faixa({
      z0: bd.z0,
      z1: bd.z1,
      bot: s => h(s).exSb,
      top: s => h(s).exBa,
      dias: s => [-1, mn(rem(s), ateVala(s))],
      cor: 0x8f8e88,
      sup: { camada: 'brita' },
      nome: 'ex-base',
      info: exInfo('Base existente', '15 cm')
    });
  }
  // revestimento existente (pista) e bordas antigas
  const zi = [
    [-hP, v0, false],
    [v0, v1, true],
    [v1, hP, false]
  ];
  for (const [a, b, ehVala] of zi) {
    faixa({
      z0: a,
      z1: b,
      bot: s => h(s).exBa,
      top: s => h(s).exTop,
      dias: s => [-1, mn(fre(s), rem(s), ehVala ? vala(s).esc : Infinity)],
      cor: 0x606366,
      opts: { roughness: 1 },
      sup: { camada: 'asfalto_usado' },
      nome: 'ex-revestimento',
      info: {
        t: 'Revestimento existente (CBUQ antigo)',
        d: { Situação: 'Desgastado, com trincas e remendos', Espessura: '5 cm', Serviço: nomeSvc('fresagem') }
      }
    });
  }
  for (const sd of [-1, 1])
    faixa({
      z0: sd * hP,
      z1: sd * hW,
      bot: s => h(s).exBa,
      top: s => h(s).exTop,
      dias: s => [-1, rem(s)].map(finito),
      cor: 0x9a9890,
      sup: { camada: 'concreto' },
      nome: 'ex-borda',
      info: { t: 'Sarjeta e meio-fio antigos', d: { Situação: 'Removidos com a caixa do pavimento', Serviço: nomeSvc('remocao') } }
    });
  // superfície fresada (topo da base existente), fora e dentro da banda da vala
  for (const [a, b, ehVala] of zi) {
    faixa({
      z0: a,
      z1: b,
      bot: s => h(s).exBa,
      top: s => h(s).exBa + 0.012,
      dias: s => [fre(s), mn(rem(s), ehVala ? vala(s).esc : Infinity)],
      cor: 0x4a4d50,
      opts: { roughness: 1 },
      // sem as trincas do revestimento antigo: a fresagem expõe a mistura sã
      sup: { camada: 'asfalto_novo', fresado: true },
      nome: 'fresada',
      lados: false,
      info: { t: 'Superfície fresada', d: { Serviço: nomeSvc('fresagem'), Norma: 'DNIT 159/2011-ES', Profundidade: '5 cm' } }
    });
  }
  // vala aberta: paredes e fundo, do topo da base existente até o fundo da vala
  faixa({
    z0: v0,
    z1: v1,
    bot: fundoDaVala,
    top: s => h(s).exBa,
    dias: s => [vala(s).esc, vala(s).reat].map(finito),
    cor: 0x6b4a33,
    tampa: false,
    fundo: true,
    sup: { camada: 'argila' },
    nome: 'vala',
    info: { t: 'Vala da rede de drenagem', d: { Serviço: nomeSvc('vala'), Norma: 'DNIT 023/2024-ES', Escoramento: 'Painéis metálicos' } }
  });
  // reaterro compactado: parte abaixo do subleito (fica) e parte acima (sai com a remoção da base)
  faixa({
    z0: v0,
    z1: v1,
    bot: fundoDaVala,
    top: s => h(s).b,
    dias: s => [vala(s).reat, NUNCA].map(finito),
    cor: 0x9b7a55,
    sup: { camada: 'solo', molhar: true },
    nome: 'reaterro',
    info: { t: 'Reaterro compactado da vala', d: { Serviço: nomeSvc('vala'), Controle: 'GC por camada (frasco de areia)' } }
  });
  faixa({
    z0: v0,
    z1: v1,
    bot: s => h(s).b,
    top: s => h(s).exBa + 0.02,
    dias: s => [vala(s).reat, rem(s)].map(finito),
    cor: 0x9b7a55,
    sup: { camada: 'solo', molhar: true },
    nome: 'reaterro',
    info: { t: 'Reaterro compactado da vala', d: { Serviço: nomeSvc('vala') } }
  });
  // subleito: fundo da caixa (sempre presente; fica visível depois da remoção da base)
  faixa({
    z0: -hW,
    z1: hW,
    bot: s => h(s).b - 1.2,
    top: s => h(s).b,
    dias: () => [-1, NUNCA],
    // argila vermelho-amarronzada do Rio (as quadras de saibro do entorno ficam com o alaranjado 0xa4683e)
    cor: 0x8a4f36,
    sup: { camada: 'argila' },
    nome: 'subleito',
    lados: false,
    info: { t: 'Subleito exposto', d: { Controle: 'ISC a cada 50 m (ilustrativo)' } }
  });
  // substituição de solo e regularização (películas no fundo da caixa)
  for (const t of trechosRuins(D.obra, 0, P.L))
    faixa({
      z0: -hW,
      z1: hW,
      s0: t.de,
      s1: t.ate,
      bot: s => h(s).b,
      top: s => h(s).b + 0.015,
      dias: s => [diaRep('substituicao', s), NUNCA].map(finito),
      cor: 0xb58a55,
      lados: false,
      sup: { camada: 'solo', molhar: true, marcas: ['pneu', 'rolo'], espalhado: espalhado('substituicao') },
      nome: 'substituicao',
      info: { t: 'Substituição de solo (60 cm)', d: { Serviço: nomeSvc('substituicao'), Material: 'Solo de jazida, ISC 14 %' } }
    });
  faixa({
    z0: -hW,
    z1: hW,
    bot: s => h(s).b,
    top: s => h(s).b + 0.03,
    dias: s => [diaRep('regularizacao', s), NUNCA].map(finito),
    cor: 0xc7a275,
    lados: false,
    sup: { camada: 'solo', molhar: true, marcas: ['pneu', 'rolo'], espalhado: espalhado('regularizacao') },
    nome: 'regularizacao',
    info: { t: 'Subleito regularizado', d: { Serviço: nomeSvc('regularizacao'), Norma: 'DNIT 137/2010-ES' } }
  });
  // sarjetas (concreto), dos dois lados
  for (const sd of [-1, 1])
    faixa({
      z0: sd * hP,
      z1: sd * (hP + P.W_SAR),
      bot: s => h(s).b,
      top: s => h(s).top - 0.02,
      dias: s => [diaRep('sarjeta', s), NUNCA].map(finito),
      cor: 0xbdbab2,
      sup: { camada: 'concreto' },
      nome: 'sarjeta',
      info: { t: 'Sarjeta de concreto', d: { Serviço: nomeSvc('sarjeta'), Norma: 'DNIT 018/2023-ES', Largura: '0,40 m' } }
    });
  // camadas novas, entre as sarjetas
  const sbInfo = { t: 'Sub-base de solo-brita', d: { Espessura: '20 cm', Largura: '7,0 m', Norma: 'DNIT 139/2010-ES', 'GC mínimo': '100 %' } };
  faixa({
    z0: -hP,
    z1: hP,
    bot: s => h(s).b + 0.03,
    top: s => h(s).sb,
    dias: s => [diaRep('subBase', s), NUNCA].map(finito),
    cor: 0xb79a72,
    sup: { camada: 'brita', molhar: true, marcas: ['pneu', 'rolo'], espalhado: espalhado('subBase') },
    nome: 'subBase',
    info: sbInfo
  });
  faixa({
    z0: -hP,
    z1: hP,
    bot: s => h(s).sb,
    top: s => h(s).ba,
    dias: s => [diaRep('base', s), NUNCA].map(finito),
    cor: 0x9d9d97,
    sup: { camada: 'brita', molhar: true, marcas: ['pneu', 'rolo'], espalhado: espalhado('base') },
    nome: 'base',
    info: { t: 'Base de brita graduada', d: { Espessura: '15 cm', Largura: '7,0 m', Norma: 'DNIT 141/2022-ES', 'GC mínimo': '100 %' } }
  });
  const film = 0.012 * Math.max(1, ST.exag);
  for (const [fx, z0, z1] of [
    ['BD', 0, hP],
    ['BE', -hP, 0]
  ]) {
    faixa({
      z0,
      z1,
      bot: s => h(s).ba,
      top: s => h(s).ba + film,
      dias: s => [diaRep('imprimacao', s, fx), NUNCA].map(finito),
      cor: 0x5a3a22,
      opts: { roughness: 0.3 },
      lados: false,
      sup: { camada: 'brita' },
      nome: 'imprimacao',
      info: { t: `Imprimação com CM-30 (${fx})`, d: { Taxa: '1,20 L/m²', Norma: 'DNIT 144/2014-ES' } }
    });
    faixa({
      z0,
      z1,
      bot: s => h(s).ba,
      top: s => h(s).ba + film * 1.6,
      dias: s => [diaRep('pintura', s, fx), NUNCA].map(finito),
      cor: 0x1c1816,
      opts: { roughness: 0.45 },
      lados: false,
      sup: { camada: 'brita' },
      nome: 'pintura',
      info: { t: `Pintura de ligação RR-1C (${fx})`, d: { Taxa: '0,90 L/m² diluída 1:1', Norma: 'DNIT 145/2012-ES' } }
    });
    faixa({
      z0,
      z1,
      bot: s => h(s).ba,
      top: s => h(s).top,
      dias: s => [diaRep('cbuq', s, fx), NUNCA].map(finito),
      cor: 0x26282a,
      opts: { roughness: 1 },
      sup: { camada: 'asfalto_novo', marcas: 'rolo', junta: true, solto: true },
      nome: 'cbuq',
      info: {
        t: `Revestimento em CBUQ (faixa ${fx === 'BD' ? 'direita' : 'esquerda'})`,
        d: { Espessura: '5 cm', Faixa: 'C-12,5', Ligante: 'CAP 50/70 · 5,6 %', Norma: 'DNIT 031/2024-ES' }
      }
    });
  }
  // trecho de CBUQ lançado com teor fora da tolerância e depois fresado (cenário ou decisão)
  const cb = servicoRep('cbuq');
  if (cb && cb.falha) {
    const fl = cb.falha,
      L = fl.s - fl.s0;
    const [z0, z1] = fl.faixa === 'BD' ? [0, hP] : [-hP, 0];
    faixa({
      z0,
      z1,
      s0: fl.s0,
      s1: fl.s,
      passo: 1,
      bot: s => h(s).ba,
      top: s => h(s).top + 0.004,
      dias: s => [fl.a + ((s - fl.s0) / L) * (fl.b - fl.a), fl.rem[0] + ((fl.s - s) / L) * (fl.rem[1] - fl.rem[0])],
      cor: 0x1a1a1a,
      opts: { roughness: 0.6 },
      sup: { camada: 'asfalto_novo' },
      nome: 'cbuq-rejeitado',
      info: { t: 'CBUQ com teor fora da tolerância', d: { Situação: 'Fresado e refeito', Teor: '6,05 % (5,6 ± 0,3 %)' } }
    });
  }
  buildMeioFio();
}

// meio-fio pré-moldado em peças de 1 m, dos dois lados
let meioFio = null;
function buildMeioFio() {
  if (meioFio) {
    cena.LAY.pavimento.remove(meioFio);
    meioFio.geometry.dispose();
  }
  const n = Math.floor(P.L);
  const geo = new THREE.BoxGeometry(0.98, 1, P.W_MF);
  const m = new THREE.InstancedMesh(geo, pbr(comDias(mat(0xd6d3cb).clone()), { camada: 'concreto' }), n * 2);
  const o = new THREE.Object3D(),
    dias = [];
  let k = 0;
  for (let i = 0; i < n; i++)
    for (const sd of [-1, 1]) {
      const s = i + 0.5,
        h = alturas(s);
      const alt = h.top + P.H_MF - h.b;
      colocar(o, s, sd * P.Z_MF, wy(h.b + alt / 2));
      o.scale.set(1, alt, 1);
      o.updateMatrix();
      m.setMatrixAt(k++, o.matrix);
      dias.push([diaRep('meioFio', s), NUNCA].map(finito));
    }
  diasPorInstancia(m, dias);
  m.castShadow = false;
  m.receiveShadow = true;
  m.userData.info = { t: 'Meio-fio pré-moldado', d: { Serviço: (servicoRep('meioFio') || {}).nome || '', Norma: 'DNIT 020/2023-ES' } };
  m.userData.diasInst = dias;
  meioFio = m;
  CAMADAS.push(m);
  cena.LAY.pavimento.add(m);
}

// ---------- superfície onde as máquinas se apoiam no dia d ----------
export function superficie(s, z, d) {
  if (s < 0 || s > P.L || Math.abs(z) > P.W_CX / 2) return nat(s, z);
  const h = alturas(s);
  if (d < finito(diaRep('remocao', s))) return d < finito(diaRep('fresagem', s)) && Math.abs(z) <= P.W_RV / 2 ? h.exTop : h.exBa;
  if (Math.abs(z) > P.W_RV / 2) return d >= finito(diaRep('sarjeta', s)) ? h.top : h.b;
  const fx = z >= 0 ? 'BD' : 'BE';
  if (d >= finito(diaRep('cbuq', s, fx))) return h.top;
  if (d >= finito(diaRep('base', s))) return h.ba;
  if (d >= finito(diaRep('subBase', s))) return h.sb;
  return h.b;
}
export const surfC = (s, z, st) => superficie(s, z, st.d);

// janela ativa de um serviço (por representação) no dia d, com a posição da frente
export function ativas(rep, d) {
  const s = servicoRep(rep);
  if (!s) return [];
  return s.jan
    .filter(w => w.f != null && d >= w.a && d < w.b)
    .map(w => ({ w, s: w.s0 + Math.min(1, Math.max(0, (d - w.a) / (w.b - w.a))) * (w.s1 - w.s0), faixa: w.faixa }));
}
export { janela };
