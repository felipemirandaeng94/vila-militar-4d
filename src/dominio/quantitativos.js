// Quantitativos da reconstrução por frente de serviço e totais.
// Demolição (fresagem e remoção), drenagem (vala, tubos, bocas de lobo, poços de visita), subleito, meio-fio, sarjeta,
// camadas novas, ligantes e CBUQ. As chaves de cada frente são as usadas em "quantidade" de dados/servicos.json.
import { P, gr, sg, diametroRede, larguraVala, profundidadeVala, bocasDeLobo, pocosDeVisita } from './geometria.js';

const fmtD = D => D.toFixed(2).replace('.', ',');

// trechos com solo mole (ISC abaixo do projeto) dentro de [s0, s1)
export function trechosRuins(obra, s0, s1) {
  return (obra.subleito.trechosComSoloRuim || []).map(t => ({ ...t, de: Math.max(t.de, s0), ate: Math.min(t.ate, s1) })).filter(t => t.ate > t.de);
}

export function quantitativosDaFrente(obra, fr, ultima) {
  const { s0, s1 } = fr;
  const L = s1 - s0;
  const tx = obra.taxas,
    emp = obra.empolamento,
    dr = obra.drenagem;
  const q = { frente: fr.i, s0, s1, extensao: L };
  // demolição
  q.areaFresagem = L * P.W_RV;
  q.volFresado = q.areaFresagem * P.EX_RV;
  q.volFresadoSolto = q.volFresado * emp.fresado;
  q.volRemocao = L * P.W_CX * (P.EX_BA + P.EX_SB);
  q.volRemocaoSolta = q.volRemocao * emp.remocao;
  // drenagem: rede longitudinal por trechos de diâmetro constante e ramais das bocas de lobo
  q.tubos = {};
  let esc = 0,
    berco = 0,
    tuboExt = 0;
  const addTrecho = (comp, D) => {
    const w = larguraVala(D),
      h = profundidadeVala(D);
    q.tubos[fmtD(D)] = (q.tubos[fmtD(D)] || 0) + comp;
    esc += comp * w * h;
    berco += comp * w * dr.berco;
    tuboExt += comp * Math.PI * (D / 2 + 0.06) ** 2;
  };
  for (let s = s0; s < s1 - 1e-9; s += 1) addTrecho(Math.min(1, s1 - s), diametroRede(s + 0.5));
  const bl = bocasDeLobo().filter(b => b.s >= s0 && (b.s < s1 || (ultima && b.s <= s1)));
  const pv = pocosDeVisita().filter(p => p.s >= s0 && (p.s < s1 || (ultima && p.s <= s1)));
  q.extRede = L;
  q.extRamais = bl.reduce((a, b) => a + b.ramal, 0);
  for (const b of bl) addTrecho(b.ramal, dr.diametroRamal);
  q.extVala = q.extRede + q.extRamais;
  q.volEscavacaoVala = esc;
  q.volBerco = berco;
  q.volReaterro = esc - berco - tuboExt;
  q.volBotaForaVala = (esc - q.volReaterro) * emp.escavacaoVala;
  q.nBocasDeLobo = bl.length;
  q.nPocosDeVisita = pv.length;
  q.desague = ultima ? 1 : 0;
  // subleito
  const ruins = trechosRuins(obra, s0, s1);
  q.extSoloRuim = ruins.reduce((a, t) => a + (t.ate - t.de), 0);
  q.volSubstituicao = q.extSoloRuim * P.W_CX * P.E_SUBST;
  q.areaRegularizacao = L * P.W_CX;
  // meio-fio e sarjeta nos dois lados
  q.extMeioFio = 2 * L;
  q.extSarjeta = 2 * L;
  q.volConcretoSarjeta = q.extSarjeta * P.W_SAR * P.E_SAR;
  // camadas novas (entre as sarjetas)
  q.areaSubBase = L * P.W_SB;
  q.volSubBase = q.areaSubBase * P.E_SB;
  q.areaBase = L * P.W_BA;
  q.volBase = q.areaBase * P.E_BA;
  q.areaImprimacao = L * P.W_RV;
  q.litrosImprimacao = q.areaImprimacao * tx.imprimacao;
  q.areaPintura = L * P.W_RV;
  q.litrosEmulsao = (q.areaPintura * tx.pinturaDiluida) / 2;
  q.volCBUQ = L * P.W_RV * P.E_RV;
  q.toneladasCBUQ = q.volCBUQ * tx.densidadeCBUQ;
  q.toneladasCAP = q.toneladasCBUQ * tx.teorLigante;
  return q;
}

// soma das chaves numéricas e dos tubos por diâmetro
function somar(lista) {
  const t = { tubos: {} };
  for (const q of lista)
    for (const [k, v] of Object.entries(q)) {
      if (k === 'tubos') for (const [d, m] of Object.entries(v)) t.tubos[d] = (t.tubos[d] || 0) + m;
      else if (typeof v === 'number' && !['frente', 's0', 's1'].includes(k)) t[k] = (t[k] || 0) + v;
    }
  return t;
}

// frentes: lista de { i, s0, s1 }
export function buildQuant(obra, frentes) {
  const porFrente = frentes.map((fr, i) => quantitativosDaFrente(obra, fr, i === frentes.length - 1));
  const total = somar(porFrente);
  total.areaLimpeza = obra.taxas.areaCanteiro;
  // perfil longitudinal a cada estaca: greide do pavimento e cota do subleito
  const rows = [];
  for (let s = 0; s <= P.L + 1e-6; s += P.EST) rows.push({ s, est: s / P.EST, gr: gr(s), sg: sg(s), D: diametroRede(s) });
  return { frentes: porFrente, total, rows, teorLigante: obra.taxas.teorLigante };
}
