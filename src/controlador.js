// Controlador: liga domínio, motor, interface e jogo. Monta o modelo, avança o tempo e redesenha a cada quadro.
import { M, ST, D, acoes } from './estado.js';
import { clamp } from './dominio/util.js';
import { svcStarts } from './dominio/cronograma.js';
import { configurarDominio, montarModelo } from './dominio/modelo.js';
import { montarMotor, reconstruirMotor, atualizarMotor, quadro, renderizar, applyTheme } from './motor/index.js';
import { $, curto } from './interface/dom.js';
import { updateUI, renderGates, hideInfo } from './interface/paineis.js';
import { renderTab, openTab } from './interface/abas.js';
import { initUI, syncSpeed, botaoTocar } from './interface/controles.js';
import { carregarDecisoes } from './jogo/decisoes.js';
import { gameGate, opcoesEmVigor, setMode, missaoAtiva } from './jogo/missao.js';

// recalcula o modelo com as opções do cenário ou da missão
function rebuild() {
  Object.assign(M, montarModelo(D, M.q, opcoesEmVigor()));
}
function rebuildAll(first) {
  rebuild();
  $('stg').max = M.fim;
  if (first) ST.day = 28.42;
  ST.day = Math.min(ST.day, M.fim);
  if (!missaoAtiva()) $('cenDesc').textContent = D.servicos.cenarios[ST.cen].descricao;
  reconstruirMotor();
  ST.sel = null;
  hideInfo();
  renderGates();
  renderTab();
  tick(true);
}

function setPlaying(on) {
  ST.playing = on;
  botaoTocar(on);
}
function goDay(d) {
  setPlaying(false);
  d = clamp(d, 0, M.fim);
  ST.day = gameGate(d);
  tick(true);
}
function jumpSvc(dir) {
  const xs = svcStarts(M.svc).concat([M.fim]);
  const d = ST.day;
  let t = dir > 0 ? xs.find(x => x > d + 0.02) : [...xs].reverse().find(x => x < d - 0.02);
  if (t == null) t = dir > 0 ? M.fim : 0;
  goDay(t + (dir > 0 && t < M.fim ? 0.02 : 0));
}

let clk = 0,
  lastT = performance.now();
function tick(force) {
  const st = { d: ST.day };
  atualizarMotor(st, clk, force, curto);
  updateUI(force);
}
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (ST.playing) {
    clk += dt;
    const nd = gameGate(Math.min(M.fim, ST.day + dt * 0.45 * ST.speed));
    if (ST.playing) ST.day = nd;
    if (ST.day >= M.fim && ST.playing) setPlaying(false);
  }
  quadro(dt);
  tick(false);
  renderizar();
  requestAnimationFrame(loop);
}

export function iniciar(dados) {
  Object.assign(D, dados);
  Object.assign(acoes, {
    irParaDia: goDay,
    tocar: setPlaying,
    reconstruir: rebuildAll,
    atualizar: tick,
    saltarServico: jumpSvc,
    sincronizarVelocidade: syncSpeed
  });
  M.q = configurarDominio(D);
  carregarDecisoes();
  rebuild();
  montarMotor($('viewport'));
  initUI();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme();
    renderTab();
  });
  new MutationObserver(() => {
    applyTheme();
    renderTab();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const h = (location.hash || '').slice(1);
  if (h === 'missao') setMode('missao');
  else if (['sequencia', 'controle', 'laboratorio', 'usina', 'quantitativos', 'contexto', 'diario'].includes(h))
    openTab({ sequencia: 'seq', controle: 'ctrl', laboratorio: 'lab', usina: 'usina', quantitativos: 'quant', contexto: 'ctx', diario: 'diario' }[h]);
  requestAnimationFrame(loop);
}
