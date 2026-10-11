// Abas do painel inferior: troca de aba, montagem do conteúdo e ligação dos eventos.
import { M, ST, acoes } from '../estado.js';
import { $, svcById, lsSet } from './dom.js';
import { selectTest } from './paineis.js';
import { tabSeq } from './abas/sequencia.js';
import { tabCtrl, filterReg } from './abas/controle.js';
import { tabLab } from './abas/laboratorio.js';
import { tabUsina, calcFleet } from './abas/usina.js';
import { tabQuant } from './abas/quantitativos.js';
import { tabCtx } from './abas/contexto.js';
import { tabMissao } from './abas/missao.js';
import { tabDiario, diarioTexto } from './diario.js';
import { iniciarMissao, recomecarMissao } from '../jogo/missao.js';

const ABAS = { seq: tabSeq, ctrl: tabCtrl, lab: tabLab, usina: tabUsina, quant: tabQuant, ctx: tabCtx, missao: tabMissao, diario: tabDiario };

export function openTab(t) {
  ST.tab = t;
  lsSet('vm4d.tab', t);
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === t));
  renderTab();
}

// soft: atualização durante a reprodução (mantém rolagem e filtros)
export function renderTab(soft) {
  const p = $('pane');
  const sc = soft ? p.scrollTop : 0;
  const fn = ABAS[ST.tab] || tabSeq;
  if (soft && ST.tab === 'ctrl') {
    const f1 = $('fSvc') && $('fSvc').value,
      f2 = $('fSt') && $('fSt').value;
    p.innerHTML = fn();
    if (f1 != null) {
      $('fSvc').value = f1;
      $('fSt').value = f2;
    }
    bindTab();
    filterReg();
    return;
  }
  p.innerHTML = fn();
  bindTab();
  if (soft) p.scrollTop = sc;
}

const irParaOModelo = () => document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'center' });

function bindTab() {
  document.querySelectorAll('#pane [data-svc]').forEach(
    r =>
      (r.onclick = () => {
        ST.man = r.dataset.svc;
        const v = svcById(ST.man);
        acoes.irParaDia(v.a + 0.02);
        renderTab();
      })
  );
  document.querySelectorAll('#pane [data-man]').forEach(
    b =>
      (b.onclick = () => {
        ST.man = b.dataset.man;
        renderTab();
        const c = document.querySelector('.man-card');
        if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      })
  );
  document.querySelectorAll('#pane [data-goto]').forEach(
    b =>
      (b.onclick = () => {
        acoes.irParaDia(+b.dataset.goto + 0.02);
        irParaOModelo();
      })
  );
  document.querySelectorAll('#pane tr[data-t]').forEach(
    r =>
      (r.onclick = () => {
        selectTest(
          M.ensaios.find(t => t.id === r.dataset.t),
          true
        );
        irParaOModelo();
      })
  );
  document.querySelectorAll('#pane [data-gantt]').forEach(
    b =>
      (b.onclick = () => {
        ST.gantt = b.dataset.gantt;
        renderTab(true);
      })
  );
  if ($('fSvc')) {
    $('fSvc').onchange = filterReg;
    $('fSt').onchange = filterReg;
  }
  document.querySelectorAll('#pane [data-startgame]').forEach(
    b =>
      (b.onclick = () => {
        iniciarMissao();
        irParaOModelo();
      })
  );
  document.querySelectorAll('#pane [data-restart]').forEach(
    b =>
      (b.onclick = () => {
        recomecarMissao();
        irParaOModelo();
      })
  );
  const cp = $('dCopy');
  if (cp)
    cp.onclick = () => {
      const txt = diarioTexto();
      const ta = $('dTxt');
      const fall = () => {
        ta.hidden = false;
        ta.value = txt;
        ta.focus();
        ta.select();
        $('dMsg').textContent = 'Texto selecionado. Use Ctrl+C para copiar.';
      };
      try {
        navigator.clipboard.writeText(txt).then(() => {
          $('dMsg').textContent = 'Diário copiado.';
        }, fall);
      } catch (e) {
        fall();
      }
    };
  if ($('calc')) {
    $('calc')
      .querySelectorAll('input')
      .forEach(i => (i.oninput = calcFleet));
    calcFleet();
  }
}
