// Validação dos arquivos de dados/ com esquemas simples. Devolve a lista de erros (vazia se tudo estiver certo).
//
// Notação dos esquemas:
//   'numero' | 'texto' | 'textoLivre' (aceita vazio) | 'booleano' | 'nulo' | 'qualquer'
//   { campo: esquema, '?campo': esquema opcional }      objeto com campos
//   ['lista', esquema, minimo?]                          lista de itens
//   ['mapa', esquema]                                    objeto com chaves livres
//   ['janela']                                           [início, fim] com início ≤ fim
//   ['umDe', ...valores]                                 valor de uma lista fechada
//   ['ou', esquema1, esquema2, ...]                      aceita qualquer um dos esquemas

function verifica(v, e, caminho, erros) {
  const erro = msg => erros.push(`${caminho}: ${msg}`);
  if (e === 'qualquer') return;
  if (e === 'numero') return typeof v === 'number' && Number.isFinite(v) ? null : erro('deveria ser um número');
  if (e === 'texto') return typeof v === 'string' && v.trim() ? null : erro('deveria ser um texto não vazio');
  if (e === 'textoLivre') return typeof v === 'string' ? null : erro('deveria ser um texto');
  if (e === 'nulo') return v === null ? null : erro('deveria ser null');
  if (e === 'booleano') return typeof v === 'boolean' ? null : erro('deveria ser verdadeiro ou falso');
  if (Array.isArray(e)) {
    const [tipo, ...arg] = e;
    if (tipo === 'lista') {
      if (!Array.isArray(v)) return erro('deveria ser uma lista');
      if (arg[1] && v.length < arg[1]) erro(`deveria ter pelo menos ${arg[1]} itens`);
      v.forEach((x, i) => verifica(x, arg[0], `${caminho}[${i}]`, erros));
      return;
    }
    if (tipo === 'mapa') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return erro('deveria ser um objeto');
      for (const k in v) verifica(v[k], arg[0], `${caminho}.${k}`, erros);
      return;
    }
    if (tipo === 'janela') {
      if (!Array.isArray(v) || v.length !== 2 || !v.every(x => typeof x === 'number')) return erro('deveria ser [início, fim] em dias úteis');
      if (v[0] > v[1]) erro(`o início (${v[0]}) é posterior ao fim (${v[1]})`);
      return;
    }
    if (tipo === 'umDe') return arg.includes(v) ? null : erro(`deveria ser um destes valores: ${arg.join(', ')}`);
    if (tipo === 'ou') {
      for (const alt of arg) {
        const tmp = [];
        verifica(v, alt, caminho, tmp);
        if (!tmp.length) return;
      }
      return erro('não corresponde a nenhum dos formatos aceitos');
    }
  }
  if (e && typeof e === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return erro('deveria ser um objeto');
    for (const k in e) {
      const opcional = k.startsWith('?'),
        nome = opcional ? k.slice(1) : k;
      if (v[nome] === undefined) {
        if (!opcional) erro(`falta o campo "${nome}"`);
      } else verifica(v[nome], e[k], `${caminho}.${nome}`, erros);
    }
  }
}

const num = 'numero',
  txt = 'texto';

const OBRA = {
  obra: { titulo: txt, local: txt, om: txt, trafego: txt, iscProjeto: num, aviso: txt },
  calendario: { inicio: txt, horaInicio: num, horasPorDia: num, prazoContratualDias: num },
  trecho: { extensao: num, estaca: num, cotaReferencia: num, cotaGreideInicio: num, rampaGreide: num },
  secao: { larguraPista: num, larguraFaixa: num, larguraSarjeta: num, larguraMeioFio: num, alturaMeioFio: num, espessuraSarjeta: num },
  pavimentoExistente: { '?nota': txt, espRevestimento: num, espBase: num, espSubBase: num },
  pavimentoNovo: { espSubBase: num, espBase: num, espRevestimento: num, espRegularizacao: num, espSubstituicaoSolo: num },
  drenagem: {
    '?nota': txt,
    afastamentoRede: num,
    diametros: ['lista', { ateEstaca: num, diametro: num }, 1],
    diametroRamal: num,
    comprimentoTubo: num,
    cobrimento: num,
    berco: num,
    folgaLateralVala: num,
    primeiraBocaDeLobo: num,
    espacamentoBocasDeLobo: num,
    espacamentoPocosDeVisita: num,
    desagueNaEstaca: num
  },
  empolamento: { fresado: num, remocao: num, escavacaoVala: num },
  subleito: { '?nota': txt, iscProjeto: num, trechosComSoloRuim: ['lista', { de: num, ate: num, isc: num }] },
  canteiro: { estacaInicio: num, estacaFim: num, afastamentoInicio: num, afastamentoFim: num, cota: num },
  taxas: {
    densidadeCBUQ: num,
    imprimacao: num,
    pinturaDiluida: num,
    teorLigante: num,
    teorLiganteFresado: num,
    larguraLimpeza: num,
    areaCanteiro: num,
    fresadoMaximoPct: num,
    '?notaFresado': txt
  },
  usina: ['lista', { nome: txt, descricao: txt }],
  contexto: ['lista', { titulo: txt, texto: txt }],
  diario: { tempoBom: txt }
};

// chaves de quantidade por frente calculadas em src/dominio/quantitativos.js
export const CHAVES_DE_QUANTIDADE = [
  'extensao', 'areaFresagem', 'volFresado', 'volFresadoSolto', 'volRemocao', 'volRemocaoSolta', 'extRede', 'extRamais', 'extVala', 'volEscavacaoVala',
  'volBerco', 'volReaterro', 'nBocasDeLobo', 'nPocosDeVisita', 'extSoloRuim', 'volSubstituicao', 'areaRegularizacao', 'extMeioFio', 'extSarjeta',
  'volConcretoSarjeta', 'areaSubBase', 'volSubBase', 'areaBase', 'volBase', 'areaImprimacao', 'litrosImprimacao', 'areaPintura', 'litrosEmulsao',
  'volCBUQ', 'toneladasCBUQ', 'toneladasCAP', 'areaLimpeza'
];

const DEP = { de: txt, '?tipo': ['umDe', 'TI', 'II', 'TT', 'passagem'], '?defasagem': num, '?em': ['umDe', 'fimDaCura'], '?trecho': ['umDe', 'soloRuim'] };
const SERVICO = {
  id: txt,
  grupo: txt,
  nome: txt,
  '?curto': txt,
  norma: txt,
  '?escopo': ['umDe', 'global', 'frente', 'final'],
  '?retrabalho': 'booleano',
  '?janelas': ['lista', ['janela'], 1],
  '?somente': ['umDe', 'ultimaFrente', 'soloRuim'],
  '?duracaoFixa': num,
  '?quantidade': ['ou', 'textoLivre', { chave: txt, unidade: txt }],
  '?produtividade': { valor: num, unidade: txt, '?ilustrativa': 'booleano' },
  '?faixas': 'booleano',
  '?cura': num,
  '?depende': ['lista', DEP],
  '?dependeFaixa': ['mapa', ['lista', { de: txt, faixa: ['umDe', 'BD', 'BE'] }]],
  '?aposGlobal': ['lista', txt],
  '?dependeFrenteAnterior': ['lista', DEP],
  '?equipe': ['ou', txt, 'nulo'],
  '?equipes': num,
  '?local': { de: num, ate: num, '?faixa': txt },
  '?inicio': DEP,
  efetivo: txt,
  equipamentos: ['lista', { nome: txt, qtd: num }],
  liberacao: txt,
  representacao: txt,
  '?diario': { '?quantitativo': txt, '?valor': num, unidade: txt, texto: txt }
};
const SERVICOS = {
  grupos: ['mapa', { nome: txt, cor: txt }],
  produtividades: { nota: txt, arredondamento: num, regraDeArredondamento: txt },
  frentes: {
    tamanho: num,
    abertasAoMesmoTempo: num,
    inicioApos: ['lista', txt],
    '?nota': txt,
    desvio: {
      estados: ['mapa', txt],
      sequencia: ['lista', { desde: { '?servico': txt, '?em': ['umDe', 'inicio', 'fim'], '?liberacao': 'booleano' }, estado: txt }, 1]
    }
  },
  servicos: ['lista', SERVICO, 1],
  retrabalhos: [
    'lista',
    {
      opcao: txt,
      frente: num,
      '?faixa': ['umDe', 'BD', 'BE'],
      '?inserirApos': txt,
      '?inserirAntes': txt,
      '?bloqueia': ['lista', txt],
      '?acrescentar': { servico: txt, dias: num },
      '?falhaAntesDe': txt,
      '?falha': { duracao: num, extensao: num, remocao: ['janela'] },
      servico: SERVICO
    }
  ],
  cenarios: ['mapa', { nome: txt, descricao: txt, opcoes: ['mapa', num] }],
  liberacoes: ['lista', { id: txt, nome: txt, servicos: ['lista', txt, 1], porFrente: 'booleano' }]
};

const DIA = {
  '?fixo': num,
  '?relativo': 'booleano',
  '?camada': 'booleano',
  '?fracao': num,
  '?frente': txt,
  '?servico': txt,
  '?faixa': txt,
  '?em': ['umDe', 'inicio', 'fim', 'curaInicio', 'curaFim', 'falhaOuInicio'],
  '?mais': num,
  '?passo': num,
  '?maisPorEstaca': num,
  '?senao': 'qualquer'
};
const TEXTO_VAR = ['ou', txt, { se: ['lista', txt], sim: txt, nao: txt }, ['mapa', txt]];
const VALOR = {
  media: num,
  '?desvio': num,
  '?uniforme': num,
  '?piso': ['lista', num],
  '?min': num,
  '?max': num,
  '?casas': num,
  '?formato': ['umDe', 'inteiro'],
  '?trechos': ['umDe', 'soloRuim'],
  '?aprovacao': { '?minimo': num, '?maximo': num }
};
const ITEM_LISTA = {
  '?condicao': ['lista', txt],
  nome: TEXTO_VAR,
  norma: txt,
  '?servico': txt,
  '?categoria': ['umDe', 'campo', 'lab', 'usina'],
  '?camada': txt,
  '?s': num,
  '?z': num,
  '?meioDaFrente': 'booleano',
  '?relativoAFrente': 'booleano',
  '?dia': DIA,
  '?ate': DIA,
  '?v': TEXTO_VAR,
  '?valor': VALOR,
  unidade: 'textoLivre',
  criterio: txt,
  '?ok': 'booleano',
  '?obs': TEXTO_VAR,
  '?granulometria': 'booleano',
  '?falha': 'qualquer'
};
const ENSAIO_SERIE = {
  nome: TEXTO_VAR,
  norma: txt,
  '?grupo': txt,
  '?deslocamento': num,
  '?diaMais': num,
  '?ate': DIA,
  '?valor': VALOR,
  '?valores': ['lista', txt],
  '?coletar': txt,
  unidade: 'textoLivre',
  criterio: txt,
  '?obsPorPonto': ['lista', txt],
  '?obsReprovado': txt,
  '?camadaCiclo': num,
  '?umidade': { media: num, desvio: num, '?casas': num },
  '?extras': ['lista', 'qualquer']
};

function validarGerador(g, caminho, erros, servicos) {
  verifica(g, { tipo: ['umDe', 'lista', 'serie', 'camadas', 'faixas', 'frentes'] }, caminho, erros);
  if (g.servico && !servicos.has(g.servico)) erros.push(`${caminho}.servico: o serviço "${g.servico}" não existe em servicos.json`);
  const base = { '?condicao': ['lista', txt], '?servico': txt, '?categoria': txt, '?camada': txt };
  if (g.tipo === 'lista') {
    verifica(g, { ...base, '?dia': DIA, itens: ['lista', ITEM_LISTA, 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => {
      if (!it.dia && !g.dia) erros.push(`${caminho}.itens[${i}]: falta o campo "dia" (no item ou no bloco)`);
      if (it.v === undefined && !it.valor) erros.push(`${caminho}.itens[${i}]: falta o resultado ("v" ou "valor")`);
    });
  } else if (g.tipo === 'serie') {
    const b = { ...base, estacas: 'qualquer', z: 'qualquer', '?zDesloc': 'qualquer', dia: DIA, '?falhas': ['lista', 'qualquer'] };
    if (g.ensaios) verifica(g, { ...b, ensaios: ['lista', ENSAIO_SERIE, 1] }, caminho, erros);
    else {
      verifica(g, { ...b, ...ENSAIO_SERIE }, caminho, erros);
      if (!g.valor && !g.valores) erros.push(`${caminho}: falta o resultado ("valor" ou "valores")`);
    }
  } else if (g.tipo === 'camadas') {
    verifica(g, { servico: txt, camadas: num, itens: ['lista', 'qualquer', 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => validarGerador(it, `${caminho}.itens[${i}]`, erros, servicos));
  } else if (g.tipo === 'faixas' || g.tipo === 'frentes') {
    verifica(g, { ...(g.tipo === 'faixas' ? { faixas: ['lista', txt, 1] } : {}), itens: ['lista', 'qualquer', 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => validarGerador(it, `${caminho}.itens[${i}]`, erros, servicos));
  }
}

const EFEITOS = { atraso: num, custo: num, qualidade: num, conformidade: num };
const REGRA_DIA = { '?fixo': num, '?falhaDeEnsaio': txt, '?servico': txt, '?frente': num, '?faixa': ['umDe', 'BD', 'BE'], '?em': ['umDe', 'inicio', 'fim', 'curaInicio'], '?mais': num };
const DECISOES = {
  opcoesBase: ['mapa', num],
  avaliacoes: ['lista', txt, 3],
  pontuacao: {
    pesos: { qualidade: num, conformidade: num, prazo: num, custo: num },
    pontosPorDiaDeAtraso: num,
    milReaisPorPonto: num,
    retrabalhosSemPenalidade: ['lista', txt],
    conceitos: ['lista', { minimo: num, nome: txt }, 1]
  },
  decisoes: [
    'lista',
    {
      id: txt,
      servico: txt,
      dia: REGRA_DIA,
      titulo: txt,
      contexto: txt,
      '?tempoNoDiario': txt,
      dados: ['lista', { rotulo: txt, valor: txt }],
      opcoes: [
        'lista',
        {
          texto: txt,
          avaliacao: ['umDe', 0, 1, 2],
          efeitos: EFEITOS,
          retorno: txt,
          '?opcoes': ['mapa', num],
          '?consequencia': { dia: ['ou', num, REGRA_DIA], titulo: txt, texto: txt, efeitos: EFEITOS }
        },
        2
      ]
    },
    1
  ]
};

function validarRegraDia(r, c, erros, todos) {
  const regras = [r.fixo != null, !!r.falhaDeEnsaio, !!r.servico].filter(Boolean).length;
  if (regras !== 1) erros.push(`${c}: use exatamente uma regra ("fixo", "falhaDeEnsaio" ou "servico" com "em")`);
  if (r.servico && !todos.has(r.servico)) erros.push(`${c}: o serviço "${r.servico}" não existe`);
  if (r.servico && !r.em) erros.push(`${c}: falta "em" (inicio, fim ou curaInicio)`);
}

export function validarDados(d) {
  const erros = [];
  verifica(d.obra, OBRA, 'obra.json', erros);
  if (d.obra?.calendario && !/^\d{4}-\d{2}-\d{2}$/.test(d.obra.calendario.inicio)) erros.push('obra.json.calendario.inicio: use o formato AAAA-MM-DD');
  verifica(d.servicos, SERVICOS, 'servicos.json', erros);
  verifica(d.manual, ['mapa', { onde: txt, como: ['lista', txt], conferir: ['lista', txt] }], 'manual.json', erros);
  verifica(d.normas, { metodos: ['mapa', txt], referencias: ['lista', { norma: txt, titulo: txt, aplicacao: txt }] }, 'normas.json', erros);
  verifica(
    d.ensaios,
    { semente: num, plano: ['lista', 'qualquer'], '?notaPlano': txt, dosagem: 'qualquer', granulometria: 'qualquer', compactacao: 'qualquer', geradores: ['lista', 'qualquer', 1] },
    'ensaios.json',
    erros
  );
  verifica(d.decisoes, DECISOES, 'decisoes.json', erros);
  if (erros.length) return erros;

  // referências cruzadas
  const S = d.servicos;
  const ids = new Set(S.servicos.map(s => s.id));
  const extras = new Set(S.retrabalhos.map(r => r.servico.id));
  const todos = new Set([...ids, ...extras]);
  const globais = new Set(S.servicos.filter(s => s.escopo === 'global').map(s => s.id));
  const vistos = new Set();
  const checarServico = (s, c, retrabalho) => {
    if (!S.grupos[s.grupo]) erros.push(`${c}: o grupo "${s.grupo}" não existe em "grupos"`);
    const escopo = s.escopo || 'frente';
    if (escopo === 'global' && !s.janelas) erros.push(`${c}: serviço global precisa de "janelas"`);
    if (escopo !== 'global' && s.duracaoFixa == null && !(s.quantidade && s.quantidade.chave && s.produtividade))
      erros.push(`${c}: informe "duracaoFixa" ou "quantidade" com "chave" e "produtividade"`);
    if (s.quantidade && s.quantidade.chave && !CHAVES_DE_QUANTIDADE.includes(s.quantidade.chave))
      erros.push(`${c}.quantidade.chave: "${s.quantidade.chave}" não é calculada pelos quantitativos (${CHAVES_DE_QUANTIDADE.join(', ')})`);
    if (s.produtividade && s.produtividade.valor <= 0) erros.push(`${c}.produtividade: deve ser maior que zero`);
    for (const dp of [...(s.depende || []), ...(s.inicio ? [s.inicio] : [])]) if (!todos.has(dp.de)) erros.push(`${c}.depende: o serviço "${dp.de}" não existe`);
    for (const [fx, lst] of Object.entries(s.dependeFaixa || {})) lst.forEach(dp => !todos.has(dp.de) && erros.push(`${c}.dependeFaixa.${fx}: o serviço "${dp.de}" não existe`));
    for (const g of s.aposGlobal || []) if (!globais.has(g)) erros.push(`${c}.aposGlobal: "${g}" não é um serviço global`);
    if (s.equipe && !todos.has(s.equipe)) erros.push(`${c}.equipe: a equipe "${s.equipe}" não corresponde a nenhum serviço`);
    if (s.diario?.quantitativo && !CHAVES_DE_QUANTIDADE.includes(s.diario.quantitativo)) erros.push(`${c}.diario.quantitativo: "${s.diario.quantitativo}" não é calculada pelos quantitativos`);
    if (s.diario && s.diario.quantitativo == null && s.diario.valor == null) erros.push(`${c}.diario: informe "quantitativo" ou "valor"`);
    if (retrabalho && !s.retrabalho) erros.push(`${c}: serviço de retrabalho precisa de "retrabalho": true`);
  };
  S.servicos.forEach((s, i) => {
    const c = `servicos.json.servicos[${i}] (${s.id})`;
    if (vistos.has(s.id)) erros.push(`${c}: id repetido`);
    vistos.add(s.id);
    checarServico(s, c, false);
  });
  S.retrabalhos.forEach((r, i) => {
    const c = `servicos.json.retrabalhos[${i}]`;
    checarServico(r.servico, c + '.servico', true);
    for (const id of [r.inserirApos, r.inserirAntes, r.falhaAntesDe, r.acrescentar?.servico, ...(r.bloqueia || [])]) if (id && !ids.has(id)) erros.push(`${c}: o serviço "${id}" não existe`);
    if (![r.inserirApos, r.inserirAntes, r.acrescentar, r.falhaAntesDe].some(Boolean)) erros.push(`${c}: indique "inserirApos", "inserirAntes", "acrescentar" ou "falhaAntesDe"`);
    if (r.falhaAntesDe && !r.falha) erros.push(`${c}: "falhaAntesDe" exige "falha"`);
  });
  for (const m of S.frentes.desvio.sequencia) {
    if (m.desde.servico && !ids.has(m.desde.servico)) erros.push(`servicos.json.frentes.desvio: o serviço "${m.desde.servico}" não existe`);
    if (!S.frentes.desvio.estados[m.estado]) erros.push(`servicos.json.frentes.desvio: o estado "${m.estado}" não está em "estados"`);
  }
  for (const id of S.frentes.inicioApos) if (!globais.has(id)) erros.push(`servicos.json.frentes.inicioApos: "${id}" não é um serviço global`);
  if (S.frentes.tamanho <= 0) erros.push('servicos.json.frentes.tamanho: deve ser maior que zero');
  S.liberacoes.forEach((l, i) => l.servicos.forEach(id => !todos.has(id) && erros.push(`servicos.json.liberacoes[${i}]: o serviço "${id}" não existe`)));
  d.ensaios.geradores.forEach((g, i) => validarGerador(g, `ensaios.json.geradores[${i}]`, erros, todos));
  const ds = new Set();
  d.decisoes.decisoes.forEach((dc, i) => {
    const c = `decisoes.json.decisoes[${i}] (${dc.id})`;
    if (ds.has(dc.id)) erros.push(`${c}: id repetido`);
    ds.add(dc.id);
    if (!todos.has(dc.servico)) erros.push(`${c}: o serviço "${dc.servico}" não existe`);
    validarRegraDia(dc.dia, c + '.dia', erros, todos);
    dc.opcoes.forEach((o, j) => {
      if (o.consequencia && typeof o.consequencia.dia === 'object') validarRegraDia(o.consequencia.dia, `${c}.opcoes[${j}].consequencia.dia`, erros, todos);
    });
  });
  return erros;
}
