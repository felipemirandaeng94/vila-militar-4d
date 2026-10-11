// Testes das regras da obra (camada de domínio) para a reconstrução de 1,6 km por frentes de serviço.
import { describe, it, expect, beforeAll } from 'vitest';
import { carregarDados } from '../src/dados.js';
import { configurarDominio, montarModelo } from '../src/dominio/modelo.js';
import { validarDados } from '../src/dominio/validacao.js';
import { dividirFrentes, janela, diaNaEstaca, estadoDoDesvio } from '../src/dominio/frentes.js';
import { buildSchedule, arredondar } from '../src/dominio/cronograma.js';
import { gateStatus } from '../src/dominio/liberacoes.js';
import { metricas, diaDaDecisao } from '../src/dominio/missao.js';
import { P } from '../src/dominio/geometria.js';

const copia = o => JSON.parse(JSON.stringify(o));
let dados, q;
beforeAll(() => {
  dados = carregarDados();
  q = configurarDominio(dados);
});
const modelo = (opt = {}, d = dados) => montarModelo(d, d === dados ? q : configurarDominio(d), opt);
const jan = (m, id, f, faixa) => janela(m.svc, id, f, faixa);
const fimNaFrente = (m, id, f) => Math.max(...m.svc.filter(s => s.id === id).flatMap(s => s.jan.filter(w => w.f === f).map(w => w.b)));
const iniNaFrente = (m, id, f) => Math.min(...m.svc.filter(s => s.id === id).flatMap(s => s.jan.filter(w => w.f === f).map(w => w.a)));

describe('dados', () => {
  it('os arquivos de dados/ passam na validação', () => {
    expect(validarDados(dados)).toEqual([]);
  });
  it('a validação aponta campo ausente, dependência inexistente, chave de quantidade desconhecida e janela invertida', () => {
    const d = copia(dados);
    delete d.servicos.servicos[0].nome;
    d.servicos.servicos.find(s => s.id === 'S09').depende = [{ de: 'S99' }];
    d.servicos.servicos.find(s => s.id === 'S11').quantidade.chave = 'metrosDeVala';
    d.servicos.servicos.find(s => s.id === 'S02').janelas = [[6, 2]];
    const erros = validarDados(d);
    expect(erros.some(e => e.includes('servicos[0]') && e.includes('"nome"'))).toBe(true);
    expect(erros.some(e => e.includes('posterior ao fim'))).toBe(true);
    const d2 = copia(dados);
    d2.servicos.servicos.find(s => s.id === 'S09').depende = [{ de: 'S99' }];
    d2.servicos.servicos.find(s => s.id === 'S11').quantidade.chave = 'metrosDeVala';
    const e2 = validarDados(d2);
    expect(e2.some(e => e.includes('"S99" não existe'))).toBe(true);
    expect(e2.some(e => e.includes('"metrosDeVala" não é calculada'))).toBe(true);
  });
  it('a validação aponta decisão que referencia serviço inexistente', () => {
    const d = copia(dados);
    d.decisoes.decisoes[0].servico = 'S99';
    expect(validarDados(d).some(e => e.includes('S99'))).toBe(true);
  });
});

describe('frentes de serviço', () => {
  it('1.600 m com frentes de 400 m: 4 frentes contíguas, sem lacuna nem sobreposição', () => {
    const F = dividirFrentes(1600, 400);
    expect(F).toHaveLength(4);
    expect(F[0].s0).toBe(0);
    expect(F.at(-1).s1).toBe(1600);
    for (let i = 1; i < F.length; i++) expect(F[i].s0).toBe(F[i - 1].s1);
    expect(F.reduce((a, f) => a + (f.s1 - f.s0), 0)).toBe(1600);
  });
  it('frentes de 350 m: 5 frentes, e a última fica com o resto (200 m)', () => {
    const F = dividirFrentes(1600, 350);
    expect(F).toHaveLength(5);
    expect(F.map(f => f.s1 - f.s0)).toEqual([350, 350, 350, 350, 200]);
  });
  it('o modelo usa o tamanho de frente do JSON (4 frentes de 400 m) a partir do canteiro, no início do trecho', () => {
    const m = modelo();
    expect(m.frentes.map(f => [f.s0, f.s1])).toEqual([
      [0, 400],
      [400, 800],
      [800, 1200],
      [1200, 1600]
    ]);
    expect(P.CANT.s0).toBe(0);
  });
  it('as frentes avançam em sequência: cada frente abre e é liberada depois da anterior', () => {
    const F = modelo().frentes;
    for (let i = 1; i < F.length; i++) {
      expect(F[i].desvio[0].d).toBeGreaterThanOrEqual(F[i - 1].desvio[0].d);
      expect(F[i].lib).toBeGreaterThan(F[i - 1].lib);
    }
  });
  it('no máximo duas frentes abertas (com tráfego desviado) ao mesmo tempo', () => {
    const F = modelo().frentes;
    for (let d = 0; d < 112; d += 0.25) {
      const abertas = F.filter(f => d >= f.desvio[0].d && d < f.lib).length;
      expect(abertas).toBeLessThanOrEqual(2);
    }
  });
  it('estado do desvio: via em uso, meia pista, desvio total, meia pista e liberada', () => {
    const f = modelo().frentes[0];
    expect(f.desvio.map(x => x.estado)).toEqual(['meiaPista', 'total', 'meiaPista', 'liberada']);
    expect(estadoDoDesvio(f, 0)).toBe('emUso');
    expect(estadoDoDesvio(f, f.desvio[1].d + 0.1)).toBe('total');
    expect(estadoDoDesvio(f, f.lib + 0.1)).toBe('liberada');
  });
  it('mudar o tamanho da frente no JSON muda o cronograma sem tocar no código', () => {
    const d = copia(dados);
    d.servicos.frentes.tamanho = 320;
    const m = modelo({}, d);
    expect(m.frentes).toHaveLength(5);
    expect(m.fim).not.toBe(modelo().fim);
  });
});

describe('precedência', () => {
  it('em nenhuma frente a sub-base começa antes do fim da drenagem e do reaterro aprovado', () => {
    for (const opt of [{}, { failTubo: 1, rwTubo: 1 }, { rwRede: 1 }]) {
      const m = modelo(opt);
      for (const f of m.frentes) {
        const sb = iniNaFrente(m, 'S20', f.i);
        for (const id of ['S11', 'S12', 'S13', 'S14', 'R3', 'R4'])
          if (m.svc.some(s => s.id === id && s.jan.some(w => w.f === f.i))) expect(sb).toBeGreaterThanOrEqual(fimNaFrente(m, id, f.i));
        const reaterro = m.ensaios.filter(t => t.f === f.i && /^GC do reaterro/.test(t.nome));
        expect(reaterro.length).toBeGreaterThan(0);
        expect(sb).toBeGreaterThan(Math.max(...reaterro.map(t => t.day)));
        const blcD = m.liberacoes.find(g => g.tipo === 'BLC-D' && g.f === f.i);
        expect(sb).toBeGreaterThan(blcD.day);
      }
    }
  });
  it('o CBUQ não começa antes da imprimação curada, em cada faixa de cada frente', () => {
    const m = modelo();
    for (const f of m.frentes) {
      const imp = m.svc.find(s => s.id === 'S22').jan.find(w => w.f === f.i && w.cura);
      for (const fx of ['BD', 'BE']) expect(jan(m, 'S24', f.i, fx).a).toBeGreaterThanOrEqual(imp.cura[1]);
    }
  });
  it('a liberação ao tráfego vem depois da sinalização definitiva', () => {
    const m = modelo();
    for (const f of m.frentes) {
      expect(f.lib).toBeGreaterThanOrEqual(fimNaFrente(m, 'S26', f.i));
      expect(f.lib).toBeGreaterThanOrEqual(fimNaFrente(m, 'S27', f.i));
      const lib = m.liberacoes.find(g => g.tipo === 'LIB' && g.f === f.i);
      expect(lib.day).toBeGreaterThan(fimNaFrente(m, 'S26', f.i));
    }
  });
  it('a pintura de ligação e o CBUQ alternam as faixas: pintura BD, CBUQ BD, pintura BE, CBUQ BE', () => {
    const m = modelo();
    const f = 0;
    const seq = [jan(m, 'S23', f, 'BD'), jan(m, 'S24', f, 'BD'), jan(m, 'S23', f, 'BE'), jan(m, 'S24', f, 'BE')];
    for (let i = 1; i < seq.length; i++) expect(seq[i].a).toBeGreaterThanOrEqual(seq[i - 1].b);
  });
});

describe('cronograma', () => {
  const S = id => dados.servicos.servicos.find(s => s.id === id);
  it('duração = quantidade ÷ produtividade, arredondada para cima em décimos de dia', () => {
    const m = modelo();
    const qf = q.frentes[0];
    for (const id of ['S09', 'S11', 'S15', 'S17', 'S18', 'S20', 'S21']) {
      const s = S(id);
      const w = jan(m, id, 0);
      const esperado = arredondar(qf[s.quantidade.chave] / s.produtividade.valor, 0.1);
      expect(w.b - w.a).toBeCloseTo(esperado, 9);
    }
    expect(jan(m, 'S09', 0).b - jan(m, 'S09', 0).a).toBeCloseTo(1.4, 9); // 2.800 m² ÷ 2.000 m²/dia
    expect(jan(m, 'S11', 0).b - jan(m, 'S11', 0).a).toBeCloseTo(13.6, 9); // 474 m de vala ÷ 35 m/dia
    // CBUQ em meia pista: metade da massa da frente em cada faixa (338,8 t ÷ 2 ÷ 400 t/dia → 0,5 dia)
    expect(jan(m, 'S24', 0, 'BD').b - jan(m, 'S24', 0, 'BD').a).toBeCloseTo(0.5, 9);
  });
  it('dobrar uma produtividade no JSON reduz a duração do serviço', () => {
    const d = copia(dados);
    d.servicos.servicos.find(s => s.id === 'S09').produtividade.valor = 4000;
    const a = modelo(),
      b = modelo({}, d);
    const dur = (m, id) => jan(m, id, 0).b - jan(m, id, 0).a;
    expect(dur(b, 'S09')).toBeCloseTo(0.7, 9);
    expect(dur(b, 'S09')).toBeLessThan(dur(a, 'S09'));
    // a drenagem continua sendo o gargalo; o fim pode até não mudar, mas nunca piora
    expect(b.fim).toBeLessThanOrEqual(a.fim);
  });
  it('mais uma equipe de drenagem no JSON encurta a obra', () => {
    const d = copia(dados);
    d.servicos.servicos.find(s => s.id === 'S11').equipes = 2;
    expect(modelo({}, d).fim).toBeLessThan(modelo().fim);
  });
  it('sem não conformidade a obra termina dentro do prazo contratual', () => {
    const m = modelo();
    expect(m.fim).toBeLessThanOrEqual(dados.obra.calendario.prazoContratualDias);
    expect(m.fim).toBeGreaterThan(dados.obra.calendario.prazoContratualDias - 1);
  });
  it('retrabalho da base (frente 2): atrasa a frente 2 e as que dependem dela, sem mexer na frente 1', () => {
    const a = modelo(),
      b = modelo({ failBase: 1, rwBase: 1 });
    const r1 = b.svc.find(s => s.id === 'R1');
    expect(r1.jan[0].f).toBe(1);
    expect(r1.jan[0].a).toBeGreaterThanOrEqual(fimNaFrente(b, 'S21', 1));
    expect(jan(b, 'S22', 1, 'BD').a).toBeGreaterThanOrEqual(r1.jan[0].b);
    expect(b.frentes[0].lib).toBe(a.frentes[0].lib);
    expect(b.frentes[1].lib).toBeCloseTo(a.frentes[1].lib + 1, 9);
    expect(b.frentes[3].lib).toBeGreaterThan(a.frentes[3].lib);
  });
  it('retrabalho do CBUQ (frente 1): usina parada, fresagem do trecho lançado e faixa refeita', () => {
    const a = modelo(),
      b = modelo({ failCbuq: 1, rwCbuq: 1 });
    const s24 = b.svc.find(s => s.id === 'S24');
    expect(s24.falha.f).toBe(0);
    expect(s24.falha.faixa).toBe('BD');
    expect(s24.falha.s - s24.falha.s0).toBeCloseTo(28.6, 9);
    const r2 = b.svc.find(s => s.id === 'R2').jan[0];
    expect(r2.a).toBeCloseTo(s24.falha.b, 9);
    expect(jan(b, 'S24', 0, 'BD').a).toBeCloseTo(r2.b, 9);
    expect(b.frentes[0].lib).toBeCloseTo(a.frentes[0].lib + 1, 9);
    expect(b.frentes[1].lib).toBe(a.frentes[1].lib);
  });
  it('rede não cadastrada (frente 2): a vala para um dia e as camadas da frente 2 esperam', () => {
    const a = modelo(),
      b = modelo({ rwRede: 1 });
    expect(jan(b, 'S11', 1).b - jan(b, 'S11', 1).a).toBeCloseTo(jan(a, 'S11', 1).b - jan(a, 'S11', 1).a + 1, 9);
    expect(b.svc.find(s => s.id === 'R4').jan[0].f).toBe(1);
    expect(jan(b, 'S11', 0).b).toBe(jan(a, 'S11', 0).b);
  });
});

describe('quantitativos', () => {
  it('área de pista = extensão × 7,0 m; meio-fio e sarjeta = 2 × extensão; CBUQ = área × espessura × densidade', () => {
    const t = q.total;
    expect(t.areaFresagem).toBeCloseTo(1600 * 7.0, 6);
    expect(t.areaImprimacao).toBeCloseTo(1600 * 7.0, 6);
    expect(t.extMeioFio).toBeCloseTo(2 * 1600, 6);
    expect(t.extSarjeta).toBeCloseTo(2 * 1600, 6);
    expect(t.toneladasCBUQ).toBeCloseTo(1600 * 7.0 * 0.05 * 2.42, 6);
    expect(t.toneladasCBUQ).toBeCloseTo(1355.2, 6);
  });
  it('bocas de lobo e poços de visita conforme o espaçamento', () => {
    // bocas de lobo a cada 40 m (a partir da est. 1), dos dois lados; poços de visita a cada 80 m, do início ao fim
    expect(q.total.nBocasDeLobo).toBe(2 * 40);
    expect(q.total.nPocosDeVisita).toBe(1600 / 80 + 1);
    expect(q.frentes.map(f => f.nPocosDeVisita)).toEqual([5, 5, 5, 6]);
    const d = copia(dados);
    d.obra.drenagem.espacamentoPocosDeVisita = 100;
    expect(configurarDominio(d).total.nPocosDeVisita).toBe(17);
    configurarDominio(dados);
  });
  it('demolição, drenagem e subleito', () => {
    const t = q.total;
    expect(t.volFresado).toBeCloseTo(11200 * 0.05, 6);
    expect(t.volFresadoSolto).toBeCloseTo(560 * 1.25, 6);
    expect(t.volRemocao).toBeCloseTo(1600 * 8.1 * 0.35, 6);
    expect(t.tubos['0,40'] + t.tubos['0,60']).toBeCloseTo(t.extVala, 6);
    expect(t.tubos['0,60']).toBeCloseTo(800, 6);
    expect(t.volReaterro).toBeLessThan(t.volEscavacaoVala);
    expect(t.volSubstituicao).toBeCloseTo(80 * 8.1 * 0.6, 6);
  });
});

describe('ensaios', () => {
  it('ensaios novos por frente: fresagem, fresado, tubos, reaterro, ISC, concreto e sarjeta', () => {
    const m = modelo();
    const por = (re, f) => m.ensaios.filter(t => t.f === f && re.test(t.nome)).length;
    for (const f of [0, 1, 2, 3]) {
      expect(por(/^Espessura fresada/, f)).toBe(4);
      expect(por(/^Fresado da frente/, f)).toBe(2);
      expect(por(/^Recebimento do lote de tubos/, f)).toBe(1);
      expect(por(/^GC do reaterro da vala/, f)).toBe(f === 1 ? 9 : 8); // frente 2 tem um reensaio
      expect(por(/^ISC do subleito exposto/, f)).toBe(8);
      expect(por(/^Caimento longitudinal da sarjeta/, f)).toBe(4);
      expect(por(/^Resistência do concreto/, f)).toBe(3);
      expect(por(/^GC regularização/, f)).toBe(5);
      expect(por(/^Deflexão na base/, f)).toBe(20);
    }
  });
  it('dia dos ensaios novos acompanha a passagem do serviço pela estaca', () => {
    const m = modelo();
    for (const t of m.ensaios.filter(t => /^GC do reaterro da vala/.test(t.nome) && !t.re))
      expect(t.day).toBeCloseTo(diaNaEstaca(jan(m, 'S11', t.f), t.s) + 0.6, 9);
    for (const t of m.ensaios.filter(t => /^ISC do subleito exposto/.test(t.nome))) expect(t.day).toBeCloseTo(diaNaEstaca(jan(m, 'S15', t.f), t.s) + 4, 9);
  });
  it('reprovação do ISC do subleito gera o serviço de substituição de solo na frente afetada', () => {
    const m = modelo();
    const ruins = m.ensaios.filter(t => /^ISC do subleito exposto/.test(t.nome) && !t.ok);
    expect(ruins.map(t => t.f)).toEqual([1, 1]);
    const s16 = m.svc.find(s => s.id === 'S16');
    expect(s16.jan.map(w => w.f)).toEqual([1]);
    expect(s16.jan[0].a).toBeGreaterThanOrEqual(Math.max(...ruins.map(t => t.day)));
    // sem solo mole no JSON, não há reprovação nem substituição
    const d = copia(dados);
    d.obra.subleito.trechosComSoloRuim = [];
    const m2 = modelo({}, d);
    expect(m2.ensaios.filter(t => /^ISC do subleito exposto/.test(t.nome) && !t.ok)).toHaveLength(0);
    expect(m2.svc.some(s => s.id === 'S16')).toBe(false);
    // solo mole na frente 3: a substituição vai para a frente 3
    const d3 = copia(dados);
    d3.obra.subleito.trechosComSoloRuim = [{ de: 900, ate: 960, isc: 5 }];
    const m3 = modelo({}, d3);
    expect(m3.svc.find(s => s.id === 'S16').jan.map(w => w.f)).toEqual([2]);
    configurarDominio(dados);
  });
  it('lote de tubos reprovado não é assentado: a drenagem da frente espera o novo lote aprovado', () => {
    const m = modelo({ failTubo: 1, rwTubo: 1 });
    const insp = m.ensaios.filter(t => t.f === 2 && /^Recebimento do lote de tubos/.test(t.nome));
    const reprov = insp.find(t => !t.ok),
      novo = insp.find(t => t.re);
    expect(reprov).toBeTruthy();
    expect(novo).toBeTruthy();
    const r3 = m.svc.find(s => s.id === 'R3').jan[0];
    expect(reprov.day).toBeLessThan(r3.a);
    expect(jan(m, 'S11', 2).a).toBeGreaterThanOrEqual(novo.day);
    expect(jan(m, 'S11', 2).a).toBeGreaterThanOrEqual(r3.b);
    // sem o retrabalho, o lote reprovado fica como não conformidade aberta
    const m2 = modelo({ failTubo: 1 });
    expect(m2.ensaios.find(t => t.f === 2 && /^Recebimento/.test(t.nome) && !t.ok).obs).toMatch(/não conformidade aberta/);
  });
  it('acrescentar um bloco no fim de ensaios.json cria o ensaio sem tocar no código', () => {
    const d = copia(dados);
    d.ensaios.geradores.push({
      tipo: 'lista',
      servico: 'S28',
      categoria: 'lab',
      dia: { servico: 'S28', em: 'inicio' },
      itens: [{ nome: 'Cadastro como construído conferido', norma: 'Nota de serviço', v: 'conforme', unidade: '', criterio: 'Cadastro completo' }]
    });
    const a = modelo(),
      b = modelo({}, d);
    expect(b.ensaios).toHaveLength(a.ensaios.length + 1);
  });
  it('ensaios ordenados por dia e com estaca e cota quando são de campo', () => {
    const T = modelo().ensaios;
    for (let i = 1; i < T.length; i++) expect(T[i].day).toBeGreaterThanOrEqual(T[i - 1].day);
    for (const t of T.filter(t => t.s != null)) expect(Number.isFinite(t.y)).toBe(true);
  });
});

describe('liberações de camada', () => {
  it('uma liberação por camada e por frente, na ordem das camadas', () => {
    const m = modelo();
    for (const f of m.frentes) {
      const L = m.liberacoes.filter(g => g.f === f.i).map(g => g.tipo);
      expect(L).toEqual(['BLC-D', 'BLC-1', 'BLC-2', 'BLC-3', 'BLC-4', 'BLC-5', 'LIB']);
      const dias = m.liberacoes.filter(g => g.f === f.i).map(g => g.day);
      for (let i = 1; i < dias.length; i++) expect(dias[i]).toBeGreaterThan(dias[i - 1]);
    }
    expect(m.liberacoes.find(g => g.tipo === 'ACEITE').day).toBeGreaterThan(Math.max(...m.frentes.map(f => f.lib)));
  });
  it('não conformidade aberta antes do reensaio e liberação emitida depois', () => {
    const m = modelo({ failBase: 1, rwBase: 1 });
    const g = m.liberacoes.find(x => x.tipo === 'BLC-3' && x.f === 1);
    const nc = m.ensaios.find(t => !t.ok && t.nome === 'GC base');
    expect(nc.f).toBe(1);
    expect(gateStatus(g, m.ensaios, nc.day + 0.01).k).toBe('bad');
    expect(gateStatus(g, m.ensaios, g.day).k).toBe('ok');
    expect(gateStatus(g, m.ensaios, 0).k).toBe('pend');
  });
});

describe('missão', () => {
  const ef = o => ({ d: o.efeitos.atraso, c: o.efeitos.custo, q: o.efeitos.qualidade, n: o.efeitos.conformidade });
  const jogar = escolha => {
    const decs = dados.decisoes.decisoes;
    const ops = decs.map(escolha);
    const opt = Object.assign({}, dados.decisoes.opcoesBase, ...ops.map(o => o.opcoes || {}));
    const m = modelo(opt);
    const semRw = { ...opt };
    for (const k of dados.decisoes.pontuacao.retrabalhosSemPenalidade) delete semRw[k];
    const fimSemRw = buildSchedule(dados, q, semRw).svc.reduce((a, s) => Math.max(a, s.b), 0);
    const eventos = ops.filter(o => o.consequencia).map(o => ef(o.consequencia));
    return metricas({
      escolhas: ops.map(ef),
      eventos,
      fim: m.fim,
      prazo: dados.obra.calendario.prazoContratualDias,
      atrasoSemPenalidade: m.fim - fimSemRw,
      pontuacao: dados.decisoes.pontuacao
    });
  };
  it('13 decisões carregam do JSON, incluindo as 4 novas, e aparecem em dias do cronograma da missão', () => {
    const D = dados.decisoes.decisoes;
    expect(D).toHaveLength(13);
    const titulos = D.map(d => d.titulo);
    for (const t of [
      'Rede não cadastrada na vala',
      'Chuva forte prevista com vala aberta',
      'Tubo de concreto trincado no recebimento',
      'Percentual de fresado reaproveitado na usina'
    ])
      expect(titulos).toContain(t);
    const m = modelo(dados.decisoes.opcoesBase);
    for (const d of D) {
      const dia = diaDaDecisao(d.dia, m.svc, m.ensaios);
      expect(dia, d.id).not.toBeNull();
      expect(dia).toBeGreaterThan(0);
      expect(dia).toBeLessThan(m.fim);
      for (const o of d.opcoes.filter(o => o.consequencia && typeof o.consequencia.dia === 'object'))
        expect(diaDaDecisao(o.consequencia.dia, m.svc, m.ensaios)).toBeGreaterThan(dia);
    }
  });
  it('todas as melhores decisões: nota alta, sem penalidade pelos retrabalhos decididos', () => {
    const r = jogar(dc => dc.opcoes.find(o => o.avaliacao === 2));
    expect(r.q).toBe(100);
    expect(r.n).toBe(100);
    expect(r.nota).toBeGreaterThanOrEqual(9);
    expect(r.conceito).toBe('Excelente');
  });
  it('as decisões novas mudam a nota conforme a consequência', () => {
    const melhor = dc => dc.opcoes.find(o => o.avaliacao === 2);
    const base = jogar(melhor);
    for (const id of ['D4', 'D11', 'D12', 'D13']) {
      const pior = jogar(dc => (dc.id === id ? dc.opcoes.find(o => o.avaliacao === 0) : melhor(dc)));
      expect(pior.nota, id).toBeLessThan(base.nota);
    }
  });
  it('sempre a primeira alternativa: nota insuficiente', () => {
    const r = jogar(dc => dc.opcoes[0]);
    expect(r.nota).toBeLessThan(5);
    expect(r.conceito).toBe('Insuficiente');
  });
});
