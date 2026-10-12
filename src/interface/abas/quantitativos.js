// Aba "Quantitativos": demolição, drenagem, subleito e pavimento, por frente e no total, e perfil longitudinal.
import { M, D } from '../../estado.js';
import { P } from '../../dominio/geometria.js';
import { nf } from '../../dominio/util.js';
import { estStr } from '../../dominio/calendario.js';
import { esc } from '../dom.js';
import { chart, card, lg } from '../graficos.js';

// cor do subleito no modelo 3D (pavimento.js): argila vermelho-amarronzada
const COR_SUBLEITO = '#8a4f36';

const LINHAS = [
  ['Demolição'],
  ['Fresagem do revestimento existente', 'areaFresagem', 'm²', 'DNIT 159/2011-ES'],
  ['Fresado (volume solto, empolamento 1,25)', 'volFresadoSolto', 'm³', 'DNIT 033/2021-ES'],
  ['Remoção de base e sub-base existentes', 'volRemocao', 'm³', 'DNIT 106/2009-ES (analogia)'],
  ['Bota-fora da remoção (volume solto)', 'volRemocaoSolta', 'm³', ''],
  ['Drenagem'],
  ['Vala (rede e ramais)', 'extVala', 'm', 'DNIT 023/2024-ES'],
  ['Escavação de vala', 'volEscavacaoVala', 'm³', ''],
  ['Berço', 'volBerco', 'm³', ''],
  ['Reaterro compactado', 'volReaterro', 'm³', ''],
  ['Bocas de lobo', 'nBocasDeLobo', 'un', 'DNIT 026/2025-ES'],
  ['Poços de visita', 'nPocosDeVisita', 'un', 'DNIT 030/2004-ES'],
  ['Meio-fio pré-moldado', 'extMeioFio', 'm', 'DNIT 020/2023-ES'],
  ['Sarjeta de concreto', 'extSarjeta', 'm', 'DNIT 018/2023-ES'],
  ['Subleito'],
  ['Substituição de solo (60 cm)', 'volSubstituicao', 'm³', 'DNIT 108/2009-ES (analogia)'],
  ['Regularização do subleito', 'areaRegularizacao', 'm²', 'DNIT 137/2010-ES'],
  ['Pavimento novo'],
  ['Sub-base de solo-brita, 20 cm', 'volSubBase', 'm³', 'DNIT 139/2010-ES'],
  ['Base de brita graduada, 15 cm', 'volBase', 'm³', 'DNIT 141/2022-ES'],
  ['Imprimação CM-30 (1,2 L/m²)', 'litrosImprimacao', 'L', 'DNIT 144/2014-ES'],
  ['Pintura de ligação RR-1C (emulsão)', 'litrosEmulsao', 'L', 'DNIT 145/2012-ES'],
  ['CBUQ faixa C-12,5, 5 cm', 'toneladasCBUQ', 't', 'DNIT 031/2024-ES'],
  ['CAP 50/70 (5,6 %)', 'toneladasCAP', 't', 'DNIT 031/2024-ES']
];

export function tabQuant() {
  const q = M.q,
    F = q.frentes,
    T = q.total;
  const casas = (k, v) => (k.startsWith('n') ? 0 : v < 100 ? 1 : 0);
  const cab = `<tr><th>Serviço</th>${F.map((f, i) => `<th class="n">${M.frentes[i].nome}<br><small>est. ${estStr(f.s0)} a ${estStr(f.s1)}</small></th>`).join('')}<th class="n">Total</th><th>Unid.</th><th>Norma</th></tr>`;
  const corpo = LINHAS.map(l =>
    l.length === 1
      ? `<tr class="tot"><td colspan="${F.length + 4}">${esc(l[0])}</td></tr>`
      : `<tr><td>${esc(l[0])}</td>${F.map(f => `<td class="n">${nf(f[l[1]], casas(l[1], f[l[1]]))}</td>`).join('')}<td class="n"><b>${nf(T[l[1]], casas(l[1], T[l[1]]))}</b></td><td class="m">${l[2]}</td><td class="m">${esc(l[3])}</td></tr>`
  ).join('');
  const tubos = Object.entries(T.tubos)
    .map(([dd, m]) => `<tr><td>Tubo de concreto ø ${dd} m</td><td class="n">${nf(m, 0)} m</td><td class="m">NBR 8890</td></tr>`)
    .join('');
  const fres = M.fresado.pct
    ? `<tr><td>Fresado reaproveitado no CBUQ (${M.fresado.pct} %)</td><td class="n">${nf(M.fresado.toneladas, 0)} t</td><td class="m">DNIT 033/2021-ES</td></tr>`
    : `<tr><td>Fresado reaproveitado no CBUQ</td><td class="n">0 t</td><td class="m">Definido na dosagem (missão)</td></tr>`;
  const ymin = Math.floor(Math.min(...q.rows.map(r => r.sg)) - 1),
    ymax = Math.ceil(Math.max(...q.rows.map(r => r.gr)) + 1);
  const prof = chart({
    w: 520,
    h: 250,
    x: [0, P.L],
    y: [ymin, ymax],
    xt: Array.from({ length: Math.floor(P.L / 200) + 1 }, (_, i) => i * 200),
    xf: v => 'est. ' + v / 20,
    yt: Array.from({ length: Math.floor((ymax - ymin) / 2) + 1 }, (_, i) => ymin + i * 2),
    xl: 'Estaca',
    yl: 'Cota (m)',
    lines: [
      { pts: q.rows.map(r => [r.s, r.gr]), c: 'var(--ink)', w: 2.4 },
      { pts: q.rows.map(r => [r.s, r.sg]), c: COR_SUBLEITO, dash: '5 4' }
    ]
  });
  return `<div class="pane-head"><h2>Quantitativos</h2><p>Reconstrução de ${nf(P.L / 1000, 1)} km da via existente, com pista de ${nf(P.W_RV, 1)} m e caixa do pavimento de ${nf(P.W_CX, 1)} m (pista, sarjetas e meios-fios). ${esc(D.obra.obra.aviso)}</p></div>
  <div class="kpis"><div class="kpi"><b>${nf(T.areaFresagem, 0)} m²</b><span>Pista fresada e reconstruída</span></div><div class="kpi"><b>${nf(T.extVala, 0)} m</b><span>Vala com tubo de concreto</span></div><div class="kpi"><b>${T.nBocasDeLobo} · ${T.nPocosDeVisita}</b><span>Bocas de lobo · poços de visita</span></div><div class="kpi"><b>${nf(T.extMeioFio, 0)} m</b><span>Meio-fio e sarjeta (cada)</span></div><div class="kpi"><b>${nf(T.toneladasCBUQ, 0)} t</b><span>CBUQ (${nf(T.volCBUQ, 1)} m³ × ${nf(D.obra.taxas.densidadeCBUQ, 2)} t/m³)</span></div></div>
  <h3 class="h3">Quantidades por frente</h3><div class="tbl"><table><thead>${cab}</thead><tbody>${corpo}</tbody></table></div>
  <div class="cols"><div>${card('Perfil longitudinal', 'Greide do pavimento (existente e novo) e fundo da caixa (subleito), 40 cm abaixo. Terreno fictício; o relevo real entra na Fase 3.', prof, lg('var(--ink)', 'Greide do pavimento') + lg(COR_SUBLEITO, 'Subleito'))}</div>
  <div>${card('Seção-tipo do pavimento novo', 'Espessuras fora de escala; abaulamento de 2 %. A sarjeta e o meio-fio ficam nos bordos da caixa.', secaoTipo())}
  <h3 class="h3">Tubos e fresado</h3><div class="tbl"><table><thead><tr><th>Item</th><th class="n">Quantidade</th><th>Referência</th></tr></thead><tbody>${tubos}${fres}</tbody></table></div></div></div>`;
}

function secaoTipo() {
  const W = 460,
    H = 230,
    cx = 230,
    sc = 24;
  const ys = { rv: 60, ba: 78, sb: 108, sg: 148 };
  const lay = (w, y0, y1, c, n, e) => {
    const h = (w / 2) * sc;
    return `<polygon points="${cx - h},${y1} ${cx},${y1 - 4} ${cx + h},${y1} ${cx + h},${y0} ${cx},${y0 - 4} ${cx - h},${y0}" fill="${c}" stroke="var(--panel)" stroke-width="1"/><text x="${cx + h + 30}" y="${(y0 + y1) / 2 + 4}" class="lt">${n}</text><text x="${cx - h - 30}" y="${(y0 + y1) / 2 + 4}" text-anchor="end" class="lt mono">${e}</text>`;
  };
  const hp = (P.W_RV / 2) * sc,
    hc = (P.W_CX / 2) * sc;
  let s = `<svg viewBox="0 0 ${W + 160} ${H}" class="chart secao" role="img" aria-label="Seção-tipo do pavimento">`;
  s += `<polygon points="${cx - hc - 60},${H - 20} ${cx - hc},${ys.sg} ${cx + hc},${ys.sg} ${cx + hc + 60},${H - 20}" fill="${COR_SUBLEITO}" opacity=".85"/>`;
  s += `<text x="${cx}" y="${H - 34}" text-anchor="middle" class="lt" style="fill:#f6efe8">Subleito regularizado (ISC ≥ 9 %)</text>`;
  s += lay(P.W_SB, ys.sb, ys.sg, '#b79a72', 'Sub-base solo-brita', '20 cm');
  s += lay(P.W_BA, ys.ba, ys.sb, '#9d9d97', 'Base brita graduada', '15 cm');
  s += `<line x1="${cx - hp}" x2="${cx + hp}" y1="${ys.ba - 0.5}" y2="${ys.ba - 0.5}" stroke="#5a3d26" stroke-width="2"/>`;
  s += lay(P.W_RV, ys.rv, ys.ba, '#2e3133', 'CBUQ faixa C-12,5', '5 cm');
  for (const sd of [-1, 1]) {
    const x0 = cx + sd * hp,
      x1 = cx + sd * (hp + P.W_SAR * sc),
      x2 = cx + sd * (hp + (P.W_SAR + P.W_MF) * sc);
    s += `<rect x="${Math.min(x0, x1)}" y="${ys.rv}" width="${Math.abs(x1 - x0)}" height="${ys.sg - ys.rv}" fill="#bdbab2"/><rect x="${Math.min(x1, x2)}" y="${ys.rv - 10}" width="${Math.abs(x2 - x1)}" height="${ys.sg - ys.rv + 10}" fill="#d6d3cb" stroke="var(--panel)"/>`;
  }
  s += `<text x="${cx}" y="${ys.rv - 18}" text-anchor="middle" class="lt">pista 7,00 m · sarjetas 0,40 m · meios-fios 0,15 m</text>`;
  return s + '</svg>';
}
