// Ponto de entrada: fontes, estilos, carga e validação dos dados e início da aplicação.
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './estilos/base.css';
import './estilos/extra.css';
import './estilos/correcoes.css';
import './estilos/interface.css';
import { carregarDados, ErroDeDados } from './dados.js';
import { carregarLocal } from './carregarLocal.js';
import { iniciar } from './controlador.js';
import { esc } from './interface/dom.js';

function mostrarErro(e) {
  console.error(e);
  const el = document.getElementById('loading');
  el.hidden = false;
  if (e instanceof ErroDeDados) {
    el.classList.add('erro-dados');
    el.innerHTML = `Os arquivos de dados têm problemas<small>${esc(e.message)} Corrija os itens abaixo em dados/ e recarregue a página.</small><ul>${e.erros
      .slice(0, 30)
      .map(x => `<li>${esc(x)}</li>`)
      .join('')}${e.erros.length > 30 ? `<li>e mais ${e.erros.length - 30}.</li>` : ''}</ul>`;
  } else el.innerHTML = 'Não foi possível montar o modelo<small>' + esc(e.message) + '</small>';
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const dados = carregarDados();
    dados.local = await carregarLocal();
    iniciar(dados);
  } catch (e) {
    mostrarErro(e);
  }
});
