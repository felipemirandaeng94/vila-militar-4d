// Painéis sobre o modelo e ao lado dele: barra 4D, selos, "Agora na obra", liberações e janela de informação.
import { M, ST, acoes } from '../estado.js';
import { nf } from '../dominio/util.js';
import { fmtDate, fmtHour, estStr } from '../dominio/calendario.js';
import { activeList } from '../dominio/cronograma.js';
import { gateStatus } from '../dominio/liberacoes.js';
import { $, esc, svcById, corGrupo } from './dom.js';
import { focarPonto } from '../motor/index.js';
import { linhaDoDiaNoGantt } from './abas/sequencia.js';
import { renderTab } from './abas.js';
import { missaoAtiva, updateHud } from '../jogo/missao.js';

// ---------- liberações de camada ----------
export function renderGates() {
  $('systems').innerHTML = M.liberacoes
    .map(g => `<button data-gate="${g.id}" aria-pressed="false" title="${esc(g.nome)}: dia ${nf(g.day, 1)}">${g.id} · ${esc(g.nome)}</button>`)
    .join('');
  $('systems')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          const g = M.liberacoes.find(x => x.id === b.dataset.gate);
          acoes.irParaDia(Math.min(M.fim, g.day + 0.01));
        })
    );
}
function updateGates() {
  $('systems')
    .querySelectorAll('button')
    .forEach(b => {
      const g = M.liberacoes.find(x => x.id === b.dataset.gate),
        s = gateStatus(g, M.ensaios, ST.day);
      b.setAttribute('aria-pressed', s.k === 'ok');
      b.dataset.k = s.k;
      b.title = `${g.nome}: ${s.txt}${s.k === 'ok' ? ' no dia ' + nf(g.day, 1) : ''}`;
    });
}

// ---------- painel "agora na obra", selos e barra ----------
let lastUI = -1;
export function updateUI(force) {
  const d = ST.day,
    END = M.fim,
    TT = M.ensaios;
  if (!force && Math.abs(d - lastUI) < 0.004) return;
  lastUI = d;
  $('stg').value = d;
  const act = activeList(M.svc, d);
  const hour = fmtHour(d);
  $('stgl').innerHTML =
    `<b>Dia útil ${Math.min(Math.floor(d) + 1, Math.ceil(END))} de ${Math.ceil(END)}</b> · ${fmtDate(d)} · ${hour} · ${act.length ? act.map(a => esc(a.s.nome) + (a.lane ? ' (' + a.lane + ')' : '')).join(' · ') : d >= END - 0.01 ? 'Obra concluída e entregue' : 'Sem frente de serviço em execução'}`;
  $('nowDate').textContent = fmtDate(d, false);
  const badges = [`<span class="chip">Dia ${Math.min(Math.floor(d) + 1, Math.ceil(END))} · ${fmtDate(d)} · ${hour}</span>`];
  act.forEach(a =>
    badges.push(
      `<span class="chip" style="--c:${corGrupo(a.s.g)}"><i class="dot"></i>${esc(a.s.id)} ${esc(a.s.nome.split(':')[0])}${a.lane ? ' · ' + a.lane : ''}${a.cura ? ' · cura' : ''}</span>`
    )
  );
  const nc = TT.filter(t => !t.ok && t.day <= d && t.day > d - 0.6);
  nc.forEach(t => badges.push(`<span class="chip ncf">Não conformidade: ${esc(t.nome)} (${esc(t.v)} ${esc(t.u)})</span>`));
  if (ST.labPulse) badges.push(`<span class="chip lab">Laboratório: ${ST.labPulse} ensaio${ST.labPulse > 1 ? 's' : ''} no dia</span>`);
  $('badges').innerHTML = badges.join('');
  // agora na obra
  let h = '';
  if (!act.length)
    h += `<p class="muted">${d >= END - 0.01 ? 'Obra concluída. O Termo de Recebimento Provisório foi assinado.' : 'Nenhuma frente em execução neste instante.'}</p>`;
  for (const a of act) {
    const s = a.s;
    h += `<div class="now-svc${s.rework ? ' rw' : ''}"><div class="now-h"><i class="dot" style="--c:${corGrupo(s.g)}"></i><b>${esc(s.id)}</b> ${esc(s.nome)}${a.lane ? ` <span class="tag">${a.lane === 'BD' ? 'faixa direita' : 'faixa esquerda'}</span>` : ''}${a.cura ? ' <span class="tag">cura</span>' : ''}</div>
      <div class="pbar"><span style="width:${Math.round(a.p * 100)}%"></span></div>
      <div class="now-m">${esc(s.norma)} · ${esc(s.efetivo)}</div>
      ${a.cura ? '' : `<div class="now-eq">${s.eq.map(([n, q]) => `<span>${q}× ${esc(n)}</span>`).join('')}</div>`}</div>`;
  }
  const recent = TT.filter(t => t.day <= d && t.day > d - 0.6)
    .slice(-4)
    .reverse();
  if (recent.length)
    h += `<div class="grp">Ensaios recentes</div><ul class="tlist">${recent.map(t => `<li data-t="${t.id}"><span class="${t.ok ? 'ok' : 'bad'}">${t.ok ? '✓' : '✕'}</span><span class="tn">${esc(t.nome)}${t.s != null ? ` <small>est. ${estStr(t.s)}</small>` : ''}</span><b>${esc(t.v)} ${esc(t.u)}</b></li>`).join('')}</ul>`;
  const nextG = M.liberacoes.find(g => d < g.day);
  if (nextG) {
    const s = gateStatus(nextG, TT, d);
    h += `<div class="grp">Próxima liberação</div><div class="gate ${s.k}"><b>${nextG.id}</b> ${esc(nextG.nome)}<span>${s.done} de ${nextG.n} ensaios · ${s.txt}</span></div>`;
  }
  $('now').innerHTML = h;
  $('now')
    .querySelectorAll('[data-t]')
    .forEach(
      li =>
        (li.onclick = () =>
          selectTest(
            TT.find(t => t.id === li.dataset.t),
            true
          ))
    );
  updateGates();
  if (ST.tab === 'seq') linhaDoDiaNoGantt(d);
  if (missaoAtiva()) updateHud();
  if (ST.tab === 'ctrl' || ST.tab === 'lab' || ST.tab === 'diario') {
    if (!ST._tabT || performance.now() - ST._tabT > 400) {
      ST._tabT = performance.now();
      renderTab(true);
    }
  }
}

// ---------- janela de informação ----------
export function showInfo(t, d, extra = '') {
  $('infot').textContent = t;
  $('infod').innerHTML =
    Object.entries(d || {})
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join('') + extra;
  $('info').hidden = false;
}
export function hideInfo() {
  $('info').hidden = true;
  if (ST.sel) {
    ST.sel = null;
  }
}
// seleciona um ensaio; com jump, leva a obra ao dia do ensaio e a câmera ao ponto
export function selectTest(t, jump) {
  if (!t) return;
  ST.sel = t;
  if (jump) {
    if (ST.day < t.day || (t.until != null && ST.day >= t.until)) acoes.irParaDia(t.day + 0.01);
    else acoes.tocar(false);
    if (ST.day < t.day) return;
  }
  const d = {
    Serviço: t.svc + ' · ' + (svcById(t.svc) || {}).nome,
    Norma: t.norma,
    Data: fmtDate(t.day) + ' · ' + fmtHour(t.day),
    Resultado: `${t.v} ${t.u}`.trim(),
    Critério: t.crit
  };
  if (t.s != null) {
    d.Local = `est. ${estStr(t.s)} · ${t.z > 1 ? 'bordo direito' : t.z < -1 ? 'bordo esquerdo' : 'eixo'}`;
  }
  if (t.w) d['Umidade de campo'] = t.w + ' %';
  if (t.esp) d['Espessura do CP'] = t.esp + ' cm';
  d.Situação = t.ok ? (t.re ? 'Conforme (reensaio)' : 'Conforme') : 'Não conforme';
  showInfo((t.ok ? '✓ ' : '✕ ') + t.nome, d, t.obs ? `<p class="obs">${esc(t.obs)}</p>` : '');
  if (jump && t.s != null) {
    ST.follow = false;
    $('optFollow').checked = false;
    focarPonto(t.s, t.y, t.z);
  }
  acoes.atualizar(true);
}
