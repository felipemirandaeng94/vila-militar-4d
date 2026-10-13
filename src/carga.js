// Progresso real da carga: um único THREE.LoadingManager recebe todos os arquivos (dados do local, céu HDRI,
// texturas, árvores e modelos 3D). Os carregadores do three usam o gerenciador diretamente; os fetch passam por
// buscar(), que avisa o início e o fim de cada arquivo. A tela de carregamento (interface/carregamento.js) lê o estado.
import { LoadingManager } from 'three';

export const gerenciador = new LoadingManager();

// grupo de cada arquivo, pela pasta, para a tela dizer o que está carregando
const GRUPOS = [
  [/\/local\//, 'Dados do local (OpenStreetMap e IPP)'],
  [/\/hdri\//, 'Céu HDRI'],
  [/\/texturas\//, 'Texturas do terreno e do pavimento'],
  [/\/modelos\/arvores\//, 'Árvores'],
  [/\/modelos\/manifesto/, 'Catálogo dos modelos 3D'],
  [/\/modelos\//, 'Modelos 3D dos equipamentos'],
  [/\/sons\//, 'Sons'],
  // imagens embutidas nos GLB, decodificadas pelo GLTFLoader com o mesmo gerenciador
  [/^blob:/, 'Texturas dos modelos 3D']
];
export function grupoDoArquivo(url) {
  const u = String(url);
  for (const [re, nome] of GRUPOS) if (re.test(u)) return nome;
  return 'Recursos';
}
/** Nome curto do arquivo (sem pasta nem consulta), para a linha de detalhe da tela. */
export const nomeDoArquivo = url => decodeURIComponent(String(url).split(/[?#]/)[0].split('/').pop() || '');

/**
 * fetch acompanhado pelo gerenciador: conta como um arquivo na barra de progresso e só termina com o corpo lido.
 * tipo: 'json', 'arrayBuffer' ou 'blob'. Resposta sem sucesso (404 etc.) vira erro.
 */
export async function buscar(url, tipo = 'json') {
  gerenciador.itemStart(url);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(nomeDoArquivo(url) + ': ' + r.status);
    return await r[tipo]();
  } catch (e) {
    gerenciador.itemError(url);
    throw e;
  } finally {
    gerenciador.itemEnd(url);
  }
}

// contagem por grupo e último arquivo terminado; o LoadingManager não expõe as contagens, então os métodos de
// início, fim e erro são envolvidos aqui (os carregadores do three chamam os mesmos métodos)
export const andamento = { total: 0, feitos: 0, falhas: 0, grupos: new Map(), ultimo: '' };
const ouvintes = new Set();
/** Chama fn() a cada arquivo iniciado, terminado ou com erro. Devolve a função que cancela. */
export function aoMudar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
const avisar = () => ouvintes.forEach(fn => fn(andamento));
const grupo = url => {
  const nome = grupoDoArquivo(url);
  if (!andamento.grupos.has(nome)) andamento.grupos.set(nome, { total: 0, feitos: 0 });
  return andamento.grupos.get(nome);
};
const { itemStart, itemEnd, itemError } = gerenciador;
gerenciador.itemStart = url => {
  andamento.total++;
  grupo(url).total++;
  itemStart.call(gerenciador, url);
  avisar();
};
gerenciador.itemEnd = url => {
  andamento.feitos++;
  grupo(url).feitos++;
  andamento.ultimo = url;
  itemEnd.call(gerenciador, url);
  avisar();
};
gerenciador.itemError = url => {
  andamento.falhas++;
  itemError.call(gerenciador, url);
  avisar();
};

/**
 * Fração carregada (0 a 1) a partir das contagens do gerenciador. Os arquivos são de tamanhos diferentes, então a
 * barra mede arquivos, não bytes; com total zero, nada pendente.
 */
export const fracao = (carregados, total) => (total > 0 ? Math.min(1, carregados / total) : 1);
