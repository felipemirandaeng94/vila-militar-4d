// Montagem do modelo da obra a partir dos dados: cronograma, frentes, ensaios e liberações.
import { configurarGeometria } from './geometria.js';
import { configurarCalendario } from './calendario.js';
import { buildQuant } from './quantitativos.js';
import { buildSchedule, fimDaObra } from './cronograma.js';
import { buildFronts } from './frentes.js';
import { buildTests } from './ensaios.js';
import { montarLiberacoes } from './liberacoes.js';

// aplica os parâmetros do trecho e do calendário e devolve os quantitativos (não dependem do cenário)
export function configurarDominio(dados) {
  configurarGeometria(dados.obra);
  configurarCalendario(dados.obra);
  return buildQuant(dados.obra.taxas);
}

// opt: opções de cronograma (falhas e retrabalhos) do cenário ou da missão
export function montarModelo(dados, q, opt) {
  const svc = buildSchedule(dados.servicos, opt);
  const frentes = buildFronts(svc, q);
  const r = buildTests(dados.ensaios, dados.normas.metodos, svc, q, opt, frentes);
  return {
    q,
    opt,
    svc,
    frentes,
    ensaios: r.T,
    dBase: r.dBase,
    dFin: r.dFin,
    fim: fimDaObra(svc),
    liberacoes: montarLiberacoes(dados.servicos.liberacoes, svc, r.T)
  };
}
