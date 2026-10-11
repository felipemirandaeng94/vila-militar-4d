// Geometria do trecho. s = estaqueamento ao longo do eixo (m), z = afastamento transversal (m, + = bordo direito), cotas (m).
// Os parâmetros vêm de dados/obra.json (configurarGeometria). Com o local real (configurarLocal, Fase 3), o eixo segue a via
// existente, o terreno vem do relevo real e o greide acompanha a via existente; sem ele, eixo reto e terreno fictício.
import { smooth, lerp, clamp } from './util.js';
import { LOCAL, configurarLocal, localDeObra, obraDeLocal, cotaTerreno, greideLocal, temTerreno } from './local.js';

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
  // referência do arranjo interno do canteiro (as posições de contêineres, usina e estoques são relativas a ela)
  P.CANT_REF = { s0: P.CANT.s0, z0: P.CANT.z0 };
  // meia largura da pista existente (com o local real, a avenida pode ser mais larga que a caixa da obra)
  P.Z_VIA = P.W_CX / 2;
  configurarLocal(null, P.L);
  return P;
}

// local real: eixo, terreno e canteiro confirmado (dados.local, carregado de public/local/)
export function configurarLocalReal(local) {
  configurarLocal(local, P.L);
  if (!LOCAL.ativo) return LOCAL;
  const lt = local.meta.via_existente || {};
  P.Z_VIA = Math.max(P.W_CX / 2, (lt.largura_m || 0) / 2);
  const c = local.meta.canteiro;
  if (c) {
    const o = obraDeLocal(c.centro[0], c.centro[1]);
    const [comp, larg] = c.dimensoes_m;
    P.CANT = { s0: o.s - comp / 2, s1: o.s + comp / 2, z0: o.z - larg / 2, z1: o.z + larg / 2, cota: P.CANT.cota };
    // pátio nivelado na cota média do terreno dentro do canteiro
    if (temTerreno()) {
      let a = 0,
        n = 0;
      for (let ss = P.CANT.s0; ss <= P.CANT.s1; ss += 5)
        for (let zz = P.CANT.z0; zz <= P.CANT.z1; zz += 5) {
          a += cotaTerreno(...localDeObra(ss, zz));
          n++;
        }
      P.CANT.cota = a / n;
    }
  }
  return LOCAL;
}

// acesso do canteiro à avenida (coordenadas da obra): do portão, pelas vias existentes, até a avenida do eixo.
// Sem o local real, sai pelo lado do canteiro voltado para a via.
export function acessoDoCanteiro() {
  const pts = LOCAL.ativo && LOCAL.meta.canteiro && LOCAL.meta.canteiro.acesso_pts;
  if (pts && pts.length >= 2) return pts.map(([x, y]) => obraDeLocal(x, y));
  const s = P.CANT.s0 + 22;
  return [
    { s, z: P.CANT.z1 },
    { s, z: -8.5 }
  ];
}

// posição no canteiro a partir do arranjo de referência (s, z relativos ao canteiro da Fase 2B)
export const noCanteiro = (s, z) => ({ s: s - P.CANT_REF.s0 + P.CANT.s0, z: z - P.CANT_REF.z0 + P.CANT.z0 });

// topo do pavimento (existente e novo) no eixo; com o local real, acompanha a via existente
export const gr = s => {
  const g = greideLocal(s);
  return g == null ? P.GR0 + P.GRI * s : g;
};
export const sg = s => gr(s) - P.E_PAV; // subleito: fundo da caixa do pavimento

// pátio do canteiro já nivelado (área militar existente)
function noPatio(s, z, v) {
  const c = P.CANT,
    f = 12;
  const ws = smooth(c.s0 - f, c.s0, s) * (1 - smooth(c.s1, c.s1 + f, s));
  const wz = smooth(c.z0 - f, c.z0, z) * (1 - smooth(c.z1, c.z1 + f, z));
  return lerp(v, c.cota, ws * wz);
}

// terreno natural
export function nat(s, z) {
  if (temTerreno()) {
    const t = cotaTerreno(...localDeObra(s, z));
    // plataforma da via existente: pista atual na cota do greide e passeios 12 cm acima, concordando com o relevo
    const fora = Math.max(0, -s, s - P.L);
    const az = Math.abs(z),
      zv = P.Z_VIA;
    const via = gr(clamp(s, 0, P.L)) + (az > zv ? 0.12 : 0);
    const w = (1 - smooth(zv + 3, zv + 14, az)) * (1 - smooth(0, 25, fora));
    return noPatio(s, z, lerp(t, via, w));
  }
  const base = gr(Math.min(Math.max(s, 0), P.L)) + 0.12;
  const g = smooth(6, 45, Math.abs(z));
  const ond = (1.2 * Math.sin(s / 140 + 0.5) + 0.8 * Math.cos(s / 90) * Math.sin(z / 31) + 0.5 * Math.sin(z / 17)) * g;
  const v = base + ond - 0.01 * Math.max(0, Math.abs(z) - 6);
  return noPatio(s, z, v);
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
