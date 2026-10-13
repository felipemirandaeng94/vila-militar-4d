// Aba "Missão": nota atual, relatório das decisões tomadas e das consequências, partida salva e histórico de notas.
import { D } from '../../estado.js';
import { nf } from '../../dominio/util.js';
import { fmtDate } from '../../dominio/calendario.js';
import { esc } from '../dom.js';
import { GAME, fxAll, missaoAtiva, partidaSalva, historicoDeNotas, tabelaHistorico } from '../../jogo/missao.js';
import { DECISOES } from '../../jogo/decisoes.js';

export function tabMissao() {
  const m = GAME.metrics();
  const BEST = D.decisoes.avaliacoes;
  const p = D.decisoes.pontuacao.pesos;
  const pc = v => Math.round(v * 100) + ' %';
  const rows = DECISOES.map((dc, i) => {
    const r = GAME.done[dc.id];
    if (!r)
      return `<li class="dl lock"><b>${i + 1}</b><div><h4>Decisão pendente</h4><p class="csub">${GAME.started ? 'Aparece quando a obra chegar a esse ponto.' : 'Inicie a missão para jogar.'}</p></div></li>`;
    return `<li class="dl"><b>${i + 1}</b><div><h4>${esc(dc.titulo)} <span class="tagb t${r.op.best}">${BEST[r.op.best]}</span></h4><p class="csub">${fmtDate(r.day)} · Você decidiu: ${esc(r.op.t)}</p><p>${esc(r.op.fb)}</p><div class="gm-fx">${fxAll(r.op)}</div></div></li>`;
  }).join('');
  const evs = GAME.events
    .filter(e => e.seen)
    .map(
      e =>
        `<li class="dl ev"><b>!</b><div><h4>${esc(e.titulo)}</h4><p class="csub">${fmtDate(e.day)} · consequência de: ${esc(e.from)}</p><p>${esc(e.txt)}</p><div class="gm-fx">${fxAll(e)}</div></div></li>`
    )
    .join('');
  const salvo = !GAME.started ? partidaSalva() : null;
  const hist = historicoDeNotas();
  const acoes = salvo
    ? `<button class="btn" data-continuar>Continuar a missão (${salvo.ordem.length} de ${DECISOES.length} decisões, ${fmtDate(salvo.dia)})</button><button class="btn ghost" data-restart>Começar do início</button>`
    : (missaoAtiva() ? '' : '<button class="btn" data-startgame>Iniciar a missão</button>') +
      (GAME.started ? '<button class="btn ghost" data-restart>Recomeçar</button>' : '');
  return `<div class="pane-head"><h2>Missão do engenheiro residente</h2><p>Jogue a obra como engenheiro residente. A cada decisão, o prazo, o custo, a qualidade e a conformidade mudam, e algumas escolhas voltam como consequência mais adiante. O progresso fica salvo neste navegador depois de cada decisão. A nota final pesa qualidade (${pc(p.qualidade)}), conformidade (${pc(p.conformidade)}), prazo (${pc(p.prazo)}) e custo (${pc(p.custo)}).</p></div>
  <div class="kpis"><div class="kpi"><b>${nf(m.nota, 1)}</b><span>Nota atual (0 a 10) · ${m.conceito}</span></div><div class="kpi"><b>${m.d > 0.01 ? '+' + nf(m.d, 1) + ' d' : 'no prazo'}</b><span>Prazo</span></div><div class="kpi"><b>R$ ${nf(m.c, 1)} mil</b><span>Custo adicional (ilustrativo)</span></div><div class="kpi"><b>${Math.round(m.q)} / ${Math.round(m.n)}</b><span>Qualidade / conformidade</span></div></div>
  <div class="gm-act">${acoes}</div>
  <ol class="dlist">${rows}${evs}</ol>
  <h3 class="h3">Histórico de notas</h3>${hist.length ? `${tabelaHistorico(hist)}<p class="csub">Guardado só neste navegador (${hist.length} ${hist.length > 1 ? 'missões concluídas' : 'missão concluída'}). <button class="lnk" data-limparhist>Apagar o histórico</button></p>` : '<p class="csub">Nenhuma missão concluída neste navegador. Ao terminar, a nota fica registrada aqui com a data.</p>'}`;
}
