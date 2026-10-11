// Frentes de serviço: divisão do trecho e posição de cada serviço ao longo do tempo.
// Cada janela de um serviço por frente ({ a, b, s0, s1 }) avança de s0 a s1 entre os dias a e b.
import { clamp } from './util.js';

// divide o trecho em frentes de "tamanho" metros a partir do início (canteiro); a última fica com o resto
export function dividirFrentes(L, tamanho) {
  const n = Math.max(1, Math.ceil(L / tamanho - 1e-9));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ i, nome: 'F' + (i + 1), s0: i * tamanho, s1: Math.min(L, (i + 1) * tamanho) });
  return out;
}

export const frenteDaEstaca = (frentes, s) => frentes.find((f, i) => s >= f.s0 && (s < f.s1 || (i === frentes.length - 1 && s <= f.s1)));

// dia em que o serviço da janela w passa pela estaca s
export const diaNaEstaca = (w, s) => w.a + (w.b === w.a || w.s1 === w.s0 ? 0 : (clamp(s, w.s0, w.s1) - w.s0) / (w.s1 - w.s0)) * (w.b - w.a);
// posição do serviço da janela w no dia d
export const posicaoNoDia = (w, d) => w.s0 + clamp((d - w.a) / (w.b - w.a || 1), 0, 1) * (w.s1 - w.s0);

// janela de um serviço numa frente (e numa faixa, se houver)
export function janela(svc, id, f, faixa) {
  const s = svc.find(x => x.id === id);
  if (!s) return null;
  return s.jan.find(w => w.f === f && (faixa == null || w.faixa === faixa)) || null;
}

// executado: o serviço já passou pela estaca s no dia d (em alguma janela que cubra s)
export function executado(svc, id, s, d, faixa) {
  const v = svc.find(x => x.id === id);
  if (!v) return false;
  return v.jan.some(w => w.f != null && s >= w.s0 && s <= w.s1 && (faixa == null || w.faixa === faixa) && d >= diaNaEstaca(w, s));
}

// estado do desvio de tráfego de uma frente no dia d
export function estadoDoDesvio(frente, d) {
  let e = 'emUso';
  for (const m of frente.desvio) if (d >= m.d) e = m.estado;
  return e;
}

// dia em que o serviço passa pela estaca s (na janela de frente que cobre s); Infinity se não passa
export function diaDoServico(svc, id, s, faixa) {
  const v = svc.find(x => x.id === id);
  if (!v) return Infinity;
  const w = v.jan.find(w => w.f != null && s >= w.s0 - 1e-6 && s <= w.s1 + 1e-6 && (faixa == null || w.faixa === faixa));
  return w ? diaNaEstaca(w, s) : Infinity;
}
