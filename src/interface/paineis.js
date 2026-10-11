// Painéis sobre o modelo e ao lado dele: barra 4D, selos, "Agora na obra", liberações e janela de informação.
import { M, ST, D, acoes } from '../estado.js';
import { nf } from '../dominio/util.js';
import { fmtDate, fmtHour, estStr } from '../dominio/calendario.js';
import { activeList } from '../dominio/cronograma.js';
import { estadoDoDesvio } from '../dominio/frentes.js';
import { gateStatus } from '../dominio/liberacoes.js';
import { $, esc, svcById, corGrupo, curto } from './dom.js';
import { focarPonto } from '../motor/index.js';
import { linhaDoDiaNoGantt } from './abas/sequencia.js';
import { renderTab } from './abas.js';
import { missaoAtiva, updateHud } from '../jogo/missao.js';

// ---------- liberações de camada ----------
const tiposDeLiberacao = () => [...new Set(M.liberacoes.map(g => g.tipo))];
const doTipo = t => M.liberacoes.filter(g => g.tipo === t).sort((x, y) => x.day - y.day);
export function renderGates() {
  $('systems').innerHTML = tiposDeLiberacao()
    .map(t => {
      const g = doTipo(t)[0];
      return `<button data-gate="${t}" aria-pressed="false">${t} · ${esc(g.nome)} <small></small></button>`;
    })
    .join('');
  $('systems')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          const lista = doTipo(b.dataset.gate);
          const g = lista.find(x => x.day > ST.day + 0.02) || lista[lista.length - 1];
          acoes.irParaDia(Math.min(M.fim, g.day + 0.01));
        })
    );
}
// situação agregada por tipo: emitida em todas as frentes, com não conformidade aberta, em ensaio ou pendente
function updateGates() {
  $('systems')
    .querySelectorAll('button')
    .forEach(b => {
      const lista = doTipo(b.dataset.gate);
      const st = lista.map(g => gateStatus(g, M.ensaios, ST.day));
      const ok = st.filter(x => x.k === 'ok').length;
      const k = ok === lista.length ? 'ok' : st.some(x => x.k === 'bad') ? 'bad' : st.some(x => x.k === 'run') || ok ? 'run' : 'pend';
      b.setAttribute('aria-pressed', k === 'ok');
      b.dataset.k = k;
      b.querySelector('small').textContent = lista.length > 1 ? `${ok}/${lista.length}` : '';
      b.title = lista
        .map((g, i) => `${g.f != null ? M.frentes[g.f].nome : 'Trecho'}: ${st[i].txt}${st[i].k === 'ok' ? ' no dia ' + nf(g.day, 1) : ''}`)
        .join(' · ');
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
  $('stgl').innerHTML = `<b>Dia útil ${Math.min(Math.floor(d) + 1, Math.ceil(END))} de ${Math.ceil(END)}</b> · ${fmtDate(d)} · ${hour} · ${
    act.length
      ? act
          .filter(a => !a.cura)
          .map(a => esc(curto(a.s.id) || a.s.nome) + onde(a))
          .join(' · ')
      : d >= END - 0.01
        ? 'Obra concluída e entregue'
        : 'Sem frente de serviço em execução'
  }`;
  $('nowDate').textContent = fmtDate(d, false);
  const badges = [`<span class="chip">Dia ${Math.min(Math.floor(d) + 1, Math.ceil(END))} · ${fmtDate(d)} · ${hour}</span>`];
  act.forEach(a =>
    badges.push(
      `<span class="chip" style="--c:${corGrupo(a.s.g)}"><i class="dot"></i>${esc(a.s.id)} ${esc(curto(a.s.id) || a.s.nome.split(':')[0])}${onde(a)}${a.cura ? ' · cura' : ''}</span>`
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
    h += `<div class="now-svc${s.rework ? ' rw' : ''}"><div class="now-h"><i class="dot" style="--c:${corGrupo(s.g)}"></i><b>${esc(s.id)}</b> ${esc(s.nome)}${a.f != null ? ` <span class="tag">${M.frentes[a.f].nome}</span>` : ''}${a.lane ? ` <span class="tag">${a.lane === 'BD' ? 'faixa direita' : 'faixa esquerda'}</span>` : ''}${a.cura ? ' <span class="tag">cura</span>' : ''}</div>
      <div class="pbar"><span style="width:${Math.round(a.p * 100)}%"></span></div>
      <div class="now-m">${esc(s.norma)} · ${esc(s.efetivo)}</div>
      ${a.cura ? '' : `<div class="now-eq">${s.eq.map(([n, q]) => `<span>${q}× ${esc(n)}</span>`).join('')}</div>`}</div>`;
  }
  const recent = TT.filter(t => t.day <= d && t.day > d - 0.6)
    .slice(-4)
    .reverse();
  if (recent.length)
    h += `<div class="grp">Ensaios recentes</div><ul class="tlist">${recent.map(t => `<li data-t="${t.id}"><span class="${t.ok ? 'ok' : 'bad'}">${t.ok ? '✓' : '✕'}</span><span class="tn">${esc(t.nome)}${t.s != null ? ` <small>est. ${estStr(t.s)}</small>` : ''}</span><b>${esc(t.v)} ${esc(t.u)}</b></li>`).join('')}</ul>`;
  const nextG = [...M.liberacoes].sort((x, y) => x.day - y.day).find(g => d < g.day);
  if (nextG) {
    const s = gateStatus(nextG, TT, d);
    h += `<div class="grp">Próxima liberação</div><div class="gate ${s.k}"><b>${nextG.tipo}${nextG.f != null ? ' · ' + M.frentes[nextG.f].nome : ''}</b> ${esc(nextG.nome)}<span>${s.done} de ${nextG.n} ensaios · ${s.txt}</span></div>`;
  }
  $('now').innerHTML = h;
  painelDeFrentes(d, act);
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

const onde = a => (a.f != null ? ` (${M.frentes[a.f].nome}${a.lane ? ' ' + a.lane : ''})` : a.lane ? ` (${a.lane})` : '');

// ---------- painel das frentes: trecho, serviço em execução e estado do desvio ----------
function painelDeFrentes(d, act) {
  const nomes = D.servicos.frentes.desvio.estados;
  $('frentes').innerHTML =
    `<div class="frentes">` +
    M.frentes
      .map(f => {
        const e = estadoDoDesvio(f, d);
        const svs = act.filter(a => a.f === f.i && !a.cura).map(a => curto(a.s.id) || a.s.nome);
        const cura = act.some(a => a.f === f.i && a.cura);
        const txt = svs.length
          ? svs.join(', ')
          : cura
            ? 'Imprimação em cura'
            : e === 'liberada'
              ? 'Concluída'
              : e === 'emUso'
                ? 'Aguardando abertura'
                : 'Sem serviço no momento';
        return `<div class="frente-l" title="est. ${estStr(f.s0)} a ${estStr(f.s1)}"><b>${f.nome}</b><span class="svc">${esc(txt)}</span><span class="desvio" data-e="${e}">${esc(nomes[e])}</span></div>`;
      })
      .join('') +
    `</div>`;
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
