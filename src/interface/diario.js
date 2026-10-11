// Diário de obra gerado a partir do dia exibido: serviços, quantidades, efetivo, equipamentos, ensaios, liberações e ocorrências.
import { M, ST, D } from '../estado.js';
import { nf, clamp } from '../dominio/util.js';
import { fmtDate, fmtHour, estStr } from '../dominio/calendario.js';
import { esc } from './dom.js';
import { tempoNoDiario, ocorrenciasDaMissao } from '../jogo/missao.js';
import { quantidadeDaJanela } from '../dominio/cronograma.js';
import { estadoDoDesvio } from '../dominio/frentes.js';

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
    let ativoNoServico = false;
    for (const w of s.jan) {
      const L = w.b - w.a;
      const ov = Math.max(0, Math.min(b, w.b) - Math.max(a, w.a));
      const cura = w.cura && Math.min(b, w.cura[1]) > Math.max(a, w.cura[0]);
      if (ov <= 0 && !cura) continue;
      const frac = L > 0 ? ov / L : 0,
        fracAc = L > 0 ? clamp((d - w.a) / L, 0, 1) : 1;
      const q = quantidadeDaJanela(s, w, M.q);
      const di = s.meta && s.meta.diario;
      const onde = w.f != null ? `${M.frentes[w.f].nome}${w.faixa ? ' ' + w.faixa : ''}` : '';
      svcs.push({
        s,
        onde,
        txt:
          ov > 0 && q != null
            ? `${nf(q * frac, q * frac < 10 ? 1 : 0)} ${di.unidade} de ${di.texto} no dia · ${Math.round(fracAc * 100)} % da frente`
            : ov > 0
              ? `${Math.round(fracAc * 100)} % concluído`
              : 'Imprimação em cura, faixa interditada'
      });
      if (ov > 0) ativoNoServico = true;
    }
    if (ativoNoServico) {
      efet += (s.efetivo.match(/\d+/g) || []).reduce((x, y) => x + +y, 0);
      s.eq.forEach(([n, k]) => (eq[n] = Math.max(eq[n] || 0, k)));
    }
  }
  const ens = M.ensaios.filter(t => t.day >= a && t.day <= b);
  const libs = M.liberacoes.filter(g => g.day >= a && g.day <= b + 1e-6 && d >= g.day);
  const oc = [];
  ens
    .filter(t => !t.ok)
    .forEach(t =>
      oc.push(`Não conformidade${t.f != null ? ' (' + M.frentes[t.f].nome + ')' : ''}: ${t.nome} = ${t.v} ${t.u} (critério ${t.crit}). ${t.obs || ''}`.trim())
    );
  oc.push(...ocorrenciasDaMissao(a, b));
  const desvio = M.frentes.map(f => `${f.nome}: ${D.servicos.frentes.desvio.estados[estadoDoDesvio(f, Math.min(b, d))]}`).join(' · ');
  return { D: Dd, d, parcial: d < Dd + 1 - 1e-6 && d < END - 1e-6, svcs, efet, eq, ens, libs, oc, desvio, tempo: tempoNoDiario(Dd) || D.obra.diario.tempoBom };
}

export function tabDiario() {
  const x = diarioData();
  const OBRA = D.obra.obra;
  return `<div class="pane-head"><h2>Diário de obra</h2><p>Gerado a partir do dia exibido no modelo: serviços, quantidades, efetivo, equipamentos, ensaios, liberações e ocorrências. Avance a obra para preencher o dia seguinte.</p></div>
  <article class="diario"><header><div><h3>Diário de obra nº ${String(x.D + 1).padStart(3, '0')}</h3><div class="m">${esc(OBRA.titulo)} · ${esc(OBRA.local)}</div></div><div class="m">${fmtDate(x.D)}${x.parcial ? ` · parcial até ${fmtHour(x.d)}` : ''}<br>Efetivo no dia: ${x.efet} militares</div></header>
  <section><h4>Condições do tempo</h4><ul><li>${esc(x.tempo)}</li></ul></section>
  <section><h4>Tráfego nas frentes</h4><ul><li>${esc(x.desvio)}</li></ul></section>
  <section><h4>Serviços executados</h4><ul>${x.svcs.length ? x.svcs.map(v => `<li><b>${v.s.id}</b>${v.onde ? ' <span class="tag">' + esc(v.onde) + '</span>' : ''} ${esc(v.s.nome)}: ${esc(v.txt)}</li>`).join('') : '<li>Sem frente de serviço neste dia.</li>'}</ul></section>
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
    'TRÁFEGO NAS FRENTES',
    x.desvio,
    '',
    'SERVIÇOS EXECUTADOS'
  );
  x.svcs.forEach(v => L.push(`- ${v.s.id}${v.onde ? ' (' + v.onde + ')' : ''} ${v.s.nome}: ${v.txt}`));
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
