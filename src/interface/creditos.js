// Tela de créditos e licenças: o conteúdo é o próprio assets/CREDITOS.md (incluído no build), para que a tela e o
// registro dos recursos externos nunca divirjam. Abre pelo botão "Créditos" do cabeçalho, pelos botões com
// data-creditos e pelo endereço #creditos.
import md from '../../assets/CREDITOS.md?raw';
import { D } from '../estado.js';
import { $, esc } from './dom.js';
import { markdownParaHtml } from './markdown.js';

let montado = false;
function montar() {
  if (montado) return;
  montado = true;
  const { html } = markdownParaHtml(md, 3);
  const local = D.local && D.local.meta && D.local.meta.creditos;
  $('creditosCorpo').innerHTML =
    `<p class="dlg-intro">Fontes de dados, recursos visuais e sonoros, fontes tipográficas e bibliotecas usados no app, com a origem e a licença de cada um. Resultados de ensaio, terreno e quantidades são ilustrativos.</p>
  <div class="dlg-obrig"><h3>Créditos obrigatórios</h3><ul>${(local && local.length
    ? local.map(c => `<li>${esc(c.texto)}</li>`)
    : ['<li>© colaboradores do OpenStreetMap (ODbL)</li>', '<li>Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos</li>']
  ).join('')}<li>Poly Haven: céu, texturas e árvore (CC0)</li><li>Freesound: sons ambientes (CC0)</li></ul></div>
  <div class="md">${html}</div>`;
}

export function abrirCreditos() {
  const d = $('creditos');
  montar();
  if (d.open) return;
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
  $('creditosCorpo').scrollTop = 0;
  $('creditosX').focus({ preventScroll: true });
}
export function fecharCreditos() {
  const d = $('creditos');
  if (typeof d.close === 'function') d.close();
  else d.removeAttribute('open');
}

export function initCreditos() {
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-creditos]');
    if (b) {
      e.preventDefault();
      abrirCreditos();
    }
  });
  $('creditosX').onclick = fecharCreditos;
  // clique fora da caixa (no fundo do diálogo) fecha
  $('creditos').addEventListener('click', e => {
    if (e.target === $('creditos')) fecharCreditos();
  });
  // as teclas da linha do tempo não valem com o diálogo aberto
  $('creditos').addEventListener('keydown', e => e.stopPropagation());
  if (location.hash === '#creditos') abrirCreditos();
}
