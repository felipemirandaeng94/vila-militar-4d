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
import { iniciarTelaDeCarga, etapaDaCarga, modeloMontado, pararTelaDeCarga } from './interface/carregamento.js';

function mostrarErro(e) {
  console.error(e);
  pararTelaDeCarga();
  const el = document.getElementById('loading');
  el.hidden = false;
  if (e instanceof ErroDeDados) {
    el.classList.add('erro-dados');
    el.innerHTML = `<div class="ld-box"><p class="ld-tit">Os arquivos de dados têm problemas</p><p class="ld-det">${esc(e.message)} Corrija os itens abaixo em dados/ e recarregue a página.</p><ul>${e.erros
      .slice(0, 30)
      .map(x => `<li>${esc(x)}</li>`)
      .join('')}${e.erros.length > 30 ? `<li>e mais ${e.erros.length - 30}.</li>` : ''}</ul></div>`;
  } else el.innerHTML = `<div class="ld-box"><p class="ld-tit">Não foi possível montar o modelo</p><p class="ld-det">${esc(e.message)}</p></div>`;
}

// deixa o navegador desenhar a etapa antes de um trabalho síncrono longo
const pintar = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));

window.addEventListener('DOMContentLoaded', async () => {
  try {
    iniciarTelaDeCarga();
    etapaDaCarga('Lendo os dados da obra', 'Serviços, ensaios, decisões, normas e manual.');
    await pintar();
    const dados = carregarDados();
    etapaDaCarga('Baixando o local real', 'Eixo, vias, áreas, edificações e terreno (OpenStreetMap e IPP).');
    dados.local = await carregarLocal();
    etapaDaCarga('Montando o canteiro', 'Terreno, usina, equipamentos, camadas e pontos de ensaio.');
    await pintar();
    iniciar(dados);
    modeloMontado();
  } catch (e) {
    mostrarErro(e);
  }
});
