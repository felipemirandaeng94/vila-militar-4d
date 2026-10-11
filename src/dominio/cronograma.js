// Cronograma da reconstrução por frentes de serviço.
//
// Serviços globais têm janelas fixas em dados/servicos.json. Serviços por frente são programados frente a frente:
//   duração = quantidade da frente ÷ produtividade (arredondada para cima em décimos de dia) ou duração fixa;
//   início = maior entre as dependências (término→início, início→início com defasagem, passagem pelo trecho de solo mole),
//            a disponibilidade da equipe do serviço e a abertura da frente (limite de frentes abertas ao mesmo tempo);
//   fim    = início + duração, estendido pelas dependências término→término.
// Serviços com "faixas" são executados em meia pista (BD e depois BE), metade da quantidade em cada faixa.
// Os retrabalhos ativados pelas opções (cenário ou missão) inserem serviços, acrescentam duração ou marcam a falha do CBUQ.
import { P } from './geometria.js';
import { dividirFrentes, diaNaEstaca } from './frentes.js';
import { trechosRuins } from './quantitativos.js';

const r6 = v => Math.round(v * 1e6) / 1e6;
export const arredondar = (x, passo) => r6(Math.ceil(x / passo - 1e-9) * passo);

// serviço no formato interno usado pelo motor e pela interface
export function servicoInterno(def) {
  const o = { id: def.id, g: def.grupo };
  if (def.retrabalho) o.rework = 1;
  o.nome = def.nome;
  o.norma = def.norma;
  o.efetivo = def.efetivo;
  o.eq = def.equipamentos.map(e => [e.nome, e.qtd]);
  o.qtd = typeof def.quantidade === 'string' ? def.quantidade : '';
  o.lib = def.liberacao;
  o.jan = [];
  Object.defineProperty(o, 'meta', {
    value: {
      curto: def.curto,
      representacao: def.representacao,
      diario: def.diario,
      escopo: def.escopo || 'frente',
      quantidade: def.quantidade,
      produtividade: def.produtividade
    },
    enumerable: false
  });
  return o;
}

// duração de um serviço numa frente (ou numa faixa)
export function duracao(def, qf, passo, faixa) {
  if (def.duracaoFixa != null) return def.duracaoFixa;
  const q = qf[def.quantidade.chave] / (faixa ? 2 : 1);
  return arredondar(q / def.produtividade.valor, passo);
}

export function buildSchedule(dados, quant, opt = {}) {
  const S = dados.servicos;
  const frentes = dividirFrentes(P.L, S.frentes.tamanho).map(f => ({ ...f }));
  const passo = S.produtividades.arredondamento;
  const defs = S.servicos;
  const defPorId = Object.fromEntries(defs.map(d => [d.id, d]));
  const ent = new Map();
  const entry = def => {
    if (!ent.has(def.id)) ent.set(def.id, servicoInterno(def));
    return ent.get(def.id);
  };
  defs.forEach(entry);
  const rws = (S.retrabalhos || []).filter(r => opt[r.opcao]);
  for (const r of rws) entry({ ...r.servico, escopo: 'frente' });

  // serviços globais com janelas fixas
  for (const def of defs.filter(d => d.escopo === 'global')) for (const w of def.janelas) entry(def).jan.push({ a: w[0], b: w[1], f: null });
  const fimGlobal = id => Math.max(...ent.get(id).jan.map(w => w.b));
  const inicioFrentes = Math.max(0, ...(S.frentes.inicioApos || []).map(fimGlobal));

  const livres = {};
  const equipe = (nome, n) => livres[nome] || (livres[nome] = new Array(n).fill(0));
  const maxAbertas = S.frentes.abertasAoMesmoTempo || Infinity;
  const libs = [];
  const historico = [];

  for (const fr of frentes) {
    const qf = quant.frentes[fr.i];
    const ultima = fr.i === frentes.length - 1;
    const aplicavel = d => !d.somente || (d.somente === 'ultimaFrente' && ultima) || (d.somente === 'soloRuim' && qf.extSoloRuim > 0);
    // sequência da frente (ordem do arquivo) com os retrabalhos desta frente
    const seq = defs.filter(d => d.escopo === 'frente' && aplicavel(d)).map(d => ({ def: d, extra: [], acrescimo: 0 }));
    const idx = id => seq.findIndex(x => x.def.id === id);
    for (const r of rws.filter(r => r.frente === fr.i + 1)) {
      const sv = { ...r.servico, escopo: 'frente' };
      if (r.inserirApos && idx(r.inserirApos) >= 0) {
        seq.splice(idx(r.inserirApos) + 1, 0, { def: { ...sv, depende: [{ de: r.inserirApos }] }, extra: [], acrescimo: 0 });
        for (const b of r.bloqueia || []) if (idx(b) >= 0) seq[idx(b)].extra.push({ de: sv.id });
      }
      if (r.inserirAntes && idx(r.inserirAntes) >= 0) {
        const alvo = seq[idx(r.inserirAntes)];
        seq.splice(idx(r.inserirAntes), 0, { def: { ...sv, depende: alvo.def.depende || [] }, extra: [], acrescimo: 0 });
        seq[idx(r.inserirAntes)].extra.push({ de: sv.id });
      }
      if (r.acrescentar && idx(r.acrescentar.servico) >= 0) {
        seq[idx(r.acrescentar.servico)].acrescimo += r.acrescentar.dias;
        seq.splice(idx(r.acrescentar.servico) + 1, 0, { def: { ...sv, depende: [sv.inicio] }, extra: [], acrescimo: 0 });
      }
      if (r.falhaAntesDe && idx(r.falhaAntesDe) >= 0) seq[idx(r.falhaAntesDe)].falha = r;
    }
    const existe = id => idx(id) >= 0;
    const feitos = {};
    const cura = {};
    const lanesDe = id => Object.keys(feitos).filter(k => k.split('|')[0] === id);
    const completo = id => lanesDe(id).length === (seq[idx(id)].def.faixas ? 2 : 1);
    const fimDe = (id, em) => (em === 'fimDaCura' ? cura[id] : Math.max(...lanesDe(id).map(k => feitos[k].b)));
    const iniDe = id => Math.min(...lanesDe(id).map(k => feitos[k].a));
    const abertura = Math.max(inicioFrentes, fr.i >= maxAbertas ? libs[fr.i - maxAbertas] : 0);
    const pend = [];
    for (const e of seq) for (const faixa of e.def.faixas ? ['BD', 'BE'] : [null]) pend.push({ e, faixa });

    while (pend.length) {
      let k = 0;
      let plano = null;
      for (; k < pend.length; k++) {
        plano = tentar(pend[k]);
        if (plano) break;
      }
      if (!plano)
        throw new Error(`Cronograma: dependência impossível na frente ${fr.nome} (${pend.map(p => p.e.def.id + (p.faixa ? ' ' + p.faixa : '')).join(', ')}).`);
      programar(pend[k], plano);
      pend.splice(k, 1);
    }

    // verifica as dependências de um item e devolve o início mínimo e os fins mínimos (término→término)
    function tentar(it) {
      const def = it.e.def;
      let t = abertura;
      const tts = [];
      for (const dp of [...(def.depende || []), ...it.e.extra]) {
        if (!dp || !existe(dp.de)) continue;
        const tipo = dp.tipo || 'TI',
          lag = dp.defasagem || 0;
        if (tipo === 'II') {
          if (!lanesDe(dp.de).length) return null;
          t = Math.max(t, iniDe(dp.de) + lag);
          continue;
        }
        if (!completo(dp.de)) return null;
        if (tipo === 'TI') t = Math.max(t, fimDe(dp.de, dp.em) + lag);
        else if (tipo === 'TT') tts.push(fimDe(dp.de) + lag);
        else if (tipo === 'passagem') {
          const w = feitos[lanesDe(dp.de)[0]];
          const ruins = trechosRuins(dados.obra, fr.s0, fr.s1);
          const sFim = Math.max(...ruins.map(r => r.ate));
          t = Math.max(t, diaNaEstaca(w, sFim) + lag);
        }
      }
      for (const dp of (def.dependeFaixa || {})[it.faixa] || []) {
        const w = feitos[dp.de + '|' + dp.faixa];
        if (!w) return null;
        t = Math.max(t, w.b);
      }
      if (it.faixa === 'BE') {
        const w = feitos[def.id + '|BD'];
        if (!w) return null;
        t = Math.max(t, w.b);
      }
      for (const g of def.aposGlobal || []) t = Math.max(t, fimGlobal(g));
      // dependência da frente anterior (por exemplo, abrir a frente perto do fim da drenagem da anterior)
      const ant = historico[fr.i - 1];
      if (ant)
        for (const dp of def.dependeFrenteAnterior || []) {
          const ws = Object.keys(ant)
            .filter(k => k.split('|')[0] === dp.de)
            .map(k => ant[k]);
          if (ws.length) t = Math.max(t, Math.max(...ws.map(w => w.b)) + (dp.defasagem || 0));
        }
      return { t, tts };
    }

    function programar(it, { t, tts }) {
      const def = it.e.def;
      const dur = r6(duracao(def, qf, passo, it.faixa) + it.e.acrescimo);
      const nomeEq = def.equipe === null ? null : def.equipe || def.id;
      const nEq = nomeEq ? (defPorId[nomeEq] || def).equipes || 1 : 0;
      let ini = t,
        j = -1,
        arr = null;
      if (nomeEq) {
        arr = equipe(nomeEq, nEq);
        j = arr.indexOf(Math.min(...arr));
        ini = Math.max(t, arr[j]);
      }
      // falha do CBUQ (rwCbuq): trecho lançado, parada da usina, fresagem do trecho e novo lançamento
      const r = it.e.falha;
      if (r && it.faixa === (r.faixa || it.faixa)) {
        const fa = ini,
          fb = r6(fa + r.falha.duracao);
        entry(def).falha = {
          a: fa,
          b: fb,
          s0: fr.s0,
          s: fr.s0 + r.falha.extensao,
          rem: [r6(fa + r.falha.remocao[0]), r6(fa + r.falha.remocao[1])],
          f: fr.i,
          faixa: it.faixa
        };
        const dr = r.servico.duracaoFixa;
        entry(r.servico).jan.push({ a: fb, b: r6(fb + dr), f: fr.i, faixa: it.faixa, s0: fr.s0, s1: fr.s0 + r.falha.extensao });
        ini = r6(fb + dr);
      }
      let fim = r6(ini + dur);
      for (const x of tts) fim = Math.max(fim, r6(x));
      if (arr) arr[j] = fim;
      const loc = def.local;
      const w = { a: r6(ini), b: fim, f: fr.i, s0: loc ? loc.de : fr.s0, s1: loc ? loc.ate : fr.s1 };
      if (it.faixa) w.faixa = it.faixa;
      if (def.cura && it.faixa !== 'BD') {
        w.cura = [fim, r6(fim + def.cura)];
        cura[def.id] = w.cura[1];
      }
      entry(def).jan.push(w);
      feitos[def.id + '|' + (it.faixa || '')] = w;
    }

    fr.lib = Math.max(...Object.values(feitos).map(w => w.b));
    libs.push(fr.lib);
    historico.push(feitos);
    const inicioDe = (id, em) => {
      const ks = lanesDe(id);
      if (!ks.length) return null;
      return em === 'fim' ? fimDe(id) : iniDe(id);
    };
    fr.desvio = S.frentes.desvio.sequencia
      .map(m => ({ estado: m.estado, d: m.desde.liberacao ? fr.lib : inicioDe(m.desde.servico, m.desde.em) }))
      .filter(m => m.d != null);
  }

  // serviço final (desmobilização) depois da liberação de todas as frentes
  const fimFrentes = Math.max(...libs);
  for (const def of defs.filter(d => d.escopo === 'final')) entry(def).jan.push({ a: fimFrentes, b: r6(fimFrentes + def.duracaoFixa), f: null });

  // ordem de exibição: a do arquivo, com cada retrabalho junto do serviço que ele afeta
  const ordem = defs.map(d => d.id);
  for (const r of rws) {
    const ref = r.inserirApos || r.inserirAntes || (r.acrescentar && r.acrescentar.servico) || r.falhaAntesDe;
    const k = ordem.indexOf(ref);
    ordem.splice(r.inserirAntes ? k : k + 1, 0, r.servico.id);
  }
  const svc = ordem.map(id => ent.get(id)).filter(s => s && s.jan.length);
  for (const s of svc) {
    s.jan.sort((x, y) => (x.f ?? -1) - (y.f ?? -1) || x.a - y.a);
    s.a = Math.min(...s.jan.map(w => w.a));
    s.b = Math.max(...s.jan.map(w => (w.cura ? w.cura[1] : w.b)));
  }
  return { svc, frentes };
}

export const fimDaObra = svc => Math.max(...svc.map(s => s.b));
export const servicoPorId = (svc, id) => svc.find(s => s.id === id);

// serviço em execução no dia d (primeira janela ativa)
export function activeSvc(svc, id, d) {
  const s = svc.find(x => x.id === id);
  if (!s) return null;
  const w = s.jan.find(w => d >= w.a && d < w.b);
  return w ? { s, w, lane: w.faixa, f: w.f } : null;
}
// todas as janelas ativas de um serviço no dia d
export function ativasDoServico(svc, id, d) {
  const s = svc.find(x => x.id === id);
  return s ? s.jan.filter(w => d >= w.a && d < w.b) : [];
}

// serviços ativos (ou em cura) no dia d, com o progresso de cada janela
export function activeList(svc, d) {
  const out = [];
  for (const s of svc) {
    for (const w of s.jan) {
      if (d >= w.a && d < w.b) out.push({ s, w, p: (d - w.a) / (w.b - w.a), lane: w.faixa, f: w.f });
      else if (w.cura && d >= w.cura[0] && d < w.cura[1]) out.push({ s, w, p: (d - w.cura[0]) / (w.cura[1] - w.cura[0]), cura: 1, f: w.f });
    }
    if (s.falha && d >= s.falha.a && d < s.falha.b)
      out.push({ s, w: { a: s.falha.a, b: s.falha.b }, p: (d - s.falha.a) / (s.falha.b - s.falha.a), lane: s.falha.faixa, f: s.falha.f });
  }
  return out;
}

// inícios de todas as janelas (para saltar de serviço em serviço)
export function svcStarts(svc) {
  const xs = [];
  for (const s of svc) s.jan.forEach(w => xs.push(w.a));
  return [...new Set(xs)].sort((a, b) => a - b);
}

// progresso (0 a 1) da janela total de um serviço global
export function winProg(svc, id, d) {
  const v = svc.find(x => x.id === id);
  if (!v) return 1;
  return Math.min(1, Math.max(0, (d - v.a) / (v.b - v.a)));
}

// quantidade de cada serviço numa janela (para o diário)
export function quantidadeDaJanela(s, w, quant) {
  const di = s.meta && s.meta.diario;
  if (!di) return null;
  if (di.valor != null) return di.valor;
  const fonte = w.f != null ? quant.frentes[w.f] : quant.total;
  const v = fonte[di.quantitativo];
  return w.faixa ? v / 2 : v;
}
