// Montagem do modelo da obra a partir dos dados: frentes, quantitativos, cronograma, ensaios e liberações.
import { P, configurarGeometria, configurarLocalReal } from './geometria.js';
import { configurarCalendario } from './calendario.js';
import { buildQuant } from './quantitativos.js';
import { buildSchedule, fimDaObra } from './cronograma.js';
import { dividirFrentes } from './frentes.js';
import { buildTests } from './ensaios.js';
import { montarLiberacoes } from './liberacoes.js';

// aplica os parâmetros do trecho, do local real (se houver) e do calendário e devolve os quantitativos por frente
// (não dependem do cenário)
export function configurarDominio(dados) {
  configurarGeometria(dados.obra);
  if (dados.local) configurarLocalReal(dados.local);
  configurarCalendario(dados.obra);
  return buildQuant(dados.obra, dividirFrentes(P.L, dados.servicos.frentes.tamanho));
}

// opt: opções de cronograma (falhas, retrabalhos e percentual de fresado) do cenário ou da missão
export function montarModelo(dados, q, opt) {
  const { svc, frentes } = buildSchedule(dados, q, opt);
  const r = buildTests(dados.ensaios, dados.normas.metodos, dados.obra, svc, frentes, opt);
  const pct = opt.fresadoPct || 0;
  return {
    q,
    opt,
    svc,
    frentes,
    ensaios: r.T,
    dBase: r.dBase,
    dFin: r.dFin,
    fim: fimDaObra(svc),
    liberacoes: montarLiberacoes(dados.servicos.liberacoes, svc, r.T, frentes),
    fresado: { pct, toneladas: (q.total.toneladasCBUQ * pct) / 100 }
  };
}
