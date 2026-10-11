// Ponto de entrada: fontes, estilos e módulos da aplicação.
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
// ui.js registra o boot no DOMContentLoaded; app.js vem antes para fixar a ordem de avaliação dos módulos
import './app.js';
import './ui.js';
