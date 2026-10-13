// Missão do engenheiro residente: cada decisão aparece no instante em que acontece na obra; algumas escolhas
// geram consequências mais adiante e outras ativam retrabalhos no cronograma.
import { M, ST, D, acoes } from '../estado.js';
import { P } from '../dominio/geometria.js';
import { nf } from '../dominio/util.js';
import { fmtDate, fmtHour } from '../dominio/calendario.js';
import { metricas, diaDaDecisao } from '../dominio/missao.js';
import { buildSchedule, fimDaObra } from '../dominio/cronograma.js';
import { $, esc, svcById, curto, lsGet, lsSet, lsDel, dataHora } from '../interface/dom.js';
import { renderTab, openTab } from '../interface/abas.js';
import { camAt } from '../motor/index.js';
import { DECISOES } from './decisoes.js';
import { serializarPartida, validarPartida, registrarNota, historicoValido, lerJson } from './progresso.js';

// chaves do localStorage: partida em andamento, histórico de notas e melhor nota
const CHAVE_PARTIDA = 'vm4d.missao';
const CHAVE_HISTORICO = 'vm4d.historico';

export const GAME = {
  started: false,
  finished: false,
  done: {}, // decisões tomadas: { id: { i, op, day } }
  ordem: [], // ids das decisões na ordem em que foram tomadas (salvamento)
  events: [], // consequências agendadas ou já vistas
  // opções de cronograma: falhas sempre ativas na missão e retrabalhos decididos pelo jogador
  opt() {
    const o = { ...D.decisoes.opcoesBase };
    for (const k in this.done) Object.assign(o, this.done[k].op.opt || {});
    return o;
  },
  // próxima parada: decisão pendente ou consequência pendente
  queue() {
    const out = [];
    for (const dc of DECISOES)
      if (!this.done[dc.id]) {
        const d = dc.day();
        if (d != null) out.push({ k: 'dec', d, dc });
      }
    for (const ev of this.events) if (!ev.seen) out.push({ k: 'ev', d: diaDoEvento(ev), ev });
    return out.sort((a, b) => a.d - b.d);
  },
  nextStop() {
    const q = this.queue();
    return q.length ? q[0] : null;
  },
  metrics() {
    // atraso causado pelos retrabalhos decididos (não reduz a nota): fim com e sem esses retrabalhos
    const semRw = { ...M.opt };
    for (const k of D.decisoes.pontuacao.retrabalhosSemPenalidade) delete semRw[k];
    const fimSemRw = fimDaObra(buildSchedule(D, M.q, semRw).svc);
    return metricas({
      escolhas: Object.values(this.done).map(x => x.op),
      eventos: this.events.filter(ev => ev.seen),
      fim: M.fim,
      prazo: D.obra.calendario.prazoContratualDias,
      atrasoSemPenalidade: M.fim - fimSemRw,
      pontuacao: D.decisoes.pontuacao
    });
  }
};

// dia da consequência: número fixo ou regra relativa ao cronograma atual
function diaDoEvento(ev) {
  if (typeof ev.regra === 'number') return ev.regra;
  const d = diaDaDecisao(ev.regra, M.svc, M.ensaios);
  return d == null ? M.fim - 0.5 : d;
}

export const missaoAtiva = () => ST.modo === 'missao';
// opções de cronograma em vigor: as da missão ou as do cenário escolhido
export const opcoesEmVigor = () => (missaoAtiva() ? GAME.opt() : D.servicos.cenarios[ST.cen].opcoes);
const BEST = () => D.decisoes.avaliacoes;

export const fx = (v, u, inv) => {
  if (!v) return '';
  const good = inv ? v > 0 : v < 0;
  return `<span class="fx ${good ? 'g' : 'b'}">${v > 0 ? '+' : '−'}${nf(Math.abs(v), Number.isInteger(v) ? 0 : 1)} ${u}</span>`;
};
export const fxAll = o =>
  [fx(o.d, 'dia' + (Math.abs(o.d) > 1 ? 's' : '')), fx(o.c, 'mil R$'), fx(o.q, 'qualidade', 1), fx(o.n, 'conformidade', 1)].join('') ||
  '<span class="fx g">sem impacto</span>';

// semBriefing: entrar na missão sem a tela de abertura (ao continuar a partida salva)
export function setMode(m, semBriefing) {
  ST.modo = m;
  const on = missaoAtiva();
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  document.body.classList.toggle('mission', on);
  $('optCen').disabled = on;
  $('cenDesc').textContent = on
    ? 'Na missão, as não conformidades aparecem como decisões, e o retrabalho só acontece se você decidir por ele.'
    : D.servicos.cenarios[ST.cen].descricao;
  $('hud').hidden = !on;
  if (on) {
    if (!GAME.started && !semBriefing) briefing();
  } else {
    fecharModal();
    acoes.reconstruir();
  }
  if (ST.tab === 'missao') renderTab();
}
export function resetGame() {
  GAME.done = {};
  GAME.ordem = [];
  GAME.events = [];
  GAME.started = false;
}

// ---------- salvamento ----------
/** Guarda a partida em andamento no navegador (depois de cada decisão, consequência e ao sair da página). */
export function salvarPartida() {
  if (!GAME.started || GAME.finished) return;
  lsSet(CHAVE_PARTIDA, JSON.stringify(serializarPartida({ ordem: GAME.ordem, done: GAME.done, eventos: GAME.events, dia: ST.day })));
}
/** Partida salva que ainda vale para as decisões atuais, ou null. */
export function partidaSalva() {
  const s = validarPartida(lerJson(lsGet(CHAVE_PARTIDA), null), DECISOES);
  return s && s.ordem.length < DECISOES.length ? s : null;
}
const apagarPartida = () => lsDel(CHAVE_PARTIDA);
/** Histórico de notas deste navegador, mais recente primeiro. */
export const historicoDeNotas = () => historicoValido(lerJson(lsGet(CHAVE_HISTORICO), []));
export function limparHistorico() {
  lsDel(CHAVE_HISTORICO);
  lsDel('vm4d.best');
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => salvarPartida());

// consequência agendada pela alternativa escolhida
function agendarConsequencia(dc, op, seen = false) {
  const ev = Object.assign({ from: dc.titulo + ' (decisão ' + (DECISOES.indexOf(dc) + 1) + ')', seen }, op.later);
  Object.defineProperty(ev, 'day', { get: () => diaDoEvento(ev), enumerable: true });
  GAME.events.push(ev);
}

/** Retoma a partida salva: refaz as escolhas e as consequências e volta ao dia em que parou. */
export function continuarMissao(s = partidaSalva()) {
  if (!s) return briefing();
  if (!missaoAtiva()) setMode('missao', true);
  resetGame();
  let k = 0;
  for (const id of s.ordem) {
    const dc = DECISOES.find(x => x.id === id),
      i = s.escolhas[id].i,
      op = dc.ops[i];
    GAME.done[id] = { i, op, day: s.escolhas[id].dia };
    GAME.ordem.push(id);
    if (op.later) agendarConsequencia(dc, op, s.vistos[k++]);
  }
  GAME.started = true;
  GAME.finished = false;
  acoes.reconstruir();
  ST.day = Math.min(M.fim, Math.max(s.dia, ...s.ordem.map(id => s.escolhas[id].dia)));
  ST.speed = 2;
  acoes.sincronizarVelocidade();
  fecharModal();
  updateHud();
  acoes.atualizar(true);
  acoes.tocar(true);
  if (ST.tab === 'missao') renderTab();
}
export const iniciarMissao = () => setMode('missao');
export function recomecarMissao() {
  apagarPartida();
  resetGame();
  GAME.finished = false;
  if (!missaoAtiva()) setMode('missao');
  else briefing();
}

const plural = (n, um, varios) => (Math.abs(n - 1) < 0.05 ? um : varios);

// tabela do histórico de notas (data, nota, conceito, melhores decisões, prazo e custo)
export function tabelaHistorico(hist, max = hist.length) {
  const linha = h =>
    `<tr><td class="m">${esc(dataHora(h.data))}</td><td class="n"><b>${nf(h.nota, 1)}</b></td><td>${esc(h.conceito || '')}</td>` +
    `<td class="n">${Number.isFinite(h.melhores) ? `${h.melhores} de ${h.total}` : '—'}</td>` +
    `<td class="n">${Number.isFinite(h.atraso) ? (h.atraso > 0.01 ? '+' + nf(h.atraso, 1) + ' d' : 'no prazo') : '—'}</td>` +
    `<td class="n">${Number.isFinite(h.custo) ? 'R$ ' + nf(h.custo, 1) + ' mil' : '—'}</td></tr>`;
  return `<div class="tbl"><table class="hist"><caption class="sr">Histórico de notas da missão neste navegador</caption><thead><tr><th scope="col">Data</th><th scope="col" class="n">Nota</th><th scope="col">Conceito</th><th scope="col" class="n">Melhores decisões</th><th scope="col" class="n">Atraso</th><th scope="col" class="n">Custo adicional</th></tr></thead><tbody>${hist
    .slice(0, max)
    .map(linha)
    .join('')}</tbody></table></div>`;
}

export function briefing() {
  const best = lsGet('vm4d.best');
  const prazo = D.obra.calendario.prazoContratualDias;
  const salvo = partidaSalva();
  const hist = historicoDeNotas();
  gm(`<p class="gm-eye">Missão · engenheiro residente</p><h3 id="gmTit">${esc(D.obra.obra.titulo)}</h3>
  <p>Você é o engenheiro residente da obra. Tem <b>${prazo} dias úteis</b> para reconstruir ${nf(P.L, 0)} m da via existente em ${M.frentes.length} frentes, com a demolição, a drenagem nova, o pavimento em CBUQ, a usina no início do trecho e todo o controle tecnológico, sem fechar a Vila Militar ao tráfego.</p>
  <p>Ao longo da obra aparecem <b>${DECISOES.length} decisões</b>, no momento em que acontecem: ensaios reprovados na jazida, no subleito, na base e no CBUQ, chuva com vala aberta e durante o lançamento, redes não cadastradas, tubos trincados, massa fria, falta de caminhões, o uso do fresado, pressão do comando e propostas de atalho. Cada escolha muda o prazo, o custo, a qualidade e a conformidade com as normas. Algumas consequências só aparecem semanas depois.</p>
  <ul class="gm-rules"><li>A linha do tempo não avança além da próxima decisão.</li><li>Decisões com retrabalho aparecem no modelo 3D e no cronograma.</li><li>O progresso fica salvo neste navegador depois de cada decisão.</li><li>No fim, você recebe a nota e o conceito da missão. Ensaios, custos e prazos são ilustrativos.</li></ul>
  ${salvo ? `<p class="gm-salvo">Há uma missão salva: <b>${salvo.ordem.length} de ${DECISOES.length} decisões</b> tomadas, parada em ${fmtDate(salvo.dia)}${salvo.salvoEm ? ` (salva em ${esc(dataHora(salvo.salvoEm))})` : ''}.</p>` : ''}
  ${best ? `<p class="gm-best">Sua melhor nota neste navegador: <b>${esc(best)}</b></p>` : ''}
  ${hist.length ? `<details class="gm-hist"><summary>Notas anteriores (${hist.length})</summary>${tabelaHistorico(hist, 5)}</details>` : ''}
  <div class="gm-act">${salvo ? '<button class="btn" id="gmCont">Continuar a missão</button><button class="btn ghost" id="gmGo">Começar do início</button>' : '<button class="btn" id="gmGo">Iniciar missão</button>'}<button class="btn ghost" id="gmBack" data-esc>Voltar a explorar</button></div>`);
  $('gmGo').onclick = () => {
    apagarPartida();
    resetGame();
    GAME.started = true;
    GAME.finished = false;
    acoes.reconstruir();
    ST.day = 0;
    ST.speed = 2;
    acoes.sincronizarVelocidade();
    fecharModal();
    salvarPartida();
    acoes.tocar(true);
    camAt(30, -20, -80, 70, 120);
  };
  if (salvo) $('gmCont').onclick = () => continuarMissao(salvo);
  $('gmBack').onclick = () => setMode('explorar');
}

// ---------- janela da missão (abertura, decisão, retorno, consequência e fim) ----------
// Acessível pelo teclado: o foco fica preso na janela, as setas percorrem as alternativas, as teclas A a D escolhem
// e Esc aciona o botão marcado com data-esc (quando houver). Ao fechar, o foco volta para onde estava.
let focoAnterior = null;
function gm(html) {
  const caixa = $('gmc');
  if ($('gm').hidden) focoAnterior = document.activeElement;
  caixa.innerHTML = html;
  $('gm').hidden = false;
  caixa.scrollTop = 0;
  const b = caixa.querySelector('.gm-op, button');
  if (b) b.focus({ preventScroll: true });
}
export function fecharModal() {
  if ($('gm').hidden) return;
  $('gm').hidden = true;
  const f = focoAnterior;
  focoAnterior = null;
  if (f && f.isConnected && f !== document.body && !$('gm').contains(f)) f.focus({ preventScroll: true });
  else $('play').focus({ preventScroll: true });
}

function teclaNoModal(e) {
  const caixa = $('gmc');
  const focaveis = [...caixa.querySelectorAll('button, summary, a[href], input, select, textarea')].filter(b => !b.disabled && b.offsetParent);
  if (!focaveis.length) return;
  if (e.key === 'Tab') {
    // foco preso na janela
    e.preventDefault();
    const n = focaveis.length,
      i = focaveis.indexOf(document.activeElement);
    focaveis[(i + (e.shiftKey ? -1 : 1) + n) % n].focus();
    return;
  }
  const ops = [...caixa.querySelectorAll('.gm-op')];
  if (ops.length && ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const n = ops.length,
      j = ops.indexOf(document.activeElement);
    let k;
    if (e.key === 'Home') k = 0;
    else if (e.key === 'End') k = n - 1;
    else if (j < 0) k = 0;
    else k = (j + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    ops[k].focus();
    return;
  }
  if (ops.length && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const k = 'abcd'.indexOf(e.key.toLowerCase());
    if (k >= 0 && ops[k]) {
      e.preventDefault();
      ops[k].click();
      return;
    }
  }
  if (e.key === 'Escape') {
    const b = caixa.querySelector('[data-esc]');
    if (b) {
      e.preventDefault();
      b.click();
    }
  }
}
/** Liga o teclado da janela da missão (chamado uma vez pela interface). */
export function iniciarTecladoDaMissao() {
  $('gm').addEventListener('keydown', e => {
    // as teclas da linha do tempo (espaço, setas) não valem com a janela aberta
    e.stopPropagation();
    teclaNoModal(e);
  });
}

function showStop(stop) {
  acoes.tocar(false);
  ST.day = stop.d;
  acoes.atualizar(true);
  salvarPartida();
  if (stop.k === 'ev') {
    const ev = stop.ev;
    gm(
      `<p class="gm-eye bad">Consequência · ${fmtDate(ev.day)} · ${fmtHour(ev.day)}</p><h3 id="gmTit">${esc(ev.titulo)}</h3><p>${esc(ev.txt)}</p><p class="gm-orig">Origem: ${esc(ev.from)}</p><div class="gm-fx">${fxAll(ev)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`
    );
    $('gmOk').onclick = () => {
      ev.seen = true;
      salvarPartida();
      fecharModal();
      updateHud();
      acoes.tocar(true);
      if (ST.tab === 'missao') renderTab();
    };
    return;
  }
  const dc = stop.dc,
    n = DECISOES.indexOf(dc) + 1,
    sv = svcById(dc.svc);
  const letras = 'ABCD'.slice(0, dc.ops.length).split('');
  gm(`<p class="gm-eye">Decisão ${n} de ${DECISOES.length} · ${fmtDate(stop.d)} · ${fmtHour(stop.d)}${sv ? ' · ' + esc(curto(sv.id)) : ''}</p><h3 id="gmTit">${esc(dc.titulo)}</h3><p>${esc(dc.ctx)}</p>
  <dl class="gm-dados">${dc.dados.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  <div class="gm-ops" role="group" aria-label="Alternativas">${dc.ops.map((o, i) => `<button class="gm-op" data-op="${i}" aria-keyshortcuts="${letras[i]}"><b aria-hidden="true">${letras[i]}</b><span><span class="sr">Alternativa ${letras[i]}: </span>${esc(o.t)}</span></button>`).join('')}</div>
  <p class="gm-tecla">Teclado: setas para percorrer as alternativas e Enter para escolher, ou as teclas ${letras.slice(0, -1).join(', ')} e ${letras[letras.length - 1]}.</p>`);
  $('gmc')
    .querySelectorAll('[data-op]')
    .forEach(b => (b.onclick = () => choose(dc, +b.dataset.op, stop.d)));
}

function choose(dc, i, day) {
  const op = dc.ops[i];
  GAME.done[dc.id] = { i, op, day };
  GAME.ordem.push(dc.id);
  if (op.later) agendarConsequencia(dc, op);
  if (op.opt) {
    acoes.reconstruir();
    ST.day = day;
  }
  salvarPartida();
  updateHud();
  acoes.atualizar(true);
  gm(
    `<p class="gm-eye ${op.best === 2 ? 'ok' : op.best ? '' : 'bad'}">${BEST()[op.best]}</p><h3 id="gmTit">${esc(dc.titulo)}</h3><p class="gm-you">Você decidiu: ${esc(op.t)}</p><p>${esc(op.fb)}</p><div class="gm-fx">${fxAll(op)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`
  );
  $('gmOk').onclick = () => {
    fecharModal();
    acoes.tocar(true);
  };
  if (ST.tab === 'missao') renderTab();
}

export function finishGame() {
  acoes.tocar(false);
  GAME.finished = true;
  const m = GAME.metrics();
  const prev = parseFloat((lsGet('vm4d.best') || '0').replace(',', '.'));
  if (m.nota > prev) lsSet('vm4d.best', nf(m.nota, 1));
  const nb = Object.values(GAME.done).filter(x => x.op.best === 2).length;
  // nota no histórico (por data) e fim da partida salva
  const r1 = v => Math.round(v * 10) / 10;
  const entrada = {
    data: new Date().toISOString(),
    nota: r1(m.nota),
    conceito: m.conceito,
    melhores: nb,
    total: DECISOES.length,
    atraso: r1(m.d),
    custo: r1(m.c),
    qualidade: Math.round(m.q),
    conformidade: Math.round(m.n)
  };
  lsSet(CHAVE_HISTORICO, JSON.stringify(registrarNota(historicoDeNotas(), entrada)));
  apagarPartida();
  const comRetrabalho = D.decisoes.pontuacao.retrabalhosSemPenalidade.some(k => M.opt[k]);
  gm(`<p class="gm-eye">Missão concluída · ${fmtDate(M.fim)}</p><h3 id="gmTit">Nota ${nf(m.nota, 1)} · ${m.conceito}</h3>
  <div class="hud-grid">${hudItems(m)}</div>
  <p>${nb} de ${DECISOES.length} decisões foram as melhores possíveis. ${m.d > 0.01 ? `A obra terminou com ${nf(m.d, 1)} ${plural(m.d, 'dia útil', 'dias úteis')} de atraso${comRetrabalho ? ', incluindo o retrabalho que você mandou fazer; esse atraso não reduz a nota' : ''}.` : 'A obra terminou no prazo.'}</p>
  <p class="csub">A nota ficou registrada no histórico deste navegador, na aba Missão.</p>
  <div class="gm-act"><button class="btn" id="gmRe">Jogar de novo</button><button class="btn ghost" id="gmRev">Ver o relatório das decisões</button><button class="btn ghost" id="gmEx" data-esc>Voltar a explorar</button></div>`);
  $('gmRe').onclick = () => {
    resetGame();
    GAME.finished = false;
    briefing();
  };
  $('gmRev').onclick = () => {
    fecharModal();
    openTab('missao');
    document.querySelector('.sheet').scrollIntoView({ behavior: 'smooth' });
  };
  $('gmEx').onclick = () => {
    resetGame();
    GAME.finished = false;
    setMode('explorar');
  };
  if (ST.tab === 'missao') renderTab();
}

export function hudItems(m) {
  const bar = v => `<span class="hbar ${v < 60 ? 'b' : v < 85 ? 'w' : ''}"><i style="width:${v}%"></i></span>`;
  return `<div class="hi"><span>Prazo</span><b class="${m.d > 0.01 ? 'bad' : ''}">${m.d > 0.01 ? '+' + nf(m.d, 1) + ' d' : 'no prazo'}</b></div>
  <div class="hi"><span>Custo adicional</span><b class="${m.c > 20 ? 'bad' : ''}">${m.c >= 0 ? '' : '−'}R$ ${nf(Math.abs(m.c), 1)} mil</b></div>
  <div class="hi"><span>Qualidade</span><b>${Math.round(m.q)}</b>${bar(m.q)}</div>
  <div class="hi"><span>Conformidade</span><b>${Math.round(m.n)}</b>${bar(m.n)}</div>`;
}
export function updateHud() {
  if (!missaoAtiva()) return;
  const m = GAME.metrics();
  const nd = Object.keys(GAME.done).length;
  $('hud').innerHTML =
    `<div class="hud-t">Missão · decisão ${Math.min(nd + 1, DECISOES.length)} de ${DECISOES.length}</div><div class="hud-grid">${hudItems(m)}</div>`;
}

// controle do avanço durante a missão: a linha do tempo para na próxima decisão ou consequência
export function gameGate(newDay) {
  if (!missaoAtiva() || !GAME.started || GAME.finished) return newDay;
  const st = GAME.nextStop();
  if (st && newDay >= st.d) {
    showStop(st);
    return st.d;
  }
  if (!st && newDay >= M.fim - 0.001) {
    ST.day = M.fim;
    acoes.atualizar(true);
    finishGame();
    return M.fim;
  }
  return newDay;
}

// texto do tempo no diário: a decisão da chuva muda o registro do dia em que aconteceu
export function tempoNoDiario(D_) {
  if (!missaoAtiva()) return null;
  for (const dc of DECISOES) {
    if (!dc.tempo || !GAME.done[dc.id]) continue;
    const d = dc.day();
    if (d != null && Math.floor(d) === D_) return dc.tempo;
  }
  return null;
}
// decisões e consequências registradas entre os dias a e b (ocorrências do diário)
export function ocorrenciasDaMissao(a, b) {
  const oc = [];
  if (!missaoAtiva()) return oc;
  for (const k in GAME.done) {
    const r = GAME.done[k];
    if (r.day >= a && r.day <= b) {
      const dc = DECISOES.find(x => x.id === k);
      oc.push(`Decisão do engenheiro residente (${dc.titulo}): ${r.op.t}`);
    }
  }
  GAME.events.filter(e => e.seen && e.day >= a && e.day <= b).forEach(e => oc.push(`${e.titulo}: ${e.txt}`));
  return oc;
}
