// Tela de carregamento: etapa atual, barra com a fração real de arquivos carregados (LoadingManager, ver carga.js),
// grupos de arquivos com contagem e o último arquivo recebido. Depois que o modelo está montado, aparece o botão
// "Entrar sem esperar"; a tela some sozinha quando nenhum arquivo fica pendente. Se o usuário entrar antes, um aviso
// pequeno sobre o modelo 3D segue mostrando a carga até o fim.
import { andamento, aoMudar, fracao, nomeDoArquivo } from '../carga.js';
import { $, esc } from './dom.js';

// tempo sem arquivos pendentes para dar a carga por encerrada (cargas que começam em cadeia, como o manifesto e os
// modelos, deixam a fila vazia por um instante)
const OCIOSO_MS = 600;

let modeloPronto = false,
  fechada = false,
  pedido = 0,
  ocioso = 0,
  cancelar = null;

const pct = () => Math.round(100 * fracao(andamento.feitos, andamento.total));

function desenhar() {
  pedido = 0;
  if (!fechada) {
    const p = pct();
    $('ldFill').style.width = p + '%';
    $('ldBar').setAttribute('aria-valuenow', p);
    $('ldNum').textContent = andamento.total
      ? `${andamento.feitos} de ${andamento.total} arquivos (${p} %)${andamento.falhas ? ` · ${andamento.falhas} indisponíve${andamento.falhas > 1 ? 'is' : 'l'}` : ''}`
      : '';
    $('ldGrupos').innerHTML = [...andamento.grupos]
      .map(
        ([nome, g]) =>
          `<li class="${g.feitos >= g.total ? 'feito' : ''}"><span>${esc(nome)}</span><b>${g.feitos >= g.total ? 'pronto' : `${g.feitos} de ${g.total}`}</b></li>`
      )
      .join('');
    const u = andamento.ultimo;
    $('ldArq').textContent = u && !u.startsWith('blob:') ? 'Recebido: ' + nomeDoArquivo(u) : '';
  } else {
    const m = $('ldMini');
    m.hidden = andamento.feitos >= andamento.total;
    const pend = [...andamento.grupos].find(([, g]) => g.feitos < g.total);
    m.textContent = pend ? `Carregando ${pend[0].toLowerCase()}: ${pend[1].feitos} de ${pend[1].total}` : '';
  }
  verificarFim();
}
const agendar = () => {
  if (!pedido) pedido = requestAnimationFrame(desenhar);
};

function verificarFim() {
  clearTimeout(ocioso);
  if (!modeloPronto || andamento.feitos < andamento.total) return;
  ocioso = setTimeout(() => {
    if (andamento.feitos < andamento.total) return;
    if (!fechada) fechar();
    $('ldMini').hidden = true;
    if (cancelar) cancelar();
    cancelar = null;
  }, OCIOSO_MS);
}

function fechar() {
  fechada = true;
  const el = $('loading');
  el.classList.add('saindo');
  el.setAttribute('aria-busy', 'false');
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('saindo');
  }, 350);
  agendar();
}

/** Mostra a tela e passa a acompanhar os arquivos. */
export function iniciarTelaDeCarga() {
  $('loading').hidden = false;
  $('loading').setAttribute('aria-busy', 'true');
  cancelar = aoMudar(agendar);
  $('ldPular').onclick = () => {
    fechar();
    $('play').focus({ preventScroll: true });
  };
  agendar();
}
/** Etapa atual (título e o que está sendo feito). */
export function etapaDaCarga(titulo, detalhe) {
  $('ldTit').textContent = titulo;
  $('ldDet').textContent = detalhe || '';
}
/** O modelo está montado: o app já pode ser usado enquanto os recursos chegam. */
export function modeloMontado() {
  modeloPronto = true;
  etapaDaCarga('Carregando os recursos', 'Céu, texturas, árvores e modelos 3D. O modelo já pode ser usado; os recursos entram à medida que chegam.');
  $('ldPular').hidden = false;
  agendar();
}
/** Interrompe o acompanhamento (erro na carga dos dados). */
export function pararTelaDeCarga() {
  if (cancelar) cancelar();
  cancelar = null;
  clearTimeout(ocioso);
}
