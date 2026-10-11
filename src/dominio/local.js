// Local real (Fase 3): eixo da obra sobre a via existente, terreno em grade e perfil do greide.
// Coordenadas locais (m): origem no início do trecho, x na direção geral início → fim, y à esquerda (public/local/meta.json).
// Coordenadas da obra: s = estaqueamento ao longo do eixo, z = afastamento (+ = bordo direito).
// Sem dados do local (testes e modo de reserva), o eixo é reto, de (0, 0) a (L, 0), e não há terreno real.
import { clamp, lerp } from './util.js';

export const LOCAL = { ativo: false };

let PX = [0, 1],
  PY = [0, 0],
  S = [0, 1],
  TX = [1],
  TY = [0];
let T = null; // terreno: { nx, ny, x0, y0, passo, zmin, cm: Uint16Array }
let GR = null; // perfil do greide: { passo, z: Float64Array }
let BALDES = null;
const BALDE = 25;

// eixo: lista de pontos [x, y] em coordenadas locais
function definirEixo(pts) {
  PX = pts.map(p => p[0]);
  PY = pts.map(p => p[1]);
  S = [0];
  TX = [];
  TY = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = PX[i] - PX[i - 1],
      dy = PY[i] - PY[i - 1],
      l = Math.hypot(dx, dy) || 1e-9;
    S.push(S[i - 1] + l);
    TX.push(dx / l);
    TY.push(dy / l);
  }
  // baldes de 25 m com os segmentos próximos, para a projeção de pontos no eixo
  BALDES = new Map();
  for (let i = 0; i < TX.length; i++) {
    const x0 = Math.min(PX[i], PX[i + 1]) - 2 * BALDE,
      x1 = Math.max(PX[i], PX[i + 1]) + 2 * BALDE,
      y0 = Math.min(PY[i], PY[i + 1]) - 2 * BALDE,
      y1 = Math.max(PY[i], PY[i + 1]) + 2 * BALDE;
    for (let a = Math.floor(x0 / BALDE); a <= Math.floor(x1 / BALDE); a++)
      for (let b = Math.floor(y0 / BALDE); b <= Math.floor(y1 / BALDE); b++) {
        const k = a * 100003 + b;
        if (!BALDES.has(k)) BALDES.set(k, []);
        BALDES.get(k).push(i);
      }
  }
}

export const extensaoDoEixo = () => S[S.length - 1];

// índice do segmento que contém a estaca s (fora do eixo, o primeiro ou o último)
function segmento(s) {
  let a = 0,
    b = TX.length - 1;
  if (s <= S[0]) return 0;
  if (s >= S[b]) return b;
  while (a < b) {
    const m = (a + b + 1) >> 1;
    if (S[m] <= s) a = m;
    else b = m - 1;
  }
  return a;
}

// ponto do eixo e tangente na estaca s; antes do início e depois do fim o eixo segue a tangente da ponta
export function pontoDoEixo(s) {
  const i = segmento(s),
    ds = s - S[i];
  return { x: PX[i] + TX[i] * ds, y: PY[i] + TY[i] * ds, tx: TX[i], ty: TY[i] };
}
// tangente suavizada (média dos segmentos a até 6 m), para orientar objetos sem quebras
export function tangente(s) {
  let tx = 0,
    ty = 0;
  for (const d of [-6, -3, 0, 3, 6]) {
    const i = segmento(s + d);
    tx += TX[i];
    ty += TY[i];
  }
  const l = Math.hypot(tx, ty) || 1;
  return { tx: tx / l, ty: ty / l };
}

// coordenadas da obra (s, z) -> locais (x, y); z positivo à direita
export function localDeObra(s, z = 0) {
  const p = pontoDoEixo(s);
  if (!z) return [p.x, p.y];
  const t = tangente(s);
  return [p.x + t.ty * z, p.y - t.tx * z];
}

function projetarNoSegmento(i, x, y) {
  const dx = x - PX[i],
    dy = y - PY[i],
    L = S[i + 1] - S[i];
  let u = dx * TX[i] + dy * TY[i];
  // antes do primeiro e depois do último segmento, a projeção se estende pela tangente
  if (i > 0) u = Math.max(0, u);
  if (i < TX.length - 1) u = Math.min(L, u);
  const px = PX[i] + TX[i] * u,
    py = PY[i] + TY[i] * u;
  const z = (x - px) * TY[i] - (y - py) * TX[i];
  return { s: S[i] + u, z, d: Math.hypot(x - px, y - py) };
}

// coordenadas locais -> obra (s, z), pela projeção no segmento mais próximo.
// Com perto = true, devolve null se o ponto estiver a mais de ~50 m do eixo (evita a busca em todos os segmentos).
export function obraDeLocal(x, y, perto = false) {
  const cand = BALDES ? BALDES.get(Math.floor(x / BALDE) * 100003 + Math.floor(y / BALDE)) : null;
  if (!cand && perto) return null;
  const lista = cand || TX.map((_, i) => i);
  let best = null;
  for (const i of lista) {
    const r = projetarNoSegmento(i, x, y);
    if (!best || r.d < best.d) best = r;
  }
  return { s: best.s, z: best.z };
}

// ---------- terreno ----------
export function cotaTerreno(x, y) {
  if (!T) return null;
  const fx = clamp((x - T.x0) / T.passo, 0, T.nx - 1.001),
    fy = clamp((y - T.y0) / T.passo, 0, T.ny - 1.001);
  const i = Math.floor(fx),
    j = Math.floor(fy),
    u = fx - i,
    v = fy - j;
  const k = j * T.nx + i;
  const z00 = T.cm[k],
    z10 = T.cm[k + 1],
    z01 = T.cm[k + T.nx],
    z11 = T.cm[k + T.nx + 1];
  return T.zmin + (lerp(lerp(z00, z10, u), lerp(z01, z11, u), v) || 0) / 100;
}
export const temTerreno = () => !!T;
export const gradeDoTerreno = () => T;

// greide de projeto: acompanha a via existente sobre o relevo real (média móvel de ±20 m da cota do terreno no eixo)
function montarGreide() {
  const passo = 2,
    L = extensaoDoEixo(),
    n = Math.ceil(L / passo) + 1;
  const bruto = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const [x, y] = localDeObra(Math.min(k * passo, L));
    bruto[k] = cotaTerreno(x, y);
  }
  const z = new Float64Array(n),
    w = Math.round(20 / passo);
  for (let k = 0; k < n; k++) {
    let a = 0,
      c = 0;
    for (let j = Math.max(0, k - w); j <= Math.min(n - 1, k + w); j++) {
      a += bruto[j];
      c++;
    }
    z[k] = a / c;
  }
  GR = { passo, z };
}
export function greideLocal(s) {
  if (!GR) return null;
  const f = clamp(s / GR.passo, 0, GR.z.length - 1.001),
    i = Math.floor(f);
  return lerp(GR.z[i], GR.z[i + 1], f - i);
}

// local = { eixo (public/local/eixo.json), meta (meta.json), terreno (ArrayBuffer de terreno.bin) }
// Sem argumento, volta ao eixo reto de extensão L.
export function configurarLocal(local, L) {
  for (const k of Object.keys(LOCAL)) delete LOCAL[k];
  T = null;
  GR = null;
  if (!local) {
    LOCAL.ativo = false;
    definirEixo([
      [0, 0],
      [L, 0]
    ]);
    return LOCAL;
  }
  definirEixo(local.eixo.pontos);
  const g = local.meta.terreno;
  if (local.terreno) {
    T = { nx: g.nx, ny: g.ny, x0: g.x0, y0: g.y0, passo: g.passo, zmin: g.zmin, cm: new Uint16Array(local.terreno) };
    montarGreide();
  }
  Object.assign(LOCAL, { ativo: true, eixo: local.eixo, meta: local.meta, extensao: extensaoDoEixo() });
  return LOCAL;
}
