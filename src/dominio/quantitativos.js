// Quantitativos: seções a cada estaca, volumes pela média das áreas, diagrama de massas e serviços de pavimentação.
import { P, nat, gr, sg, dFill, section } from './geometria.js';

export function buildQuant(taxas) {
  const rows = [];
  const step = P.EST;
  let cum = 0,
    prev = null,
    Vc = 0,
    Va = 0;
  for (let s = 0; s <= P.L + 1e-6; s += step) {
    const sec = section(s),
      n0 = nat(s, 0);
    const r = { s, est: s / P.EST, nat: n0, gr: gr(s), sg: sg(s), h: n0 - sg(s), ac: sec.ac, aa: sec.aa, vc: 0, va: 0 };
    if (prev) {
      r.vc = ((prev.ac + r.ac) / 2) * step;
      r.va = ((prev.aa + r.aa) / 2) * step;
    }
    Vc += r.vc;
    Va += r.va;
    cum += r.vc - r.va * P.FH;
    r.cum = cum;
    rows.push(r);
    prev = r;
  }
  // camada final (0,60 m) e corpo do aterro
  let Vcf = 0,
    minNat = 99,
    maxTopCorpo = -99,
    sFill0 = 999,
    sFill1 = -1;
  for (let s = 0; s <= P.L; s += 1) {
    const n = nat(s, 0),
      top = sg(s);
    if (n < top) {
      sFill0 = Math.min(sFill0, s);
      sFill1 = Math.max(sFill1, s);
      minNat = Math.min(minNat, n);
      maxTopCorpo = Math.max(maxTopCorpo, top - P.E_CF);
    }
    let a = 0;
    const dz = 0.1;
    for (let z = -20; z <= 20; z += dz) {
      const nn = nat(s, z),
        f = dFill(s, z),
        cfb = f - P.E_CF;
      if (nn < f) a += (f - Math.max(nn, cfb)) * dz;
    }
    Vcf += a;
  }
  const nLifts = Math.max(1, Math.ceil((maxTopCorpo - minNat) / P.LIFT));
  const q = {
    rows,
    Vc,
    Va,
    Vcf,
    Vcorpo: Va - Vcf,
    Vbota: Vc - Va * P.FH,
    nLifts,
    minNat,
    sFill0,
    sFill1,
    Alimp: P.L * taxas.larguraLimpeza,
    Areg: P.L * P.B,
    Vsb: P.L * P.W_SB * P.E_SB,
    Vba: P.L * P.W_BA * P.E_BA,
    Aimp: P.L * P.W_BA,
    Apint: P.L * P.W_RV,
    Vrv: P.L * P.W_RV * P.E_RV
  };
  q.Trv = q.Vrv * taxas.densidadeCBUQ;
  q.Limp = q.Aimp * taxas.imprimacao;
  q.Lpint = q.Apint * taxas.pinturaDiluida;
  q.teorLigante = taxas.teorLigante;
  return q;
}

// estacas inicial e final de cada camada do corpo do aterro (null quando a camada não existe)
export function extensoesDasCamadas(q) {
  const out = [];
  for (let k = 0; k < q.nLifts; k++) {
    const lvl = q.minNat + P.LIFT * (k + 1);
    let a = null,
      b = null;
    for (let s = 0; s <= P.L; s += 2)
      if (nat(s, 0) < Math.min(lvl, sg(s) - P.E_CF) - 0.05) {
        if (a == null) a = s;
        b = s;
      }
    out.push(a == null ? null : [a, b]);
  }
  return out;
}
