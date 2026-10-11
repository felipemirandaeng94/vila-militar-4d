// Regras puras da missão: dia em que cada decisão aparece e cálculo da nota.
import { clamp } from './util.js';

// dia da decisão conforme a regra de dados/decisoes.json; null se a situação não ocorre no cenário atual
export function diaDaDecisao(regra, svc, T) {
  if (regra.fixo != null) return regra.fixo;
  if (regra.falhaDeEnsaio) {
    const re = new RegExp(regra.falhaDeEnsaio);
    const t = T.find(x => !x.ok && re.test(x.nome));
    return t ? t.day + 0.012 : null;
  }
  const s = svc.find(x => x.id === regra.servico);
  if (!s) return null;
  const f = regra.frente != null ? regra.frente - 1 : null;
  const w = s.jan.find(w => (f == null || w.f === f) && (regra.faixa == null || w.faixa === regra.faixa) && (regra.em !== 'curaInicio' || w.cura));
  if (!w) return null;
  const d = regra.em === 'curaInicio' ? w.cura[0] : regra.em === 'fim' ? w.b : w.a;
  return d + (regra.mais || 0);
}

// métricas da missão: atraso (d), custo (c), qualidade (q), conformidade (n), nota de 0 a 10 e conceito.
// escolhas: efeitos das alternativas escolhidas; eventos: consequências já vistas;
// atrasoSemPenalidade: atraso do cronograma causado pelos retrabalhos decididos corretamente (não reduz a nota).
export function metricas({ escolhas, eventos, fim, prazo, atrasoSemPenalidade = 0, pontuacao }) {
  let d = Math.max(0, fim - prazo),
    c = 0,
    q = 100,
    n = 100;
  for (const o of escolhas) {
    d += o.d;
    c += o.c;
    q += o.q;
    n += o.n;
  }
  for (const ev of eventos) {
    d += ev.d;
    c += ev.c;
    q += ev.q;
    n += ev.n;
  }
  q = clamp(q, 0, 100);
  n = clamp(n, 0, 100);
  const inev = Math.min(Math.max(0, fim - prazo), atrasoSemPenalidade);
  const ps = clamp(100 - pontuacao.pontosPorDiaDeAtraso * Math.max(0, d - inev), 0, 100),
    cs = clamp(100 - Math.max(0, c) / pontuacao.milReaisPorPonto, 0, 100);
  const p = pontuacao.pesos;
  const nota = (p.qualidade * q + p.conformidade * n + p.prazo * ps + p.custo * cs) / 10;
  const conceito = pontuacao.conceitos.find(x => nota >= x.minimo).nome;
  return { d, c, q, n, nota, conceito };
}
