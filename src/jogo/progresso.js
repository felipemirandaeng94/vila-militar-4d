// Progresso da missão guardado no navegador: a partida em andamento (para continuar depois) e o histórico de notas.
// Funções puras; a leitura e a escrita no localStorage ficam em jogo/missao.js.
//
// Partida salva: { versao, ordem: [ids na ordem das escolhas], escolhas: { id: { i, dia } }, vistos: [bool por
// consequência, na ordem em que foram criadas], dia, salvoEm }. As consequências não são guardadas: saem de novo das
// alternativas escolhidas, na mesma ordem.

export const VERSAO_SALVO = 1;
export const MAX_HISTORICO = 30;

/** Partida em andamento em formato para o localStorage. done: GAME.done; eventos: GAME.events; ordem: ids escolhidos. */
export function serializarPartida({ ordem, done, eventos, dia, agora = new Date() }) {
  return {
    versao: VERSAO_SALVO,
    ordem: ordem.filter(id => done[id]),
    escolhas: Object.fromEntries(ordem.filter(id => done[id]).map(id => [id, { i: done[id].i, dia: done[id].day }])),
    vistos: eventos.map(ev => !!ev.seen),
    dia,
    salvoEm: agora.toISOString()
  };
}

/**
 * Confere uma partida lida do localStorage contra as decisões atuais (os dados podem ter mudado desde que foi salva).
 * Devolve a partida limpa ou null se não servir. decisoes: [{ id, ops: [...] }].
 */
export function validarPartida(s, decisoes) {
  if (!s || typeof s !== 'object' || s.versao !== VERSAO_SALVO || !Array.isArray(s.ordem) || !s.escolhas) return null;
  const porId = Object.fromEntries(decisoes.map(dc => [dc.id, dc]));
  const ordem = [];
  for (const id of s.ordem) {
    const dc = porId[id],
      e = s.escolhas[id];
    // decisão removida dos dados, alternativa que não existe mais ou id repetido: a partida não vale
    if (!dc || !e || !Number.isInteger(e.i) || e.i < 0 || e.i >= dc.ops.length || !Number.isFinite(e.dia) || ordem.includes(id)) return null;
    ordem.push(id);
  }
  const nEventos = ordem.filter(id => porId[id].ops[s.escolhas[id].i].later).length;
  const vistos = Array.isArray(s.vistos) ? s.vistos.slice(0, nEventos).map(Boolean) : [];
  while (vistos.length < nEventos) vistos.push(false);
  return {
    versao: VERSAO_SALVO,
    ordem,
    escolhas: Object.fromEntries(ordem.map(id => [id, { i: s.escolhas[id].i, dia: s.escolhas[id].dia }])),
    vistos,
    dia: Number.isFinite(s.dia) ? Math.max(0, s.dia) : 0,
    salvoEm: typeof s.salvoEm === 'string' ? s.salvoEm : null
  };
}

/** Entradas válidas de um histórico lido do armazenamento: { data (ISO), nota, conceito, ... }. */
export const historicoValido = h => (Array.isArray(h) ? h.filter(x => x && Number.isFinite(x.nota) && typeof x.data === 'string') : []);

/** Acrescenta uma nota ao histórico (mais recente primeiro), limitado a MAX_HISTORICO entradas. */
export const registrarNota = (historico, entrada) => [entrada, ...historicoValido(historico)].slice(0, MAX_HISTORICO);

/** Lê um JSON do armazenamento sem falhar (texto ausente ou corrompido devolve o padrão). */
export function lerJson(txt, padrao) {
  if (!txt) return padrao;
  try {
    return JSON.parse(txt);
  } catch (e) {
    return padrao;
  }
}
