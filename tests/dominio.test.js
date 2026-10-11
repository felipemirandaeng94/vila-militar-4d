// Testes das regras da obra (camada de domínio).
// A referência tests/referencia/fase1.json foi gerada com o código migrado na Fase 1 (comportamento do HTML original):
// a refatoração da Fase 2 precisa reproduzir os mesmos quantitativos, cronogramas, frentes e ensaios.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { carregarDados } from '../src/dados.js';
import { configurarDominio, montarModelo } from '../src/dominio/modelo.js';
import { validarDados } from '../src/dominio/validacao.js';
import { gateStatus } from '../src/dominio/liberacoes.js';
import { metricas, diaDaDecisao } from '../src/dominio/missao.js';
import { activeSvc } from '../src/dominio/cronograma.js';
import { stateAt } from '../src/dominio/frentes.js';

const REF = JSON.parse(fs.readFileSync(new URL('./referencia/fase1.json', import.meta.url), 'utf8'));
const OPCOES = {
  nenhum: {},
  base: { failBase: 1, rwBase: 1 },
  cbuq: { failCbuq: 1, rwCbuq: 1 },
  missaoSemRetrabalho: { failBase: 1, failCbuq: 1 },
  missaoComRetrabalhos: { failBase: 1, failCbuq: 1, rwBase: 1, rwCbuq: 1 }
};
// mesmo arredondamento usado no retrato de referência
const limpa = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
const copia = o => JSON.parse(JSON.stringify(o));

let dados, q;
beforeAll(() => {
  dados = carregarDados();
  q = configurarDominio(dados);
});
const modelo = (opt, d = dados) => montarModelo(d, q, opt);

describe('dados', () => {
  it('os arquivos de dados/ passam na validação', () => {
    expect(validarDados(dados)).toEqual([]);
  });
  it('a validação aponta campo ausente, grupo inexistente e janela invertida', () => {
    const d = copia(dados);
    delete d.servicos.servicos[0].nome;
    d.servicos.servicos[1].grupo = 'inexistente';
    d.servicos.servicos[2].janelas = [[6, 2]];
    const erros = validarDados(d);
    expect(erros.some(e => e.includes('servicos[0]') && e.includes('"nome"'))).toBe(true);
    expect(erros.some(e => e.includes('servicos[2]') && e.includes('posterior ao fim'))).toBe(true);
    const d2 = copia(dados);
    d2.servicos.servicos[1].grupo = 'inexistente';
    expect(validarDados(d2).some(e => e.includes('grupo "inexistente"'))).toBe(true);
  });
  it('a validação aponta decisão que referencia serviço inexistente', () => {
    const d = copia(dados);
    d.decisoes.decisoes[0].servico = 'S99';
    expect(validarDados(d).some(e => e.includes('S99'))).toBe(true);
  });
});

describe('quantitativos', () => {
  it('reproduz os volumes de referência (corte ≈ 2.061 m³, aterro ≈ 2.754 m³, CBUQ ≈ 254 t)', () => {
    expect(q.Vc).toBeCloseTo(2061.47, 1);
    expect(q.Va).toBeCloseTo(2754.17, 1);
    expect(q.Trv).toBeCloseTo(254.1, 6);
    expect(q.nLifts).toBe(9);
    const r = limpa(q);
    for (const k of Object.keys(REF.q)) expect(r[k], k).toEqual(REF.q[k]);
  });
  it('diagrama de massas: volumes acumulados por estaca iguais à referência', () => {
    expect(q.rows).toHaveLength(16);
    expect(limpa(q.rows.map(r => [r.s, r.vc, r.va, r.cum]))).toEqual(REF.q.rows.map(r => [r.s, r.vc, r.va, r.cum]));
    // o acumulado é a soma de corte − aterro × fator de homogeneização
    const fim = q.rows.reduce((a, r) => a + r.vc - r.va * 1.2, 0);
    expect(q.rows.at(-1).cum).toBeCloseTo(fim, 9);
  });
  it('pavimentação: áreas, volumes e massa de CBUQ coerentes com a seção-tipo', () => {
    expect(q.Areg).toBe(300 * 9);
    expect(q.Vsb).toBeCloseTo(300 * 8 * 0.2, 9);
    expect(q.Vba).toBeCloseTo(300 * 7.6 * 0.15, 9);
    expect(q.Trv).toBeCloseTo(300 * 7 * 0.05 * 2.42, 9);
  });
});

describe('cronograma', () => {
  const CAMPOS = ['id', 'g', 'rework', 'nome', 'win', 'lanes', 'cura', 'norma', 'efetivo', 'eq', 'qtd', 'lib', 'falha', 'a', 'b'];
  const pick = s => Object.fromEntries(CAMPOS.filter(k => s[k] !== undefined).map(k => [k, s[k]]));
  for (const caso of Object.keys(OPCOES))
    it(`serviços e janelas iguais à referência (${caso})`, () => {
      const m = modelo(OPCOES[caso]);
      expect(limpa(m.svc.map(pick))).toEqual(REF.casos[caso].svc);
      expect(m.fim).toBe(REF.casos[caso].fim);
    });
  it('sem não conformidade a obra termina no dia 34', () => {
    expect(modelo({}).fim).toBe(34);
  });
  it('retrabalho da base: insere R1 antes da imprimação e atrasa imprimação, pintura, CBUQ e entrega em 1 dia', () => {
    const a = modelo({}).svc,
      b = modelo({ failBase: 1, rwBase: 1 }).svc;
    const ids = b.map(s => s.id);
    expect(ids.indexOf('R1')).toBe(ids.indexOf('S13') - 1);
    for (const id of ['S13', 'S14', 'S15', 'S16', 'S17']) expect(b.find(s => s.id === id).b).toBeCloseTo(a.find(s => s.id === id).b + 1, 9);
    for (const id of ['S11', 'S12']) expect(b.find(s => s.id === id).b).toBe(a.find(s => s.id === id).b);
  });
  it('retrabalho do CBUQ: usina parada (R2), fresagem do trecho lançado e faixas refeitas', () => {
    const m = modelo({ failCbuq: 1, rwCbuq: 1 });
    const s15 = m.svc.find(s => s.id === 'S15'),
      r2 = m.svc.find(s => s.id === 'R2');
    expect(s15.falha).toEqual({ a: 28.3, b: 28.36, s: 28.6, rem: [28.5, 29.2] });
    expect(s15.lanes.BD[0]).toBeCloseTo(29.3, 9);
    expect(r2.win[0][0]).toBeCloseTo(28.4, 9);
    expect(m.fim).toBe(35);
  });
  it('os dois retrabalhos juntos atrasam a entrega em 2 dias', () => {
    expect(modelo(OPCOES.missaoComRetrabalhos).fim).toBe(36);
  });
  it('alterar a janela de um serviço no JSON muda o cronograma e a frente no 3D', () => {
    const d = copia(dados);
    d.servicos.servicos.find(s => s.id === 'S09').janelas = [[15, 18]];
    const m = modelo({}, d);
    expect(m.svc.find(s => s.id === 'S09').b).toBe(18);
    expect(m.frentes.reg).toEqual([
      [15, 0],
      [18, 300]
    ]);
    expect(stateAt(m.frentes, 16.5).reg).toBeCloseTo(150, 9);
    expect(activeSvc(m.svc, 'S09', 17.5)).not.toBeNull();
  });
});

describe('frentes de serviço', () => {
  const NOMES = { pc: 'corte', ck: 'corpo' };
  for (const caso of Object.keys(OPCOES))
    it(`quadros-chave iguais à referência (${caso})`, () => {
      const F = modelo(OPCOES[caso]).frentes;
      const conv = Object.fromEntries(
        Object.entries(F)
          .filter(([k]) => k !== 'hydro')
          .map(([k, v]) => [NOMES[k] || k, v])
      );
      expect(limpa(conv)).toEqual(REF.casos[caso].F);
    });
});

describe('ensaios', () => {
  for (const caso of Object.keys(OPCOES))
    it(`ensaios, deflexões e dias iguais à referência (${caso})`, () => {
      const m = modelo(OPCOES[caso]);
      expect(limpa(m.ensaios)).toEqual(REF.casos[caso].T);
      expect(m.dBase).toEqual(REF.casos[caso].dBase);
      expect(m.dFin).toEqual(REF.casos[caso].dFin);
    });
  it('quantidade de ensaios por cenário', () => {
    expect(modelo({}).ensaios).toHaveLength(177);
    expect(modelo({ failBase: 1, rwBase: 1 }).ensaios).toHaveLength(178);
    expect(modelo(OPCOES.missaoComRetrabalhos).ensaios).toHaveLength(179);
  });
  it('a reprovação real do corpo do aterro tem reensaio conforme no mesmo ponto', () => {
    const T = modelo({}).ensaios;
    const nc = T.filter(t => !t.ok);
    expect(nc.map(t => t.nome)).toEqual(['GC corpo do aterro, camada 4']);
    const re = T.find(t => t.re && t.nome === 'GC corpo do aterro, camada 4 (reensaio)');
    expect(re.s).toBe(nc[0].s);
    expect(re.day).toBeCloseTo(nc[0].day + 0.08, 9);
  });
  it('ensaios ordenados por dia e com estaca e cota quando são de campo', () => {
    const T = modelo({}).ensaios;
    for (let i = 1; i < T.length; i++) expect(T[i].day).toBeGreaterThanOrEqual(T[i - 1].day);
    for (const t of T.filter(t => t.s != null)) expect(Number.isFinite(t.y)).toBe(true);
  });
  it('acrescentar um bloco no fim de ensaios.json cria o ensaio sem tocar no código', () => {
    const d = copia(dados);
    d.ensaios.geradores.push({
      tipo: 'lista',
      servico: 'S16',
      categoria: 'campo',
      camada: 'rv',
      dia: { servico: 'S16', em: 'fim', mais: -0.2 },
      itens: [{ nome: 'Espessura por extração adicional', norma: 'DNIT 031/2024-ES', s: 150, z: 1.75, v: '5,0', unidade: 'cm', criterio: 'Espessura ± 5 %' }]
    });
    const T = modelo({}, d).ensaios;
    expect(T).toHaveLength(178);
    const t = T.find(x => x.nome === 'Espessura por extração adicional');
    expect(t.day).toBeCloseTo(31.8, 9);
  });
});

describe('liberações de camada', () => {
  it('emitidas na ordem das camadas, depois do último ensaio de cada serviço', () => {
    const m = modelo({});
    const L = m.liberacoes;
    expect(L.map(g => g.id)).toEqual(['BLC-A', 'BLC-1', 'BLC-2', 'BLC-3', 'BLC-4', 'BLC-5', 'ACEITE']);
    for (let i = 1; i < L.length; i++) expect(L[i].day).toBeGreaterThan(L[i - 1].day);
    for (const g of L) {
      const ultimo = Math.max(...m.ensaios.filter(t => g.svc.includes(t.svc)).map(t => t.day));
      expect(g.day).toBeGreaterThan(ultimo);
    }
    expect(L.find(g => g.id === 'BLC-1').day).toBeCloseTo(17.04, 9);
    expect(L.find(g => g.id === 'BLC-4').day).toBeCloseTo(27.54, 9); // fim da cura da imprimação
  });
  it('não conformidade aberta antes do reensaio e liberação emitida depois', () => {
    const m = modelo({ failBase: 1, rwBase: 1 });
    const g = m.liberacoes.find(x => x.id === 'BLC-3');
    const nc = m.ensaios.find(t => !t.ok && t.nome === 'GC base');
    expect(gateStatus(g, m.ensaios, nc.day + 0.01).k).toBe('bad');
    expect(gateStatus(g, m.ensaios, g.day).k).toBe('ok');
    expect(gateStatus(g, m.ensaios, 0).k).toBe('pend');
  });
  it('sem retrabalho, a reprovação da base mantém a não conformidade aberta', () => {
    const m = modelo({ failBase: 1 });
    const g = m.liberacoes.find(x => x.id === 'BLC-3');
    expect(gateStatus(g, m.ensaios, g.day - 0.01).k).toBe('bad');
  });
});

describe('missão', () => {
  const efeitos = o => ({ d: o.efeitos.atraso, c: o.efeitos.custo, q: o.efeitos.qualidade, n: o.efeitos.conformidade });
  const jogar = escolha => {
    const decs = dados.decisoes.decisoes;
    const ops = decs.map(escolha);
    const opt = Object.assign({}, dados.decisoes.opcoesBase, ...ops.map(o => o.opcoes || {}));
    const m = modelo(opt);
    const eventos = ops.filter(o => o.consequencia).map(o => efeitos(o.consequencia));
    return metricas({
      escolhas: ops.map(efeitos),
      eventos,
      fim: m.fim,
      prazo: dados.obra.calendario.prazoContratualDias,
      opt,
      pontuacao: dados.decisoes.pontuacao
    });
  };
  it('todas as melhores decisões: nota 9,8 (Excelente), com os retrabalhos sem penalidade de prazo', () => {
    const r = jogar(dc => dc.opcoes.find(o => o.avaliacao === 2));
    expect(r.d).toBe(2);
    expect(r.c).toBeCloseTo(20.5, 9);
    expect(r.q).toBe(100);
    expect(r.n).toBe(100);
    expect(r.nota).toBeCloseTo((35 + 35 + 15 + 0.15 * (100 - 20.5 / 1.5)) / 10, 9);
    expect(r.conceito).toBe('Excelente');
  });
  it('sempre a primeira alternativa: nota e conceito calculados com consequências', () => {
    const r = jogar(dc => dc.opcoes[0]);
    // qualidade 100 − 95 (decisões) − 30 (consequências de D3, D7 e D9) → limitada a 0; conformidade 100 − 120 → 0
    expect(r.q).toBe(0);
    expect(r.n).toBe(0);
    // custo: D4 1,5 + D8 6 + D10 14 + consequências 30 + 62 + 35; atraso só das consequências (1 + 2 + 1,5)
    expect(r.c).toBeCloseTo(148.5, 9);
    expect(r.d).toBeCloseTo(4.5, 9);
    expect(r.nota).toBeCloseTo((0.15 * (100 - 15 * 4.5) + 0.15 * (100 - 148.5 / 1.5)) / 10, 9);
    expect(r.conceito).toBe('Insuficiente');
  });
  it('dia de cada decisão no cenário da missão', () => {
    const m = modelo(dados.decisoes.opcoesBase);
    const dia = id => diaDaDecisao(dados.decisoes.decisoes.find(d => d.id === id).dia, m.svc, m.ensaios);
    expect(dia('D1')).toBe(0.35);
    expect(dia('D6')).toBeCloseTo(16.85, 9);
    expect(dia('D8')).toBeCloseTo(25.1, 9);
    expect(dia('D10')).toBeCloseTo(28.65, 9);
    const t = m.ensaios.find(x => !x.ok && /^GC corpo do aterro, camada 4$/.test(x.nome));
    expect(dia('D3')).toBeCloseTo(t.day + 0.012, 9);
    // sem a falha do CBUQ, a decisão do teor de ligante não aparece
    const m2 = modelo({ failBase: 1 });
    expect(diaDaDecisao(dados.decisoes.decisoes.find(d => d.id === 'D9').dia, m2.svc, m2.ensaios)).toBeNull();
  });
});
