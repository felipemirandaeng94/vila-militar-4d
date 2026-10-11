// Geometria do trecho.
// s = estaqueamento ao longo do eixo (m), z = afastamento transversal (m, + = bordo direito), cotas reais (m).
// Os parâmetros vêm de dados/obra.json (configurarGeometria). O terreno natural é fictício e será trocado pelo real na Fase 3.
import { smooth, lerp, clamp } from './util.js';

// P é preenchido em configurarGeometria e lido por todas as camadas
export const P = {};

export function configurarGeometria(obra) {
  const g = obra.geometria,
    c = obra.canteiro;
  for (const k of Object.keys(P)) delete P[k];
  Object.assign(P, {
    L: g.extensao,
    EST: g.estaca,
    Y0: g.cotaReferencia,
    B: g.larguraPlataforma,
    TC: g.taludeCorte,
    TA: g.taludeAterro,
    W_SB: g.larguraSubBase,
    W_BA: g.larguraBase,
    W_RV: g.larguraRevestimento,
    LANE: g.larguraFaixa,
    E_SB: g.espSubBase,
    E_BA: g.espBase,
    E_RV: g.espRevestimento,
    E_REG: g.espRegularizacao,
    E_CF: g.espCamadaFinal,
    LIFT: g.espCamadaCorpo,
    LIFT_CF: g.espSubcamadaFinal,
    GR0: g.cotaGreideInicio,
    GRI: g.rampaGreide,
    FH: g.fatorHomogeneizacao,
    CANT: { s0: c.estacaInicio, s1: c.estacaFim, z0: c.afastamentoInicio, z1: c.afastamentoFim, cota: c.cota }
  });
  P.E_PAV = P.E_SB + P.E_BA + P.E_RV;
  P.halfB = P.B / 2;
  return P;
}

export function natRaw(s, z) {
  const g = Math.exp(-((z / 62) ** 2));
  return (
    22.0 + (2.6 * Math.exp(-(((s - 50) / 95) ** 2)) - 2.9 * Math.exp(-(((s - 215) / 75) ** 2))) * g - 0.012 * z + 0.25 * Math.sin(s / 37) * Math.cos(z / 29)
  );
}
// terreno natural, com o pátio do canteiro já nivelado (área militar existente)
export function nat(s, z) {
  const c = P.CANT,
    f = 12;
  const ws = smooth(c.s0 - f, c.s0, s) * (1 - smooth(c.s1, c.s1 + f, s));
  const wz = smooth(c.z0 - f, c.z0, z) * (1 - smooth(c.z1, c.z1 + f, z));
  return lerp(natRaw(s, z), c.cota, ws * wz);
}
export const gr = s => P.GR0 + P.GRI * s; // topo do revestimento (eixo)
export const sg = s => gr(s) - P.E_PAV; // topo da terraplenagem (subleito acabado)
export const dCut = (s, z) => sg(s) + Math.max(0, Math.abs(z) - P.halfB) / P.TC;
export const dFill = (s, z) => sg(s) - Math.max(0, Math.abs(z) - P.halfB) / P.TA;
// fator de transição nas extremidades (concordância com as vias existentes)
export const endW = s => smooth(-22, 0, s) * (1 - smooth(P.L, P.L + 22, s));
export const sgx = s => sg(clamp(s, 0, P.L));

// seção transversal na estaca s: áreas de corte e aterro (m²)
export function section(s) {
  let ac = 0,
    aa = 0;
  const dz = 0.05;
  for (let z = -30; z <= 30; z += dz) {
    const n = nat(s, z),
      c = dCut(s, z),
      f = dFill(s, z);
    if (n > c) ac += (n - c) * dz;
    else if (n < f) aa += (f - n) * dz;
  }
  return { ac, aa };
}
