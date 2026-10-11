// Decisões da missão lidas de dados/decisoes.json e convertidas para o formato usado pelo jogo.
// Efeitos de cada alternativa: d = atraso (dias úteis), c = custo adicional (R$ mil), q = qualidade (pontos),
// n = conformidade e segurança (pontos). best: 2 = melhor decisão, 1 = aceitável, 0 = inadequada.
import { M, D } from '../estado.js';
import { diaDaDecisao } from '../dominio/missao.js';

const efeitos = e => ({ d: e.atraso, c: e.custo, q: e.qualidade, n: e.conformidade });

export let DECISOES = [];

export function carregarDecisoes() {
  DECISOES = D.decisoes.decisoes.map(dc => ({
    id: dc.id,
    svc: dc.servico,
    titulo: dc.titulo,
    ctx: dc.contexto,
    tempo: dc.tempoNoDiario,
    dados: dc.dados.map(x => [x.rotulo, x.valor]),
    // dia em que a decisão aparece no cronograma atual (null se a situação não ocorre)
    day: () => diaDaDecisao(dc.dia, M.svc, M.ensaios),
    ops: dc.opcoes.map(o => ({
      t: o.texto,
      best: o.avaliacao,
      ...efeitos(o.efeitos),
      fb: o.retorno,
      ...(o.opcoes ? { opt: o.opcoes } : {}),
      ...(o.consequencia
        ? { later: { regra: o.consequencia.dia, titulo: o.consequencia.titulo, txt: o.consequencia.texto, ...efeitos(o.consequencia.efeitos) } }
        : {})
    }))
  }));
  return DECISOES;
}
