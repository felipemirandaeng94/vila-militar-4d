// Geometria do trecho em eixo reto (o traçado real entra na Fase 3).
// s = estaqueamento ao longo do eixo (m), z = afastamento transversal (m, + = bordo direito), cotas reais (m).
// Os parâmetros vêm de dados/obra.json (configurarGeometria). O terreno natural é fictício e será trocado pelo real na Fase 3.
import { smooth, lerp } from './util.js';

// P é preenchido em configurarGeometria e lido por todas as camadas
export const P = {};

export function configurarGeometria(obra) {
  const t = obra.trecho,
    sc = obra.secao,
    ex = obra.pavimentoExistente,
    nv = obra.pavimentoNovo,
    c = obra.canteiro;
  for (const k of Object.keys(P)) delete P[k];
  Object.assign(P, {
    L: t.extensao,
    EST: t.estaca,
    Y0: t.cotaReferencia,
    GR0: t.cotaGreideInicio,
    GRI: t.rampaGreide,
    W_RV: sc.larguraPista,
    LANE: sc.larguraFaixa,
    W_SAR: sc.larguraSarjeta,
    W_MF: sc.larguraMeioFio,
    H_MF: sc.alturaMeioFio,
    E_SAR: sc.espessuraSarjeta,
    EX_RV: ex.espRevestimento,
    EX_BA: ex.espBase,
    EX_SB: ex.espSubBase,
    E_SB: nv.espSubBase,
    E_BA: nv.espBase,
    E_RV: nv.espRevestimento,
    E_REG: nv.espRegularizacao,
    E_SUBST: nv.espSubstituicaoSolo,
    CANT: { s0: c.estacaInicio, s1: c.estacaFim, z0: c.afastamentoInicio, z1: c.afastamentoFim, cota: c.cota },
    DRN: obra.drenagem
  });
  // caixa do pavimento: pista, sarjetas e meios-fios; as camadas novas ficam entre as sarjetas
  P.W_CX = P.W_RV + 2 * (P.W_SAR + P.W_MF);
  P.W_SB = P.W_RV;
  P.W_BA = P.W_RV;
  P.E_PAV = P.E_SB + P.E_BA + P.E_RV;
  P.E_EX = P.EX_RV + P.EX_BA + P.EX_SB;
  // afastamento do eixo da sarjeta e do meio-fio (lado direito; o esquerdo é simétrico)
  P.Z_SAR = P.W_RV / 2 + P.W_SAR / 2;
  P.Z_MF = P.W_RV / 2 + P.W_SAR + P.W_MF / 2;
  return P;
}

export const gr = s => P.GR0 + P.GRI * s; // topo do pavimento (existente e novo) no eixo
export const sg = s => gr(s) - P.E_PAV; // subleito: fundo da caixa do pavimento

// terreno natural: passeios e quadras próximos da cota da via, com ondulações mais longe dela
export function nat(s, z) {
  const base = gr(Math.min(Math.max(s, 0), P.L)) + 0.12;
  const g = smooth(6, 45, Math.abs(z));
  const ond = (1.2 * Math.sin(s / 140 + 0.5) + 0.8 * Math.cos(s / 90) * Math.sin(z / 31) + 0.5 * Math.sin(z / 17)) * g;
  const v = base + ond - 0.01 * Math.max(0, Math.abs(z) - 6);
  // pátio do canteiro já nivelado (área militar existente)
  const c = P.CANT,
    f = 12;
  const ws = smooth(c.s0 - f, c.s0, s) * (1 - smooth(c.s1, c.s1 + f, s));
  const wz = smooth(c.z0 - f, c.z0, z) * (1 - smooth(c.z1, c.z1 + f, z));
  return lerp(v, c.cota, ws * wz);
}

// diâmetro da rede longitudinal na estaca s
export function diametroRede(s) {
  for (const d of P.DRN.diametros) if (s <= d.ateEstaca) return d.diametro;
  return P.DRN.diametros[P.DRN.diametros.length - 1].diametro;
}
// largura e profundidade da vala (a partir do topo do pavimento existente) para um tubo de diâmetro D
export const larguraVala = D => D + 2 * P.DRN.folgaLateralVala;
export const profundidadeVala = D => P.DRN.cobrimento + D + P.DRN.berco;

// bocas de lobo nas sarjetas dos dois lados, a cada espaçamento
export function bocasDeLobo() {
  const out = [];
  for (let s = P.DRN.primeiraBocaDeLobo; s < P.L; s += P.DRN.espacamentoBocasDeLobo)
    for (const lado of [1, -1]) out.push({ s, z: lado * P.Z_SAR, lado: lado > 0 ? 'BD' : 'BE', ramal: Math.abs(lado * P.Z_SAR - P.DRN.afastamentoRede) });
  return out;
}
// poços de visita na rede longitudinal
export function pocosDeVisita() {
  const out = [];
  for (let s = 0; s <= P.L + 1e-6; s += P.DRN.espacamentoPocosDeVisita) out.push({ s, z: P.DRN.afastamentoRede });
  return out;
}
