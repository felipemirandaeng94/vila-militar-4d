// Frentes de serviço: posição de cada frente ao longo do tempo, em quadros-chave [dia, valor].
// O tipo de frente de cada serviço vem do campo "frente" em dados/servicos.json:
//   extensao: avança de 0 a L (estaca) na janela; fracao: vai de 0 a "ate" na janela;
//   camadas: sobe uma camada do corpo do aterro por vez; faixas: uma frente por meia pista (BD e BE);
//   suave: transição suave de 0 a 1 entre o início e o fim do serviço.
import { P } from './geometria.js';
import { lerp, smooth } from './util.js';

export function interpKF(kf, d) {
  if (!kf.length || d <= kf[0][0]) return kf.length ? kf[0][1] : 0;
  for (let i = 1; i < kf.length; i++)
    if (d <= kf[i][0]) {
      const [a, va] = kf[i - 1],
        [b, vb] = kf[i];
      return b === a ? vb : va + ((vb - va) * (d - a)) / (b - a);
    }
  return kf[kf.length - 1][1];
}
export const winKF = (w, L = P.L) => [
  [w[0], 0],
  [w[1], L]
];

export function buildFronts(svc, q) {
  const F = {};
  for (const s of svc) {
    const f = s.meta && s.meta.frente;
    if (!f) continue;
    if (f.tipo === 'extensao') {
      const w = s.win[0];
      F[f.chave] = winKF([w[0], w[1] - (f.fimAntecipado || 0)]);
    } else if (f.tipo === 'fracao') {
      const w = s.win[0];
      F[f.chave] = [
        [w[0], 0],
        [w[1], f.ate]
      ];
    } else if (f.tipo === 'camadas') {
      const w = s.win[0],
        n = q.nLifts;
      F[f.chave] = [];
      for (let k = 0; k <= n; k++) F[f.chave].push([lerp(w[0], w[1], k / n), k]);
    } else if (f.tipo === 'faixas') {
      for (const ln of Object.keys(s.lanes)) {
        if (s.falha && ln === 'BD') {
          // trecho lançado, parada, fresagem do trecho e novo lançamento
          const fl = s.falha;
          F[f.chave + ln] = [
            [fl.a, 0],
            [fl.b, fl.s],
            [fl.rem[0], fl.s],
            [fl.rem[1], 0],
            [s.lanes.BD[0], 0],
            [s.lanes.BD[1], P.L]
          ];
        } else F[f.chave + ln] = winKF(s.lanes[ln]);
      }
    } else if (f.tipo === 'suave') F[f.chave] = { suave: [s.a, s.b] };
  }
  return F;
}

// estado de todas as frentes no dia d
export function stateAt(F, d) {
  const st = { d };
  for (const k in F) st[k] = F[k].suave ? smooth(F[k].suave[0], F[k].suave[1], d) : interpKF(F[k], d);
  return st;
}

// dia em que a frente (quadros-chave) passa pela estaca s
export function diaNaEstaca(kf, s) {
  for (let i = 1; i < kf.length; i++) {
    const [a, va] = kf[i - 1],
      [b, vb] = kf[i];
    if (vb > va && s >= va && s <= vb) return a + ((b - a) * (s - va)) / (vb - va);
  }
  return kf[kf.length - 1][0];
}
