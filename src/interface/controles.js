// Controles da interface: vistas, camadas, cenário, velocidade, opções, barra 4D, modos, teclado e abas.
import { M, ST, D, acoes, on } from '../estado.js';
import { nf } from '../dominio/util.js';
import { fmtDate } from '../dominio/calendario.js';
import { P } from '../dominio/geometria.js';
import { $, lsGet } from './dom.js';
import { hideInfo, showInfo, selectTest } from './paineis.js';
import { openTab } from './abas.js';
import { cena, setView, trocarExagero, mostrarRotulos, camAt } from '../motor/index.js';
import { GAME, briefing, finishGame, missaoAtiva, setMode } from '../jogo/missao.js';

export function syncSpeed() {
  $('optSpd')
    .querySelectorAll('button')
    .forEach(x => x.setAttribute('aria-pressed', +x.dataset.spd === ST.speed));
}

// texto e estado do botão de reprodução
export function botaoTocar(onPlay) {
  $('play').setAttribute('aria-pressed', onPlay);
  $('play').textContent = onPlay ? '❚❚ Pausar' : missaoAtiva() && !GAME.started ? '▶ Iniciar missão' : '▶ Executar a obra';
}

export function initUI() {
  $('meta').textContent =
    `Trecho de ${P.L} m · pista de ${nf(P.W_RV, 1)} m · CBUQ 5 cm sobre base de 15 cm e sub-base de 20 cm · ${nf(M.fim, 0)} dias úteis a partir de ${fmtDate(0)}`;
  // vistas
  document.querySelectorAll('[data-view]').forEach(
    b =>
      (b.onclick = () => {
        document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
        setView(b.dataset.view);
      })
  );
  // camadas
  const LAYS = [
    ['grp', 'Modelo'],
    ['terreno', 'Terreno e terraplenagem', '#a3591c'],
    ['pavimento', 'Pavimento', '#3b4650'],
    ['usina', 'Usina de CBUQ', '#c7851a'],
    ['canteiro', 'Canteiro e estoques', '#728078'],
    ['equip', 'Equipamentos', '#5a6340'],
    ['grp', 'Informação'],
    ['ensaios', 'Pontos de ensaio', 'var(--ok)'],
    ['rotulos', 'Estacas e rótulos', '#d9a21b'],
    ['entorno', 'Vila Militar (entorno)', '#e4d6b0']
  ];
  $('layers').innerHTML = LAYS.map(([k, n, c]) =>
    k === 'grp'
      ? `<div class="grp">${n}</div>`
      : `<label class="layer"><input type="checkbox" data-lay="${k}" checked><span class="sw" style="--c:${c}"></span><span class="l">${n}</span></label>`
  ).join('');
  $('layers')
    .querySelectorAll('input')
    .forEach(
      i =>
        (i.onchange = () => {
          const k = i.dataset.lay;
          ST.lay[k] = i.checked;
          cena.LAY[k].visible = i.checked && !(ST.profile && ['entorno', 'canteiro', 'usina'].includes(k));
          if (k === 'rotulos') mostrarRotulos(i.checked);
        })
    );
  // cenário de não conformidade
  $('optCen').innerHTML = Object.entries(D.servicos.cenarios)
    .map(([k, v]) => `<option value="${k}">${v.nome}</option>`)
    .join('');
  $('optCen').onchange = e => {
    ST.cen = e.target.value;
    acoes.reconstruir();
  };
  $('optSpd')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          ST.speed = +b.dataset.spd;
          syncSpeed();
        })
    );
  $('optEx').onchange = e => {
    ST.exag = e.target.checked ? 3 : 1;
    trocarExagero();
    acoes.atualizar(true);
  };
  $('optFollow').onchange = e => {
    ST.follow = e.target.checked;
  };
  on('seguir', v => {
    const ck = $('optFollow');
    if (ck) ck.checked = v;
  });
  // eventos do motor
  on('info', (t, d) => showInfo(t, d));
  on('semSelecao', hideInfo);
  on('selecionarEnsaio', (t, jump) => selectTest(t, jump));
  // barra 4D
  $('play').onclick = () => {
    if (missaoAtiva() && !GAME.started) {
      briefing();
      return;
    }
    if (missaoAtiva() && GAME.finished) {
      finishGame();
      return;
    }
    if (!ST.playing && ST.day >= M.fim - 0.01 && !missaoAtiva()) ST.day = 0;
    acoes.tocar(!ST.playing);
  };
  $('stg').oninput = e => acoes.irParaDia(+e.target.value);
  document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => setMode(b.dataset.mode)));
  $('prev').onclick = () => acoes.saltarServico(-1);
  $('next').onclick = () => acoes.saltarServico(1);
  $('infox').onclick = hideInfo;
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      $('play').click();
    }
    if (e.key === 'ArrowRight') acoes.saltarServico(1);
    if (e.key === 'ArrowLeft') acoes.saltarServico(-1);
  });
  // abas
  document.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => openTab(b.dataset.tab)));
  ST.tab = 'seq';
  ST.man = 'S15';
  const savedTab = lsGet('vm4d.tab');
  if (savedTab && document.querySelector(`[data-tab="${savedTab}"]`)) {
    ST.tab = savedTab;
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === savedTab));
  }
  acoes.reconstruir(true);
  camAt(20, -30, -75, 60, 110);
}
