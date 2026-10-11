// Gráficos em SVG (linhas, pontos, barras, faixas) e cartões de gráfico.
import { esc } from './dom.js';

export function chart(o) {
  const W = o.w || 460,
    H = o.h || 260,
    m = { l: 52, r: 26, t: 16, b: 40 };
  const [x0, x1] = o.x,
    [y0, y1] = o.y;
  const lx = o.logx;
  const X = v => m.l + ((lx ? Math.log10(v) - Math.log10(x0) : v - x0) / (lx ? Math.log10(x1) - Math.log10(x0) : x1 - x0)) * (W - m.l - m.r);
  const Y = v => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.title || '')}">`;
  (o.yt || []).forEach(
    v =>
      (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-2)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${o.yf ? o.yf(v) : v}</text>`)
  );
  (o.xt || []).forEach(
    v =>
      (s += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line-2)"/><text x="${X(v)}" y="${H - m.b + 15}" text-anchor="middle">${o.xf ? o.xf(v) : v}</text>`)
  );
  (o.bands || []).forEach(
    b =>
      (s += `<rect x="${m.l}" width="${W - m.l - m.r}" y="${Y(Math.min(b[1], y1))}" height="${Math.max(0, Y(Math.max(b[0], y0)) - Y(Math.min(b[1], y1)))}" fill="${b[2] || 'var(--accent-soft)'}" opacity=".7"/>`)
  );
  (o.area || []).forEach(a => {
    const up = a.pts.map(p => `${X(p[0])},${Y(p[2])}`),
      dn = a.pts
        .slice()
        .reverse()
        .map(p => `${X(p[0])},${Y(p[1])}`);
    s += `<polygon points="${up.concat(dn).join(' ')}" fill="${a.c}" opacity=".18"/>`;
  });
  (o.hl || []).forEach(
    h =>
      (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(h[0])}" y2="${Y(h[0])}" stroke="${h[1] || 'var(--bad)'}" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${h[3] ? m.l + 6 : W - m.r - 4}" y="${Y(h[0]) + (h[4] || -5)}" text-anchor="${h[3] ? 'start' : 'end'}" style="fill:${h[1] || 'var(--bad)'}">${esc(h[2] || '')}</text>`)
  );
  (o.vl || []).forEach(
    h =>
      (s += `<line y1="${m.t}" y2="${H - m.b}" x1="${X(h[0])}" x2="${X(h[0])}" stroke="${h[1] || 'var(--brass)'}" stroke-dasharray="4 4" stroke-width="1.4"/><text x="${X(h[0]) + 4}" y="${m.t + 11}" style="fill:${h[1] || 'var(--brass)'}">${esc(h[2] || '')}</text>`)
  );
  (o.bars || []).forEach(b => {
    const bw = b.w || 10;
    b.pts.forEach(
      p =>
        (s += `<rect x="${X(p[0]) - bw / 2}" width="${bw}" y="${Y(p[1])}" height="${Y(y0) - Y(p[1])}" rx="2" fill="${p[2] || b.c}" opacity="${p[3] ? 0.35 : 1}"><title>${esc(p[4] || '')}</title></rect>`)
    );
  });
  (o.lines || []).forEach(l => {
    s += `<polyline points="${l.pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="${l.c}" stroke-width="${l.w || 2}" ${l.dash ? `stroke-dasharray="${l.dash}"` : ''}/>`;
    if (l.dots) l.pts.forEach(p => (s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.4" fill="var(--panel)" stroke="${l.c}" stroke-width="2"/>`));
  });
  (o.dots || []).forEach(
    d =>
      (s += `<circle cx="${X(d[0])}" cy="${Y(d[1])}" r="${d[4] || 4.5}" fill="${d[3] ? 'var(--panel)' : d[2]}" stroke="${d[2]}" stroke-width="1.6"><title>${esc(d[5] || '')}</title></circle>`)
  );
  s += `<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink-2)"/><line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" stroke="var(--ink-2)"/>`;
  if (o.xl) s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" class="ax">${esc(o.xl)}</text>`;
  if (o.yl) s += `<text transform="translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" class="ax">${esc(o.yl)}</text>`;
  return s + '</svg>';
}
export const card = (t, sub, body, leg = '') =>
  `<div class="ccard"><h4>${esc(t)}</h4>${sub ? `<p class="csub">${sub}</p>` : ''}${body}${leg ? `<div class="legend sm">${leg}</div>` : ''}</div>`;
export const lg = (c, n, k = 'dot') => `<span><i class="${k}" style="--c:${c}"></i>${esc(n)}</span>`;
