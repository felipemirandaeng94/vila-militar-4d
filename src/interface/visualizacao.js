// Cartão "Visualização": qualidade gráfica (automática ou manual, salva no navegador), exposição e indicador de quadros
// por segundo (tecla F).
import { $, lsGet, lsSet } from './dom.js';
import { visual, escolherQualidade, definirExposicao } from '../motor/index.js';
import { PERFIS, CHAVE, CHAVE_EXPOSICAO, escolhaValida, FPS_MINIMO } from '../motor/qualidade.js';
import { nf } from '../dominio/util.js';

const DESC = {
  baixa: 'Sombra de 1024 px perto da câmera, sem pós-processamento, 35% das árvores.',
  media: 'Sombra de 2048 px, oclusão de ambiente em meia resolução, FXAA, 70% das árvores.',
  alta: 'Sombra de 4096 px, oclusão de ambiente (GTAO), SMAA, céu em 4K, todas as árvores com sombra.'
};

function descrever() {
  const p = visual.perfil;
  const auto = visual.escolha === 'auto';
  $('qualDesc').textContent = (auto ? `Em uso: ${PERFIS[p].nome}${visual.fpsMedido ? ` (${nf(visual.fpsMedido, 0)} quadros/s medidos)` : ''}. ` : '') + DESC[p];
}

let fpsLigado = false,
  timer = null;
function mostrarFps(on) {
  fpsLigado = on;
  $('optFps').checked = on;
  $('fps').hidden = !on;
  clearInterval(timer);
  if (!on) return;
  const atualizar = () => {
    const f = visual.medidor.fps;
    $('fps').textContent = `${nf(f, 0)} quadros/s · ${PERFIS[visual.perfil].nome}`;
    $('fps').classList.toggle('lento', f > 0 && f < FPS_MINIMO);
    // logo acima da barra 4D, cuja altura muda com a largura da tela
    const barra = document.querySelector('.bar4d');
    if (barra) $('fps').style.bottom = barra.offsetHeight + 22 + 'px';
  };
  atualizar();
  timer = setInterval(atualizar, 500);
}

export function initVisualizacao() {
  visual.aoMudar = descrever;
  const escolha = escolhaValida(lsGet(CHAVE));
  $('optQual').value = escolha;
  $('optQual').onchange = e => {
    lsSet(CHAVE, e.target.value);
    escolherQualidade(e.target.value);
    descrever();
  };
  const exp = Number(lsGet(CHAVE_EXPOSICAO));
  const ev = exp >= 0.5 && exp <= 1.8 ? exp : visual.exposicao;
  const mostrarExp = v => ($('expVal').textContent = nf(v, 2));
  $('optExp').value = ev;
  mostrarExp(ev);
  definirExposicao(ev);
  $('optExp').oninput = e => {
    const v = +e.target.value;
    definirExposicao(v);
    mostrarExp(v);
    lsSet(CHAVE_EXPOSICAO, String(v));
  };
  $('optFps').onchange = e => mostrarFps(e.target.checked);
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') mostrarFps(!fpsLigado);
  });
  escolherQualidade(escolha);
  descrever();
}
