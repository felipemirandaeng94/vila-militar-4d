// Geração dos ensaios a partir dos blocos declarativos de dados/ensaios.json ("geradores").
//
// Tipos de bloco:
//   lista   - ensaios com resultado fixo (ou sorteado por "valor"), um por item;
//   serie   - pontos ao longo das estacas, com resultado sorteado (média, desvio, limites);
//   frentes - repete os itens em cada frente de serviço (estacas e dias relativos à frente);
//   faixas  - repete os itens em cada meia pista (BD, BE);
//   camadas - repete os itens um número fixo de vezes (subcamadas).
// Os blocos são processados na ordem do arquivo; essa ordem define a numeração (E001...) e a sequência do
// gerador aleatório. Resultados são ilustrativos; critérios e frequências seguem o plano de controle.
import { P } from './geometria.js';
import { lerp, rng, gauss, nf } from './util.js';
import { diaNaEstaca, janela } from './frentes.js';
import { trechosRuins } from './quantitativos.js';
import { surfAt } from './cotas.js';

export function buildTests(cfg, normas, obra, svc, frentes, opt) {
  const T = [];
  const R = rng(cfg.semente);
  const coletas = {};
  const add = t => {
    t.id = 'E' + String(T.length + 1).padStart(3, '0');
    T.push(t);
    return t;
  };

  // ---------- resolução de textos, condições, números, dias e estacas ----------
  const cond = (lista, ctx) =>
    (lista || []).every(c => {
      if (c.startsWith('faixa:')) return ctx.faixa === c.slice(6);
      if (c.startsWith('frente:')) return ctx.frente === +c.slice(7);
      return !!opt[c];
    });
  const texto = (v, ctx) => {
    if (v == null) return v;
    if (typeof v === 'object' && 'se' in v) v = cond(v.se, ctx) ? v.sim : v.nao;
    else if (typeof v === 'object') v = v[ctx.faixa];
    return String(v)
      .replace(/\{k\}/g, ctx.k != null ? ctx.k + 1 : '')
      .replace(/\{faixa\}/g, ctx.faixa || '')
      .replace(/\{frente\}/g, ctx.frente || '')
      .replace(/\{opt\.(\w+)\}/g, (m, k) => opt[k] ?? '');
  };
  const norma = (v, ctx) => texto(v, ctx).replace(/@(\w+)/g, (m, k) => normas[k] || m);
  const ruim = s => (obra.subleito.trechosComSoloRuim || []).find(t => s >= t.de && s <= t.ate);
  // número sorteado; devolve { x, ok } (ok = null quando não há critério numérico)
  const numero = (spec, s) => {
    let x = spec.media,
      ok = null;
    if (spec.desvio) x += gauss(R) * spec.desvio;
    if (spec.uniforme) x += (R() - 0.5) * spec.uniforme;
    if (spec.piso && x < spec.piso[0]) x = spec.piso[0] + R() * spec.piso[1];
    if (spec.min != null) x = Math.max(spec.min, x);
    if (spec.max != null) x = Math.min(spec.max, x);
    if (spec.trechos === 'soloRuim' && s != null && ruim(s)) x = ruim(s).isc;
    if (spec.aprovacao) ok = (spec.aprovacao.minimo == null || x >= spec.aprovacao.minimo) && (spec.aprovacao.maximo == null || x <= spec.aprovacao.maximo);
    return { x, ok };
  };
  const formata = (spec, x) => (spec.formato === 'inteiro' ? String(Math.round(x)) : nf(x, spec.casas ?? 1));
  const jan = (id, ctx, faixa) => {
    const s = svc.find(x => x.id === id);
    if (!s) return null;
    if (s.jan[0].f == null) return s.jan[0];
    return janela(svc, id, ctx.f, faixa === undefined ? (s.jan.some(w => w.faixa) ? ctx.faixa : null) : faixa);
  };
  function dia(spec, ctx, s, base) {
    let d;
    if (spec.fixo != null) d = spec.fixo;
    else if (spec.relativo) d = base;
    else if (spec.camada) d = lerp(ctx.camA, ctx.camB, (ctx.k + (spec.fracao ?? 1)) / ctx.n);
    else if (spec.frente) {
      const w = jan(texto(spec.frente, ctx), ctx, spec.faixa ? texto(spec.faixa, ctx) : undefined);
      if (!w) return spec.senao ? dia(spec.senao, ctx, s, base) : null;
      d = diaNaEstaca(w, s);
    } else {
      const sv = svc.find(x => x.id === spec.servico);
      const fx = spec.faixa ? texto(spec.faixa, ctx) : undefined;
      const w = jan(spec.servico, ctx, fx);
      if (!w) return spec.senao ? dia(spec.senao, ctx, s, base) : null;
      if (spec.em === 'curaInicio') d = w.cura[0];
      else if (spec.em === 'curaFim') d = w.cura[1];
      else if (spec.em === 'falhaOuInicio') d = sv.falha && sv.falha.f === w.f && sv.falha.faixa === w.faixa ? sv.falha.a : w.a;
      else d = spec.em === 'fim' ? w.b : w.a;
    }
    if (spec.mais) d = d + spec.mais;
    if (spec.passo) d = d + ctx.i * spec.passo;
    if (spec.maisPorEstaca) d = d + (ctx.f != null ? (s - ctx.s0) / (ctx.s1 - ctx.s0) : s / P.L) * spec.maisPorEstaca;
    return d;
  }
  function estacas(spec, ctx) {
    if (Array.isArray(spec)) return spec.filter(s => ctx.f == null || (s >= ctx.s0 && s < ctx.s1));
    const L = ctx.f != null ? ctx.s1 - ctx.s0 : P.L,
      s0 = ctx.f != null ? ctx.s0 : 0;
    const out = [];
    if (spec.porFrente && spec.porFrente.minimo != null) {
      const n = Math.max(spec.porFrente.minimo, Math.ceil(L / spec.porFrente.passo - 1e-9));
      for (let i = 0; i < n; i++) out.push(Math.round(s0 + ((i + 0.5) * L) / n));
    } else if (spec.porFrente) {
      for (let s = s0 + spec.porFrente.inicio; s < s0 + L - 1e-9; s += spec.porFrente.passo) out.push(s);
    } else if (spec.global) {
      for (let s = spec.global.inicio; s <= P.L; s += spec.global.passo) if (ctx.f == null || (s >= ctx.s0 && s < ctx.s1)) out.push(s);
    } else if (spec.trecho === 'soloRuim') {
      for (const t of trechosRuins(obra, ctx.f != null ? ctx.s0 : 0, ctx.f != null ? ctx.s1 : P.L))
        for (let s = t.de + spec.passo / 2; s < t.ate; s += spec.passo) out.push(s);
    } else {
      const n = typeof spec.n === 'object' ? spec.n[ctx.faixa] : spec.n;
      for (let i = 0; i < n; i++) out.push(s0 + spec.inicio + i * spec.passo + (spec.porFaixa ? ctx.j * spec.porFaixa : 0));
    }
    return out;
  }
  function afastamento(spec, desloc, ctx, i) {
    if (!Array.isArray(spec)) return spec[ctx.faixa];
    const dz = desloc === 'camada' ? ctx.k : desloc || 0;
    return spec[(i + dz) % spec.length];
  }
  function reensaio(t, r, ctx, s) {
    if (!r || !cond(r.condicao, ctx)) return;
    add({ ...t, nome: t.nome + ' (reensaio)', day: dia(r.dia, ctx, s, t.day), v: r.v, ok: true, ...(r.w ? { w: r.w } : {}), obs: r.obs, re: 1 });
  }

  // ---------- blocos ----------
  function lista(b, ctx) {
    b.itens.forEach((it, i) => {
      const c = { ...ctx, i };
      if (!cond(it.condicao, c)) return;
      const t = { svc: it.servico || ctx.servico, tipo: it.categoria || ctx.categoria };
      const camada = it.camada || ctx.camada;
      if (camada) t.layer = camada;
      t.nome = texto(it.nome, c);
      t.norma = norma(it.norma, c);
      const s =
        it.s != null
          ? ctx.f != null && it.relativoAFrente
            ? ctx.s0 + it.s
            : it.s
          : it.meioDaFrente && ctx.f != null
            ? Math.round((ctx.s0 + ctx.s1) / 2)
            : null;
      if (s != null) {
        t.s = s;
        t.z = it.z ?? 0;
      }
      t.day = dia(it.dia || b.dia, c, s);
      if (t.day == null) return;
      if (it.ate) t.until = dia(it.ate, c, s, t.day);
      let ok = it.ok ?? true;
      if (it.valor) {
        const r = numero(it.valor, s);
        t.v = formata(it.valor, r.x);
        if (r.ok != null) ok = r.ok;
      } else t.v = texto(it.v, c);
      t.u = it.unidade;
      t.crit = it.criterio;
      t.ok = ok;
      if (it.obs) t.obs = texto(it.obs, c);
      if (it.granulometria) t.gran = ctx.j;
      if (ctx.f != null) t.f = ctx.f;
      const fl = it.falha;
      if (fl && cond(fl.condicao, c)) {
        t.v = fl.v;
        t.ok = false;
        t.obs = texto(fl.obs, c);
        add(t);
        reensaio(t, fl.reensaio, c, s);
        return;
      }
      add(t);
    });
  }
  function ensaio(e, ctx, s, z, dBase) {
    const t = { svc: ctx.servico, tipo: ctx.categoria, layer: ctx.camada };
    if (e.grupo) t.grp = e.grupo;
    if (ctx.camadas) t.k = ctx.k;
    t.nome = texto(e.nome, ctx) + (e.camadaCiclo ? `, camada ${(ctx.i % e.camadaCiclo) + 1}` : '');
    t.norma = norma(e.norma, ctx);
    t.s = s + (e.deslocamento || 0);
    t.z = z;
    t.day = dBase + (e.diaMais || 0);
    if (e.ate) t.until = dia(e.ate, ctx, s, t.day);
    let ok = true;
    if (e.valor) {
      const r = numero(e.valor, s);
      t.v = formata(e.valor, r.x);
      if (r.ok != null) ok = r.ok;
      if (e.coletar) (coletas[e.coletar] = coletas[e.coletar] || []).push(Math.round(r.x));
    } else t.v = texto(e.valores[ctx.i], ctx);
    t.u = e.unidade;
    t.crit = e.criterio;
    t.ok = ok;
    if (e.obsPorPonto) t.obs = e.obsPorPonto[ctx.i];
    if (!ok && e.obsReprovado) t.obs = texto(e.obsReprovado, ctx);
    if (e.umidade) t.w = nf(e.umidade.media + gauss(R) * e.umidade.desvio, e.umidade.casas ?? 1);
    for (const x of e.extras || []) t[x.campo] = formata(x, numero(x).x);
    if (ctx.f != null) t.f = ctx.f;
    return t;
  }
  function serie(b, ctx0) {
    const ctx = { ...ctx0, servico: b.servico || ctx0.servico, categoria: b.categoria || ctx0.categoria, camada: b.camada || ctx0.camada };
    const ss = estacas(b.estacas, ctx);
    const unico = b.ensaios ? null : b;
    ss.forEach((s0, i) => {
      const c = { ...ctx, i };
      let s = s0,
        z = afastamento(b.z, b.zDesloc, c, i);
      const falha = (b.falhas || []).find(
        f => f.ponto === i + 1 && (f.frente == null || f.frente === c.frente) && (f.camada == null || f.camada === c.k + 1) && cond(f.condicao, c)
      );
      if (falha && falha.s != null) {
        s = falha.s;
        z = falha.z;
      }
      const d = dia(b.dia, c, s);
      if (d == null) return;
      if (unico) {
        const t = ensaio(unico, c, s, z, d);
        if (falha) {
          t.v = falha.v;
          t.ok = false;
          if (falha.w) t.w = falha.w;
          t.obs = texto(falha.obs, c);
          add(t);
          reensaio(t, falha.reensaio, c, s);
        } else add(t);
      } else for (const e of b.ensaios) add(ensaio(e, c, s, z, d));
    });
  }
  function porFrentes(b, ctx0) {
    for (const fr of frentes) {
      const ctx = { ...ctx0, f: fr.i, frente: fr.i + 1, s0: fr.s0, s1: fr.s1 };
      for (const it of b.itens) bloco(it, ctx);
    }
  }
  function camadas(b, ctx0) {
    const w = jan(b.servico, ctx0);
    if (!w) return;
    for (let k = 0; k < b.camadas; k++) {
      const ctx = { ...ctx0, servico: b.servico, k, n: b.camadas, camadas: true, camA: w.a, camB: w.b };
      for (const it of b.itens) bloco(it, ctx);
    }
  }
  function faixas(b, ctx0) {
    b.faixas.forEach((faixa, j) => {
      for (const it of b.itens) bloco(it, { ...ctx0, faixa, j });
    });
  }
  function bloco(b, ctx) {
    const c = { ...ctx };
    if (b.servico) c.servico = b.servico;
    if (b.categoria) c.categoria = b.categoria;
    if (b.camada) c.camada = b.camada;
    // blocos de um serviço que não existe nesta frente (por exemplo, substituição de solo) são ignorados
    if (c.f != null && b.servico && !svc.some(s => s.id === b.servico && s.jan.some(w => w.f === c.f))) return;
    if (b.condicao && !cond(b.condicao, c)) return;
    if (b.tipo === 'lista') lista(b, c);
    else if (b.tipo === 'serie') serie(b, c);
    else if (b.tipo === 'frentes') porFrentes(b, c);
    else if (b.tipo === 'camadas') camadas(b, c);
    else if (b.tipo === 'faixas') faixas(b, c);
    else throw new Error(`Tipo de bloco de ensaio desconhecido: ${b.tipo}`);
  }

  for (const b of cfg.geradores) bloco(b, {});
  for (const t of T) if (t.s != null) t.y = surfAt(t.layer, t.s, t.z);
  T.sort((a, b) => a.day - b.day);
  return { T, dBase: coletas.dBase || [], dFin: coletas.dFin || [] };
}

// estatística das deflexões (Dc = D̄ + k·S)
export function deflStats(arr) {
  const n = arr.length,
    m = arr.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  const k = n >= 21 ? 1.01 : n >= 15 ? 1.1 : n >= 10 ? 1.21 : 1.55;
  return { n, m, sd, k, dc: m + k * sd };
}
