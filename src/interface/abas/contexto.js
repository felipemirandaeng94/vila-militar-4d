// Aba "Contexto e normas": obra militar, cadeia de liberação e normas utilizadas.
import { D } from '../../estado.js';
import { esc } from '../dom.js';
import { P } from '../../dominio/geometria.js';
import { nf } from '../../dominio/util.js';

// local real (Fase 3): via, extensão medida, canteiro e fontes dos dados abertos
function local() {
  const L = D.local;
  if (!L)
    return `<h3 class="h3">Local</h3><p class="note">Os arquivos do local real (public/local/) não foram carregados: o modelo usa o eixo reto e o terreno fictício.</p>`;
  const m = L.meta;
  const linhas = [
    ['Via', m.via],
    [
      'Extensão medida no eixo',
      nf(P.L, 1) +
        ' m (' +
        nf(L.eixo.trechos.length, 0) +
        ' trecho' +
        (L.eixo.trechos.length > 1 ? 's' : '') +
        ' do OpenStreetMap; ' +
        nf(m.extensao_medida_m, 1) +
        ' m)'
    ],
    ['Pista existente', `${nf(m.via_existente.largura_m, 1)} m (${m.via_existente.faixas} faixas, ${m.via_existente.fonte})`],
    ['Canteiro e usina', `${m.canteiro.dimensoes_m.map(v => nf(v, 0)).join(' × ')} m, a noroeste do início do trecho, ${m.canteiro.acesso}`],
    ['Relevo', m.terreno.fonte + '. Precisão: ' + m.terreno.precisao],
    ['Ortofoto', m.ortofoto]
  ];
  return `<h3 class="h3">Local e fontes de dados</h3><div class="tbl"><table><tbody>${linhas.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
  <div class="tbl"><table><thead><tr><th>Fonte</th><th>Crédito</th><th>Uso no modelo</th></tr></thead><tbody>${m.creditos
    .map(c => `<tr><td>${esc(c.fonte)}</td><td>${esc(c.texto)}</td><td>${esc(c.uso)}</td></tr>`)
    .join('')}</tbody></table></div>
  <p class="note">${esc(m.aviso)} Área militar: o modelo usa apenas dados de fontes públicas e não identifica edificações internas.</p>`;
}

// recursos visuais externos (Fase 4); a lista completa está em assets/CREDITOS.md
const RECURSOS = [
  [
    'Céu HDRI',
    'Kloofendal 48d Partly Cloudy (Pure Sky), de Greg Zaal e Jarod Guest, Poly Haven (polyhaven.com)',
    'CC0 1.0 (domínio público)',
    'Fundo do céu, luz ambiente e direção do sol'
  ],
  ['Textura PBR', 'Cracked Red Ground, de Amal Kumar, Poly Haven (polyhaven.com)', 'CC0 1.0 (domínio público)', 'Subleito exposto, vala, quadras de saibro'],
  [
    'Textura PBR',
    'Dry Mud Field 001, de Rob Tuytel e Rico Cilliers, Poly Haven (polyhaven.com)',
    'CC0 1.0 (domínio público)',
    'Solo compactado: regularização, reaterro, substituição, sub-base existente, chão do entorno'
  ],
  [
    'Textura PBR',
    'Gravel Floor 04, de Charlotte Baglioni, Poly Haven (polyhaven.com)',
    'CC0 1.0 (domínio público)',
    'Brita graduada, solo-brita, imprimação e pintura de ligação (sobre a base), pátio do canteiro, faixa de desvio'
  ],
  [
    'Textura PBR',
    'Asphalt Pit Lane, de Dimitrios Savva, Poly Haven (polyhaven.com)',
    'CC0 1.0 (domínio público)',
    'CBUQ novo, superfície fresada, tinta de demarcação'
  ],
  ['Textura PBR', 'Asphalt 02, de Rob Tuytel, Poly Haven (polyhaven.com)', 'CC0 1.0 (domínio público)', 'Revestimento existente e vias do entorno'],
  ['Textura PBR', 'Leafy Grass, de Charlotte Baglioni, Poly Haven (polyhaven.com)', 'CC0 1.0 (domínio público)', 'Gramados, campos e matas'],
  [
    'Textura PBR',
    'Concrete Floor 03, de Rob Tuytel e Matterfield, Poly Haven (polyhaven.com)',
    'CC0 1.0 (domínio público)',
    'Passeios, sarjeta, meio-fio e vias de concreto'
  ],
  [
    'Modelo 3D',
    'Jacaranda Tree, de Rico Cilliers e Rob Tuytel, Poly Haven (polyhaven.com); malha reduzida para o app',
    'CC0 1.0 (domínio público)',
    'Árvores do entorno e folhas da palmeira-imperial'
  ]
];
function recursos() {
  return `<h3 class="h3">Recursos visuais</h3><div class="tbl"><table><thead><tr><th>Recurso</th><th>Origem</th><th>Licença</th><th>Uso no modelo</th></tr></thead><tbody>${RECURSOS.map(
    r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`
  ).join('')}</tbody></table></div>`;
}

export function tabCtx() {
  const OBRA = D.obra.obra;
  const flow = [
    'Execução da camada',
    'Ensaios de campo (laboratório)',
    'Análise do engenheiro residente',
    'Não conformidade? Retrabalho e reensaio',
    'Fiscalização assina o BLC',
    'Próxima camada liberada'
  ];
  return `<div class="pane-head"><h2>Contexto da obra militar</h2><p>${esc(OBRA.local)}. A obra reconstrói a via existente, que continua em uso pelo tráfego de ${esc(OBRA.trafego)}, com drenagem nova e pavimento em CBUQ, por frentes de serviço de 400 m.</p></div>
  <div class="flow">${flow.map((f, i) => `<div class="fstep${i === 3 ? ' warn' : ''}"><b>${i + 1}</b>${esc(f)}</div>`).join('<span class="farr">→</span>')}</div>
  <div class="masonry">${D.obra.contexto.map(c => `<div class="ccard"><h4>${esc(c.titulo)}</h4><p class="csub">${esc(c.texto)}</p></div>`).join('')}</div>
  <h3 class="h3">Normas utilizadas</h3><div class="tbl"><table><thead><tr><th>Norma</th><th>Título</th><th>Aplicação no modelo</th></tr></thead><tbody>${D.normas.referencias.map(n => `<tr><td class="m">${n.norma}</td><td>${esc(n.titulo)}</td><td>${esc(n.aplicacao)}</td></tr>`).join('')}</tbody></table></div>
  ${local()}
  ${recursos()}
  <p class="note">Modelo didático. Terreno, quantidades e resultados de ensaio são ilustrativos, gerados de forma coerente com os critérios das especificações citadas. Não substituem o projeto executivo nem o plano de controle da obra real. Confirme sempre a revisão vigente de cada norma na coletânea do DNIT.</p>`;
}
