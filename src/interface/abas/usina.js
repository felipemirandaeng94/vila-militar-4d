// Aba "Usina e transporte": componentes da usina, dimensionamento da frota e tíquetes simulados.
import { M, D } from '../../estado.js';
import { nf, rng, gauss } from '../../dominio/util.js';
import { fmtDate, fmtHourM } from '../../dominio/calendario.js';
import { $, esc } from '../dom.js';

export function tabUsina() {
  const R = rng(5);
  const cb = M.svc.find(s => s.meta && s.meta.representacao === 'cbuq');
  const porFaixa = M.q.frentes[0].toneladasCBUQ / 2;
  const tk = ['BD', 'BE'].map(ln => {
    const w = cb.jan.find(x => x.f === 0 && x.faixa === ln);
    const n = Math.ceil(porFaixa / 12);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const day = w.a + 0.05 + (i * (12 / 60)) / 10;
      rows.push([i + 1, fmtHourM(day), nf(11.4 + R() * 0.6, 2), Math.round(158 + gauss(R) * 1.8), Math.round(151 + gauss(R) * 1.8)]);
    }
    return { ln, rows };
  });
  return `<div class="pane-head"><h2>Usina e transporte do CBUQ</h2><p>A usina fica no próprio canteiro. O caminhão para sob o silo de massa, recebe a carga, segue coberto com lona pela avenida e pela meia pista livre, manobra à frente da vibroacabadora e descarrega de ré na caçamba da acabadora.</p></div>
  <div class="cols"><div><h3 class="h3">Componentes</h3><ul class="q comp">${D.obra.usina.map(u => `<li><b>${esc(u.nome)}</b><span>${esc(u.descricao)}</span></li>`).join('')}</ul></div>
  <div><h3 class="h3">Dimensionamento da frota</h3><div class="form" id="calc">
  <label>Produção da usina (t/h)<input type="number" id="cP" value="60" min="20" step="5"></label>
  <label>Carga por caminhão (t)<input type="number" id="cC" value="12" min="5" step="1"></label>
  <label>Distância usina → frente (km)<input type="number" id="cD" value="0.8" min="0.1" step="0.1"></label>
  <label>Velocidade média (km/h)<input type="number" id="cV" value="15" min="5" step="5"></label>
  <label>Descarga e manobra (min)<input type="number" id="cM" value="10" min="1" step="1"></label></div>
  <div class="readout calc" id="cOut"></div>
  <p class="note">A frota deve manter a vibroacabadora alimentada sem paradas, porque cada parada cria junta e degrau na superfície. Com a usina no início do trecho, a distância até a frente vai de algumas dezenas de metros (frente 1) a 1,6 km (frente 4). Aumente a distância para ver como a frota cresce nas frentes mais distantes ou com uma usina comercial.</p></div></div>
  <h3 class="h3">Tíquetes de pesagem e temperatura (simulados)</h3><div class="cols">${tk.map(t => `<div><div class="tbl"><table><thead><tr><th>Caminhão</th><th>Saída</th><th class="n">Massa (t)</th><th class="n">T saída (°C)</th><th class="n">T espalh. (°C)</th></tr></thead><tbody>${t.rows.map(r => `<tr><td class="m">${t.ln}-${String(r[0]).padStart(2, '0')}</td><td class="m">${r[1]}</td><td class="n">${r[2]}</td><td class="n">${r[3]}</td><td class="n ${r[4] < 145 ? 'bad' : ''}">${r[4]}</td></tr>`).join('')}</tbody></table></div><p class="csub">Frente 1 · ${t.ln === 'BD' ? 'faixa direita' : 'faixa esquerda'} · ${fmtDate(cb.jan.find(x => x.f === 0 && x.faixa === t.ln).a)}</p></div>`).join('')}</div>
  <h3 class="h3">Temperaturas de controle</h3><div class="tbl"><table><thead><tr><th>Ponto</th><th>Faixa</th><th>Frequência</th></tr></thead><tbody>
  <tr><td>CAP 50/70 no tanque e na bomba</td><td class="m">≈ 155 °C (limite 107 a 177 °C)</td><td>A cada 4 h</td></tr>
  <tr><td>Agregados na saída do secador</td><td class="m">10 a 15 °C acima do CAP, até 177 °C</td><td>A cada 4 h</td></tr>
  <tr><td>Massa na saída da usina</td><td class="m">≈ 158 °C</td><td>Cada caminhão</td></tr>
  <tr><td>Massa no espalhamento</td><td class="m">≥ 145 °C (± 5 °C do projeto)</td><td>Cada caminhão</td></tr></tbody></table></div>`;
}

export function calcFleet() {
  if (!$('cP')) return;
  const P_ = +$('cP').value,
    Cc = +$('cC').value,
    D_ = +$('cD').value,
    V = +$('cV').value,
    Mn = +$('cM').value;
  const load = (Cc / P_) * 60,
    go = (D_ / V) * 60,
    cyc = load + 2 * go + Mn,
    n = Math.ceil(cyc / load);
  const tLane = M.q.frentes[0].toneladasCBUQ / 2,
    hrs = tLane / P_;
  $('cOut').innerHTML =
    `Carga no silo: <b>${nf(load, 1)} min</b> · ida e volta: <b>${nf(2 * go, 1)} min</b> · ciclo: <b>${nf(cyc, 1)} min</b><br>Caminhões em ciclo: <b>${n}</b> + 1 reserva = <b>${n + 1}</b><br>Massa por faixa de uma frente de 400 m: <b>${nf(tLane, 0)} t</b> · <b>${Math.ceil(tLane / Cc)}</b> viagens · usina operando <b>${nf(hrs, 1)} h</b> por faixa`;
}
