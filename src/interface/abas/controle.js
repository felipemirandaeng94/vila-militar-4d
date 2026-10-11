// Aba "Controle tecnológico": plano de controle e registro dos ensaios até o dia exibido.
import { M, ST, D } from '../../estado.js';
import { fmtDate, estStr } from '../../dominio/calendario.js';
import { $, esc } from '../dom.js';

export function tabCtrl() {
  const d = ST.day,
    TT = M.ensaios,
    SVC = M.svc;
  const done = TT.filter(t => t.day <= d);
  const nc = done.filter(t => !t.ok).length;
  const gOk = M.liberacoes.filter(g => d >= g.day).length;
  const opts = SVC.filter(s => TT.some(t => t.svc === s.id))
    .map(s => `<option value="${s.id}">${s.id} · ${esc(s.nome.split(':')[0])}</option>`)
    .join('');
  return `<div class="pane-head"><h2>Controle tecnológico</h2><p>O plano de controle define, para cada serviço, o ensaio, a norma, a frequência e o critério de aceitação. O registro abaixo é preenchido conforme a obra avança no modelo. Clique em um ensaio para vê-lo na pista.</p></div>
  <div class="kpis"><div class="kpi"><b>${done.length} de ${TT.length}</b><span>Ensaios realizados até o dia</span></div><div class="kpi"><b class="ok">${done.length - nc}</b><span>Conformes</span></div><div class="kpi"><b class="${nc ? 'bad' : ''}">${nc}</b><span>Não conformes (com reensaio)</span></div><div class="kpi"><b>${gOk} de ${M.liberacoes.length}</b><span>Liberações de camada emitidas</span></div></div>
  <h3 class="h3">Plano de controle</h3>
  <div class="tbl"><table><thead><tr><th>Serviço</th><th>Controle</th><th>Método</th><th>Frequência</th><th>Critério de aceitação</th></tr></thead><tbody>${D.ensaios.plano.map(r => `<tr><td class="m">${r.servico}</td><td>${esc(r.controle)}</td><td>${esc(r.metodo)}</td><td>${esc(r.frequencia)}</td><td>${esc(r.criterio)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">${esc(D.ensaios.notaPlano || '')}</p>
  <h3 class="h3">Registro de ensaios</h3>
  <div class="form"><label>Serviço<select id="fSvc"><option value="">Todos</option>${opts}</select></label><label>Situação<select id="fSt"><option value="">Todas</option><option value="ok">Conforme</option><option value="bad">Não conforme</option><option value="fut">Previsto</option></select></label></div>
  <div class="tbl reg"><table><thead><tr><th>Nº</th><th>Data</th><th>Serviço</th><th>Ensaio</th><th>Local</th><th class="n">Resultado</th><th>Critério</th><th>Situação</th></tr></thead><tbody>${TT.map(
    t => {
      const fut = t.day > d;
      return `<tr class="click${ST.sel === t ? ' sel' : ''}" data-t="${t.id}" data-svc="${t.svc}" data-st="${fut ? 'fut' : t.ok ? 'ok' : 'bad'}"><td class="m">${t.id}</td><td class="m">${fmtDate(t.day, false).slice(0, 5)}</td><td class="m">${t.svc}</td><td>${esc(t.nome)}</td><td class="m">${t.s != null ? (t.f != null ? M.frentes[t.f].nome + ' · ' : '') + 'est. ' + estStr(t.s) + ' ' + (t.z > 1 ? 'BD' : t.z < -1 ? 'BE' : 'eixo') : (t.f != null ? M.frentes[t.f].nome + ' · ' : '') + (t.tipo === 'usina' ? 'usina' : 'laboratório')}</td><td class="n">${fut ? '—' : esc((t.v + ' ' + t.u).trim())}</td><td>${esc(t.crit)}</td><td>${fut ? '<span class="muted">previsto</span>' : t.ok ? '<span class="ok">conforme</span>' : '<span class="bad">não conforme</span>'}</td></tr>`;
    }
  ).join('')}</tbody></table></div>`;
}

export function filterReg() {
  const a = $('fSvc') ? $('fSvc').value : '',
    b = $('fSt') ? $('fSt').value : '';
  document.querySelectorAll('.reg tbody tr').forEach(r => (r.hidden = (a && r.dataset.svc !== a) || (b && r.dataset.st !== b)));
}
