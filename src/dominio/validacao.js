// Validação dos arquivos de dados/ com esquemas simples. Devolve a lista de erros (vazia se tudo estiver certo).
//
// Notação dos esquemas:
//   'numero' | 'texto' | 'textoLivre' (aceita vazio) | 'booleano' | 'qualquer'
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
  obra: { titulo: txt, local: txt, om: txt, trafego: txt, iscProjeto: num },
  calendario: { inicio: txt, horaInicio: num, horasPorDia: num, prazoContratualDias: num },
  geometria: ['mapa', num],
  canteiro: { estacaInicio: num, estacaFim: num, afastamentoInicio: num, afastamentoFim: num, cota: num },
  taxas: { densidadeCBUQ: num, imprimacao: num, pinturaDiluida: num, teorLigante: num, larguraLimpeza: num },
  usina: ['lista', { nome: txt, descricao: txt }],
  contexto: ['lista', { titulo: txt, texto: txt }],
  diario: { tempoBom: txt }
};
const GEOMETRIA = [
  'extensao',
  'estaca',
  'cotaReferencia',
  'larguraPlataforma',
  'taludeCorte',
  'taludeAterro',
  'larguraSubBase',
  'larguraBase',
  'larguraRevestimento',
  'larguraFaixa',
  'espSubBase',
  'espBase',
  'espRevestimento',
  'espRegularizacao',
  'espCamadaFinal',
  'espCamadaCorpo',
  'espSubcamadaFinal',
  'cotaGreideInicio',
  'rampaGreide',
  'fatorHomogeneizacao'
];

const FRENTE = { chave: txt, tipo: ['umDe', 'extensao', 'fracao', 'camadas', 'faixas', 'suave'], '?ate': num, '?fimAntecipado': num };
const SERVICO = {
  id: txt,
  grupo: txt,
  nome: txt,
  '?curto': txt,
  norma: txt,
  '?retrabalho': 'booleano',
  '?janelas': ['lista', ['janela'], 1],
  '?janelasRelativas': ['lista', ['janela'], 1],
  '?faixas': ['mapa', ['janela']],
  '?cura': ['janela'],
  efetivo: txt,
  equipamentos: ['lista', { nome: txt, qtd: num }],
  '?quantidade': 'textoLivre',
  liberacao: txt,
  '?frente': FRENTE,
  '?diario': { '?quantitativo': txt, '?valor': num, unidade: txt, texto: txt }
};
const SERVICOS = {
  grupos: ['mapa', { nome: txt, cor: txt }],
  servicos: ['lista', SERVICO, 1],
  retrabalhos: [
    'lista',
    {
      opcao: txt,
      '?referencia': { servico: txt, '?faixa': txt, em: ['umDe', 'inicio', 'fim'] },
      '?faixas': ['lista', { servico: txt, faixa: txt, janela: ['janela'] }],
      '?falha': { servico: txt, inicio: num, fim: num, extensao: num, remocao: ['janela'] },
      '?deslocar': { servicos: ['lista', txt], dias: num },
      '?inserir': { antesDe: txt, servico: SERVICO }
    }
  ],
  cenarios: ['mapa', { nome: txt, descricao: txt, opcoes: ['mapa', num] }],
  liberacoes: ['lista', { id: txt, nome: txt, servicos: ['lista', txt, 1] }]
};

const DIA = {
  '?fixo': num,
  '?relativo': 'booleano',
  '?camada': 'booleano',
  '?fracao': num,
  '?ultima': 'qualquer',
  '?frente': txt,
  '?ultimoTrecho': 'booleano',
  '?servico': txt,
  '?faixa': txt,
  '?em': ['umDe', 'inicio', 'fim', 'curaInicio', 'falhaOuInicio'],
  '?mais': num,
  '?passo': num,
  '?maisPorEstaca': num
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
  '?formato': ['umDe', 'inteiro']
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
  '?dia': DIA,
  '?ate': DIA,
  '?v': TEXTO_VAR,
  '?valor': VALOR,
  unidade: 'textoLivre',
  criterio: txt,
  '?ok': 'booleano',
  '?obs': TEXTO_VAR,
  '?granulometria': 'booleano'
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
  '?umidade': { media: num, desvio: num, '?casas': num },
  '?extras': ['lista', 'qualquer']
};

function validarGerador(g, caminho, erros, servicos) {
  verifica(g, { tipo: ['umDe', 'lista', 'serie', 'camadas', 'faixas'] }, caminho, erros);
  if (g.servico && !servicos.has(g.servico)) erros.push(`${caminho}.servico: o serviço "${g.servico}" não existe em servicos.json`);
  if (g.tipo === 'lista') {
    verifica(g, { '?servico': txt, '?categoria': txt, '?camada': txt, '?dia': DIA, itens: ['lista', ITEM_LISTA, 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => {
      if (!it.dia && !g.dia) erros.push(`${caminho}.itens[${i}]: falta o campo "dia" (no item ou no bloco)`);
      if (it.v === undefined && !it.valor) erros.push(`${caminho}.itens[${i}]: falta o resultado ("v" ou "valor")`);
    });
  } else if (g.tipo === 'serie') {
    const base = {
      '?servico': txt,
      '?categoria': txt,
      '?camada': txt,
      estacas: 'qualquer',
      z: 'qualquer',
      '?zDesloc': 'qualquer',
      dia: DIA,
      '?falhas': ['lista', 'qualquer']
    };
    if (g.ensaios) verifica(g, { ...base, ensaios: ['lista', ENSAIO_SERIE, 1] }, caminho, erros);
    else {
      verifica(g, { ...base, ...ENSAIO_SERIE }, caminho, erros);
      if (!g.valor && !g.valores) erros.push(`${caminho}: falta o resultado ("valor" ou "valores")`);
    }
  } else if (g.tipo === 'camadas') {
    verifica(g, { servico: txt, camadas: ['ou', num, ['umDe', 'corpoDoAterro']], itens: ['lista', 'qualquer', 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => validarGerador(it, `${caminho}.itens[${i}]`, erros, servicos));
  } else if (g.tipo === 'faixas') {
    verifica(g, { faixas: ['lista', txt, 1], itens: ['lista', 'qualquer', 1] }, caminho, erros);
    (g.itens || []).forEach((it, i) => validarGerador(it, `${caminho}.itens[${i}]`, erros, servicos));
  }
}

const EFEITOS = { atraso: num, custo: num, qualidade: num, conformidade: num };
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
      dia: { '?fixo': num, '?falhaDeEnsaio': txt, '?servico': txt, '?faixa': txt, '?em': ['umDe', 'inicio', 'fim', 'curaInicio'], '?mais': num },
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
          '?consequencia': { dia: num, titulo: txt, texto: txt, efeitos: EFEITOS }
        },
        2
      ]
    },
    1
  ]
};

export function validarDados(d) {
  const erros = [];
  verifica(d.obra, OBRA, 'obra.json', erros);
  for (const k of GEOMETRIA) if (typeof d.obra?.geometria?.[k] !== 'number') erros.push(`obra.json.geometria: falta o número "${k}"`);
  if (d.obra?.calendario && !/^\d{4}-\d{2}-\d{2}$/.test(d.obra.calendario.inicio)) erros.push('obra.json.calendario.inicio: use o formato AAAA-MM-DD');
  verifica(d.servicos, SERVICOS, 'servicos.json', erros);
  verifica(d.manual, ['mapa', { onde: txt, como: ['lista', txt], conferir: ['lista', txt] }], 'manual.json', erros);
  verifica(d.normas, { metodos: ['mapa', txt], referencias: ['lista', { norma: txt, titulo: txt, aplicacao: txt }] }, 'normas.json', erros);
  verifica(
    d.ensaios,
    {
      semente: num,
      plano: ['lista', 'qualquer'],
      dosagem: 'qualquer',
      granulometria: 'qualquer',
      compactacao: 'qualquer',
      geradores: ['lista', 'qualquer', 1]
    },
    'ensaios.json',
    erros
  );
  verifica(d.decisoes, DECISOES, 'decisoes.json', erros);
  if (erros.length) return erros;

  // referências cruzadas
  const ids = new Set(d.servicos.servicos.map(s => s.id));
  const extras = new Set(d.servicos.retrabalhos.filter(r => r.inserir).map(r => r.inserir.servico.id));
  const todos = new Set([...ids, ...extras]);
  const vistos = new Set();
  d.servicos.servicos.forEach((s, i) => {
    const c = `servicos.json.servicos[${i}] (${s.id})`;
    if (vistos.has(s.id)) erros.push(`${c}: id repetido`);
    vistos.add(s.id);
    if (!d.servicos.grupos[s.grupo]) erros.push(`${c}: o grupo "${s.grupo}" não existe em "grupos"`);
    if (!s.janelas === !s.faixas) erros.push(`${c}: informe "janelas" ou "faixas" (só um dos dois)`);
    if (s.frente?.tipo === 'faixas' && !s.faixas) erros.push(`${c}: frente do tipo "faixas" exige o campo "faixas"`);
    if (s.diario?.quantitativo == null && s.diario?.valor == null && s.diario) erros.push(`${c}.diario: informe "quantitativo" ou "valor"`);
  });
  d.servicos.retrabalhos.forEach((r, i) => {
    const c = `servicos.json.retrabalhos[${i}]`;
    for (const id of [r.referencia?.servico, r.falha?.servico, r.inserir?.antesDe, ...(r.deslocar?.servicos || []), ...(r.faixas || []).map(f => f.servico)])
      if (id && !ids.has(id)) erros.push(`${c}: o serviço "${id}" não existe`);
  });
  d.servicos.liberacoes.forEach((l, i) =>
    l.servicos.forEach(id => !todos.has(id) && erros.push(`servicos.json.liberacoes[${i}]: o serviço "${id}" não existe`))
  );
  d.ensaios.geradores.forEach((g, i) => validarGerador(g, `ensaios.json.geradores[${i}]`, erros, todos));
  const ds = new Set();
  d.decisoes.decisoes.forEach((dc, i) => {
    const c = `decisoes.json.decisoes[${i}] (${dc.id})`;
    if (ds.has(dc.id)) erros.push(`${c}: id repetido`);
    ds.add(dc.id);
    if (!todos.has(dc.servico)) erros.push(`${c}: o serviço "${dc.servico}" não existe`);
    const r = dc.dia;
    const regras = [r.fixo != null, !!r.falhaDeEnsaio, !!r.servico].filter(Boolean).length;
    if (regras !== 1) erros.push(`${c}.dia: use exatamente uma regra ("fixo", "falhaDeEnsaio" ou "servico" com "em")`);
    if (r.servico && !todos.has(r.servico)) erros.push(`${c}.dia: o serviço "${r.servico}" não existe`);
    if (r.servico && !r.em) erros.push(`${c}.dia: falta "em" (inicio, fim ou curaInicio)`);
  });
  return erros;
}
