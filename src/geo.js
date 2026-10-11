// ==GEOMETRIA==
// s = estaqueamento ao longo do eixo (m), z = afastamento transversal (m, + = bordo direito), cotas reais (m).
// Mundo 3D: X = s - 150, Y = cota - Y0, Z = z.
const P = {
  L: 300,
  EST: 20,
  Y0: 18,
  B: 9.0, // largura da plataforma de terraplenagem (m)
  TC: 1.0, // talude de corte 1V:1H
  TA: 1.5, // talude de aterro 1V:1,5H
  W_SB: 8.0,
  W_BA: 7.6,
  W_RV: 7.0,
  LANE: 3.5,
  E_SB: 0.2,
  E_BA: 0.15,
  E_RV: 0.05,
  E_REG: 0.2,
  E_CF: 0.6,
  LIFT: 0.3,
  LIFT_CF: 0.2,
  GR0: 23.6,
  GRI: -0.0075, // greide do revestimento no eixo: cota 23,60 na est. 0, rampa de -0,75 %
  FH: 1.2, // fator de homogeneização (volume de corte por m³ de aterro compactado)
  CANT: { s0: 0, s1: 135, z0: -112, z1: -40, cota: 22.6 }
};
P.E_PAV = P.E_SB + P.E_BA + P.E_RV;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function natRaw(s, z) {
  const g = Math.exp(-((z / 62) ** 2));
  return (
    22.0 + (2.6 * Math.exp(-(((s - 50) / 95) ** 2)) - 2.9 * Math.exp(-(((s - 215) / 75) ** 2))) * g - 0.012 * z + 0.25 * Math.sin(s / 37) * Math.cos(z / 29)
  );
}
// terreno natural, com o pátio do canteiro já nivelado (área militar existente)
function nat(s, z) {
  const c = P.CANT,
    f = 12;
  const ws = smooth(c.s0 - f, c.s0, s) * (1 - smooth(c.s1, c.s1 + f, s));
  const wz = smooth(c.z0 - f, c.z0, z) * (1 - smooth(c.z1, c.z1 + f, z));
  return lerp(natRaw(s, z), c.cota, ws * wz);
}
const gr = s => P.GR0 + P.GRI * s; // topo do revestimento (eixo)
const sg = s => gr(s) - P.E_PAV; // topo da terraplenagem (subleito acabado)
const halfB = P.B / 2;
const dCut = (s, z) => sg(s) + Math.max(0, Math.abs(z) - halfB) / P.TC;
const dFill = (s, z) => sg(s) - Math.max(0, Math.abs(z) - halfB) / P.TA;
// fator de transição nas extremidades (concordância com as vias existentes)
const endW = s => smooth(-22, 0, s) * (1 - smooth(P.L, P.L + 22, s));
const sgx = s => sg(clamp(s, 0, P.L));

// seção transversal na estaca s: áreas de corte e aterro (m²)
function section(s) {
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

function buildQuant() {
  const rows = [];
  const step = 20;
  let cum = 0,
    prev = null,
    Vc = 0,
    Va = 0;
  for (let s = 0; s <= P.L + 1e-6; s += step) {
    const sec = section(s),
      n0 = nat(s, 0);
    const r = { s, est: s / 20, nat: n0, gr: gr(s), sg: sg(s), h: n0 - sg(s), ac: sec.ac, aa: sec.aa, vc: 0, va: 0 };
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
    Alimp: P.L * 15,
    Areg: P.L * P.B,
    Vsb: P.L * P.W_SB * P.E_SB,
    Vba: P.L * P.W_BA * P.E_BA,
    Aimp: P.L * P.W_BA,
    Apint: P.L * P.W_RV,
    Vrv: P.L * P.W_RV * P.E_RV
  };
  q.Trv = q.Vrv * 2.42;
  q.Limp = q.Aimp * 1.2;
  q.Lpint = q.Apint * 0.9;
  return q;
}

// calendário: dia útil 0 = segunda-feira 03/05/2027
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function dateOf(d) {
  const w = Math.floor(d);
  const dt = new Date(2027, 4, 3);
  let n = 0;
  while (n < w) {
    dt.setDate(dt.getDate() + 1);
    const k = dt.getDay();
    if (k !== 0 && k !== 6) n++;
  }
  return dt;
}
function fmtDate(d, wd = true) {
  const dt = dateOf(d);
  const s = String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
  return wd ? DIAS[dt.getDay()] + ' ' + s : s;
}
function fmtHourM(d) {
  const f = d - Math.floor(d);
  const m = Math.round((7 + f * 10) * 60);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function fmtHour(d) {
  const f = d - Math.floor(d);
  const h = 7 + f * 10;
  const hh = Math.floor(h),
    mm = Math.round(((h - hh) * 60) / 15) * 15;
  return String(hh + (mm === 60 ? 1 : 0)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
}
const estStr = s => {
  const e = Math.floor(s / 20 + 1e-9),
    r = s - e * 20;
  return e + '+' + r.toFixed(r % 1 ? 1 : 0).padStart(2, '0');
};
const nf = (v, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export {
  P,
  smooth,
  lerp,
  clamp,
  natRaw,
  nat,
  gr,
  sg,
  halfB,
  dCut,
  dFill,
  endW,
  sgx,
  section,
  buildQuant,
  DIAS,
  dateOf,
  fmtDate,
  fmtHourM,
  fmtHour,
  estStr,
  nf
};
