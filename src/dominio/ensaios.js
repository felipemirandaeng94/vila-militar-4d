// Geração dos ensaios a partir dos blocos declarativos de dados/ensaios.json ("geradores").
//
// Tipos de bloco:
//   lista   - ensaios com resultado fixo (ou sorteado por "valor"), um por item;
//   serie   - pontos ao longo das estacas, com resultado sorteado (média, desvio, limites);
//   camadas - repete os itens para cada camada (do corpo do aterro ou um número fixo de subcamadas);
//   faixas  - repete os itens para cada meia pista (BD, BE).
// Os blocos são processados na ordem do arquivo; essa ordem define a numeração (E001...) e a sequência do
// gerador aleatório, por isso inserir um bloco no meio muda os valores sorteados dos blocos seguintes.
// Resultados são ilustrativos; os critérios e frequências seguem as especificações citadas em cada ensaio.
import { P } from './geometria.js';
import { lerp, rng, gauss, nf } from './util.js';
import { diaNaEstaca } from './frentes.js';
import { extensoesDasCamadas } from './quantitativos.js';
import { surfAt } from './cotas.js';

export function buildTests(cfg, normas, svc, q, opt, F) {
  const T = [];
  const R = rng(cfg.semente);
  const coletas = {};
  const lifts = extensoesDasCamadas(q);
  const get = id => {
    const s = svc.find(x => x.id === id);
    if (!s) throw new Error(`Ensaio referencia o serviço ${id}, que não existe no cronograma.`);
    return s;
  };
  const add = t => {
    t.id = 'E' + String(T.length + 1).padStart(3, '0');
    T.push(t);
    return t;
  };

  // ---------- resolução de textos, condições, números e dias ----------
  const cond = (lista, ctx) => (lista || []).every(c => (c.startsWith('faixa:') ? ctx.faixa === c.slice(6) : !!opt[c]));
  const texto = (v, ctx) => {
    if (v == null) return v;
    if (typeof v === 'object' && 'se' in v) v = cond(v.se, ctx) ? v.sim : v.nao;
    else if (typeof v === 'object') v = v[ctx.faixa];
    return String(v)
      .replace(/\{k\}/g, ctx.k != null ? ctx.k + 1 : '')
      .replace(/\{faixa\}/g, ctx.faixa || '');
  };
  const norma = (v, ctx) => texto(v, ctx).replace(/@(\w+)/g, (m, k) => normas[k] || m);
  const numero = spec => {
    let x = spec.media;
    if (spec.desvio) x += gauss(R) * spec.desvio;
    if (spec.uniforme) x += (R() - 0.5) * spec.uniforme;
    if (spec.piso && x < spec.piso[0]) x = spec.piso[0] + R() * spec.piso[1];
    if (spec.min != null) x = Math.max(spec.min, x);
    if (spec.max != null) x = Math.min(spec.max, x);
    return x;
  };
  const formata = (spec, x) => (spec.formato === 'inteiro' ? String(Math.round(x)) : nf(x, spec.casas ?? 1));
  function dia(spec, ctx, s, base) {
    let d;
    if (spec.fixo != null) d = spec.fixo;
    else if (spec.relativo) d = base;
    else if (spec.camada) {
      if (spec.ultima && ctx.k === ctx.n - 1) return dia(spec.ultima, ctx, s, base);
      const w = get(ctx.servico).win[0];
      d = lerp(w[0], w[1], (ctx.k + (spec.fracao ?? 1)) / ctx.n);
    } else if (spec.frente) {
      let kf = F[texto(spec.frente, ctx)];
      if (spec.ultimoTrecho) kf = kf.slice(-2);
      d = diaNaEstaca(kf, s);
    } else {
      const sv = get(spec.servico);
      const fx = spec.faixa ? texto(spec.faixa, ctx) : null;
      if (spec.em === 'curaInicio') d = sv.cura[0];
      else if (spec.em === 'falhaOuInicio') d = sv.falha ? sv.falha.a : sv.lanes[fx][0];
      else {
        const w = fx ? sv.lanes[fx] : sv.win[0];
        d = spec.em === 'fim' ? w[1] : w[0];
      }
    }
    if (spec.mais) d = d + spec.mais;
    if (spec.passo) d = d + ctx.i * spec.passo;
    if (spec.maisPorEstaca) d = d + (s / P.L) * spec.maisPorEstaca;
    return d;
  }
  function estacas(spec, ctx) {
    if (Array.isArray(spec)) return spec;
    const n = typeof spec.n === 'object' ? spec.n[ctx.faixa] : spec.n;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (spec.distribuir === 'camadaDoCorpo') {
        const [a, b] = lifts[ctx.k];
        out.push(Math.round(lerp(a, b, (i + 0.5) / n)));
      } else if (spec.distribuir === 'aterro') out.push(Math.round(lerp(q.sFill0 + spec.margem, q.sFill1 - spec.margem, (i + 0.5) / n)));
      else out.push(spec.inicio + i * spec.passo + (spec.porFaixa ? ctx.j * spec.porFaixa : 0));
    }
    return out;
  }
  function afastamento(spec, desloc, ctx, i) {
    if (!Array.isArray(spec)) return spec[ctx.faixa];
    const dz = desloc === 'camada' ? ctx.k : desloc || 0;
    return spec[(i + dz) % spec.length];
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
      if (it.s != null) {
        t.s = it.s;
        t.z = it.z;
      }
      t.day = dia(it.dia || b.dia, c, it.s);
      if (it.ate) t.until = dia(it.ate, c, it.s, t.day);
      t.v = it.valor ? formata(it.valor, numero(it.valor)) : texto(it.v, c);
      t.u = it.unidade;
      t.crit = it.criterio;
      t.ok = it.ok ?? true;
      if (it.obs) t.obs = texto(it.obs, c);
      if (it.granulometria) t.gran = ctx.j;
      add(t);
    });
  }
  function ensaio(e, ctx, s, z, dBase) {
    const t = { svc: ctx.servico, tipo: ctx.categoria, layer: ctx.camada };
    if (e.grupo) t.grp = e.grupo;
    if (ctx.camadas) t.k = ctx.k;
    t.nome = texto(e.nome, ctx);
    t.norma = norma(e.norma, ctx);
    t.s = s + (e.deslocamento || 0);
    t.z = z;
    t.day = dBase + (e.diaMais || 0);
    if (e.ate) t.until = dia(e.ate, ctx, s, t.day);
    if (e.valor) {
      const x = numero(e.valor);
      t.v = formata(e.valor, x);
      if (e.coletar) (coletas[e.coletar] = coletas[e.coletar] || []).push(Math.round(x));
    } else t.v = texto(e.valores[ctx.i], ctx);
    t.u = e.unidade;
    t.crit = e.criterio;
    t.ok = true;
    if (e.obsPorPonto) t.obs = e.obsPorPonto[ctx.i];
    if (e.umidade) t.w = nf(e.umidade.media + gauss(R) * e.umidade.desvio, e.umidade.casas ?? 1);
    for (const x of e.extras || []) t[x.campo] = formata(x, numero(x));
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
      const falha = (b.falhas || []).find(f => f.ponto === i + 1 && (f.camada == null || f.camada === c.k + 1) && cond(f.condicao, c));
      if (falha && falha.s != null) {
        s = falha.s;
        z = falha.z;
      }
      const d = dia(b.dia, c, s);
      if (unico) {
        const t = ensaio(unico, c, s, z, d);
        if (falha) {
          t.v = falha.v;
          t.ok = false;
          t.w = falha.w;
          t.obs = texto(falha.obs, c);
          add(t);
          const r = falha.reensaio;
          if (r && cond(r.condicao, c)) add({ ...t, nome: t.nome + ' (reensaio)', day: dia(r.dia, c, s, t.day), v: r.v, ok: true, w: r.w, obs: r.obs, re: 1 });
        } else add(t);
      } else for (const e of b.ensaios) add(ensaio(e, c, s, z, d));
    });
  }
  function camadas(b, ctx0) {
    const porCorpo = b.camadas === 'corpoDoAterro';
    const n = porCorpo ? q.nLifts : b.camadas;
    for (let k = 0; k < n; k++) {
      if (porCorpo && !lifts[k]) continue;
      const ctx = { ...ctx0, servico: b.servico, k, n, camadas: true };
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
    if (b.tipo === 'lista') lista(b, c);
    else if (b.tipo === 'serie') serie(b, c);
    else if (b.tipo === 'camadas') camadas(b, c);
    else if (b.tipo === 'faixas') faixas(b, c);
    else throw new Error(`Tipo de bloco de ensaio desconhecido: ${b.tipo}`);
  }

  for (const b of cfg.geradores) bloco(b, {});
  for (const t of T) if (t.s != null) t.y = surfAt(q, t.layer, t.s, t.z, t.k || 0);
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
