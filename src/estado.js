// Estado central da aplicação. Todas as camadas leem e alteram o estado por aqui; não há variáveis globais soltas.
//
// ST: estado da interação (dia exibido, cenário, modo, seleção, vista, opções de exibição).
// M:  modelo da obra calculado pelo domínio (quantitativos, cronograma, frentes, ensaios, liberações).
// D:  dados carregados de dados/*.json.
// acoes: funções de controle registradas pelo controlador (irParaDia, tocar, reconstruir, atualizar),
//        para que interface, motor e jogo peçam mudanças sem importar o controlador.

export const ST = {
  day: 0, // dia útil exibido (fração = hora do dia)
  playing: false,
  speed: 1,
  follow: false, // câmera segue a frente de serviço
  view: 'iso',
  sel: null, // ensaio selecionado
  lay: {}, // camadas do modelo desligadas pelo usuário (false)
  vexag: 1, // exagero vertical da vista em perfil
  exag: 3, // exagero das espessuras do pavimento
  cen: 'nenhum', // cenário de não conformidade (modo explorar)
  modo: 'explorar', // 'explorar' ou 'missao'
  tab: 'seq',
  man: 'S15', // serviço aberto no procedimento
  profile: false, // corte em perfil ativo
  labPulse: 0 // ensaios de laboratório ou de usina em andamento
};

export const M = {};
export const D = {};
export const acoes = {};

const ouvintes = {};
export function on(evento, fn) {
  (ouvintes[evento] = ouvintes[evento] || []).push(fn);
}
export function emit(evento, ...args) {
  for (const fn of ouvintes[evento] || []) fn(...args);
}
