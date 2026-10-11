// Aba "Laboratório": compactação, GC por camada, dosagem Marshall, granulometria, deflexões e GC do CBUQ.
import { M, ST, D } from '../../estado.js';
import { nf } from '../../dominio/util.js';
import { estStr } from '../../dominio/calendario.js';
import { deflStats } from '../../dominio/ensaios.js';
import { chart, card, lg } from '../graficos.js';
import { P } from '../../dominio/geometria.js';

const EIXO = () => Array.from({ length: Math.floor(P.L / 200) + 1 }, (_, i) => i * 200);

export function tabLab() {
  const d = ST.day,
    TT = M.ensaios;
  const PROCTOR = D.ensaios.compactacao;
  const out = [];
  out.push(
    `<div class="pane-head"><h2>Laboratório</h2><p>Resultados de laboratório e de campo. Os pontos cheios já foram ensaiados no dia exibido; os vazados ainda estão previstos. Avance a obra para ver os gráficos se completarem.</p></div><div class="cgrid">`
  );
  // compactação
  out.push(
    card(
      'Curvas de compactação',
      'Massa específica aparente seca × umidade, com o ponto ótimo de cada material.',
      chart({
        x: [2, 24],
        y: [1.6, 2.36],
        xt: [4, 8, 12, 16, 20, 24],
        yt: [1.6, 1.8, 2.0, 2.2],
        yf: v => nf(v, 2),
        xl: 'Umidade (%)',
        yl: 'γd (g/cm³)',
        lines: PROCTOR.map(p => ({ pts: p.pontos, c: p.cor, dots: 1 })),
        dots: PROCTOR.map(p => [p.umidadeOtima, p.densidadeMaxima, p.cor, 0, 6, `${p.nome}: hót ${nf(p.umidadeOtima)} %, γd ${nf(p.densidadeMaxima, 3)}`])
      }),
      PROCTOR.map(p => lg(p.cor, `${p.nome} · hót ${nf(p.umidadeOtima)} %`)).join('')
    )
  );
  // GC por camada
  const LC = { vala: 'var(--c-esg)', subst: 'var(--c-tug)', reg: 'var(--c-ilum)', sb: 'var(--c-clima)', ba: 'var(--c-alim)' };
  const gcs = TT.filter(t => /^GC (do reaterro|da substituição|regulariza|sub-base|base)/.test(t.nome));
  out.push(
    card(
      'Grau de compactação das camadas',
      'Frasco de areia ao longo do trecho. O critério é GC ≥ 100 %; o ponto vermelho é a reprovação seguida de reensaio.',
      chart({
        x: [0, P.L],
        y: [96.5, 103.5],
        xt: EIXO(),
        xf: v => 'est. ' + v / 20,
        yt: [97, 98, 99, 100, 101, 102, 103],
        xl: 'Estaca',
        yl: 'GC (%)',
        hl: [[100, 'var(--bad)', 'mínimo 100 %', 1, 14]],
        dots: gcs.map(t => [
          t.s,
          parseFloat(t.v.replace(',', '.')),
          t.ok ? LC[t.layer] : 'var(--bad)',
          t.day > d,
          4.2,
          `${t.nome} · est. ${estStr(t.s)} · ${t.v} %`
        ])
      }),
      Object.entries({ vala: 'Reaterro de vala', subst: 'Substituição de solo', reg: 'Regularização', sb: 'Sub-base', ba: 'Base' })
        .map(([k, n]) => lg(LC[k], n))
        .join('')
    )
  );
  // Marshall
  const Ms = D.ensaios.dosagem;
  const rbv = Ms.vam.map((v, i) => ((v - Ms.vv[i]) / v) * 100);
  const xr = [4.4, 6.8],
    xt = [4.6, 5.1, 5.6, 6.1, 6.6],
    vl = [[5.6, 'var(--brass)', 'teor 5,6 %']];
  const mini = (t, y, yt, arr, band, yl) =>
    card(
      t,
      '',
      chart({
        w: 300,
        h: 200,
        x: xr,
        y,
        xt,
        yt,
        xf: v => nf(v, 1),
        xl: 'Teor de ligante (%)',
        yl,
        vl,
        bands: band ? [band] : [],
        lines: [{ pts: Ms.teor.map((v, i) => [v, arr[i]]), c: 'var(--accent)', dots: 1 }]
      })
    );
  out.push(`</div><h3 class="h3">Dosagem Marshall (75 golpes) · CAP 50/70 · faixa C-12,5</h3><div class="cgrid four">`);
  out.push(mini('Volume de vazios', [1.5, 7.5], [2, 3, 4, 5, 6, 7], Ms.vv, [3, 5], 'Vv (%)'));
  out.push(mini('Relação betume/vazios', [50, 85], [55, 65, 75, 85], rbv, [65, 75], 'RBV (%)'));
  out.push(mini('Estabilidade', [400, 1100], [500, 700, 900, 1100], Ms.estabilidade, [500, 1100], 'kgf'));
  out.push(mini('Vazios do agregado mineral', [13, 16], [13, 14, 15, 16], Ms.vam, [14, 16], 'VAM (%)'));
  out.push(`</div><div class="cgrid">`);
  // granulometria
  const G = D.ensaios.granulometria;
  const done0 = TT.find(t => t.gran === 0),
    done1 = TT.find(t => t.gran === 1);
  const gd = [];
  G.aberturas.forEach((mm, i) => {
    gd.push([mm, G.usina[0][i], 'var(--c-af)', !(done0 && done0.day <= d), 4, `BD: ${G.peneiras[i]} ${G.usina[0][i]} %`]);
    gd.push([mm, G.usina[1][i], 'var(--c-tug)', !(done1 && done1.day <= d), 4, `BE: ${G.peneiras[i]} ${G.usina[1][i]} %`]);
  });
  out.push(
    card(
      'Granulometria da mistura',
      'Curva de projeto com a faixa de trabalho (projeto ± tolerâncias da Tabela 3 da DNIT 031/2024-ES) e as amostras da produção.',
      chart({
        w: 520,
        x: [0.06, 25],
        y: [0, 100],
        logx: 1,
        xt: [0.075, 0.15, 0.3, 0.6, 1.18, 2.36, 4.75, 9.5, 19],
        xf: v => (v < 1 ? nf(v, v < 0.1 ? 3 : 2) : nf(v, v < 3 ? 2 : 1)),
        yt: [0, 20, 40, 60, 80, 100],
        xl: 'Abertura da peneira (mm, escala log)',
        yl: '% passante',
        area: [
          {
            c: 'var(--accent)',
            pts: G.aberturas.map((m, i) => [m, Math.max(0, G.projeto[i] - G.tolerancias[i]), Math.min(100, G.projeto[i] + G.tolerancias[i])])
          }
        ],
        lines: [{ pts: G.aberturas.map((m, i) => [m, G.projeto[i]]), c: 'var(--accent)' }],
        dots: gd
      }),
      lg('var(--accent)', 'Projeto e faixa de trabalho') + lg('var(--c-af)', 'Usina, faixa direita') + lg('var(--c-tug)', 'Usina, faixa esquerda')
    )
  );
  // deflexões
  const dfl = (grp, lim, title, sub) => {
    const ts = TT.filter(t => t.grp === grp);
    const doneT = ts.filter(t => t.day <= d);
    const st = doneT.length >= 2 ? deflStats(doneT.map(t => +t.v)) : null;
    const hl = [[lim, 'var(--bad)', `projeto ${lim}`]];
    if (st) hl.push([st.dc, 'var(--accent)', `Dc = ${nf(st.dc, 1)}`]);
    return card(
      title,
      sub + (st ? ` n = ${st.n}, D̄ = ${nf(st.m, 1)}, s = ${nf(st.sd, 1)}, k = ${nf(st.k, 2)}.` : ' Medições ainda não realizadas.'),
      chart({
        x: [0, P.L],
        y: [0, Math.max(80, lim + 10)],
        xt: EIXO(),
        xf: v => 'est. ' + v / 20,
        yt: [0, 20, 40, 60, 80],
        xl: 'Estaca',
        yl: 'D0 (0,01 mm)',
        hl,
        bars: [
          {
            c: 'var(--c-alim)',
            w: 11,
            pts: ts.map(t => [t.s, +t.v, t.z > 0 ? 'var(--c-alim)' : 'var(--c-clima)', t.day > d, `est. ${estStr(t.s)} ${t.z > 0 ? 'BD' : 'BE'}: ${t.v}`])
          }
        ]
      }),
      lg('var(--c-alim)', 'Faixa direita', 'dot') + lg('var(--c-clima)', 'Faixa esquerda')
    );
  };
  out.push(dfl('deflBase', 70, 'Deflexões no topo da base', 'Viga Benkelman a cada 20 m, alternando as faixas. Dc = D̄ + k·S.'));
  out.push(dfl('deflFin', 50, 'Deflexões no revestimento', 'Controle de aceitação do pavimento acabado.'));
  // GC CBUQ
  const cb = TT.filter(t => t.grp === 'gcCB');
  out.push(
    card(
      'Grau de compactação do CBUQ',
      'Corpos de prova extraídos a cada 100 m por faixa, em todas as frentes. A faixa aceitável é de 97 % a 100 %.',
      chart({
        x: [0, P.L],
        y: [95, 101.5],
        xt: EIXO(),
        xf: v => 'est. ' + v / 20,
        yt: [95, 96, 97, 98, 99, 100, 101],
        xl: 'Estaca',
        yl: 'GC (%)',
        bands: [[97, 100]],
        dots: cb.map(t => [
          t.s,
          parseFloat(t.v.replace(',', '.')),
          t.z > 0 ? 'var(--c-af)' : 'var(--c-tug)',
          t.day > d,
          5,
          `${t.nome}: ${t.v} % · espessura ${t.esp} cm`
        ])
      }),
      lg('var(--c-af)', 'Faixa direita') + lg('var(--c-tug)', 'Faixa esquerda')
    )
  );
  out.push('</div>');
  return out.join('');
}
