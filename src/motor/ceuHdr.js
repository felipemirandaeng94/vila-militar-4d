// Análise do HDRI do céu (equirretangular, meio-float RGBA, como entregue pelo HDRLoader com flipY): direção do sol,
// cor média do horizonte e radiância média do céu; preparo das cópias usadas no ambiente (sol limitado, porque a luz
// direcional já faz o papel do sol) e no fundo (hemisfério de baixo com a cor do horizonte, que se funde com a névoa).
// Não depende de WebGL: roda nos testes.
import { DataUtils } from 'three';

const { fromHalfFloat, toHalfFloat } = DataUtils;
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Convenção do three (equirectUv): u = atan(z, x)/2π + 0,5; v = asin(y)/π + 0,5. Com flipY, a linha 0 dos dados
// (topo do arquivo) fica em v = 1.
export function direcaoDoTexel(col, lin, w, h) {
  const u = (col + 0.5) / w,
    v = 1 - (lin + 0.5) / h;
  const fi = (u - 0.5) * 2 * Math.PI,
    te = (v - 0.5) * Math.PI;
  return [Math.cos(te) * Math.cos(fi), Math.sin(te), Math.cos(te) * Math.sin(fi)];
}
// elevação (rad) da linha lin
export const elevacaoDaLinha = (lin, h) => (0.5 - (lin + 0.5) / h) * Math.PI;

// azimute no plano XZ medido a partir de +Z em direção a +X (o mesmo sentido da rotação em Y do three)
export const azimute = d => Math.atan2(d[0], d[2]);

/**
 * Azimute no mundo (rad, a partir de +Z para +X) de uma direção geográfica com azimute azGeo (graus, a partir do norte
 * no sentido horário), dado o azimute geográfico do eixo x local (graus). No mundo X = x local e Z = −y local, com o y
 * local 90° à esquerda do x.
 */
export function azimuteNoMundo(azGeo, azEixoX) {
  const r = Math.PI / 180;
  const d = [Math.sin(azGeo * r), Math.cos(azGeo * r)],
    ex = [Math.sin(azEixoX * r), Math.cos(azEixoX * r)],
    ey = [-ex[1], ex[0]];
  const x = d[0] * ex[0] + d[1] * ex[1],
    y = d[0] * ey[0] + d[1] * ey[1];
  return Math.atan2(x, -y);
}

/**
 * Analisa o céu. img: { data: Uint16Array RGBA meio-float, width, height }.
 * Devolve sol (vetor unitário apontando para o sol), elevação e azimute do sol, cor média do horizonte (0° a 6°),
 * radiância média do hemisfério superior sem o sol e o pico do sol.
 */
export function analisarCeu(img, passo = 2) {
  const { data, width: w, height: h } = img;
  const meio = Math.floor(h / 2);
  let pico = 0,
    pc = 0,
    pl = 0;
  for (let l = 0; l < meio; l += passo)
    for (let c = 0; c < w; c += passo) {
      const i = (l * w + c) * 4;
      const y = lum(fromHalfFloat(data[i]), fromHalfFloat(data[i + 1]), fromHalfFloat(data[i + 2]));
      if (y > pico) [pico, pc, pl] = [y, c, l];
    }
  // centroide (por direção) dos texels a mais de 25% do pico em volta do pico: o disco do sol
  const raio = Math.max(4, Math.round(w / 90));
  const s = [0, 0, 0];
  for (let l = Math.max(0, pl - raio); l <= Math.min(h - 1, pl + raio); l++)
    for (let dc = -raio; dc <= raio; dc++) {
      const c = (pc + dc + w) % w;
      const i = (l * w + c) * 4;
      const y = lum(fromHalfFloat(data[i]), fromHalfFloat(data[i + 1]), fromHalfFloat(data[i + 2]));
      if (y < pico * 0.25) continue;
      const d = direcaoDoTexel(c, l, w, h);
      s[0] += d[0] * y;
      s[1] += d[1] * y;
      s[2] += d[2] * y;
    }
  const n = Math.hypot(...s) || 1;
  const sol = s.map(v => v / n);
  // horizonte: linhas entre 0° e 6° de elevação; céu: hemisfério superior, sem os texels do sol
  const horiz = [0, 0, 0];
  let nh = 0,
    soma = 0,
    peso = 0;
  const limiteSol = pico * 0.02;
  for (let l = 0; l < meio; l += passo) {
    const el = elevacaoDaLinha(l, h);
    const cosEl = Math.cos(el);
    for (let c = 0; c < w; c += passo) {
      const i = (l * w + c) * 4;
      const r = fromHalfFloat(data[i]),
        g = fromHalfFloat(data[i + 1]),
        b = fromHalfFloat(data[i + 2]);
      const y = lum(r, g, b);
      if (el < (6 * Math.PI) / 180) {
        horiz[0] += r;
        horiz[1] += g;
        horiz[2] += b;
        nh++;
      }
      if (y < limiteSol) {
        soma += y * cosEl;
        peso += cosEl;
      }
    }
  }
  return {
    sol,
    elevacao: Math.asin(sol[1]),
    azimute: azimute(sol),
    horizonte: horiz.map(v => v / Math.max(1, nh)),
    mediaCeu: soma / Math.max(1e-9, peso),
    picoSol: pico
  };
}

/** Cópia do céu com cada canal limitado a teto (o disco do sol vira céu claro). */
export function limitarSol(img, teto) {
  const d = new Uint16Array(img.data);
  const t = toHalfFloat(teto);
  // meio-float positivo: a ordem dos bits é a ordem dos valores
  for (let i = 0; i < d.length; i++) if ((i & 3) !== 3 && d[i] > t && d[i] < 0x8000) d[i] = t;
  return { ...img, data: d };
}

/**
 * Substitui, no próprio arranjo, o hemisfério de baixo pela cor do horizonte, com transição suave até -3°.
 * O céu "puro" do Poly Haven tem um chão escuro ou espelhado que apareceria além da borda do terreno.
 */
export function preencherChao(img, cor, transicaoGraus = 3) {
  const { data, width: w, height: h } = img;
  const hc = cor.map(toHalfFloat);
  const tr = (transicaoGraus * Math.PI) / 180;
  for (let l = 0; l < h; l++) {
    const el = elevacaoDaLinha(l, h);
    if (el >= 0) continue;
    const k = Math.min(1, -el / tr);
    for (let c = 0; c < w; c++) {
      const i = (l * w + c) * 4;
      if (k >= 1) {
        data[i] = hc[0];
        data[i + 1] = hc[1];
        data[i + 2] = hc[2];
      } else for (let j = 0; j < 3; j++) data[i + j] = toHalfFloat(fromHalfFloat(data[i + j]) * (1 - k) + cor[j] * k);
    }
  }
  return img;
}
