import { P, clamp, dFill, gr, lerp, nat, nf, sg } from './geo.js';

// ==DADOS DA OBRA==
const OBRA = {
  titulo: 'Via interna da Vila Militar',
  local: 'Vila Militar · Deodoro, Rio de Janeiro/RJ',
  om: 'Organização Militar de Engenharia executora (ilustrativa)',
  inicio: 'seg 03/05/2027',
  trafego: 'viaturas operacionais, ônibus e caminhões de abastecimento (N = 3 × 10⁶)',
  isc: 9
};

// grupos (cores no Gantt e nas camadas)
const GRP = {
  apoio: { nome: 'Apoio e mobilização', c: '#728078' },
  terra: { nome: 'Terraplenagem', c: '#a3591c' },
  pav: { nome: 'Pavimentação', c: '#3b4650' },
  usina: { nome: 'Usina de CBUQ', c: '#c7851a' },
  lab: { nome: 'Controle tecnológico', c: '#0f5a4b' }
};

// ---------- serviços (cronograma-base, dias úteis) ----------
// win: janelas de execução [início, fim]; lanes: janela por meia pista (BD/BE)
const SVC_BASE = [
  {
    id: 'S01',
    g: 'apoio',
    nome: 'Mobilização e canteiro de obras',
    win: [[0, 3]],
    norma: 'NR-18 · Plano de canteiro',
    efetivo: '1 Sgt encarregado, 1 Cb, 8 Sd',
    eq: [
      ['Caminhão guindauto (munck)', 1],
      ['Pá carregadeira', 1]
    ],
    qtd: 'Escritório, laboratório, almoxarifado, refeitório, sanitários, pátio de agregados',
    lib: 'Laboratório de campo montado e aferido antes do primeiro ensaio.'
  },
  {
    id: 'S02',
    g: 'apoio',
    nome: 'Locação topográfica e nota de serviço',
    win: [[2, 3.5]],
    norma: 'NBR 13133',
    efetivo: '1 topógrafo, 2 auxiliares',
    eq: [
      ['Estação total', 1],
      ['Nível digital', 1]
    ],
    qtd: 'Eixo estaqueado de 20 em 20 m (est. 0 a 15), offsets e referências de nível',
    lib: 'Nota de serviço de terraplenagem aprovada pela fiscalização.'
  },
  {
    id: 'S03',
    g: 'lab',
    nome: 'Ensaios prévios: subleito, jazidas, agregados e CAP',
    win: [[2, 6]],
    norma: 'DNER-ME 080, 082, 122, 129 e 049',
    efetivo: '1 laboratorista, 2 auxiliares',
    eq: [
      ['Sonda a trado', 1],
      ['Prensa CBR', 1]
    ],
    qtd: '5 furos de sondagem; caracterização, compactação e ISC dos materiais',
    lib: 'Materiais aprovados antes de qualquer lançamento na pista.'
  },
  {
    id: 'S04',
    g: 'terra',
    nome: 'Limpeza, desmatamento e destocamento',
    win: [[3.5, 5]],
    norma: 'DNIT 104/2009-ES',
    efetivo: '1 Sgt, 4 Sd, 2 operadores',
    eq: [
      ['Trator de esteiras', 1],
      ['Caminhão basculante', 2]
    ],
    qtd: '',
    lib: 'Faixa limpa e expurgo removido antes do corte e do aterro.'
  },
  {
    id: 'S05',
    g: 'usina',
    nome: 'Montagem da usina de CBUQ',
    win: [[3, 11]],
    norma: 'Manual do fabricante · NR-12',
    efetivo: '1 Sgt mecânico, 1 eletricista, 4 Sd',
    eq: [
      ['Caminhão guindauto (munck)', 1],
      ['Pá carregadeira', 1]
    ],
    qtd: 'Usina contínua (tambor secador-misturador) de 60 t/h, 4 silos dosadores, filtro de mangas, silo de massa e tanques de CAP',
    lib: 'Licença ambiental de operação, base nivelada e balanças aferidas.'
  },
  {
    id: 'S06',
    g: 'terra',
    nome: 'Escavação de corte, carga e transporte',
    win: [[5, 11]],
    norma: 'DNIT 106/2009-ES',
    efetivo: '1 Sgt, 2 Sd, 5 operadores/motoristas',
    eq: [
      ['Escavadeira hidráulica 20 t', 1],
      ['Caminhão basculante 10 m³', 4],
      ['Trator de esteiras', 1]
    ],
    qtd: '',
    lib: 'Cotas do fundo do corte conferidas (± 3 cm) antes da regularização.'
  },
  {
    id: 'S07',
    g: 'terra',
    nome: 'Aterro: corpo (camadas de até 30 cm)',
    win: [[5.5, 12]],
    norma: 'DNIT 108/2009-ES',
    efetivo: '1 Sgt, 4 operadores, 2 Sd',
    eq: [
      ['Motoniveladora', 1],
      ['Rolo pé-de-carneiro vibratório', 1],
      ['Caminhão-pipa 10 000 L', 1],
      ['Grade de discos + trator', 1]
    ],
    qtd: '',
    lib: 'Cada camada só recebe a seguinte com GC ≥ 100 % (Proctor normal) e umidade dentro de ± 3 %.'
  },
  {
    id: 'S08',
    g: 'terra',
    nome: 'Aterro: camada final (3 × 20 cm)',
    win: [[12, 15]],
    norma: 'DNIT 108/2009-ES',
    efetivo: '1 Sgt, 4 operadores, 2 Sd',
    eq: [
      ['Motoniveladora', 1],
      ['Rolo pé-de-carneiro vibratório', 1],
      ['Rolo liso vibratório', 1],
      ['Caminhão-pipa 10 000 L', 1],
      ['Caminhão basculante 10 m³', 3]
    ],
    qtd: '',
    lib: 'GC ≥ 100 % (energia intermediária), ISC ≥ projeto e expansão ≤ 2 %.'
  },
  {
    id: 'S09',
    g: 'terra',
    nome: 'Regularização do subleito',
    win: [[15, 17]],
    norma: 'DNIT 137/2010-ES',
    efetivo: '1 Sgt, 3 operadores, 2 Sd',
    eq: [
      ['Motoniveladora', 1],
      ['Rolo pé-de-carneiro vibratório', 1],
      ['Rolo liso vibratório', 1],
      ['Caminhão-pipa 10 000 L', 1]
    ],
    qtd: '',
    lib: 'BLC-1: GC ≥ 100 %, umidade ± 2 %, cotas ± 3 cm.'
  },
  {
    id: 'S10',
    g: 'usina',
    nome: 'Dosagem Marshall e calibração da usina',
    win: [[9, 16]],
    norma: 'DNIT 031/2024-ES · DNIT 447-ME',
    efetivo: '1 laboratorista, 1 operador de usina',
    eq: [
      ['Compactador Marshall', 1],
      ['Pá carregadeira', 1]
    ],
    qtd: 'Projeto de mistura faixa C-12,5 e calibração de silos, balanças e bomba de CAP',
    lib: 'Teor de projeto aprovado e curva de calibração dos silos registrada.'
  },
  {
    id: 'S11',
    g: 'pav',
    nome: 'Sub-base de solo-brita (20 cm)',
    win: [[17, 20]],
    norma: 'DNIT 139/2010-ES',
    efetivo: '1 Sgt, 4 operadores, 2 Sd',
    eq: [
      ['Motoniveladora', 1],
      ['Rolo liso vibratório', 1],
      ['Rolo de pneus', 1],
      ['Caminhão-pipa 10 000 L', 1],
      ['Caminhão basculante 10 m³', 3]
    ],
    qtd: '',
    lib: 'BLC-2: GC ≥ 100 %, umidade −2/+1 % na compactação, espessura ± 10 %.'
  },
  {
    id: 'S12',
    g: 'pav',
    nome: 'Base de brita graduada (15 cm)',
    win: [[20, 23.5]],
    norma: 'DNIT 141/2022-ES',
    efetivo: '1 Sgt, 4 operadores, 2 Sd',
    eq: [
      ['Motoniveladora', 1],
      ['Rolo liso vibratório', 1],
      ['Rolo de pneus', 1],
      ['Caminhão-pipa 10 000 L', 1],
      ['Caminhão basculante 10 m³', 3],
      ['Viga Benkelman', 1]
    ],
    qtd: '',
    lib: 'BLC-3: GC ≥ 100 %, umidade ± 1 %, deflexão característica ≤ admissível.'
  },
  {
    id: 'S13',
    g: 'pav',
    nome: 'Imprimação com CM-30',
    lanes: { BD: [23.5, 24], BE: [24, 24.5] },
    cura: [24.5, 27.5],
    norma: 'DNIT 144/2014-ES',
    efetivo: '1 Cb, 1 motorista, 2 Sd',
    eq: [
      ['Vassoura mecânica', 1],
      ['Caminhão espargidor', 1]
    ],
    qtd: '',
    lib: 'Taxa dentro de ± 0,2 L/m² e cura efetiva antes da pintura de ligação.'
  },
  {
    id: 'S14',
    g: 'pav',
    nome: 'Pintura de ligação com RR-1C',
    lanes: { BD: [28, 28.2], BE: [29, 29.2] },
    norma: 'DNIT 145/2012-ES',
    efetivo: '1 Cb, 1 motorista, 2 Sd',
    eq: [
      ['Vassoura mecânica', 1],
      ['Caminhão espargidor', 1]
    ],
    qtd: '',
    lib: 'Emulsão rompida (sem água livre) antes do lançamento do CBUQ.'
  },
  {
    id: 'S15',
    g: 'pav',
    nome: 'CBUQ: produção, transporte, espalhamento e compactação',
    lanes: { BD: [28.3, 28.62], BE: [29.3, 29.62] },
    norma: 'DNIT 031/2024-ES',
    efetivo: '1 Sgt, 1 operador de usina, 6 operadores/motoristas, 4 Sd',
    eq: [
      ['Usina contínua 60 t/h', 1],
      ['Caminhão basculante 12 t (com lona)', 4],
      ['Vibroacabadora', 1],
      ['Rolo de pneus', 1],
      ['Rolo tandem vibratório', 1]
    ],
    qtd: '',
    lib: 'BLC-5: GC entre 97 % e 100 %, espessura ± 5 %; tráfego só com a massa abaixo do ponto de amolecimento.'
  },
  {
    id: 'S16',
    g: 'lab',
    nome: 'Controle final e aceitação do pavimento',
    win: [[30, 32]],
    norma: 'DNIT 031/2024-ES · DNIT 133-ME',
    efetivo: '1 laboratorista, 1 topógrafo, 2 auxiliares',
    eq: [
      ['Viga Benkelman + caminhão 8,2 t', 1],
      ['Perfilômetro / régua de 3 m', 1],
      ['Pêndulo britânico', 1]
    ],
    qtd: 'Deflexões, irregularidade, regularidade, macrotextura e atrito',
    lib: 'Termo de aceitação com todos os ensaios conformes.'
  },
  {
    id: 'S17',
    g: 'apoio',
    nome: 'Desmobilização e entrega à OM',
    win: [[32, 34]],
    norma: 'Termo de Recebimento Provisório',
    efetivo: '1 Sgt, 6 Sd',
    eq: [
      ['Caminhão guindauto (munck)', 1],
      ['Pá carregadeira', 1]
    ],
    qtd: 'Retirada do canteiro e da usina, limpeza e recomposição da área',
    lib: 'Área do canteiro recomposta e as-built entregue.'
  }
];

// cenários de não conformidade (modo "e se")
const CENARIOS = {
  nenhum: {
    opt: {},
    nome: 'Sem não conformidade',
    desc: 'Todos os ensaios conformes, exceto a reprovação real no corpo do aterro (camada 4, com recompactação).'
  },
  base: {
    opt: { failBase: 1, rwBase: 1 },
    nome: 'GC da base reprovado (est. 9+00)',
    desc: 'Um ponto de grau de compactação da base dá 98,1 % (mínimo 100 %). A base é escarificada nesse segmento, a umidade é corrigida, a camada é recompactada e o ponto é reensaiado. Imprimação, pintura, CBUQ e entrega atrasam 1 dia útil.'
  },
  cbuq: {
    opt: { failCbuq: 1, rwCbuq: 1 },
    nome: 'Teor de ligante fora da tolerância',
    desc: 'A primeira amostra da usina (Rotarex) dá 6,05 % de ligante, para projeto de 5,6 % ± 0,3 %. A usina é parada e recalibrada, e os 28 m já lançados na faixa direita são fresados e refeitos. A pavimentação e a entrega atrasam 1 dia útil.'
  }
};

function buildSchedule(o) {
  const svc = SVC_BASE.map(s => JSON.parse(JSON.stringify(s)));
  const shift = (ids, d) =>
    svc
      .filter(s => ids.includes(s.id))
      .forEach(s => {
        if (s.win) s.win = s.win.map(w => w.map(v => v + d));
        if (s.lanes) for (const k in s.lanes) s.lanes[k] = s.lanes[k].map(v => v + d);
        if (s.cura) s.cura = s.cura.map(v => v + d);
      });
  let extra = null;
  if (o.rwBase) {
    shift(['S13', 'S14', 'S15', 'S16', 'S17'], 1);
    extra = {
      id: 'R1',
      g: 'pav',
      rework: 1,
      nome: 'Retrabalho: escarificação e recompactação da base (est. 8+10 a 9+10, BE)',
      win: [[23.5, 24.5]],
      norma: 'DNIT 141/2022-ES',
      efetivo: '1 Sgt, 3 operadores',
      eq: [
        ['Motoniveladora', 1],
        ['Caminhão-pipa 10 000 L', 1],
        ['Rolo liso vibratório', 1]
      ],
      qtd: '20 m × 3,8 m × 0,15 m',
      lib: 'Reensaio de GC no mesmo ponto antes da imprimação.'
    };
    svc.splice(
      svc.findIndex(s => s.id === 'S13'),
      0,
      extra
    );
  }
  if (o.rwCbuq) {
    const s15 = svc.find(s => s.id === 'S15'),
      s14 = svc.find(s => s.id === 'S14');
    const b0 = s15.lanes.BD[0];
    s14.lanes.BE = [b0 + 1.7, b0 + 1.9];
    s15.lanes.BD = [b0 + 1, b0 + 1.32];
    s15.lanes.BE = [b0 + 2, b0 + 2.32];
    s15.falha = { a: b0, b: b0 + 0.06, s: 28.6, rem: [b0 + 0.2, b0 + 0.9] };
    shift(['S16', 'S17'], 1);
    extra = {
      id: 'R2',
      g: 'usina',
      rework: 1,
      nome: 'Usina parada: recalibração e fresagem do segmento 0+00 a 1+08,6 (BD)',
      win: [[b0 + 0.1, b0 + 0.95]],
      norma: 'DNIT 031/2024-ES',
      efetivo: '1 operador de usina, 1 Sgt, 3 Sd',
      eq: [
        ['Fresadora', 1],
        ['Caminhão basculante 12 t (com lona)', 1]
      ],
      qtd: '28,6 m × 3,5 m × 0,05 m ≈ 12 t',
      lib: 'Novo ensaio de teor de ligante conforme antes de retomar a produção.'
    };
    svc.splice(
      svc.findIndex(s => s.id === 'S16'),
      0,
      extra
    );
  }
  for (const s of svc) {
    const ws = s.win ? s.win : Object.values(s.lanes);
    s.a = Math.min(...ws.map(w => w[0]));
    s.b = Math.max(...ws.map(w => w[1]), s.cura ? s.cura[1] : -1);
  }
  return svc;
}

// ---------- progresso das frentes (keyframes [dia, s]) ----------
function interpKF(kf, d) {
  if (!kf.length || d <= kf[0][0]) return kf.length ? kf[0][1] : 0;
  for (let i = 1; i < kf.length; i++)
    if (d <= kf[i][0]) {
      const [a, va] = kf[i - 1],
        [b, vb] = kf[i];
      return b === a ? vb : va + ((vb - va) * (d - a)) / (b - a);
    }
  return kf[kf.length - 1][1];
}
const winKF = (w, L = P.L) => [
  [w[0], 0],
  [w[1], L]
];

function buildFronts(svc, q) {
  const get = id => svc.find(s => s.id === id);
  const F = {};
  const s04 = get('S04').win[0];
  F.limp = winKF(s04);
  const s06 = get('S06').win[0];
  F.corte = [
    [s06[0], 0],
    [s06[1], 1]
  ];
  // corpo do aterro: nível absoluto que sobe camada a camada
  const s07 = get('S07').win[0];
  F.corpo = [];
  const n = q.nLifts;
  for (let k = 0; k <= n; k++) F.corpo.push([lerp(s07[0], s07[1], k / n), k]);
  const s08 = get('S08').win[0];
  F.cf = [
    [s08[0], 0],
    [s08[1], 3]
  ];
  F.reg = winKF(get('S09').win[0]);
  F.sb = winKF(get('S11').win[0]);
  const s12 = get('S12').win[0];
  F.ba = [
    [s12[0], 0],
    [s12[1] - 0.5, P.L]
  ];
  const s13 = get('S13');
  F.impBD = winKF(s13.lanes.BD);
  F.impBE = winKF(s13.lanes.BE);
  const s14 = get('S14');
  F.pinBD = winKF(s14.lanes.BD);
  F.pinBE = winKF(s14.lanes.BE);
  const s15 = get('S15');
  if (s15.falha) {
    const f = s15.falha;
    F.rvBD = [
      [f.a, 0],
      [f.b, f.s],
      [f.rem[0], f.s],
      [f.rem[1], 0],
      [s15.lanes.BD[0], 0],
      [s15.lanes.BD[1], P.L]
    ];
  } else F.rvBD = winKF(s15.lanes.BD);
  F.rvBE = winKF(s15.lanes.BE);
  return F;
}

// ---------- ensaios ----------
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = R => {
  let u = 0,
    v = 0;
  while (u === 0) u = R();
  while (v === 0) v = R();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const NORMAS = {
  frasco: 'DNER-ME 092/94',
  speedy: 'DNER-ME 052/94',
  comp: 'DNER-ME 129/94',
  isc: 'DNER-ME 049/94',
  granul: 'DNER-ME 080/94',
  ll: 'DNER-ME 122/94',
  lp: 'DNER-ME 082/94',
  benk: 'DNER-ME 024/94',
  marshall: 'DNIT 447-ME',
  rt: 'DNIT 136-ME',
  dui: 'DNIT 180-ME',
  gmm: 'DNIT 427-ME',
  granCB: 'DNIT 412-ME',
  cps: 'DNIT 428-ME',
  defl: 'DNIT 133-ME',
  irr: 'DNIT 442-ME',
  la: 'DNIT 451-ME',
  ea: 'DNIT 450-ME'
};

// cota da superfície exposta (para posicionar marcadores)
function surfAt(layer, s, z, k) {
  if (layer === 'nat') return nat(s, z);
  if (layer === 'corpo') return Math.min(dFill(s, z) - P.E_CF, OBRA_Q.minNat + P.LIFT * (k + 1));
  if (layer === 'cf') return dFill(s, z) - P.E_CF + P.LIFT_CF * (k + 1);
  if (layer === 'reg') return sg(s);
  if (layer === 'sb') return sg(s) + P.E_SB;
  if (layer === 'ba' || layer === 'imp') return sg(s) + P.E_SB + P.E_BA;
  return gr(s);
}
let OBRA_Q = null;
const setObraQ = q => {
  OBRA_Q = q;
};

function buildTests(svc, q, o, F) {
  const T = [];
  const R = rng(20270503);
  const get = id => svc.find(s => s.id === id);
  const at = (kf, s) => {
    // dia em que a frente passa pela estaca s
    for (let i = 1; i < kf.length; i++) {
      const [a, va] = kf[i - 1],
        [b, vb] = kf[i];
      if (vb > va && s >= va && s <= vb) return a + ((b - a) * (s - va)) / (vb - va);
    }
    return kf[kf.length - 1][0];
  };
  const add = t => {
    t.id = 'E' + String(T.length + 1).padStart(3, '0');
    T.push(t);
    return t;
  };
  const lado = z => (z > 1 ? 'BD' : z < -1 ? 'BE' : 'eixo');
  const zs = [-2.4, 0, 2.4];

  // --- ensaios prévios (laboratório) ---
  const s03 = get('S03').win[0];
  const s04a = get('S04').win[0][0];
  [0, 80, 160, 220, 300].forEach((s, i) =>
    add({
      svc: 'S03',
      tipo: 'campo',
      layer: 'nat',
      nome: 'Sondagem a trado do subleito',
      norma: 'DNER-PRO 381/98',
      s,
      z: 0,
      day: s03[0] + 0.5 + i * 0.3,
      until: s04a + (s / P.L) * 1.5,
      v: ['Argila arenosa vermelha', 'Argila arenosa vermelha', 'Argila siltosa cinza', 'Argila siltosa cinza', 'Argila arenosa vermelha'][i],
      u: '',
      crit: 'Identificação do material e do NA',
      ok: true,
      obs: i === 3 ? 'NA não atingido até 1,50 m' : 'NA não atingido até 1,00 m'
    })
  );
  const LAB = [
    ['Subleito: granulometria e limites (LL 38 %, IP 14 %)', NORMAS.granul + ' · ' + NORMAS.ll, 'IG = 7', '', 'Classificação TRB A-6', true],
    ['Subleito: compactação Proctor normal', NORMAS.comp, '1,725', 'g/cm³', 'hót = 18,2 %', true],
    ['Subleito: ISC e expansão', NORMAS.isc, '9', '%', 'ISC ≥ 6 % · exp. 1,2 % ≤ 2 %', true],
    ['Jazida de empréstimo (camada final): ISC', NORMAS.isc, '14', '%', 'ISC ≥ 6 % · exp. 0,8 % ≤ 2 %', true],
    ['Solo-brita (60 % solo + 40 % brita 1): ISC', NORMAS.isc, '38', '%', 'ISC ≥ 20 % · exp. 0,3 % ≤ 1 % · IG = 0', true],
    ['Brita graduada: ISC e expansão', NORMAS.isc, '92', '%', 'ISC ≥ 60 % (N ≤ 5×10⁶) · exp. 0,1 % ≤ 0,5 %', true],
    ['Brita graduada: LL / IP', NORMAS.ll, 'NL / NP', '', 'LL ≤ 25 % · IP ≤ 6 %', true],
    ['Brita graduada: abrasão Los Angeles', NORMAS.la, '31', '%', '≤ 55 %', true],
    ['Agregado graúdo do CBUQ: abrasão Los Angeles', NORMAS.la, '28', '%', '≤ 50 %', true],
    ['Agregado miúdo do CBUQ: equivalente de areia', NORMAS.ea, '68', '%', '≥ 55 %', true],
    ['CAP 50/70: penetração e ponto de amolecimento', 'Resolução ANP 897/2022', '58 / 49,5', '0,1 mm / °C', 'Conforme especificação do ligante', true]
  ];
  LAB.forEach((l, i) => add({ svc: 'S03', tipo: 'lab', nome: l[0], norma: l[1], day: s03[0] + 1.2 + i * 0.25, v: l[2], u: l[3], crit: l[4], ok: l[5] }));

  // --- corpo do aterro ---
  const s07 = get('S07').win[0];
  const n = q.nLifts;
  for (let k = 0; k < n; k++) {
    const lvl = q.minNat + P.LIFT * (k + 1);
    const xs = [];
    for (let s = 0; s <= P.L; s += 2) if (nat(s, 0) < Math.min(lvl, sg(s) - P.E_CF) - 0.05) xs.push(s);
    if (!xs.length) continue;
    const a = xs[0],
      b = xs[xs.length - 1];
    const d0 = lerp(s07[0], s07[1], (k + 1) / n),
      cover = lerp(s07[0], s07[1], (k + 1.02) / n);
    add({
      svc: 'S07',
      tipo: 'lab',
      nome: `Corpo do aterro, camada ${k + 1}: Proctor normal do material do corte`,
      norma: NORMAS.comp,
      day: d0 - 0.25,
      v: nf(1.718 + (R() - 0.5) * 0.02, 3),
      u: 'g/cm³',
      crit: 'Referência para o GC da camada',
      ok: true
    });
    for (let i = 0; i < 5; i++) {
      const s = Math.round(lerp(a, b, (i + 0.5) / 5));
      const z = zs[i % 3];
      let gc = 101.3 + gauss(R) * 0.7;
      if (gc < 100.2) gc = 100.2 + R() * 0.5;
      const t = {
        svc: 'S07',
        tipo: 'campo',
        layer: 'corpo',
        k,
        nome: `GC corpo do aterro, camada ${k + 1}`,
        norma: NORMAS.frasco,
        s,
        z,
        day: d0 - 0.15 + i * 0.02,
        until: cover,
        v: nf(gc),
        u: '%',
        crit: 'GC ≥ 100 % (Proctor normal)',
        ok: true,
        w: nf(18.2 + gauss(R) * 1.1)
      };
      if (k === 3 && i === 2) {
        t.v = '97,6';
        t.ok = false;
        t.obs = 'Umidade 21,6 % (acima de hót + 3 %). Camada aerada com grade de discos e recompactada.';
        t.w = '21,6';
        add(t);
        add({ ...t, nome: t.nome + ' (reensaio)', day: t.day + 0.08, v: '100,9', ok: true, obs: 'Reensaio após aeração e recompactação.', w: '18,9', re: 1 });
        continue;
      }
      add(t);
    }
  }
  // --- camada final ---
  const s08 = get('S08').win[0];
  for (let k = 0; k < 3; k++) {
    const d0 = lerp(s08[0], s08[1], (k + 1) / 3),
      cover = k < 2 ? d0 + 0.02 : get('S11').win[0][0];
    if (k === 0)
      add({
        svc: 'S08',
        tipo: 'lab',
        nome: 'Camada final: compactação e ISC do empréstimo (energia intermediária)',
        norma: NORMAS.comp + ' · ' + NORMAS.isc,
        day: s08[0] - 0.3,
        v: '14',
        u: '%',
        crit: 'ISC ≥ 6 % · exp. ≤ 2 %',
        ok: true
      });
    for (let i = 0; i < 5; i++) {
      const s = Math.round(lerp(q.sFill0 + 4, q.sFill1 - 4, (i + 0.5) / 5));
      const z = zs[(i + k) % 3];
      const gc = Math.max(100.3, 101.0 + gauss(R) * 0.6);
      add({
        svc: 'S08',
        tipo: 'campo',
        layer: 'cf',
        k,
        nome: `GC camada final, subcamada ${k + 1}`,
        norma: NORMAS.frasco,
        s,
        z,
        day: d0 - 0.2 + i * 0.03,
        until: cover,
        v: nf(gc),
        u: '%',
        crit: 'GC ≥ 100 % (Método B)',
        ok: true,
        w: nf(16.4 + gauss(R) * 0.8)
      });
    }
  }
  // --- regularização ---
  const s09 = get('S09').win[0];
  const s11a = get('S11').win[0][0];
  for (let i = 0; i < 5; i++) {
    const s = 30 + i * 60,
      z = zs[i % 3];
    add({
      svc: 'S09',
      tipo: 'campo',
      layer: 'reg',
      nome: 'GC regularização do subleito',
      norma: NORMAS.frasco,
      s,
      z,
      day: at(F.reg, s) + 0.1,
      until: s11a + (s / P.L) * 3,
      v: nf(Math.max(100.2, 101.1 + gauss(R) * 0.5)),
      u: '%',
      crit: 'GC ≥ 100 % · umidade ± 2 %',
      ok: true,
      w: nf(17.9 + gauss(R) * 0.9)
    });
  }
  add({
    svc: 'S09',
    tipo: 'campo',
    layer: 'reg',
    nome: 'Controle geométrico: cotas da regularização',
    norma: 'Nota de serviço',
    s: 150,
    z: 4.5,
    day: s09[1] - 0.1,
    until: s11a + 1.5,
    v: '−1,8 a +2,4',
    u: 'cm',
    crit: '± 3 cm em relação ao greide',
    ok: true
  });
  // --- sub-base ---
  const s11 = get('S11').win[0];
  const s12a = get('S12').win[0][0];
  add({
    svc: 'S11',
    tipo: 'lab',
    nome: 'Sub-base: compactação (Método B) e ISC do solo-brita',
    norma: NORMAS.comp + ' · ' + NORMAS.isc,
    day: s11[0] + 0.3,
    v: '2,086',
    u: 'g/cm³',
    crit: 'hót = 9,6 % · ISC 38 % ≥ 20 %',
    ok: true
  });
  for (let i = 0; i < 5; i++) {
    const s = 20 + i * 62,
      z = zs[(i + 1) % 3];
    add({
      svc: 'S11',
      tipo: 'campo',
      layer: 'sb',
      nome: 'GC sub-base',
      norma: NORMAS.frasco,
      s,
      z,
      day: at(F.sb, s) + 0.12,
      until: s12a + (s / P.L) * 3,
      v: nf(Math.max(100.3, 101.4 + gauss(R) * 0.6)),
      u: '%',
      crit: 'GC ≥ 100 %',
      ok: true,
      w: nf(9.1 + gauss(R) * 0.5)
    });
  }
  // --- base ---
  const s12 = get('S12').win[0];
  const s13a = get('S13').lanes.BD[0];
  add({
    svc: 'S12',
    tipo: 'lab',
    nome: 'Base: compactação e ISC da brita graduada',
    norma: 'DNIT 164-ME · DNIT 172-ME',
    day: s12[0] + 0.3,
    v: '2,312',
    u: 'g/cm³',
    crit: 'hót = 5,8 % · ISC 92 % ≥ 60 % · exp. 0,1 %',
    ok: true
  });
  for (let i = 0; i < 5; i++) {
    const s = i === 2 && o.failBase ? 180 : 15 + i * 64,
      z = i === 2 && o.failBase ? -2.4 : zs[(i + 2) % 3];
    const t = {
      svc: 'S12',
      tipo: 'campo',
      layer: 'ba',
      nome: 'GC base',
      norma: NORMAS.frasco,
      s,
      z,
      day: at(F.ba, s) + 0.12,
      until: s13a + 0.3,
      v: nf(Math.max(100.2, 101.2 + gauss(R) * 0.5)),
      u: '%',
      crit: 'GC ≥ 100 % · umidade ± 1 %',
      ok: true,
      w: nf(5.7 + gauss(R) * 0.3)
    };
    if (i === 2 && o.failBase) {
      t.v = '98,1';
      t.ok = false;
      t.w = '4,2';
      t.obs = o.rwBase
        ? 'Umidade 1,6 % abaixo da ótima. Segmento escarificado, umedecido e recompactado.'
        : 'Umidade 1,6 % abaixo da ótima. Ponto aceito sem retrabalho: não conformidade aberta.';
      add(t);
      if (o.rwBase) {
        const r1 = get('R1').win[0];
        add({ ...t, nome: 'GC base (reensaio)', day: r1[1] - 0.15, v: '100,8', ok: true, w: '5,9', obs: 'Reensaio após retrabalho.', re: 1 });
      }
    } else add(t);
  }
  // deflexões na base (a cada 20 m, faixas alternadas)
  const dBase = [];
  for (let i = 0; i < 15; i++) {
    const s = 10 + i * 20,
      z = i % 2 ? -1.75 : 1.75;
    const d = Math.round(52 + gauss(R) * 6);
    dBase.push(d);
    add({
      svc: 'S12',
      tipo: 'campo',
      layer: 'ba',
      grp: 'deflBase',
      nome: 'Deflexão na base (viga Benkelman)',
      norma: NORMAS.benk,
      s,
      z,
      day: s12[1] - 0.45 + i * 0.025,
      until: s13a + 0.3,
      v: String(d),
      u: '× 0,01 mm',
      crit: 'Dc ≤ 70 × 0,01 mm (projeto)',
      ok: true
    });
  }
  // --- imprimação ---
  const s13 = get('S13');
  const s14 = get('S14');
  ['BD', 'BE'].forEach((ln, j) => {
    for (let i = 0; i < (j ? 2 : 3); i++) {
      const s = 40 + i * 100 + j * 50,
        z = ln === 'BD' ? 1.9 : -1.9;
      add({
        svc: 'S13',
        tipo: 'campo',
        layer: 'imp',
        nome: 'Taxa de imprimação (bandeja)',
        norma: 'DNIT 144/2014-ES',
        s,
        z,
        day: at(ln === 'BD' ? F.impBD : F.impBE, s) + 0.02,
        until: s14.lanes[ln][0],
        v: nf(1.2 + gauss(R) * 0.06, 2),
        u: 'L/m²',
        crit: 'Projeto 1,20 ± 0,20 L/m²',
        ok: true
      });
    }
  });
  // --- pintura ---
  const s15 = get('S15');
  ['BD', 'BE'].forEach((ln, j) => {
    for (let i = 0; i < (j ? 2 : 3); i++) {
      const s = 60 + i * 90 + j * 40,
        z = ln === 'BD' ? 1.6 : -1.6;
      add({
        svc: 'S14',
        tipo: 'campo',
        layer: 'pin',
        nome: 'Taxa de pintura de ligação (bandeja)',
        norma: 'DNIT 145/2012-ES',
        s,
        z,
        day: at(ln === 'BD' ? F.pinBD : F.pinBE, s) + 0.02,
        until: s15.lanes[ln][0] + (s / P.L) * 0.55,
        v: nf(0.9 + gauss(R) * 0.05, 2),
        u: 'L/m²',
        crit: 'Emulsão diluída 1:1 · 0,90 ± 0,20 L/m²',
        ok: true
      });
    }
  });
  // --- dosagem e usina ---
  const s10 = get('S10').win[0];
  [
    ['Dosagem Marshall: teor de projeto', NORMAS.marshall, '5,6', '%', 'Vv = 4,0 % (3 a 5 %)'],
    ['Dosagem: relação betume/vazios', 'DNIT 449-PRO', '72', '%', 'RBV 65 a 75 %'],
    ['Dosagem: estabilidade Marshall (75 golpes)', NORMAS.marshall, '985', 'kgf', '≥ 500 kgf'],
    ['Dosagem: resistência à tração indireta', NORMAS.rt, '1,08', 'MPa', '≥ 0,65 MPa'],
    ['Dosagem: dano por umidade induzida (RRT)', NORMAS.dui, '0,82', '', '≥ 0,70'],
    ['Dosagem: relação filer/betume', 'DNIT 031/2024-ES', '1,1', '', '0,6 a 1,6']
  ].forEach((l, i) => add({ svc: 'S10', tipo: 'lab', nome: l[0], norma: l[1], day: s10[0] + 1 + i * 0.6, v: l[2], u: l[3], crit: l[4], ok: true }));
  add({
    svc: 'S10',
    tipo: 'usina',
    nome: 'Calibração dos silos dosadores e da bomba de CAP',
    norma: 'Manual do fabricante',
    day: s10[1] - 1.2,
    v: '±1,5',
    u: '% de vazão',
    crit: 'Curva de calibração registrada',
    ok: true
  });

  ['BD', 'BE'].forEach((ln, j) => {
    const w = s15.lanes[ln];
    const fail = o.failCbuq && ln === 'BD',
      rw = fail && o.rwCbuq;
    if (fail) {
      add({
        svc: 'S15',
        tipo: 'usina',
        nome: 'Teor de ligante da mistura (Rotarex), 1ª amostra',
        norma: 'DNER-ME 053/94',
        day: (rw ? s15.falha.a : w[0]) + 0.07,
        v: '6,05',
        u: '%',
        crit: '5,6 ± 0,3 %',
        ok: false,
        obs: rw ? 'Usina parada. Recalibração da bomba de CAP e fresagem dos 28,6 m lançados.' : 'Produção mantida sem correção: não conformidade aberta.'
      });
    }
    add({
      svc: 'S15',
      tipo: 'usina',
      nome: `Temperatura CAP / agregados (${ln})`,
      norma: 'DNIT 031/2024-ES',
      day: w[0] - 0.05,
      v: '155 / 167',
      u: '°C',
      crit: 'CAP 107 a 177 °C · agregados +10 a +15 °C',
      ok: true
    });
    add({
      svc: 'S15',
      tipo: 'usina',
      nome: `Teor de ligante da mistura (Rotarex, ${ln})${rw ? ' após recalibração' : ''}`,
      norma: 'DNER-ME 053/94',
      day: w[0] + 0.15,
      v: nf(5.6 + gauss(R) * 0.08, 2),
      u: '%',
      crit: '5,6 ± 0,3 %',
      ok: true
    });
    add({
      svc: 'S15',
      tipo: 'usina',
      nome: `Granulometria da mistura (${ln})`,
      norma: NORMAS.granCB,
      day: w[0] + 0.2,
      v: 'na faixa',
      u: '',
      crit: 'Projeto ± tolerâncias da Tabela 3',
      ok: true,
      gran: j
    });
    add({
      svc: 'S15',
      tipo: 'usina',
      nome: `Gmm e resistência à tração (${ln})`,
      norma: NORMAS.gmm + ' · ' + NORMAS.rt,
      day: w[0] + 0.3,
      v: j ? '2,458 / 1,02' : '2,461 / 1,06',
      u: 'g/cm³ / MPa',
      crit: 'RT ≥ 0,65 MPa',
      ok: true
    });
    for (let i = 0; i < 3; i++) {
      const s = 50 + i * 100,
        z = ln === 'BD' ? 1.75 : -1.75,
        d = at(ln === 'BD' ? F.rvBD.slice(-2) : F.rvBE, s);
      add({
        svc: 'S15',
        tipo: 'campo',
        layer: 'rv',
        nome: `Temperatura de espalhamento (${ln})`,
        norma: 'DNIT 031/2024-ES',
        s: s - 20,
        z,
        day: d,
        until: d + 0.3,
        v: String(Math.round(151 + gauss(R) * 2)),
        u: '°C',
        crit: '≥ 145 °C',
        ok: true
      });
      add({
        svc: 'S15',
        tipo: 'campo',
        layer: 'rv',
        grp: 'gcCB',
        nome: `GC do CBUQ, corpo de prova extraído (${ln})`,
        norma: NORMAS.cps,
        s,
        z,
        day: d + 0.9,
        v: nf(clamp(98.6 + gauss(R) * 0.6, 97.3, 99.8)),
        u: '%',
        crit: '97 % ≤ GC ≤ 100 %',
        ok: true,
        esp: nf(clamp(5.0 + gauss(R) * 0.08, 4.8, 5.2), 2)
      });
    }
  });
  // --- controle final ---
  const s16 = get('S16').win[0];
  const dFin = [];
  for (let i = 0; i < 15; i++) {
    const s = 10 + i * 20,
      z = i % 2 ? 1.75 : -1.75,
      d = Math.round(36 + gauss(R) * 4.5);
    dFin.push(d);
    add({
      svc: 'S16',
      tipo: 'campo',
      layer: 'rv',
      grp: 'deflFin',
      nome: 'Deflexão no revestimento (viga Benkelman)',
      norma: NORMAS.defl,
      s,
      z,
      day: s16[0] + 0.1 + i * 0.03,
      v: String(d),
      u: '× 0,01 mm',
      crit: 'Dc ≤ 50 × 0,01 mm (projeto)',
      ok: true
    });
  }
  [
    ['Irregularidade longitudinal, est. 0 a 10', NORMAS.irr, '1,7', 'm/km', 'IRI ≤ 2,0 m/km', 100],
    ['Irregularidade longitudinal, est. 10 a 15', NORMAS.irr, '1,9', 'm/km', 'IRI ≤ 2,0 m/km', 250],
    ['Régua de 3 m (regularidade)', 'DNIT 031/2024-ES', '0,3', 'cm', '≤ 0,5 cm', 120],
    ['Atrito: pêndulo britânico (VDR)', 'DNIT 031/2024-ES', '56', '', 'VDR ≥ 47', 200],
    ['Macrotextura: mancha de areia', 'DNIT 031/2024-ES', '0,62', 'mm', 'Conforme projeto (0,6 a 1,2 mm)', 210]
  ].forEach((l, i) =>
    add({
      svc: 'S16',
      tipo: 'campo',
      layer: 'rv',
      nome: l[0],
      norma: l[1],
      s: l[5],
      z: i % 2 ? 1.75 : -1.75,
      day: s16[0] + 1 + i * 0.15,
      v: l[2],
      u: l[3],
      crit: l[4],
      ok: true
    })
  );

  for (const t of T) if (t.s != null) t.y = surfAt(t.layer, t.s, t.z, t.k || 0);
  T.sort((a, b) => a.day - b.day);
  return { T, dBase, dFin };
}

// estatística das deflexões (Dc = D̄ + k·S)
function deflStats(arr) {
  const n = arr.length,
    m = arr.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  const k = n >= 21 ? 1.01 : n >= 15 ? 1.1 : n >= 10 ? 1.21 : 1.55;
  return { n, m, sd, k, dc: m + k * sd };
}

// ---------- dosagem Marshall (série de teores) ----------
const MARSHALL = {
  teor: [4.6, 5.1, 5.6, 6.1, 6.6],
  vv: [6.4, 5.1, 4.0, 3.1, 2.4],
  vam: [15.0, 14.7, 14.4, 14.6, 15.0],
  est: [820, 930, 985, 940, 860],
  dap: [2.338, 2.352, 2.363, 2.36, 2.351]
};
MARSHALL.rbv = MARSHALL.vam.map((v, i) => ((v - MARSHALL.vv[i]) / v) * 100);

// granulometria do CBUQ (faixa C-12,5): curva de projeto e tolerâncias de produção (DNIT 031/2024-ES, Tabela 3)
const GRAN = {
  pen: ['3/4"', '1/2"', '3/8"', '1/4"', 'nº 4', 'nº 8', 'nº 16', 'nº 30', 'nº 50', 'nº 100', 'nº 200'],
  mm: [19.0, 12.5, 9.5, 6.3, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15, 0.075],
  proj: [100, 95, 84, 68, 58, 40, 28, 20, 13, 8.5, 5.5],
  tol: [7, 7, 7, 7, 5, 5, 5, 5, 4, 3, 2],
  usina: [
    [100, 96, 86, 70, 59, 41, 29, 19.6, 12.4, 8.1, 5.2],
    [100, 94, 82, 66, 56, 38.5, 27, 19.2, 12.8, 8.8, 5.9]
  ]
};

// curvas de compactação (laboratório) para o gráfico
const PROCTOR = [
  {
    nome: 'Subleito (Proctor normal)',
    hot: 18.2,
    gmax: 1.725,
    c: 'var(--c-esg)',
    pts: [
      [14.1, 1.651],
      [16.2, 1.699],
      [18.2, 1.725],
      [20.1, 1.704],
      [22.0, 1.661]
    ]
  },
  {
    nome: 'Solo-brita (Método B)',
    hot: 9.6,
    gmax: 2.086,
    c: 'var(--c-ilum)',
    pts: [
      [6.0, 2.003],
      [7.8, 2.058],
      [9.6, 2.086],
      [11.4, 2.061],
      [13.1, 2.012]
    ]
  },
  {
    nome: 'Brita graduada',
    hot: 5.8,
    gmax: 2.312,
    c: 'var(--c-alim)',
    pts: [
      [3.6, 2.241],
      [4.7, 2.289],
      [5.8, 2.312],
      [6.9, 2.296],
      [8.0, 2.258]
    ]
  }
];

// ---------- usina: componentes ----------
const USINA = [
  [
    'Silos dosadores frios (4)',
    'Brita 1, brita 0, pó de pedra e areia. Cada silo tem comporta e correia dosadora de velocidade variável, calibrada por pesagem.'
  ],
  ['Correia coletora e balança', 'Leva a mistura de agregados úmidos ao tambor. A balança integradora informa a vazão real ao CLP.'],
  ['Tambor secador-misturador', 'Contrafluxo: o queimador seca e aquece os agregados na zona de secagem, e o CAP é injetado na zona de mistura.'],
  ['Filtro de mangas e chaminé', 'Retém os finos (o filer recuperado volta à mistura) e controla a emissão de material particulado.'],
  ['Elevador e silo de massa', 'Armazena a massa quente. Os caminhões param sob a comporta e recebem a carga em três montes, para evitar segregação.'],
  ['Tanques de CAP aquecidos', 'O CAP 50/70 fica aquecido por óleo térmico, com circulação mínima de 15 min antes da produção do dia.'],
  ['Cabine de comando', 'Opera o CLP, registra temperaturas e vazões e emite o tíquete de cada caminhão (hora, massa e temperatura).']
];

// ---------- manual por serviço ----------
const MANUAL = {
  S01: {
    onde: 'Pátio já nivelado ao lado da estaca 0, dentro da área militar, com acesso direto à via existente.',
    como: [
      'Defina com a fiscalização e o comando da OM a área do canteiro, o horário de trabalho e as restrições de circulação (formaturas, deslocamento de tropa e viaturas).',
      'Instale os contêineres de escritório, laboratório, almoxarifado, refeitório e sanitários sobre calços nivelados e aterre as estruturas metálicas.',
      'Monte o laboratório de campo (estufa, balanças, conjunto de frasco de areia, Speedy, prensa CBR e compactador Marshall) e registre a aferição dos equipamentos.',
      'Delimite as baias de agregados com piso drenado e separe a área da usina, com bacia de contenção para os tanques de CAP e combustível.',
      'Sinalize o desvio de tráfego e afixe a placa da obra.'
    ],
    chk: ['Plano de canteiro aprovado', 'Extintores e kit de primeiros socorros', 'Bacia de contenção dos tanques', 'Equipamentos de laboratório aferidos']
  },
  S02: {
    onde: 'Eixo da via, estacas 0+00 a 15+00, com referências de nível fora da área de terraplenagem.',
    como: [
      'Implante o eixo com estacas a cada 20 m e marque os offsets (pés de corte e de aterro) dos dois lados.',
      'Nivele o terreno natural em todas as estacas e gere as seções transversais primitivas.',
      'Emita a nota de serviço com cotas de projeto, alturas de corte e aterro e larguras de plataforma.',
      'Transfira as referências de nível para pontos fixos fora da área de trabalho (meios-fios e muros existentes).'
    ],
    chk: ['Seções primitivas arquivadas', 'Referências de nível protegidas', 'Nota de serviço assinada']
  },
  S03: {
    onde: 'Subleito ao longo do eixo, jazida de empréstimo indicada pela fiscalização, pedreira e distribuidora de CAP.',
    como: [
      'Execute furos de sondagem a trado nas estacas 0, 4, 8, 11 e 15 e colete amostras deformadas de cada horizonte.',
      'Faça granulometria, limites de Atterberg, compactação e ISC do subleito e classifique o solo (TRB).',
      'Ensaie o solo da jazida para a camada final e a mistura de solo-brita para a sub-base.',
      'Aprove a brita graduada (ISC, expansão, LL/IP e abrasão Los Angeles) e os agregados do CBUQ (Los Angeles, equivalente de areia, forma e adesividade).',
      'Confira o certificado do CAP 50/70 de cada carga recebida.'
    ],
    chk: ['ISC do subleito ≥ ISC de projeto (9 %)', 'Expansão do subleito ≤ 2 %', 'Agregados aprovados antes de abastecer a usina']
  },
  S04: {
    onde: 'Faixa de domínio da obra, estacas 0+00 a 15+00, com 15 m de largura.',
    como: [
      'Retire árvores, arbustos e tocos com o trator de esteiras, removendo também as raízes.',
      'Raspe a camada vegetal (cerca de 20 cm) e estoque o material para a recomposição dos taludes.',
      'Carregue os resíduos vegetais para a área de bota-fora autorizada pela OM.',
      'Não deixe raízes nem material orgânico sob a área de aterro.'
    ],
    chk: ['Supressão vegetal autorizada', 'Expurgo removido da base dos aterros', 'Terra vegetal estocada']
  },
  S05: {
    onde: 'Área da usina no canteiro, a cerca de 60 m do eixo, com saída para a via pela rampa de acesso.',
    como: [
      'Execute a base de concreto e os blocos de ancoragem conforme o projeto do fabricante.',
      'Posicione os silos dosadores, a correia coletora, o tambor, o filtro de mangas, o silo de massa e os tanques de CAP.',
      'Faça as ligações elétricas, o óleo térmico e as linhas de CAP com isolamento térmico.',
      'Teste o queimador e o exaustor em vazio e confira o intertravamento do CLP.',
      'Afira as balanças da correia e da bomba de CAP com pesos-padrão.'
    ],
    chk: ['Licença de operação ambiental', 'Balanças aferidas', 'Termômetros de 90 a 210 °C com precisão de ± 1 °C', 'Bacia de contenção estanque']
  },
  S06: {
    onde: 'Trechos em corte: estacas 0+00 a 6+14 e 14+06 a 15+00.',
    como: [
      'Escave com a escavadeira em fatias de cerca de 1 m, mantendo a drenagem provisória da praça de trabalho.',
      'Carregue os basculantes e transporte o material para o corpo do aterro (estacas 7 a 14).',
      'Conforme os taludes de corte em 1V:1H e deixe o fundo do corte na cota do topo da terraplenagem indicada na nota de serviço.',
      'Confira as cotas do fundo do corte com o nível a cada 20 m.'
    ],
    chk: ['Distribuição pelo diagrama de massas', 'Material inservível segregado', 'Talude conferido com gabarito']
  },
  S07: {
    onde: 'Trecho em aterro: estacas 6+14 a 14+05, onde a altura máxima chega a cerca de 2,5 m.',
    como: [
      'Lance o material do corte em camadas de no máximo 30 cm compactados, começando pela cota mais baixa.',
      'Homogeneíze com a grade de discos e corrija a umidade (caminhão-pipa ou aeração) para hót ± 3 %.',
      'Compacte com o rolo pé-de-carneiro até atingir GC ≥ 100 % do Proctor normal.',
      'Faça o ensaio de frasco de areia em pelo menos 5 pontos por camada antes de liberar a seguinte.',
      'Mantenha caimento transversal para escoar a chuva e evitar empoçamento.'
    ],
    chk: [
      'Espessura solta conferida',
      'Umidade dentro de hót ± 3 %',
      'GC ≥ 100 % em todos os pontos',
      'Taludes de 1V:1,5H com sobrelargura para corte posterior'
    ]
  },
  S08: {
    onde: 'Últimos 60 cm do aterro, nas estacas 6+14 a 14+05, com solo selecionado da jazida de empréstimo.',
    como: [
      'Lance o solo da jazida em três subcamadas de 20 cm compactados.',
      'Corrija a umidade e compacte na energia intermediária (Método B).',
      'Controle o GC em 5 pontos por subcamada e o ISC a cada 4 ensaios de compactação.',
      'Acerte a última subcamada com a motoniveladora seguindo a nota de serviço.'
    ],
    chk: ['ISC ≥ 6 % e expansão ≤ 2 %', 'GC ≥ 100 % (Método B)', 'Cotas de eixo e bordos dentro de ± 4 cm']
  },
  S09: {
    onde: 'Toda a plataforma, estacas 0+00 a 15+00, com 9,0 m de largura.',
    como: [
      'Escarifique 20 cm do subleito com a motoniveladora.',
      'Pulverize, umedeça ou aere até a umidade ótima (± 2 %) e homogeneíze.',
      'Compacte com o pé-de-carneiro e dê o acabamento com o rolo liso.',
      'Confira as cotas a cada 20 m (eixo e bordos) e o abaulamento.',
      'Emita o Boletim de Liberação de Camada (BLC-1) antes de lançar a sub-base.'
    ],
    chk: ['GC ≥ 100 % em 5 pontos', 'Cotas dentro de ± 3 cm', 'Largura ≥ 9,0 m (tolerância ± 10 cm)']
  },
  S10: {
    onde: 'Laboratório de campo e usina de CBUQ.',
    como: [
      'Componha a curva granulométrica de projeto na faixa C-12,5 com brita 1, brita 0, pó de pedra e areia.',
      'Molde corpos de prova Marshall (75 golpes) em 5 teores de ligante e determine Vv, VAM, RBV e estabilidade.',
      'Escolha o teor de projeto para Vv = 4 % e confira RBV, resistência à tração e dano por umidade.',
      'Calibre cada silo dosador (vazão × abertura) e a bomba de CAP com pesagens reais.',
      'Produza uma mistura de teste e confira teor e granulometria antes de liberar a usina.'
    ],
    chk: ['Vv 3 a 5 %, RBV 65 a 75 %', 'RT ≥ 0,65 MPa e RRT ≥ 0,70', 'Curvas de calibração arquivadas']
  },
  S11: {
    onde: 'Plataforma regularizada, estacas 0+00 a 15+00, com 8,0 m de largura.',
    como: [
      'Misture solo e brita (60/40 em massa) no pátio ou na pista e distribua com a motoniveladora.',
      'Corrija a umidade para a faixa de −2 a +1 ponto da ótima no início da compactação.',
      'Compacte com rolo liso vibratório e de pneus até GC ≥ 100 %.',
      'Controle espessura, largura e abaulamento e emita o BLC-2.'
    ],
    chk: ['ISC ≥ 20 %, expansão ≤ 1 %, IG = 0', 'GC ≥ 100 % em 5 pontos', 'Espessura de 20 cm ± 10 %']
  },
  S12: {
    onde: 'Sobre a sub-base liberada, estacas 0+00 a 15+00, com 7,6 m de largura.',
    como: [
      'Descarregue a brita graduada em leiras e espalhe com a motoniveladora sem segregar.',
      'Corrija a umidade para hót ± 1 % com o caminhão-pipa.',
      'Compacte com o rolo liso vibratório e finalize com o rolo de pneus.',
      'Ensaie o GC em 5 pontos e meça as deflexões a cada 20 m em faixas alternadas.',
      'Imprime logo após o acabamento, para não deixar a base exposta.'
    ],
    chk: ['GC ≥ 100 %', 'Dc = D̄ + k·S ≤ deflexão de projeto', 'Espessura de 15 cm ± 10 %']
  },
  S13: {
    onde: 'Base acabada, em meia pista (primeiro o bordo direito, depois o esquerdo), mantendo o acesso das viaturas.',
    como: [
      'Varra a superfície e umedeça levemente, se necessário.',
      'Aplique o CM-30 com o caminhão espargidor a 1,2 L/m², com a barra em altura constante.',
      'Coloque bandejas para aferir a taxa e corrija a velocidade do caminhão, se preciso.',
      'Interdite a faixa até a cura (cerca de 72 h) e não aplique abaixo de 10 °C ou com chuva.'
    ],
    chk: ['Taxa de 1,2 ± 0,2 L/m²', 'Penetração e cura verificadas', 'Sem excesso empoçado']
  },
  S14: {
    onde: 'Sobre a base imprimada, na meia pista a pavimentar no dia.',
    como: [
      'Varra a superfície imprimada, que ficou exposta ao tráfego de obra.',
      'Dilua a RR-1C 1:1 com água limpa e aplique cerca de 0,9 L/m² da emulsão diluída.',
      'Aguarde a ruptura (mudança de cor de marrom para preto) antes de liberar a vibroacabadora.'
    ],
    chk: ['Taxa de 0,9 ± 0,2 L/m²', 'Emulsão rompida', 'Junta longitudinal pintada no 2º dia']
  },
  S15: {
    onde: 'Usina no canteiro → avenida existente → meia pista em execução (faixa direita no 1º dia, esquerda no 2º).',
    como: [
      'Aqueça o CAP a cerca de 155 °C e os agregados de 10 a 15 °C acima, sem passar de 177 °C.',
      'Carregue os caminhões sob o silo de massa em três montes, cubra com lona e registre o tíquete (massa e temperatura).',
      'Os caminhões chegam pela meia pista liberada, manobram à frente da vibroacabadora e descarregam com a caçamba basculando sobre a caçamba da acabadora.',
      'Espalhe a 5 cm de espessura com a mesa aquecida, conferindo a temperatura da massa (≥ 145 °C) a cada caminhão.',
      'Compacte com o rolo de pneus logo atrás da acabadora e finalize com o rolo tandem, sem parar sobre a massa quente.',
      'No 2º dia, corte e pinte a junta longitudinal fria antes de pavimentar a faixa esquerda.'
    ],
    chk: ['Teor de ligante 5,6 ± 0,3 % a cada 4 h', 'Temperatura em todos os caminhões', 'GC entre 97 e 100 % a cada 100 m', 'Espessura ± 5 %']
  },
  S16: {
    onde: 'Pista concluída, estacas 0+00 a 15+00.',
    como: [
      'Meça as deflexões com a viga Benkelman a cada 20 m, alternando as faixas (15 pontos).',
      'Levante a irregularidade (IRI) por segmento de 200 m e a regularidade com régua de 3 m.',
      'Faça o pêndulo britânico e a mancha de areia no segmento.',
      'Compile o relatório final de controle tecnológico e as-built.'
    ],
    chk: ['IRI ≤ 2,0 m/km', 'VDR ≥ 47', 'Dc ≤ deflexão de projeto do revestimento']
  },
  S17: {
    onde: 'Canteiro, área da usina e jazida.',
    como: [
      'Desmonte a usina e retire os tanques, os resíduos de CAP e o material contaminado para destinação licenciada.',
      'Recomponha o pátio e os taludes com a terra vegetal estocada.',
      'Entregue à OM o as-built, o relatório de ensaios e o Termo de Recebimento Provisório.'
    ],
    chk: ['Passivo ambiental zerado', 'As-built entregue', 'Termo de Recebimento Provisório assinado']
  },
  R1: {
    onde: 'Base, est. 8+10 a 9+10, bordo esquerdo.',
    como: ['Escarifique a base no segmento reprovado.', 'Umedeça até hót ± 1 % e homogeneíze.', 'Recompacte e refaça o ensaio no mesmo ponto.'],
    chk: ['Reensaio GC ≥ 100 %']
  },
  R2: {
    onde: 'Usina e segmento 0+00 a 1+08,6 (BD).',
    como: [
      'Pare a produção e recalibre a bomba de CAP.',
      'Frese o segmento lançado e retire o material.',
      'Reaplique a pintura e retome a pavimentação após o novo ensaio de teor conforme.'
    ],
    chk: ['Novo teor dentro de 5,6 ± 0,3 %', 'Segmento refeito']
  }
};

const CONTEXTO = [
  [
    'Obra militar dentro de área sob administração militar',
    'O canteiro, a usina e a jazida ficam dentro da área sob administração militar. O cronograma é ajustado com o comando da guarnição para não interferir em formaturas, deslocamentos de tropa e no tráfego de viaturas.'
  ],
  [
    'Execução em meia pista',
    'Imprimação, pintura e CBUQ são executados uma faixa por vez. A outra faixa fica livre para as viaturas e é usada pelos próprios caminhões da usina para chegar à vibroacabadora.'
  ],
  [
    'Janela climática',
    'No Rio de Janeiro, maio a setembro é o período mais seco. As especificações proíbem a execução com chuva e com temperatura abaixo de 10 °C, e o cronograma usa essa janela.'
  ],
  [
    'Cadeia de liberação',
    'O laboratório ensaia, o engenheiro residente analisa e a fiscalização assina o Boletim de Liberação de Camada (BLC). Nenhuma camada é coberta sem o BLC da anterior.'
  ],
  [
    'Efetivo',
    'As equipes são formadas por sargentos encarregados, cabos e soldados de engenharia, com operadores e motoristas habilitados para cada equipamento.'
  ],
  [
    'Usina própria',
    'Com a usina no canteiro, a distância de transporte cai para algumas centenas de metros. A massa chega quente e 4 caminhões (3 em ciclo e 1 reserva) mantêm a vibroacabadora sem paradas.'
  ]
];

export {
  setObraQ,
  OBRA,
  GRP,
  SVC_BASE,
  CENARIOS,
  buildSchedule,
  interpKF,
  winKF,
  buildFronts,
  rng,
  gauss,
  NORMAS,
  surfAt,
  OBRA_Q,
  buildTests,
  deflStats,
  MARSHALL,
  GRAN,
  PROCTOR,
  USINA,
  MANUAL,
  CONTEXTO
};
