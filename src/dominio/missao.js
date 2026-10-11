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
  let d;
  if (regra.em === 'curaInicio') d = s.cura[0];
  else {
    const w = regra.faixa ? s.lanes[regra.faixa] : s.win[0];
    d = regra.em === 'fim' ? w[1] : w[0];
  }
  return d + (regra.mais || 0);
}

// métricas da missão: atraso (d), custo (c), qualidade (q), conformidade (n), nota de 0 a 10 e conceito.
// escolhas: [{ op: efeitos }], eventos: consequências já vistas; opt: opções de cronograma em vigor.
export function metricas({ escolhas, eventos, fim, prazo, opt, pontuacao }) {
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
  // retrabalho decidido corretamente: o atraso que ele causa não reduz a nota
  const inev = pontuacao.retrabalhosSemPenalidade.filter(k => opt[k]).length;
  const ps = clamp(100 - pontuacao.pontosPorDiaDeAtraso * Math.max(0, d - inev), 0, 100),
    cs = clamp(100 - Math.max(0, c) / pontuacao.milReaisPorPonto, 0, 100);
  const p = pontuacao.pesos;
  const nota = (p.qualidade * q + p.conformidade * n + p.prazo * ps + p.custo * cs) / 10;
  const conceito = pontuacao.conceitos.find(x => nota >= x.minimo).nome;
  return { d, c, q, n, nota, conceito };
}
