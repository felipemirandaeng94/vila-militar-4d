// Missão do engenheiro residente: cada decisão aparece no instante em que acontece na obra; algumas escolhas
// geram consequências mais adiante e outras ativam retrabalhos no cronograma.
import { M, ST, D, acoes } from '../estado.js';
import { P } from '../dominio/geometria.js';
import { nf } from '../dominio/util.js';
import { fmtDate, fmtHour } from '../dominio/calendario.js';
import { metricas } from '../dominio/missao.js';
import { $, esc, svcById, curto, lsGet, lsSet } from '../interface/dom.js';
import { renderTab, openTab } from '../interface/abas.js';
import { camAt } from '../motor/index.js';
import { DECISOES } from './decisoes.js';

export const GAME = {
  started: false,
  finished: false,
  done: {}, // decisões tomadas: { id: { i, op, day } }
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
    for (const ev of this.events) if (!ev.seen) out.push({ k: 'ev', d: ev.day, ev });
    return out.sort((a, b) => a.d - b.d);
  },
  nextStop() {
    const q = this.queue();
    return q.length ? q[0] : null;
  },
  metrics() {
    return metricas({
      escolhas: Object.values(this.done).map(x => x.op),
      eventos: this.events.filter(ev => ev.seen),
      fim: M.fim,
      prazo: D.obra.calendario.prazoContratualDias,
      opt: M.opt,
      pontuacao: D.decisoes.pontuacao
    });
  }
};

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

export function setMode(m) {
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
    if (!GAME.started) briefing();
  } else {
    $('gm').hidden = true;
    acoes.reconstruir();
  }
  if (ST.tab === 'missao') renderTab();
}
export function resetGame() {
  GAME.done = {};
  GAME.events = [];
  GAME.started = false;
}
export const iniciarMissao = () => setMode('missao');
export function recomecarMissao() {
  resetGame();
  GAME.finished = false;
  if (!missaoAtiva()) setMode('missao');
  else briefing();
}

export function briefing() {
  const best = lsGet('vm4d.best');
  const prazo = D.obra.calendario.prazoContratualDias;
  gm(`<p class="gm-eye">Missão · engenheiro residente</p><h3>${esc(D.obra.obra.titulo)}</h3>
  <p>Você é o engenheiro residente da obra. Tem <b>${prazo} dias úteis</b> para entregar ${P.L} m de via em CBUQ, com a terraplenagem, a usina no canteiro e todo o controle tecnológico.</p>
  <p>Ao longo da obra aparecem <b>${DECISOES.length} decisões</b>, no momento em que acontecem: ensaios reprovados, chuva, pressão do comando, propostas de atalho. Cada escolha muda o prazo, o custo, a qualidade e a conformidade com as normas. Algumas consequências só aparecem semanas depois.</p>
  <ul class="gm-rules"><li>A linha do tempo não avança além da próxima decisão.</li><li>Decisões com retrabalho aparecem no modelo 3D e no cronograma.</li><li>No fim, você recebe a nota e o conceito da missão.</li></ul>
  ${best ? `<p class="gm-best">Sua melhor nota neste navegador: <b>${esc(best)}</b></p>` : ''}
  <div class="gm-act"><button class="btn" id="gmGo">Iniciar missão</button><button class="btn ghost" id="gmBack">Voltar a explorar</button></div>`);
  $('gmGo').onclick = () => {
    resetGame();
    GAME.started = true;
    acoes.reconstruir();
    ST.day = 0;
    ST.speed = 2;
    acoes.sincronizarVelocidade();
    $('gm').hidden = true;
    acoes.tocar(true);
    camAt(30, -20, -80, 70, 120);
  };
  $('gmBack').onclick = () => setMode('explorar');
}

function gm(html) {
  $('gmc').innerHTML = html;
  $('gm').hidden = false;
  $('gmc').scrollTop = 0;
  const b = $('gmc').querySelector('button');
  if (b) b.focus({ preventScroll: true });
}

function showStop(stop) {
  acoes.tocar(false);
  ST.day = stop.d;
  acoes.atualizar(true);
  if (stop.k === 'ev') {
    const ev = stop.ev;
    gm(
      `<p class="gm-eye bad">Consequência · ${fmtDate(ev.day)} · ${fmtHour(ev.day)}</p><h3>${esc(ev.titulo)}</h3><p>${esc(ev.txt)}</p><p class="gm-orig">Origem: ${esc(ev.from)}</p><div class="gm-fx">${fxAll(ev)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`
    );
    $('gmOk').onclick = () => {
      ev.seen = true;
      $('gm').hidden = true;
      updateHud();
      acoes.tocar(true);
      if (ST.tab === 'missao') renderTab();
    };
    return;
  }
  const dc = stop.dc,
    n = DECISOES.indexOf(dc) + 1,
    sv = svcById(dc.svc);
  gm(`<p class="gm-eye">Decisão ${n} de ${DECISOES.length} · ${fmtDate(stop.d)} · ${fmtHour(stop.d)} · ${esc(sv ? curto(sv.id) : '')}</p><h3>${esc(dc.titulo)}</h3><p>${esc(dc.ctx)}</p>
  <dl class="gm-dados">${dc.dados.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  <div class="gm-ops">${dc.ops.map((o, i) => `<button class="gm-op" data-op="${i}"><b>${'ABCD'[i]}</b><span>${esc(o.t)}</span></button>`).join('')}</div>`);
  $('gmc')
    .querySelectorAll('[data-op]')
    .forEach(b => (b.onclick = () => choose(dc, +b.dataset.op, stop.d)));
}

function choose(dc, i, day) {
  const op = dc.ops[i];
  GAME.done[dc.id] = { i, op, day };
  if (op.later) GAME.events.push(Object.assign({ from: dc.titulo + ' (decisão ' + (DECISOES.indexOf(dc) + 1) + ')' }, op.later));
  if (op.opt) {
    acoes.reconstruir();
    ST.day = day;
  }
  updateHud();
  acoes.atualizar(true);
  gm(
    `<p class="gm-eye ${op.best === 2 ? 'ok' : op.best ? '' : 'bad'}">${BEST()[op.best]}</p><h3>${esc(dc.titulo)}</h3><p class="gm-you">Você decidiu: ${esc(op.t)}</p><p>${esc(op.fb)}</p><div class="gm-fx">${fxAll(op)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`
  );
  $('gmOk').onclick = () => {
    $('gm').hidden = true;
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
  const comRetrabalho = D.decisoes.pontuacao.retrabalhosSemPenalidade.some(k => M.opt[k]);
  gm(`<p class="gm-eye">Missão concluída · ${fmtDate(M.fim)}</p><h3>Nota ${nf(m.nota, 1)} · ${m.conceito}</h3>
  <div class="hud-grid">${hudItems(m)}</div>
  <p>${nb} de ${DECISOES.length} decisões foram as melhores possíveis. ${m.d > 0.01 ? `A obra terminou com ${nf(m.d, 1)} dia(s) útil(eis) de atraso${comRetrabalho ? ', incluindo o retrabalho que você mandou fazer; esse atraso não reduz a nota' : ''}.` : 'A obra terminou no prazo.'}</p>
  <div class="gm-act"><button class="btn" id="gmRe">Jogar de novo</button><button class="btn ghost" id="gmRev">Ver o relatório das decisões</button><button class="btn ghost" id="gmEx">Voltar a explorar</button></div>`);
  $('gmRe').onclick = () => {
    resetGame();
    GAME.finished = false;
    briefing();
  };
  $('gmRev').onclick = () => {
    $('gm').hidden = true;
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
