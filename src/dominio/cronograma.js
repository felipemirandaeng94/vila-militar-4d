// Cronograma: serviços de dados/servicos.json, com os retrabalhos ativados pelas opções do cenário ou da missão.
// Cada serviço tem janelas de execução (win) ou janelas por meia pista (lanes, BD/BE), em dias úteis.
// O formato interno (id, g, nome, win, lanes, cura, eq, lib...) é o mesmo usado pelo motor e pela interface.

const copia = o => JSON.parse(JSON.stringify(o));

// converte um serviço do JSON para o formato interno
export function servicoInterno(s, desloc = 0) {
  const o = { id: s.id, g: s.grupo };
  if (s.retrabalho) o.rework = 1;
  o.nome = s.nome;
  if (s.janelas) o.win = copia(s.janelas);
  if (s.janelasRelativas) o.win = s.janelasRelativas.map(w => w.map(v => v + desloc));
  if (s.faixas) o.lanes = copia(s.faixas);
  if (s.cura) o.cura = copia(s.cura);
  o.norma = s.norma;
  o.efetivo = s.efetivo;
  o.eq = s.equipamentos.map(e => [e.nome, e.qtd]);
  o.qtd = s.quantidade || '';
  o.lib = s.liberacao;
  // informações extras (não usadas no cálculo do cronograma)
  Object.defineProperty(o, 'meta', { value: { curto: s.curto, frente: s.frente, diario: s.diario }, enumerable: false });
  return o;
}

function instante(svc, ref) {
  const s = svc.find(x => x.id === ref.servico);
  const w = ref.faixa ? s.lanes[ref.faixa] : s.win[0];
  return ref.em === 'fim' ? w[1] : w[0];
}

export function buildSchedule(dadosServicos, opt = {}) {
  const svc = dadosServicos.servicos.map(s => servicoInterno(s));
  const shift = (ids, d) =>
    svc
      .filter(s => ids.includes(s.id))
      .forEach(s => {
        if (s.win) s.win = s.win.map(w => w.map(v => v + d));
        if (s.lanes) for (const k in s.lanes) s.lanes[k] = s.lanes[k].map(v => v + d);
        if (s.cura) s.cura = s.cura.map(v => v + d);
      });
  for (const rw of dadosServicos.retrabalhos || []) {
    if (!opt[rw.opcao]) continue;
    // instante de referência para as janelas relativas (lido antes de qualquer deslocamento deste retrabalho)
    const b0 = rw.referencia ? instante(svc, rw.referencia) : 0;
    for (const f of rw.faixas || []) svc.find(s => s.id === f.servico).lanes[f.faixa] = [b0 + f.janela[0], b0 + f.janela[1]];
    if (rw.falha) {
      const f = rw.falha;
      svc.find(s => s.id === f.servico).falha = { a: b0 + f.inicio, b: b0 + f.fim, s: f.extensao, rem: [b0 + f.remocao[0], b0 + f.remocao[1]] };
    }
    if (rw.deslocar) shift(rw.deslocar.servicos, rw.deslocar.dias);
    if (rw.inserir) {
      const novo = servicoInterno(rw.inserir.servico, b0);
      svc.splice(
        svc.findIndex(s => s.id === rw.inserir.antesDe),
        0,
        novo
      );
    }
  }
  for (const s of svc) {
    const ws = s.win ? s.win : Object.values(s.lanes);
    s.a = Math.min(...ws.map(w => w[0]));
    s.b = Math.max(...ws.map(w => w[1]), s.cura ? s.cura[1] : -1);
  }
  return svc;
}

export const fimDaObra = svc => Math.max(...svc.map(s => s.b));
export const servicoPorId = (svc, id) => svc.find(s => s.id === id);

// serviço em execução no dia d (janela ou meia pista)
export function activeSvc(svc, id, d) {
  const s = svc.find(x => x.id === id);
  if (!s) return null;
  if (s.win) {
    for (const w of s.win) if (d >= w[0] && d < w[1]) return { s, w };
    return null;
  }
  for (const k in s.lanes) {
    const w = s.lanes[k];
    if (d >= w[0] && d < w[1]) return { s, w, lane: k };
  }
  return null;
}

// lista de serviços ativos (ou em cura) no dia d, com o progresso na janela
export function activeList(svc, d) {
  const out = [];
  for (const s of svc) {
    let w = null,
      lane = null;
    if (s.win) w = s.win.find(x => d >= x[0] && d < x[1]);
    else
      for (const k in s.lanes)
        if (d >= s.lanes[k][0] && d < s.lanes[k][1]) {
          w = s.lanes[k];
          lane = k;
        }
    if (s.falha && d >= s.falha.a && d < s.falha.b) {
      w = [s.falha.a, s.falha.b];
      lane = 'BD';
    }
    if (w) out.push({ s, p: (d - w[0]) / (w[1] - w[0]), lane });
    else if (s.cura && d >= s.cura[0] && d < s.cura[1]) out.push({ s, p: (d - s.cura[0]) / (s.cura[1] - s.cura[0]), cura: 1 });
  }
  return out;
}

// inícios de todas as janelas (para saltar de serviço em serviço)
export function svcStarts(svc) {
  const xs = [];
  for (const s of svc) {
    if (s.win) s.win.forEach(w => xs.push(w[0]));
    else Object.values(s.lanes).forEach(w => xs.push(w[0]));
  }
  return [...new Set(xs)].sort((a, b) => a - b);
}

// progresso (0 a 1) da janela total de um serviço
export function winProg(svc, id, d) {
  const v = svc.find(x => x.id === id);
  if (!v) return 1;
  const w = v.win ? [v.win[0][0], v.win[v.win.length - 1][1]] : [v.a, v.b];
  return Math.min(1, Math.max(0, (d - w[0]) / (w[1] - w[0])));
}
