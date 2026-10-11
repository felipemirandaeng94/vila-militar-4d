// Aba "Quantitativos": seções, diagrama de massas, perfil longitudinal e serviços de pavimentação.
import { M } from '../../estado.js';
import { P, nat, gr, sg } from '../../dominio/geometria.js';
import { nf } from '../../dominio/util.js';
import { chart, card, lg } from '../graficos.js';

export function tabQuant() {
  const q = M.q;
  const rows = q.rows
    .map(
      r =>
        `<tr><td class="m">${r.est}</td><td class="n">${nf(r.nat, 2)}</td><td class="n">${nf(r.gr, 2)}</td><td class="n">${nf(r.sg, 2)}</td><td class="n ${r.h > 0 ? '' : 'bad'}">${r.h > 0 ? nf(r.h, 2) : '−' + nf(-r.h, 2)}</td><td class="n">${nf(r.ac, 1)}</td><td class="n">${nf(r.aa, 1)}</td><td class="n">${nf(r.vc, 0)}</td><td class="n">${nf(r.va, 0)}</td><td class="n">${nf(r.cum, 0)}</td></tr>`
    )
    .join('');
  const mass = chart({
    w: 520,
    h: 250,
    x: [0, 300],
    y: [-1500, 2200],
    xt: [0, 60, 120, 180, 240, 300],
    xf: v => 'est. ' + v / 20,
    yt: [-1500, -1000, -500, 0, 500, 1000, 1500, 2000],
    yf: v => nf(v, 0),
    xl: 'Estaca',
    yl: 'Volume acumulado (m³)',
    hl: [[0, 'var(--ink-2)', '']],
    lines: [{ pts: q.rows.map(r => [r.s, r.cum]), c: 'var(--accent)', dots: 1 }]
  });
  const prof = chart({
    w: 520,
    h: 250,
    x: [0, 300],
    y: [18.5, 25.5],
    xt: [0, 60, 120, 180, 240, 300],
    xf: v => 'est. ' + v / 20,
    yt: [19, 20, 21, 22, 23, 24, 25],
    xl: 'Estaca',
    yl: 'Cota (m)',
    lines: [
      { pts: Array.from({ length: 151 }, (_, i) => [i * 2, nat(i * 2, 0)]), c: 'var(--c-esg)' },
      {
        pts: [
          [0, gr(0)],
          [300, gr(300)]
        ],
        c: 'var(--ink)',
        w: 2.4
      },
      {
        pts: [
          [0, sg(0)],
          [300, sg(300)]
        ],
        c: 'var(--muted)',
        dash: '5 4'
      }
    ]
  });
  return `<div class="pane-head"><h2>Quantitativos</h2><p>Volumes calculados pela média das áreas das seções, a cada 20 m, sobre o mesmo terreno do modelo 3D. Fator de homogeneização de ${nf(P.FH, 2)} entre o corte e o aterro compactado.</p></div>
  <div class="kpis"><div class="kpi"><b>${nf(q.Vc, 0)} m³</b><span>Corte (volume geométrico)</span></div><div class="kpi"><b>${nf(q.Va, 0)} m³</b><span>Aterro compactado</span></div><div class="kpi"><b>${nf(q.Vcf * P.FH, 0)} m³</b><span>Empréstimo para a camada final (${nf(q.Vcf, 0)} m³ compactados)</span></div><div class="kpi"><b>${nf(q.Vc - q.Vcorpo * P.FH, 0)} m³</b><span>Sobra do corte (bota-fora)</span></div><div class="kpi"><b>${nf(q.Trv, 0)} t</b><span>CBUQ (${nf(q.Vrv, 1)} m³ × 2,42 t/m³)</span></div></div>
  <div class="cgrid">${card('Perfil longitudinal', 'Terreno natural no eixo, greide do revestimento e topo da terraplenagem (40 cm abaixo).', prof, lg('var(--c-esg)', 'Terreno natural') + lg('var(--ink)', 'Greide (−0,75 %)') + lg('var(--muted)', 'Topo da terraplenagem'))}
  ${card('Diagrama de massas (Brückner)', 'Ramos ascendentes são corte; descendentes, aterro. O material do corte atende o corpo do aterro, e a camada final vem da jazida.', mass)}</div>
  <div class="cols"><div>${card('Seção-tipo do pavimento', 'Espessuras fora de escala; abaulamento de 2 %. A linha marrom entre a base e o CBUQ é a imprimação com a pintura de ligação.', secaoTipo())}</div>
  <div><h3 class="h3">Pavimentação</h3><div class="tbl"><table><thead><tr><th>Serviço</th><th class="n">Quantidade</th><th>Norma</th></tr></thead><tbody>
  <tr><td>Limpeza e destocamento</td><td class="n">${nf(q.Alimp, 0)} m²</td><td class="m">DNIT 104/2009-ES</td></tr>
  <tr><td>Regularização do subleito</td><td class="n">${nf(q.Areg, 0)} m²</td><td class="m">DNIT 137/2010-ES</td></tr>
  <tr><td>Sub-base de solo-brita, 20 cm</td><td class="n">${nf(q.Vsb, 0)} m³</td><td class="m">DNIT 139/2010-ES</td></tr>
  <tr><td>Base de brita graduada, 15 cm</td><td class="n">${nf(q.Vba, 0)} m³</td><td class="m">DNIT 141/2022-ES</td></tr>
  <tr><td>Imprimação CM-30 (1,2 L/m²)</td><td class="n">${nf(q.Aimp, 0)} m² · ${nf(q.Limp, 0)} L</td><td class="m">DNIT 144/2014-ES</td></tr>
  <tr><td>Pintura de ligação RR-1C (0,9 L/m² diluída)</td><td class="n">${nf(q.Apint, 0)} m² · ${nf(q.Lpint / 2, 0)} L de emulsão</td><td class="m">DNIT 145/2012-ES</td></tr>
  <tr><td>CBUQ faixa C-12,5, 5 cm</td><td class="n">${nf(q.Trv, 0)} t</td><td class="m">DNIT 031/2024-ES</td></tr>
  <tr><td>CAP 50/70 (5,6 %)</td><td class="n">${nf(q.Trv * q.teorLigante, 1)} t</td><td class="m">DNIT 031/2024-ES</td></tr></tbody></table></div></div></div>
  <h3 class="h3">Seções transversais e volumes</h3><div class="tbl"><table><thead><tr><th>Est.</th><th class="n">Terreno (m)</th><th class="n">Greide (m)</th><th class="n">Terraplenagem (m)</th><th class="n">h corte/aterro (m)</th><th class="n">Área corte (m²)</th><th class="n">Área aterro (m²)</th><th class="n">V corte (m³)</th><th class="n">V aterro (m³)</th><th class="n">Acumulado (m³)</th></tr></thead><tbody>${rows}<tr class="tot"><td>Total</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="n">${nf(q.Vc, 0)}</td><td class="n">${nf(q.Va, 0)}</td><td></td></tr></tbody></table></div>`;
}

function secaoTipo() {
  const W = 460,
    H = 230,
    cx = 230,
    sc = 26; // m -> px horizontal
  const ys = { rv: 60, ba: 78, sb: 108, sg: 148 };
  const lay = (w, y0, y1, c, n, e) => {
    const h = (w / 2) * sc;
    return `<polygon points="${cx - h},${y1} ${cx},${y1 - 4} ${cx + h},${y1} ${cx + h},${y0} ${cx},${y0 - 4} ${cx - h},${y0}" fill="${c}" stroke="var(--panel)" stroke-width="1"/><text x="${cx + h + 8}" y="${(y0 + y1) / 2 + 4}" class="lt">${n}</text><text x="${cx - h - 8}" y="${(y0 + y1) / 2 + 4}" text-anchor="end" class="lt mono">${e}</text>`;
  };
  let s = `<svg viewBox="0 0 ${W + 120} ${H}" class="chart secao" role="img" aria-label="Seção-tipo do pavimento">`;
  s += `<polygon points="${cx - 4.5 * sc - 60},${H - 20} ${cx - 4.5 * sc},${ys.sg} ${cx + 4.5 * sc},${ys.sg} ${cx + 4.5 * sc + 60},${H - 20}" fill="#b5784a" opacity=".55"/>`;
  s += `<text x="${cx}" y="${H - 34}" text-anchor="middle" class="lt">Subleito regularizado (ISC 9 %)</text>`;
  s += lay(8.0, ys.sb, ys.sg, '#b79a72', 'Sub-base solo-brita', '20 cm');
  s += lay(7.6, ys.ba, ys.sb, '#9d9d97', 'Base brita graduada', '15 cm');
  s += `<line x1="${cx - 3.8 * sc}" x2="${cx + 3.8 * sc}" y1="${ys.ba - 0.5}" y2="${ys.ba - 0.5}" stroke="#5a3d26" stroke-width="2"/>`;
  s += lay(7.0, ys.rv, ys.ba, '#2e3133', 'CBUQ faixa C-12,5', '5 cm');
  s += `<text x="${cx}" y="${ys.rv - 18}" text-anchor="middle" class="lt">pista 7,00 m · 2 faixas de 3,50 m · i = 2 %</text>`;
  return s + '</svg>';
}
