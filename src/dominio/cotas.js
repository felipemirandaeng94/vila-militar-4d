// Cotas da superfície trabalhada (sem a espessura exagerada do pavimento, que é só visual).
import { P, nat, gr, sg, dCut, dFill, endW } from './geometria.js';
import { clamp } from './util.js';

// cota da superfície exposta de uma camada (para posicionar os pontos de ensaio)
export function surfAt(q, layer, s, z, k) {
  if (layer === 'nat') return nat(s, z);
  if (layer === 'corpo') return Math.min(dFill(s, z) - P.E_CF, q.minNat + P.LIFT * (k + 1));
  if (layer === 'cf') return dFill(s, z) - P.E_CF + P.LIFT_CF * (k + 1);
  if (layer === 'reg') return sg(s);
  if (layer === 'sb') return sg(s) + P.E_SB;
  if (layer === 'ba' || layer === 'imp') return sg(s) + P.E_SB + P.E_BA;
  return gr(s);
}

// cota do terreno trabalhado (corte e aterro) no estado st das frentes
export function terrainC(q, s, z, st) {
  const n = nat(s, z);
  const w = endW(s);
  if (w <= 0) return n;
  const sc = clamp(s, 0, P.L),
    c = dCut(sc, z),
    f = dFill(sc, z);
  if (n > c) return n - st.pc * (n - c) * w;
  if (n < f) {
    let top;
    if (st.cf > 0) top = f - P.E_CF + P.LIFT_CF * st.cf;
    else top = Math.min(q.minNat + P.LIFT * st.ck, f - P.E_CF);
    return Math.max(n, n + (Math.min(f, top) - n) * w);
  }
  return n;
}
