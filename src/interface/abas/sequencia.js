// Aba "Sequência executiva": Gantt agrupado por serviço ou por frente, liberações de camada e procedimento de cada serviço.
import { M, ST, D } from '../../estado.js';
import { nf } from '../../dominio/util.js';
import { fmtDate, fmtHour, estStr } from '../../dominio/calendario.js';
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

const nomeFaixa = f => (f === 'BD' ? 'faixa direita' : 'faixa esquerda');
const rotuloJanela = (v, w) =>
  `${w.f != null ? M.frentes[w.f].nome + ' · ' : ''}${w.faixa ? nomeFaixa(w.faixa) + ' · ' : ''}${fmtDate(w.a)} ${fmtHour(w.a)} a ${fmtDate(w.b)} ${fmtHour(w.b)}`;

export function tabSeq() {
  const SVC = M.svc,
    END = M.fim,
    GRP = D.servicos.grupos;
  const porFrente = ST.gantt === 'frente';
  // linhas: por serviço (uma linha por serviço) ou por frente (uma linha por grupo de serviço em cada frente)
  const linhas = [];
  if (porFrente) {
    linhas.push({ tit: 'Serviços gerais', cab: true });
    for (const [g, gg] of Object.entries(GRP)) {
      const jan = SVC.flatMap(v => v.jan.filter(w => w.f == null && v.g === g).map(w => ({ v, w })));
      if (jan.length) linhas.push({ tit: gg.nome, jan, g });
    }
    for (const f of M.frentes) {
      linhas.push({ tit: `${f.nome} · est. ${estStr(f.s0)} a ${estStr(f.s1)}`, cab: true, f: f.i });
      for (const [g, gg] of Object.entries(GRP)) {
        const jan = SVC.flatMap(v => v.jan.filter(w => w.f === f.i && v.g === g).map(w => ({ v, w })));
        if (jan.length) linhas.push({ tit: gg.nome, jan, g, f: f.i });
      }
    }
  } else for (const v of SVC) linhas.push({ v, tit: v.nome, jan: v.jan.map(w => ({ v, w })), g: v.g });
  const W = 1000,
    left = 300,
    top = 34,
    rh = 20,
    H = top + linhas.length * rh + 58;
  const x = d => left + (d / (END + 0.5)) * (W - left - 14);
  GX = x;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronograma da obra"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel-2)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" stroke-width="2"/></pattern></defs>`;
  for (let d = 0; d <= END; d += 10)
    s += `<line x1="${x(d)}" x2="${x(d)}" y1="${top - 6}" y2="${H - 40}" stroke="var(--line-2)"/><text x="${x(d) + 3}" y="${top - 12}">${fmtDate(d, false).slice(0, 5)}</text>`;
  linhas.forEach((ln, i) => {
    const y = top + i * rh;
    if (ln.cab) {
      s += `<rect x="0" y="${y}" width="${W}" height="${rh}" fill="var(--panel-2)"/><text x="8" y="${y + 14}" style="font-weight:600">${esc(ln.tit)}</text>`;
      return;
    }
    const v = ln.v;
    s += `<g class="row${v && ST.man === v.id ? ' sel' : ''}"${v ? ` data-svc="${v.id}"` : ''}><rect class="bg" x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
    if (v)
      s += `<text x="8" y="${y + 14}" style="font-family:var(--f-mono);fill:var(--muted)">${v.id}</text><text x="44" y="${y + 14}"${v.rework ? ' style="fill:var(--bad)"' : ''}>${esc(v.nome.length > 44 ? v.nome.slice(0, 43) + '…' : v.nome)}</text>`;
    else s += `<text x="24" y="${y + 14}">${esc(ln.tit)}</text>`;
    for (const { v: sv, w } of ln.jan) {
      const cor = sv.rework ? 'var(--bad)' : GRP[sv.g].cor;
      const wd = Math.max(2.5, x(w.b) - x(w.a));
      s += `<rect x="${x(w.a)}" y="${y + 4}" width="${wd}" height="${rh - 8}" rx="2" fill="${cor}" data-svc="${sv.id}"><title>${esc(sv.id + ' · ' + sv.nome)}\n${esc(rotuloJanela(sv, w))}</title></rect>`;
      if (!porFrente && w.f != null && wd > 16 && !w.faixa)
        s += `<text x="${x(w.a) + 3}" y="${y + 13}" style="font-size:9px;fill:#fff;pointer-events:none">${M.frentes[w.f].nome}</text>`;
      if (w.cura)
        s += `<rect x="${x(w.cura[0])}" y="${y + 4}" width="${x(w.cura[1]) - x(w.cura[0])}" height="${rh - 8}" rx="2" fill="url(#hatch)" stroke="var(--muted)" stroke-width=".6"><title>Cura da imprimação (${M.frentes[w.f].nome})</title></rect>`;
    }
    if (v && v.falha)
      s += `<rect x="${x(v.falha.a)}" y="${y + 4}" width="${Math.max(3, x(v.falha.b) - x(v.falha.a))}" height="${rh - 8}" rx="2" fill="var(--bad)"><title>Trecho lançado com teor fora da tolerância</title></rect>`;
    s += `</g>`;
  });
  const gy = H - 46;
  s += `<text x="8" y="${gy + 14}" style="font-weight:600">Liberações de camada (BLC) por frente</text>`;
  M.liberacoes.forEach(g => {
    const xx = x(g.day),
      rotulo = g.tipo === 'LIB' || g.tipo === 'ACEITE';
    s += `<g><title>${g.id} · ${esc(g.nome)} · ${fmtDate(g.day)}</title><path d="M${xx} ${gy + 4} l5 5 l-5 5 l-5 -5z" fill="${g.tipo === 'LIB' ? 'var(--ok)' : 'var(--accent)'}"/>${rotulo ? `<text x="${xx}" y="${gy + 30}" text-anchor="middle" style="font-size:9px;fill:var(--ink-2)">${g.tipo === 'LIB' ? 'LIB ' + M.frentes[g.f].nome : 'ACEITE'}</text>` : ''}</g>`;
  });
  s += `<line id="gNow" x1="${x(ST.day)}" x2="${x(ST.day)}" y1="${top - 6}" y2="${H - 6}" stroke="var(--brass)" stroke-width="2"/></svg>`;
  const legend =
    Object.values(GRP)
      .map(g => `<span><i class="dot" style="--c:${g.cor}"></i>${g.nome}</span>`)
      .join('') + `<span><i class="dot" style="--c:var(--bad)"></i>Retrabalho / não conformidade</span><span><i class="dot hatch"></i>Cura</span>`;
  const seletor = `<div class="seg" role="group" aria-label="Agrupar o cronograma"><button data-gantt="servico" aria-pressed="${!porFrente}">Por serviço</button><button data-gantt="frente" aria-pressed="${porFrente}">Por frente</button></div>`;
  return `<div class="pane-head"><h2>Sequência executiva</h2><p>Cada barra é a execução de um serviço numa frente de 400 m, em dias úteis. As frentes avançam em cascata, limitadas pelas equipes e pelo máximo de duas frentes com tráfego desviado. Os losangos marcam a emissão dos Boletins de Liberação de Camada de cada frente. ${esc(D.servicos.produtividades.nota)}</p></div>
  <div class="gantt-tools">${seletor}<div class="legend">${legend}</div></div><div class="gantt">${s}</div>${manualHTML()}`;
}

function manualHTML() {
  const SVC = M.svc,
    TT = M.ensaios;
  const v = svcById(ST.man) || SVC[0];
  const man = D.manual[v.id];
  const m = man ? { onde: man.onde, como: man.como, chk: man.conferir } : { onde: '', como: [], chk: [] };
  const ts = TT.filter(t => t.svc === v.id),
    ok = ts.filter(t => t.ok).length;
  const win = v.jan
    .map(
      w =>
        `${w.f != null ? M.frentes[w.f].nome + (w.faixa ? ' ' + w.faixa : '') + ': ' : ''}${fmtDate(w.a, false).slice(0, 5)} a ${fmtDate(Math.max(w.a, w.b - 0.01), false).slice(0, 5)}`
    )
    .join(' · ');
  const prod =
    v.meta && v.meta.produtividade
      ? ` · produtividade ${nf(v.meta.produtividade.valor, 0)} ${v.meta.produtividade.unidade}${v.meta.produtividade.ilustrativa ? ' (ilustrativa)' : ''}`
      : '';
  const steps = SVC.map(
    s =>
      `<button class="${s.id === v.id ? 'on' : ''}" data-man="${s.id}"><b>${s.id.startsWith('R') ? s.id : s.id.replace('S', '').replace(/^0/, '')}</b>${esc(curto(s.id) || s.nome)}</button>`
  ).join('');
  return `<div class="man"><div class="man-steps">${steps}</div>
  <article class="man-card"><header><span class="man-n">${v.id}</span><div><h3>${esc(v.nome)}</h3><p class="man-meta">${esc(v.norma)}${esc(prod)} · dias ${nf(v.a, 1)} a ${nf(v.b, 1)}</p><p class="man-meta">${esc(win)}</p></div></header>
  <div class="man-onde"><span>Onde</span>${esc(m.onde)}</div>
  <div class="man-grid"><div><h4>Como executar</h4><ol>${m.como.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
  <div class="man-side"><h4>Conferir antes de liberar</h4><ul class="man-chk">${m.chk.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <h4>Equipe e equipamentos</h4><p>${esc(v.efetivo)}</p><ul class="man-mat">${v.eq.map(([n, q]) => `<li><span>${esc(n)}</span><b>${q}</b></li>`).join('')}</ul>
  <h4>Liberação</h4><p>${esc(v.lib)}</p></div></div>
  <footer><span>${ts.length ? `${ts.length} ensaios vinculados · ${ok} conformes · ${ts.length - ok} não conformes` : 'Sem ensaios vinculados'}</span><button class="btn sm" data-goto="${v.a}">Ver no modelo ▶</button></footer></article></div>`;
}
