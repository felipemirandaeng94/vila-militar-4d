// Aba "Sequência executiva": Gantt dos serviços, liberações de camada e procedimento de cada serviço.
import { M, ST, D } from '../../estado.js';
import { nf } from '../../dominio/util.js';
import { fmtDate, fmtHour } from '../../dominio/calendario.js';
import { esc, svcById, curto } from '../dom.js';

// posição x do dia no Gantt atual (para mover a linha do dia sem redesenhar)
let GX = d => d;
export function linhaDoDiaNoGantt(d) {
  const ln = document.getElementById('gNow');
  if (ln) {
    const x = GX(d);
    ln.setAttribute('x1', x);
    ln.setAttribute('x2', x);
  }
}

export function tabSeq() {
  const SVC = M.svc,
    END = M.fim,
    GRP = D.servicos.grupos;
  const W = 1000,
    left = 300,
    top = 34,
    rh = 22,
    rows = SVC.length,
    H = top + rows * rh + 58;
  const x = d => left + (d / (END + 0.5)) * (W - left - 14);
  GX = x;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronograma da obra"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel-2)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" stroke-width="2"/></pattern></defs>`;
  for (let d = 0; d <= END; d += 5)
    s += `<line x1="${x(d)}" x2="${x(d)}" y1="${top - 6}" y2="${H - 40}" stroke="var(--line-2)"/><text x="${x(d) + 3}" y="${top - 12}">${fmtDate(d, false).slice(0, 5)}</text>`;
  SVC.forEach((v, i) => {
    const y = top + i * rh;
    const c = GRP[v.g].cor;
    s += `<g class="row${ST.man === v.id ? ' sel' : ''}" data-svc="${v.id}"><rect class="bg" x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
    s += `<text x="8" y="${y + 15}" style="font-family:var(--f-mono);fill:var(--muted)">${v.id}</text><text x="44" y="${y + 15}"${v.rework ? ' style="fill:var(--bad)"' : ''}>${esc(v.nome.length > 44 ? v.nome.slice(0, 43) + '…' : v.nome)}</text>`;
    const ws = v.win ? v.win.map(w => [w, '']) : Object.entries(v.lanes).map(([k, w]) => [w, k]);
    ws.forEach(([w, k]) => {
      s += `<rect x="${x(w[0])}" y="${y + 5}" width="${Math.max(3, x(w[1]) - x(w[0]))}" height="${rh - 10}" rx="3" fill="${v.rework ? 'var(--bad)' : c}"><title>${k ? (k === 'BD' ? 'Faixa direita' : 'Faixa esquerda') + ': ' : ''}${fmtDate(w[0])} ${fmtHour(w[0])} a ${fmtHour(w[1])}</title></rect>`;
    });
    if (v.lanes)
      s += `<text x="${x(Math.max(...Object.values(v.lanes).map(w => w[1]))) + 4}" y="${y + 15}" style="font-size:10px;fill:var(--muted)">BD → BE</text>`;
    if (v.cura)
      s += `<rect x="${x(v.cura[0])}" y="${y + 5}" width="${x(v.cura[1]) - x(v.cura[0])}" height="${rh - 10}" rx="3" fill="url(#hatch)" stroke="var(--muted)" stroke-width=".6"/><text x="${x(v.cura[1]) + 3}" y="${y + 15}" style="font-size:10px;fill:var(--muted)">cura</text>`;
    if (v.falha)
      s += `<rect x="${x(v.falha.a)}" y="${y + 5}" width="${Math.max(3, x(v.falha.b) - x(v.falha.a))}" height="${rh - 10}" rx="2" fill="var(--bad)"/>`;
    s += `</g>`;
  });
  const gy = H - 46;
  s += `<text x="8" y="${gy + 14}" style="font-weight:600">Liberações de camada (BLC)</text>`;
  M.liberacoes.forEach((g, i) => {
    const xx = x(g.day);
    s += `<g><title>${g.id} · ${esc(g.nome)} · ${fmtDate(g.day)}</title><path d="M${xx} ${gy + 2} l7 7 l-7 7 l-7 -7z" fill="var(--accent)"/><text x="${xx}" y="${gy + 30 + (i % 2) * 11}" text-anchor="middle" style="font-size:9.5px;fill:var(--ink-2)">${g.id}</text></g>`;
  });
  s += `<line id="gNow" x1="${x(ST.day)}" x2="${x(ST.day)}" y1="${top - 6}" y2="${H - 6}" stroke="var(--brass)" stroke-width="2"/></svg>`;
  const legend =
    Object.values(GRP)
      .map(g => `<span><i class="dot" style="--c:${g.cor}"></i>${g.nome}</span>`)
      .join('') + `<span><i class="dot" style="--c:var(--bad)"></i>Retrabalho / não conformidade</span><span><i class="dot hatch"></i>Cura</span>`;
  return `<div class="pane-head"><h2>Sequência executiva</h2><p>Cada barra é uma frente de serviço em dias úteis. Os losangos marcam a emissão de cada Boletim de Liberação de Camada, que só acontece depois do último ensaio conforme. Clique em uma linha para ir ao início do serviço e abrir o procedimento.</p></div>
  <div class="legend">${legend}</div><div class="gantt">${s}</div>${manualHTML()}`;
}

function manualHTML() {
  const SVC = M.svc,
    TT = M.ensaios;
  const v = svcById(ST.man) || SVC[0];
  const man = D.manual[v.id];
  const m = man ? { onde: man.onde, como: man.como, chk: man.conferir } : { onde: '', como: [], chk: [] };
  const ts = TT.filter(t => t.svc === v.id),
    ok = ts.filter(t => t.ok).length;
  const win = v.win
    ? v.win.map(w => `${fmtDate(w[0], false)} a ${fmtDate(Math.max(w[0], w[1] - 0.01), false)}`).join(', ')
    : Object.entries(v.lanes)
        .map(([k, w]) => `${k}: ${fmtDate(w[0], false)}`)
        .join(' · ');
  const steps = SVC.map(
    s =>
      `<button class="${s.id === v.id ? 'on' : ''}" data-man="${s.id}"><b>${s.id.startsWith('R') ? s.id : s.id.replace('S', '').replace(/^0/, '')}</b>${esc(curto(s.id) || s.nome)}</button>`
  ).join('');
  return `<div class="man"><div class="man-steps">${steps}</div>
  <article class="man-card"><header><span class="man-n">${v.id}</span><div><h3>${esc(v.nome)}</h3><p class="man-meta">${esc(v.norma)} · ${win} · dias ${nf(v.a, 1)} a ${nf(v.b, 1)}</p></div></header>
  <div class="man-onde"><span>Onde</span>${esc(m.onde)}</div>
  <div class="man-grid"><div><h4>Como executar</h4><ol>${m.como.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
  <div class="man-side"><h4>Conferir antes de liberar</h4><ul class="man-chk">${m.chk.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <h4>Equipe e equipamentos</h4><p>${esc(v.efetivo)}</p><ul class="man-mat">${v.eq.map(([n, q]) => `<li><span>${esc(n)}</span><b>${q}</b></li>`).join('')}</ul>
  <h4>Liberação</h4><p>${esc(v.lib)}</p></div></div>
  <footer><span>${ts.length ? `${ts.length} ensaios vinculados · ${ok} conformes · ${ts.length - ok} não conformes` : 'Sem ensaios vinculados'}</span><button class="btn sm" data-goto="${v.a}">Ver no modelo ▶</button></footer></article></div>`;
}
