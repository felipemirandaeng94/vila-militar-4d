// Diário de obra gerado a partir do dia exibido: serviços, quantidades, efetivo, equipamentos, ensaios, liberações e ocorrências.
import { M, ST, D } from '../estado.js';
import { nf, clamp } from '../dominio/util.js';
import { fmtDate, fmtHour, estStr } from '../dominio/calendario.js';
import { esc } from './dom.js';
import { tempoNoDiario, ocorrenciasDaMissao } from '../jogo/missao.js';

// quantidade do serviço para o diário: chave dos quantitativos ou valor fixo (retrabalhos)
function qtdDoServico(s) {
  const di = s.meta && s.meta.diario;
  if (!di) return null;
  return [di.quantitativo ? M.q[di.quantitativo] : di.valor, di.unidade, di.texto];
}

function diarioData() {
  const END = M.fim;
  const d = ST.day,
    Dd = Math.floor(Math.min(d, END - 1e-6)),
    a = Dd,
    b = Math.min(Dd + 1, d);
  const svcs = [];
  let efet = 0;
  const eq = {};
  for (const s of M.svc) {
    const ws = s.win ? s.win : Object.values(s.lanes);
    let frac = 0,
      fracAc = 0,
      ativo = false;
    for (const w of ws) {
      const L = w[1] - w[0];
      const ov = Math.max(0, Math.min(b, w[1]) - Math.max(a, w[0]));
      if (ov > 0) ativo = true;
      frac += ov / L / ws.length;
      fracAc += clamp((d - w[0]) / L, 0, 1) / ws.length;
    }
    const cura = s.cura && Math.min(b, s.cura[1]) > Math.max(a, s.cura[0]);
    if (!ativo && !cura) continue;
    const q = qtdDoServico(s);
    svcs.push({
      s,
      frac,
      fracAc,
      cura: cura && !ativo,
      txt:
        q && ativo
          ? `${nf(q[0] * frac, 0)} ${q[1]} de ${q[2]} no dia · ${Math.round(fracAc * 100)} % acumulado`
          : cura && !ativo
            ? 'Imprimação em cura, faixa interditada'
            : `${Math.round(fracAc * 100)} % concluído`
    });
    if (ativo) {
      efet += (s.efetivo.match(/\d+/g) || []).reduce((x, y) => x + +y, 0);
      s.eq.forEach(([n, k]) => (eq[n] = Math.max(eq[n] || 0, k)));
    }
  }
  const ens = M.ensaios.filter(t => t.day >= a && t.day <= b);
  const libs = M.liberacoes.filter(g => g.day >= a && g.day <= b + 1e-6 && d >= g.day);
  const oc = [];
  ens.filter(t => !t.ok).forEach(t => oc.push(`Não conformidade: ${t.nome} = ${t.v} ${t.u} (critério ${t.crit}). ${t.obs || ''}`.trim()));
  oc.push(...ocorrenciasDaMissao(a, b));
  return { D: Dd, d, parcial: d < Dd + 1 - 1e-6 && d < END - 1e-6, svcs, efet, eq, ens, libs, oc, tempo: tempoNoDiario(Dd) || D.obra.diario.tempoBom };
}

export function tabDiario() {
  const x = diarioData();
  const OBRA = D.obra.obra;
  return `<div class="pane-head"><h2>Diário de obra</h2><p>Gerado a partir do dia exibido no modelo: serviços, quantidades, efetivo, equipamentos, ensaios, liberações e ocorrências. Avance a obra para preencher o dia seguinte.</p></div>
  <article class="diario"><header><div><h3>Diário de obra nº ${String(x.D + 1).padStart(3, '0')}</h3><div class="m">${esc(OBRA.titulo)} · ${esc(OBRA.local)}</div></div><div class="m">${fmtDate(x.D)}${x.parcial ? ` · parcial até ${fmtHour(x.d)}` : ''}<br>Efetivo no dia: ${x.efet} militares</div></header>
  <section><h4>Condições do tempo</h4><ul><li>${esc(x.tempo)}</li></ul></section>
  <section><h4>Serviços executados</h4><ul>${x.svcs.length ? x.svcs.map(v => `<li><b>${v.s.id}</b> ${esc(v.s.nome)}: ${esc(v.txt)}</li>`).join('') : '<li>Sem frente de serviço neste dia.</li>'}</ul></section>
  <section><h4>Equipamentos em operação</h4><ul>${
    Object.keys(x.eq).length
      ? Object.entries(x.eq)
          .map(([n, k]) => `<li>${k}× ${esc(n)}</li>`)
          .join('')
      : '<li>Nenhum.</li>'
  }</ul></section>
  <section><h4>Ensaios realizados</h4><ul>${x.ens.length ? x.ens.map(t => `<li><span class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'Conforme' : 'Não conforme'}</span> · ${esc(t.nome)}${t.s != null ? ` (est. ${estStr(t.s)})` : ''}: ${esc(t.v)} ${esc(t.u)}</li>`).join('') : '<li>Nenhum ensaio no dia.</li>'}</ul></section>
  <section><h4>Liberações de camada</h4><ul>${x.libs.length ? x.libs.map(g => `<li>${g.id} · ${esc(g.nome)} emitido</li>`).join('') : '<li>Nenhuma liberação no dia.</li>'}</ul></section>
  <section><h4>Ocorrências</h4><ul>${x.oc.length ? x.oc.map(o => `<li>${esc(o)}</li>`).join('') : '<li>Sem ocorrências.</li>'}</ul></section>
  <div class="sig"><div>Engenheiro residente</div><div>Fiscalização</div></div></article>
  <div class="gm-act"><button class="btn" id="dCopy">Copiar o diário</button><span class="csub" id="dMsg" aria-live="polite"></span></div><textarea id="dTxt" hidden readonly aria-label="Texto do diário"></textarea>`;
}

export function diarioTexto() {
  const x = diarioData();
  const OBRA = D.obra.obra;
  const L = [];
  L.push(
    `DIÁRIO DE OBRA Nº ${String(x.D + 1).padStart(3, '0')} · ${fmtDate(x.D)}${x.parcial ? ' (parcial até ' + fmtHour(x.d) + ')' : ''}`,
    `${OBRA.titulo} · ${OBRA.local}`,
    `Efetivo: ${x.efet} militares`,
    '',
    'CONDIÇÕES DO TEMPO',
    x.tempo,
    '',
    'SERVIÇOS EXECUTADOS'
  );
  x.svcs.forEach(v => L.push(`- ${v.s.id} ${v.s.nome}: ${v.txt}`));
  if (!x.svcs.length) L.push('- Sem frente de serviço.');
  L.push('', 'EQUIPAMENTOS');
  Object.entries(x.eq).forEach(([n, k]) => L.push(`- ${k}x ${n}`));
  L.push('', 'ENSAIOS');
  x.ens.forEach(t => L.push(`- ${t.ok ? 'Conforme' : 'NÃO CONFORME'}: ${t.nome}${t.s != null ? ' (est. ' + estStr(t.s) + ')' : ''} = ${t.v} ${t.u}`));
  if (!x.ens.length) L.push('- Nenhum.');
  L.push('', 'LIBERAÇÕES');
  x.libs.forEach(g => L.push(`- ${g.id} ${g.nome} emitido`));
  if (!x.libs.length) L.push('- Nenhuma.');
  L.push('', 'OCORRÊNCIAS');
  x.oc.forEach(o => L.push('- ' + o));
  if (!x.oc.length) L.push('- Sem ocorrências.');
  L.push('', 'Engenheiro residente: ____________________   Fiscalização: ____________________');
  return L.join('\n');
}
