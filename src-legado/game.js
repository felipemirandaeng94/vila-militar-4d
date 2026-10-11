// ==MISSÃO DO ENGENHEIRO RESIDENTE (modo jogo)==
// Cada decisão aparece no instante em que acontece na obra. Efeitos: d = atraso (dias úteis), c = custo adicional (R$ mil),
// q = qualidade (pontos), n = conformidade e segurança (pontos). best: 2 = melhor decisão, 1 = aceitável, 0 = inadequada.
const failDay = (re) => { const t = TT.find(x => !x.ok && re.test(x.nome)); return t ? t.day + 0.012 : null; };
const DECISOES = [
  { id: 'D1', svc: 'S01', day: () => 0.35, titulo: 'Base da usina de CBUQ',
    ctx: 'A usina contínua de 60 t/h chegou ao canteiro. O encarregado propõe assentar a usina direto sobre o pátio de brita e dispensar a bacia de contenção dos tanques de CAP, para ganhar três dias de montagem.',
    dados: [['Usina', '60 t/h, tambor contrafluxo'], ['Tanques de CAP', '2 × 30 m³ aquecidos'], ['Prazo da montagem', '8 dias úteis']],
    ops: [
      { t: 'Executar base de concreto nivelada, bacia de contenção e aguardar a licença de operação.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. A base nivelada mantém as balanças e os silos aferidos, e a bacia de contenção é exigida para armazenar ligante aquecido. A montagem cabe na janela prevista, em paralelo com a terraplenagem.' },
      { t: 'Assentar sobre o pátio de brita e dispensar a bacia, para ganhar tempo.', best: 0, d: 0, c: 0, q: -10, n: -25, fb: 'Inadequado. Recalques diferenciais desaferem as balanças dos silos e da bomba de CAP, e um vazamento de ligante sem contenção é passivo ambiental dentro da área militar.', later: { day: 15.5, titulo: 'Fiscalização ambiental', txt: 'A vistoria da licença de operação encontrou os tanques sem contenção e solo contaminado sob a bomba de CAP. A usina só pode operar depois da bacia e da remoção do solo.', d: 1, c: 24, q: 0, n: -10 } },
      { t: 'Não montar nada até sair a licença definitiva.', best: 1, d: 2, c: 0, q: 0, n: 0, fb: 'Aceitável, mas conservador. A licença é necessária para operar, não para montar. Esperar para começar a montagem empurra a calibração da usina para depois da base pronta.' }
    ] },
  { id: 'D2', svc: 'S03', day: () => 3.6, titulo: 'Material da camada final do aterro',
    ctx: 'O projeto pede ISC ≥ 9 % e expansão ≤ 2 % nos últimos 60 cm do aterro. O laboratório entregou três opções de material.',
    dados: [['Solo do corte (argila arenosa)', 'ISC 9 % · exp. 1,2 %'], ['Jazida de empréstimo, a 1,3 km', 'ISC 14 % · exp. 0,8 %'], ['Argila siltosa cinza da est. 11', 'ISC 7 % · exp. 2,6 %']],
    ops: [
      { t: 'Usar a jazida de empréstimo na camada final e o solo do corte no corpo do aterro.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. A jazida dá margem sobre o ISC de projeto e o solo do corte é bem aproveitado no corpo, onde a exigência é menor (ISC ≥ 2 %, expansão ≤ 4 %).' },
      { t: 'Usar o solo do corte também na camada final, porque atinge exatamente o ISC de projeto.', best: 1, d: 0, c: -18, q: -10, n: -5, fb: 'Aceitável no papel, arriscado na prática. Sem margem, qualquer variação do material reprova a camada. Exigiria ensaios de ISC mais frequentes.' },
      { t: 'Usar a argila siltosa da est. 11, que está mais perto.', best: 0, d: 0, c: -25, q: -20, n: -25, fb: 'Inadequado. A expansão de 2,6 % passa do limite de 2 % da DNIT 108/2009-ES e o ISC está abaixo do projeto.', later: { day: 16.3, titulo: 'Bombeamento na regularização', txt: 'Na regularização, o subleito entre as est. 10 e 13 bombeou sob o rolo depois de uma garoa. O material expansivo precisou ser removido e substituído.', d: 2, c: 45, q: -5, n: 0 } }
    ] },
  { id: 'D3', svc: 'S07', day: () => failDay(/^GC corpo do aterro, camada 4$/), titulo: 'GC reprovado no corpo do aterro',
    ctx: 'O frasco de areia na camada 4 deu GC = 97,6 %. A umidade de campo está em 21,6 %, para ótima de 18,2 %. Os outros quatro pontos da camada passaram com média de 101,3 %.',
    dados: [['GC medido', '97,6 % (mín. 100 %)'], ['Umidade', '21,6 % (hót + 3,4 %)'], ['Média da camada', '101,3 %']],
    ops: [
      { t: 'Aceitar, porque a média da camada passa de 100 %.', best: 0, d: 0, c: 0, q: -15, n: -20, fb: 'Inadequado. O ponto também está fora da faixa de umidade (hót ± 3 %), e a causa é conhecida. A média não protege o local fraco, que é onde o recalque vai aparecer.', later: { day: 31.2, titulo: 'Recalque no aterro', txt: 'O levantamento final mostrou um afundamento de 2 cm na est. 10+10, justamente sobre o ponto aceito. A fiscalização exigiu monitoramento e reparo localizado do revestimento.', d: 1, c: 30, q: -10, n: 0 } },
      { t: 'Aerar com a grade de discos, recompactar e reensaiar o ponto.', best: 2, d: 0, c: 2.5, q: 0, n: 0, fb: 'Correto. Com a umidade de volta à faixa, a recompactação resolve. O reensaio deu 100,9 % e a camada seguinte foi liberada no mesmo dia.' },
      { t: 'Lançar a próxima camada com 40 cm, para "compensar" com mais energia.', best: 0, d: 0, c: 0, q: -20, n: -25, fb: 'Inadequado. A DNIT 108/2009-ES limita o corpo do aterro a 30 cm compactados. Uma camada mais espessa compacta pior, sem corrigir a de baixo.' },
      { t: 'Parar a frente e esperar o solo secar sozinho.', best: 1, d: 1.5, c: 0, q: 0, n: 0, fb: 'Aceitável, mas lento. A aeração mecânica com grade resolve em horas o que o sol leva dias para fazer.' }
    ] },
  { id: 'D4', svc: 'S07', day: () => 10.2, titulo: 'Frente fria no fim da tarde',
    ctx: 'A meteorologia indica chuva forte à noite, com 35 mm previstos. Há uma camada de aterro recém-espalhada e ainda não compactada entre as est. 9 e 12.',
    dados: [['Chuva prevista', '35 mm entre 20 h e 4 h'], ['Camada exposta', '≈ 60 m, solta'], ['Horário', '15 h 30']],
    ops: [
      { t: 'Compactar e selar a camada com rolo liso, dar caimento transversal e abrir saídas para a água.', best: 2, d: 0, c: 1.5, q: 0, n: 0, fb: 'Correto. Superfície selada e com caimento escoa a chuva em vez de absorvê-la. No dia seguinte basta escarificar levemente e continuar.' },
      { t: 'Continuar lançando material até o fim do expediente.', best: 0, d: 1, c: 18, q: -10, n: -10, fb: 'Inadequado. O material solto absorve a chuva e fica muito acima da umidade ótima. Precisou ser removido ou aerado por um dia inteiro.' },
      { t: 'Suspender a frente por dois dias por precaução.', best: 1, d: 2, c: 0, q: 0, n: 0, fb: 'Aceitável, mas caro em prazo. A camada solta sem selagem continuaria exposta à chuva do mesmo jeito.' }
    ] },
  { id: 'D5', svc: 'S08', day: () => 12.25, titulo: 'Espessura da camada final',
    ctx: 'O encarregado propõe lançar a camada final em uma única subcamada de 40 cm, em vez de 20 cm, para ganhar um dia.',
    dados: [['Camada final', '60 cm (3 × 20 cm no projeto)'], ['Limite da especificação', '0,20 m por camada'], ['Rolo disponível', 'Pé-de-carneiro 11 t']],
    ops: [
      { t: 'Aceitar a camada de 40 cm.', best: 0, d: 0, c: 0, q: -15, n: -20, fb: 'Inadequado. A DNIT 108/2009-ES limita a camada final a 0,20 m. O rolo não transmite energia ao fundo de 40 cm, e o frasco de areia só mede os 15 cm de cima.' },
      { t: 'Manter as subcamadas de 20 cm, com ensaio em cada uma.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. Cada subcamada recebe energia uniforme e é controlada antes de ser coberta.' },
      { t: 'Aceitar 40 cm, mas com ensaio de GC dobrado no topo.', best: 0, d: 0, c: 1, q: -12, n: -15, fb: 'Inadequado. Mais ensaios no topo não medem o fundo da camada, onde está o problema.' }
    ] },
  { id: 'D6', svc: 'S09', day: () => SVC.find(s => s.id === 'S09').win[0][1] - 0.15, titulo: 'Pressão para liberar o subleito',
    ctx: 'Quatro dos cinco pontos de GC da regularização estão conformes. O último, na est. 13+10, ainda está no laboratório (cerca de 2 h). O comando pede que a sub-base comece hoje.',
    dados: [['Pontos conformes', '4 de 5'], ['Cotas', '−1,8 a +2,4 cm (tol. ± 3 cm)'], ['Resultado pendente', 'est. 13+10']],
    ops: [
      { t: 'Emitir o BLC-1 agora, para todo o trecho.', best: 0, d: 0, c: 0, q: -5, n: -20, fb: 'Inadequado. Liberar sem o último ensaio quebra a cadeia de liberação. Se o ponto reprovar, a sub-base terá de ser removida.' },
      { t: 'Liberar só as est. 0 a 10, já ensaiadas, e o restante quando sair o último resultado.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. A liberação parcial por segmento é registrada no BLC, a frente não para e nenhuma camada é coberta sem ensaio.' },
      { t: 'Aguardar o último resultado e liberar tudo de uma vez.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. O atraso é de poucas horas e o BLC sai completo.' }
    ] },
  { id: 'D7', svc: 'S12', day: () => failDay(/^GC base$/), titulo: 'GC da base reprovado',
    ctx: 'Na est. 9+00, bordo esquerdo, o frasco de areia deu GC = 98,1 %. A umidade de campo está 1,6 % abaixo da ótima. As deflexões da base ainda não foram medidas nesse segmento.',
    dados: [['GC medido', '98,1 % (mín. 100 %)'], ['Umidade', '4,2 % (hót 5,8 % ± 1 %)'], ['Próximo serviço', 'Imprimação']],
    ops: [
      { t: 'Aceitar e confiar que a deflexão vai passar.', best: 0, d: 0, c: 0, q: -15, n: -20, fb: 'Inadequado. A deflexão não substitui o grau de compactação: são critérios independentes da DNIT 141/2022-ES.', later: { day: 30.6, titulo: 'Deflexão alta e trilha de roda', txt: 'No controle final, a est. 9+00 BE deu deflexão de 61 × 0,01 mm (acima do projeto) e marca de trilha de roda. O CBUQ e a base do segmento foram refeitos.', d: 2, c: 62, q: -10, n: 0 } },
      { t: 'Escarificar o segmento, umedecer, recompactar e reensaiar antes de imprimar.', best: 2, d: 0, c: 4, q: 0, n: 0, opt: { rwBase: 1 }, fb: 'Correto. O retrabalho de 20 m custa um dia útil, e o reensaio deu 100,8 %. A imprimação e o CBUQ passam para o dia seguinte.' },
      { t: 'Compensar aumentando o CBUQ para 6 cm nesse trecho.', best: 0, d: 0, c: 8, q: -10, n: -15, fb: 'Inadequado. Alterar a espessura do revestimento muda o projeto sem corrigir a base, e cria degrau na superfície.' }
    ] },
  { id: 'D8', svc: 'S13', day: () => SVC.find(s => s.id === 'S13').cura[0] + 0.6, titulo: 'Tráfego sobre a imprimação',
    ctx: 'A imprimação está em cura. O comando da guarnição pede a via liberada amanhã cedo para o deslocamento de uma coluna de viaturas até a área de formatura.',
    dados: [['Cura mínima', '≈ 72 h'], ['Tempo decorrido', '≈ 14 h'], ['Rota alternativa', 'Avenida existente, +900 m']],
    ops: [
      { t: 'Liberar a via, porque o ligante já penetrou.', best: 0, d: 0, c: 6, q: -10, n: -10, fb: 'Inadequado. Antes da cura, os pneus arrancam a película e levam ligante para a via. A imprimação teve de ser reaplicada nos trechos danificados.' },
      { t: 'Manter a interdição e sinalizar o desvio pela avenida existente.', best: 2, d: 0, c: 0.5, q: 0, n: 0, fb: 'Correto. A cura é preservada e o deslocamento das viaturas acontece pelo desvio sinalizado, combinado com o comando.' },
      { t: 'Espalhar pó de pedra e liberar só viaturas leves, em baixa velocidade.', best: 1, d: 0, c: 2, q: -3, n: 0, fb: 'Aceitável em emergência. O pó de pedra protege a película, mas o excesso precisa ser varrido antes da pintura de ligação.' }
    ] },
  { id: 'D9', svc: 'S15', day: () => failDay(/Rotarex\), 1ª amostra/), titulo: 'Teor de ligante fora da tolerância',
    ctx: 'A primeira amostra da produção deu 6,05 % de ligante (Rotarex). O projeto é 5,6 % ± 0,3 %. Um caminhão (≈ 28 m da faixa direita) já foi espalhado e compactado.',
    dados: [['Teor medido', '6,05 %'], ['Faixa aceita', '5,3 a 5,9 %'], ['Massa já aplicada', '≈ 12 t']],
    ops: [
      { t: 'Seguir produzindo e corrigir a bomba de CAP nos próximos caminhões.', best: 0, d: 0, c: 0, q: -20, n: -20, fb: 'Inadequado. A massa já aplicada fica com vazios baixos e tende a exsudar. A produção sem correção comprovada também mantém o risco.', later: { day: 31.0, titulo: 'Exsudação na faixa direita', txt: 'No controle final, o segmento 0+00 a 1+10 BD apresentou exsudação e Vv abaixo de 3 % nos corpos de prova. O trecho foi fresado e refeito.', d: 1.5, c: 35, q: -10, n: 0 } },
      { t: 'Parar a usina, recalibrar a bomba de CAP e fresar o trecho já aplicado.', best: 2, d: 0, c: 12, q: 0, n: 0, opt: { rwCbuq: 1 }, fb: 'Correto. A produção só volta com novo ensaio conforme. A faixa direita passa para o dia seguinte e o segmento fresado é refeito.' },
      { t: 'Seguir produzindo e reduzir as passadas do rolo, para não fechar os vazios.', best: 0, d: 0, c: 0, q: -25, n: -25, fb: 'Inadequado. Compactar menos não corrige o excesso de ligante e reprova o grau de compactação, que precisa ficar entre 97 % e 100 %.' }
    ] },
  { id: 'D10', svc: 'S15', day: () => SVC.find(s => s.id === 'S15').lanes.BD[1] + 0.03, titulo: 'Abertura da faixa ao tráfego',
    ctx: 'A faixa direita acabou de ser compactada. O comando quer passar as viaturas blindadas por ela agora, para liberar a outra faixa à pavimentação de amanhã.',
    dados: [['Temperatura da massa', '≈ 95 °C'], ['Ponto de amolecimento do CAP', '49,5 °C'], ['Viaturas', 'Blindadas sobre rodas']],
    ops: [
      { t: 'Liberar imediatamente após a última passada do rolo.', best: 0, d: 0, c: 14, q: -15, n: -10, fb: 'Inadequado. A massa quente deforma sob carga pesada e fica marcada. A DNIT 031/2024-ES só admite tráfego com a massa abaixo do ponto de amolecimento do ligante.' },
      { t: 'Liberar quando a temperatura medida cair abaixo do ponto de amolecimento.', best: 2, d: 0, c: 0, q: 0, n: 0, fb: 'Correto. Em poucas horas a massa esfria, a temperatura é conferida com termômetro e a faixa é liberada com segurança.' },
      { t: 'Manter a faixa fechada por 7 dias.', best: 1, d: 0, c: 5, q: 0, n: 0, fb: 'Aceitável, mas desnecessário. O desvio prolongado atrapalha a rotina da guarnição sem ganho para o pavimento.' }
    ] }
];

const GAME = {
  on: false, started: false, done: {}, events: [], idx: 0, best: null,
  opt() { const o = { failBase: 1, failCbuq: 1 }; for (const k in this.done) Object.assign(o, this.done[k].op.opt || {}); return o; },
  // próxima parada: decisão pendente ou consequência pendente
  queue() {
    const out = [];
    for (const dc of DECISOES) if (!this.done[dc.id]) { const d = dc.day(); if (d != null) out.push({ k: 'dec', d, dc }); }
    for (const ev of this.events) if (!ev.seen) out.push({ k: 'ev', d: ev.day, ev });
    return out.sort((a, b) => a.d - b.d);
  },
  nextStop() { const q = this.queue(); return q.length ? q[0] : null; },
  metrics() {
    let d = Math.max(0, END - 34), c = 0, q = 100, n = 100;
    for (const k in this.done) { const o = this.done[k].op; d += o.d; c += o.c; q += o.q; n += o.n; }
    for (const ev of this.events) if (ev.seen) { d += ev.d; c += ev.c; q += ev.q; n += ev.n; }
    q = clamp(q, 0, 100); n = clamp(n, 0, 100);
    const inev = (OPT.rwBase ? 1 : 0) + (OPT.rwCbuq ? 1 : 0); // retrabalho correto: atraso não penaliza a nota
    const ps = clamp(100 - 15 * Math.max(0, d - inev), 0, 100), cs = clamp(100 - Math.max(0, c) / 1.5, 0, 100);
    const nota = (0.35 * q + 0.35 * n + 0.15 * ps + 0.15 * cs) / 10;
    return { d, c, q, n, nota, conceito: nota >= 9 ? 'Excelente' : nota >= 8 ? 'Muito bom' : nota >= 6.5 ? 'Bom' : nota >= 5 ? 'Regular' : 'Insuficiente' };
  }
};
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const fx = (v, u, inv) => { if (!v) return ''; const good = inv ? v > 0 : v < 0; return `<span class="fx ${good ? 'g' : 'b'}">${v > 0 ? '+' : '−'}${nf(Math.abs(v), Number.isInteger(v) ? 0 : 1)} ${u}</span>`; };
const fxAll = o => [fx(o.d, 'dia' + (Math.abs(o.d) > 1 ? 's' : '')), fx(o.c, 'mil R$'), fx(o.q, 'qualidade', 1), fx(o.n, 'conformidade', 1)].join('') || '<span class="fx g">sem impacto</span>';
const BEST = ['Inadequada', 'Aceitável', 'Melhor decisão'];

function setMode(m) {
  GAME.on = m === 'missao';
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  document.body.classList.toggle('mission', GAME.on);
  $('optCen').disabled = GAME.on; $('cenDesc').textContent = GAME.on ? 'Na missão, as não conformidades aparecem como decisões, e o retrabalho só acontece se você decidir por ele.' : CENARIOS[CEN].desc;
  $('hud').hidden = !GAME.on;
  if (GAME.on) { if (!GAME.started) briefing(); }
  else { $('gm').hidden = true; rebuildAll(); }
  if (ST.tab === 'missao') renderTab();
}
function resetGame() { GAME.done = {}; GAME.events = []; GAME.started = false; }
function briefing() {
  const best = lsGet('vm4d.best');
  gm(`<p class="gm-eye">Missão · engenheiro residente</p><h3>Via interna da Vila Militar</h3>
  <p>Você é o engenheiro residente da obra. Tem <b>34 dias úteis</b> para entregar 300 m de via em CBUQ, com a terraplenagem, a usina no canteiro e todo o controle tecnológico.</p>
  <p>Ao longo da obra aparecem <b>10 decisões</b>, no momento em que acontecem: ensaios reprovados, chuva, pressão do comando, propostas de atalho. Cada escolha muda o prazo, o custo, a qualidade e a conformidade com as normas. Algumas consequências só aparecem semanas depois.</p>
  <ul class="gm-rules"><li>A linha do tempo não avança além da próxima decisão.</li><li>Decisões com retrabalho aparecem no modelo 3D e no cronograma.</li><li>No fim, você recebe a nota e o conceito da missão.</li></ul>
  ${best ? `<p class="gm-best">Sua melhor nota neste navegador: <b>${esc(best)}</b></p>` : ''}
  <div class="gm-act"><button class="btn" id="gmGo">Iniciar missão</button><button class="btn ghost" id="gmBack">Voltar a explorar</button></div>`);
  $('gmGo').onclick = () => { resetGame(); GAME.started = true; rebuildAll(); ST.day = 0; ST.speed = 2; syncSpeed(); $('gm').hidden = true; setPlaying(true); camAt(30, -20, -80, 70, 120); };
  $('gmBack').onclick = () => setMode('explorar');
}
function gm(html) { $('gmc').innerHTML = html; $('gm').hidden = false; $('gmc').scrollTop = 0; const b = $('gmc').querySelector('button'); if (b) b.focus({ preventScroll: true }); }
function showStop(stop) {
  setPlaying(false); ST.day = stop.d; tick(true);
  if (stop.k === 'ev') {
    const ev = stop.ev;
    gm(`<p class="gm-eye bad">Consequência · ${fmtDate(ev.day)} · ${fmtHour(ev.day)}</p><h3>${esc(ev.titulo)}</h3><p>${esc(ev.txt)}</p><p class="gm-orig">Origem: ${esc(ev.from)}</p><div class="gm-fx">${fxAll(ev)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`);
    $('gmOk').onclick = () => { ev.seen = true; $('gm').hidden = true; updateHud(); setPlaying(true); if (ST.tab === 'missao') renderTab(); };
    return;
  }
  const dc = stop.dc, n = DECISOES.indexOf(dc) + 1, sv = svcById(dc.svc);
  gm(`<p class="gm-eye">Decisão ${n} de ${DECISOES.length} · ${fmtDate(stop.d)} · ${fmtHour(stop.d)} · ${esc(sv ? CURTO[sv.id] : '')}</p><h3>${esc(dc.titulo)}</h3><p>${esc(dc.ctx)}</p>
  <dl class="gm-dados">${dc.dados.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  <div class="gm-ops">${dc.ops.map((o, i) => `<button class="gm-op" data-op="${i}"><b>${'ABCD'[i]}</b><span>${esc(o.t)}</span></button>`).join('')}</div>`);
  $('gmc').querySelectorAll('[data-op]').forEach(b => b.onclick = () => choose(dc, +b.dataset.op, stop.d));
}
function choose(dc, i, day) {
  const op = dc.ops[i]; GAME.done[dc.id] = { i, op, day };
  if (op.later) GAME.events.push(Object.assign({ from: dc.titulo + ' (decisão ' + (DECISOES.indexOf(dc) + 1) + ')' }, op.later));
  if (op.opt) { rebuildAll(); ST.day = day; }
  updateHud(); tick(true);
  gm(`<p class="gm-eye ${op.best === 2 ? 'ok' : op.best ? '' : 'bad'}">${BEST[op.best]}</p><h3>${esc(dc.titulo)}</h3><p class="gm-you">Você decidiu: ${esc(op.t)}</p><p>${esc(op.fb)}</p><div class="gm-fx">${fxAll(op)}</div><div class="gm-act"><button class="btn" id="gmOk">Continuar a obra</button></div>`);
  $('gmOk').onclick = () => { $('gm').hidden = true; setPlaying(true); };
  if (ST.tab === 'missao') renderTab();
}
function finishGame() {
  setPlaying(false); GAME.finished = true; const m = GAME.metrics();
  const prev = parseFloat((lsGet('vm4d.best') || '0').replace(',', '.')); if (m.nota > prev) lsSet('vm4d.best', nf(m.nota, 1));
  const nb = Object.values(GAME.done).filter(x => x.op.best === 2).length;
  gm(`<p class="gm-eye">Missão concluída · ${fmtDate(END)}</p><h3>Nota ${nf(m.nota, 1)} · ${m.conceito}</h3>
  <div class="hud-grid">${hudItems(m)}</div>
  <p>${nb} de ${DECISOES.length} decisões foram as melhores possíveis. ${m.d > 0.01 ? `A obra terminou com ${nf(m.d, 1)} dia(s) útil(eis) de atraso${(OPT.rwBase || OPT.rwCbuq) ? ', incluindo o retrabalho que você mandou fazer; esse atraso não reduz a nota' : ''}.` : 'A obra terminou no prazo.'}</p>
  <div class="gm-act"><button class="btn" id="gmRe">Jogar de novo</button><button class="btn ghost" id="gmRev">Ver o relatório das decisões</button><button class="btn ghost" id="gmEx">Voltar a explorar</button></div>`);
  $('gmRe').onclick = () => { resetGame(); GAME.finished = false; briefing(); };
  $('gmRev').onclick = () => { $('gm').hidden = true; openTab('missao'); document.querySelector('.sheet').scrollIntoView({ behavior: 'smooth' }); };
  $('gmEx').onclick = () => { resetGame(); GAME.finished = false; setMode('explorar'); };
  if (ST.tab === 'missao') renderTab();
}
function hudItems(m) {
  const bar = (v, k) => `<span class="hbar ${v < 60 ? 'b' : v < 85 ? 'w' : ''}"><i style="width:${v}%"></i></span>`;
  return `<div class="hi"><span>Prazo</span><b class="${m.d > 0.01 ? 'bad' : ''}">${m.d > 0.01 ? '+' + nf(m.d, 1) + ' d' : 'no prazo'}</b></div>
  <div class="hi"><span>Custo adicional</span><b class="${m.c > 20 ? 'bad' : ''}">${m.c >= 0 ? '' : '−'}R$ ${nf(Math.abs(m.c), 1)} mil</b></div>
  <div class="hi"><span>Qualidade</span><b>${Math.round(m.q)}</b>${bar(m.q)}</div>
  <div class="hi"><span>Conformidade</span><b>${Math.round(m.n)}</b>${bar(m.n)}</div>`;
}
function updateHud() { if (!GAME.on) return; const m = GAME.metrics(); const nd = Object.keys(GAME.done).length; $('hud').innerHTML = `<div class="hud-t">Missão · decisão ${Math.min(nd + 1, DECISOES.length)} de ${DECISOES.length}</div><div class="hud-grid">${hudItems(m)}</div>`; }

// controle do avanço durante a missão
function gameGate(newDay) {
  if (!GAME.on || !GAME.started || GAME.finished) return newDay;
  const st = GAME.nextStop();
  if (st && newDay >= st.d) { showStop(st); return st.d; }
  if (!st && newDay >= END - 0.001) { ST.day = END; tick(true); finishGame(); return END; }
  return newDay;
}

function tabMissao() {
  const m = GAME.metrics();
  const rows = DECISOES.map((dc, i) => {
    const r = GAME.done[dc.id];
    if (!r) return `<li class="dl lock"><b>${i + 1}</b><div><h4>Decisão pendente</h4><p class="csub">${GAME.started ? 'Aparece quando a obra chegar a esse ponto.' : 'Inicie a missão para jogar.'}</p></div></li>`;
    return `<li class="dl"><b>${i + 1}</b><div><h4>${esc(dc.titulo)} <span class="tagb t${r.op.best}">${BEST[r.op.best]}</span></h4><p class="csub">${fmtDate(r.day)} · Você decidiu: ${esc(r.op.t)}</p><p>${esc(r.op.fb)}</p><div class="gm-fx">${fxAll(r.op)}</div></div></li>`;
  }).join('');
  const evs = GAME.events.filter(e => e.seen).map(e => `<li class="dl ev"><b>!</b><div><h4>${esc(e.titulo)}</h4><p class="csub">${fmtDate(e.day)} · consequência de: ${esc(e.from)}</p><p>${esc(e.txt)}</p><div class="gm-fx">${fxAll(e)}</div></div></li>`).join('');
  return `<div class="pane-head"><h2>Missão do engenheiro residente</h2><p>Jogue a obra como engenheiro residente. A cada decisão, o prazo, o custo, a qualidade e a conformidade mudam, e algumas escolhas voltam como consequência mais adiante. A nota final pesa qualidade (35 %), conformidade (35 %), prazo (15 %) e custo (15 %).</p></div>
  <div class="kpis"><div class="kpi"><b>${nf(m.nota, 1)}</b><span>Nota atual (0 a 10) · ${m.conceito}</span></div><div class="kpi"><b>${m.d > 0.01 ? '+' + nf(m.d, 1) + ' d' : 'no prazo'}</b><span>Prazo</span></div><div class="kpi"><b>R$ ${nf(m.c, 1)} mil</b><span>Custo adicional (ilustrativo)</span></div><div class="kpi"><b>${Math.round(m.q)} / ${Math.round(m.n)}</b><span>Qualidade / conformidade</span></div></div>
  <div class="gm-act">${GAME.on ? '' : '<button class="btn" data-startgame>Iniciar a missão</button>'}${GAME.started ? '<button class="btn ghost" data-restart>Recomeçar</button>' : ''}</div>
  <ol class="dlist">${rows}${evs}</ol>`;
}
