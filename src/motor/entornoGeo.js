// Geometria plana do entorno (Fase 6), sem Three.js e sem DOM (testada em tests/entorno.test.js): polígonos, retângulo
// mínimo, classificação das edificações por tipo de fachada, telhado de quatro águas, amostragem ao longo das vias e
// nível de detalhe das árvores. Coordenadas locais (x, y) em metros.

export function areaPoligono(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

export function dentroPoligono(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

export function distanciaAoSegmento(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function envoltoria(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo = [],
    cima = [];
  for (const q of p) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop();
    baixo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop();
    cima.push(q);
  }
  return baixo.slice(0, -1).concat(cima.slice(0, -1));
}

/**
 * Retângulo de menor área que contém o polígono (direções das arestas da envoltória convexa). Devolve o centro c, o
 * eixo longo u e o curto v (unitários), o comprimento (lado longo) e a largura.
 */
export function retanguloMinimo(pts) {
  const h = envoltoria(pts);
  let melhor = null;
  for (let i = 0; i < h.length; i++) {
    const [x0, y0] = h[i],
      [x1, y1] = h[(i + 1) % h.length];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1e-9) continue;
    const ux = (x1 - x0) / l,
      uy = (y1 - y0) / l;
    let a0 = Infinity,
      a1 = -Infinity,
      b0 = Infinity,
      b1 = -Infinity;
    for (const [x, y] of h) {
      const a = x * ux + y * uy,
        b = -x * uy + y * ux;
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
      b0 = Math.min(b0, b);
      b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!melhor || area < melhor.area) melhor = { area, ux, uy, a0, a1, b0, b1 };
  }
  const { ux, uy, a0, a1, b0, b1 } = melhor;
  const ma = (a0 + a1) / 2,
    mb = (b0 + b1) / 2;
  const c = [ma * ux - mb * uy, ma * uy + mb * ux];
  let u = [ux, uy],
    comp = a1 - a0,
    larg = b1 - b0;
  // u sempre no lado longo
  if (larg > comp) [u, comp, larg] = [[-uy, ux], larg, comp];
  return { c, u, v: [-u[1], u[0]], comp, larg };
}

/** Fração do retângulo mínimo ocupada pelo polígono (1 = retângulo). */
export const retangularidade = pts => {
  const r = retanguloMinimo(pts);
  return Math.abs(areaPoligono(pts)) / Math.max(1e-9, r.comp * r.larg);
};

/**
 * Tipo de fachada de uma edificação existente, pelo uso do cadastro, pela área, pela forma e pela altura (sem tentar
 * identificar prédios): 'residencial' (casas e blocos de apartamentos da vila militar), 'alojamento' (blocos longos e
 * baixos), 'administrativo' (blocos compactos e grandes), 'utilitario' (galpões, casas de máquinas, reservatórios) e
 * 'cobertura' (telheiros e marquises, abertos).
 */
export function classificarEdificacao(e) {
  if (['telheiro', 'marquise'].includes(e.uso)) return 'cobertura';
  if (e.uso !== 'edificação') return 'utilitario';
  const area = Math.abs(areaPoligono(e.c));
  const r = retanguloMinimo(e.c);
  const alongado = r.comp / Math.max(0.1, r.larg);
  if (area < 40) return 'utilitario';
  if (e.h >= 12) return 'residencial';
  if (area < 220) return 'residencial';
  if (alongado >= 2.4) return 'alojamento';
  return 'administrativo';
}

/** Telhado cerâmico de quatro águas (ou de duas, nos muito estreitos)? Retângulos razoáveis e prédios baixos. */
export function temTelhadoCeramico(tipo, e) {
  if (!['residencial', 'alojamento', 'administrativo'].includes(tipo)) return false;
  if (e.h >= 12) return false;
  // galpões e pavilhões muito largos ficam com laje: o telhado de quatro águas sobre eles seria alto demais
  const r = retanguloMinimo(e.c);
  if (r.larg > 24 || r.comp * r.larg > 2500) return false;
  return retangularidade(e.c) >= 0.82;
}

/**
 * Telhado de quatro águas sobre o retângulo r ampliado pelo beiral (m), com a inclinação dada (altura ÷ meia largura).
 * Devolve { altura, tris }, com os triângulos em coordenadas locais [x, y, dz, u, v]: dz acima do respaldo, u ao longo
 * do beiral e v ao longo da água (m), para a textura das telhas.
 */
export function telhadoQuatroAguas(r, beiral = 0.5, inclinacao = 0.3) {
  const a = r.comp / 2 + beiral,
    b = r.larg / 2 + beiral,
    H = inclinacao * b,
    k = Math.sqrt(1 + inclinacao * inclinacao);
  const P = (s, t) => [r.c[0] + r.u[0] * s + r.v[0] * t, r.c[1] + r.u[1] * s + r.v[1] * t];
  const tris = [];
  const v3 = (s, t, dz, u, v) => [...P(s, t), dz, u, v];
  const cum = a - b;
  for (const sd of [1, -1]) {
    // águas longas (trapézios; triângulos se o retângulo for quadrado)
    const e0 = v3(-a, sd * b, 0, 0, 0),
      e1 = v3(a, sd * b, 0, 2 * a, 0),
      c1 = v3(cum, 0, H, a + cum, b * k),
      c0 = v3(-cum, 0, H, a - cum, b * k);
    tris.push([e0, e1, c1]);
    if (cum > 1e-6) tris.push([e0, c1, c0]);
    // águas das pontas (triângulos)
    tris.push([v3(sd * a, -b, 0, 0, 0), v3(sd * a, b, 0, 2 * b, 0), v3(sd * cum, 0, H, b, b * k)]);
  }
  return { altura: H, tris };
}

/** Nível de detalhe pela distância (m): 0 modelo perto, 1 modelo reduzido, 2 impostor. */
export const nivelDeDetalhe = (d, perto, medio) => (d < perto ? 0 : d < medio ? 1 : 2);

/** Comprimento de uma polilinha [[x, y], ...]. */
export function comprimento(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

/**
 * Pontos a cada passo (m) ao longo da polilinha, começando em inicio, deslocados lateralmente de desloc (m, + à
 * esquerda do sentido da polilinha). Cada ponto traz a posição, a tangente unitária e a distância ao longo da via.
 */
export function amostrarAoLongo(pts, passo, desloc = 0, inicio = passo / 2) {
  const out = [];
  let acum = 0,
    prox = inicio;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1],
      [x1, y1] = pts[i];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1e-9) continue;
    const tx = (x1 - x0) / l,
      ty = (y1 - y0) / l;
    while (prox <= acum + l + 1e-9) {
      const t = prox - acum;
      out.push({ x: x0 + tx * t - ty * desloc, y: y0 + ty * t + tx * desloc, tx, ty, d: prox });
      prox += passo;
    }
    acum += l;
  }
  return out;
}

/**
 * Reamostra a polilinha em pedaços de até passo (m) e devolve, em cada ponto, a posição e a normal unitária à esquerda
 * (média das direções vizinhas). É a mesma amostragem da faixa das vias do entorno, para meio-fio e calçada coincidirem
 * com a borda do asfalto.
 */
export function reamostrar(pts, passo = 4) {
  const r = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let k = 0; k < n; k++) r.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  r.push(pts[pts.length - 1]);
  return r.map(([x, y], i) => {
    const [xa, ya] = r[Math.max(0, i - 1)],
      [xb, yb] = r[Math.min(r.length - 1, i + 1)];
    const l = Math.hypot(xb - xa, yb - ya) || 1;
    return { x, y, nx: -(yb - ya) / l, ny: (xb - xa) / l };
  });
}

/** Hierarquia das vias (para a preferência nos cruzamentos): maior = mais importante. */
export const HIERARQUIA = { motorway: 6, primary: 5, secondary: 4, busway: 4, tertiary: 3, residential: 2, living_street: 1, service: 0 };

/** Densidade de tufos de grama por metro quadrado e raio em torno do alvo da câmera, pelo perfil. */
export function tufosNoRaio(perfil, fracaoGramada = 1) {
  const g = perfil.gramado;
  return Math.round(Math.PI * g.raio * g.raio * g.densidade * fracaoGramada);
}
