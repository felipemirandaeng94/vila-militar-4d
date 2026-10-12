// Regras dos efeitos de partículas e do som (Fase 8), sem dependência do three nem do DOM: testáveis no Vitest.
// O estado da obra decide cada efeito: poeira só em terra ou brita seca, vapor só sobre o CBUQ quente, jato do pipa e
// leque do espargidor só com o caminhão em serviço, fumaça da chaminé só com a usina produzindo.

// idade (dias úteis) até a qual o CBUQ recém-espalhado solta vapor (a massa sai da usina a 150-160 °C e perde o vapor
// visível em cerca de uma hora de um dia de 10 h)
export const VAPOR_DIAS = 0.1;
// idade (dias úteis) até a qual uma camada de solo ou de brita continua úmida pela água do pipa: o mesmo tempo de
// secagem do shader (superficies.js, uSecagem)
export const SECAGEM_DIAS = 0.8;
// trecho (m, ao longo do eixo) molhado em torno de um caminhão-pipa em serviço
export const ALCANCE_PIPA = 30;

/** Intensidade do vapor (0 a 1) do CBUQ com a idade dada (dias); 0 antes do lançamento e depois de esfriar. */
export function vapor(idade) {
  if (!(idade >= 0) || idade >= VAPOR_DIAS) return 0;
  const k = 1 - idade / VAPOR_DIAS;
  return k * k;
}

/**
 * Chão sob um ponto, a partir dos dias de execução das camadas na estaca (dias = { remocao, regularizacao,
 * substituicao, subBase, base, imprimacao, pintura, cbuq, sarjeta }; Infinity = ainda não executada) e da posição
 * (zona: 'pista' na largura do revestimento, 'lateral' na faixa da sarjeta e do meio-fio, 'desvio' na faixa de desvio
 * sem revestimento, 'canteiro' no pátio de brita, 'via' nas vias pavimentadas do entorno).
 * Devolve { tipo: 'terra' | 'brita' | 'pavimento', idade (dias desde a última camada de solo ou brita) }.
 */
export function chao(zona, dias, d) {
  const feito = k => dias[k] != null && d >= dias[k];
  if (zona === 'canteiro') return { tipo: 'brita', idade: Infinity };
  if (zona === 'desvio') return { tipo: 'terra', idade: Infinity };
  if (zona === 'via' || !feito('remocao')) return { tipo: 'pavimento', idade: Infinity };
  if (zona === 'lateral') return feito('sarjeta') ? { tipo: 'pavimento', idade: Infinity } : { tipo: 'terra', idade: d - dias.remocao };
  if (feito('cbuq') || feito('pintura') || feito('imprimacao')) return { tipo: 'pavimento', idade: Infinity };
  if (feito('base')) return { tipo: 'brita', idade: d - dias.base };
  if (feito('subBase')) return { tipo: 'brita', idade: d - dias.subBase };
  const ult = Math.max(...['remocao', 'substituicao', 'regularizacao'].filter(feito).map(k => dias[k]));
  return { tipo: 'terra', idade: d - ult };
}

/** Solo ou brita seca: levanta poeira. molhado = dentro do alcance de um pipa em serviço. */
export const levantaPoeira = (c, molhado) => c.tipo !== 'pavimento' && !molhado && !(c.idade < SECAGEM_DIAS);

/**
 * Partículas de poeira por segundo de uma máquina: cresce com a velocidade (m/s) até 24/s; as que trabalham o solo
 * parada (escavadeira, trator, motoniveladora, pá) levantam um mínimo de 6/s. taxa = fator do perfil de qualidade.
 */
export function taxaPoeira(velocidade, trabalhando, taxa = 1) {
  const v = Math.min(24, Math.max(0, velocidade) * 2.5);
  return Math.max(v, trabalhando ? 6 : 0) * taxa;
}

/**
 * Volume (0 a 1) de uma fonte de som pela distância à câmera (m): pleno até ref, depois cai com o inverso da distância
 * (atenuação de campo livre, 6 dB a cada dobro) e some além de max.
 */
export function volumePelaDistancia(dist, ref = 25, max = 600) {
  if (!(dist >= 0) || dist >= max) return 0;
  const v = dist <= ref ? 1 : ref / dist;
  // rampa nos últimos 20% do alcance: sem salto ao cruzar o limite
  return v * Math.min(1, (max - dist) / (0.2 * max));
}
