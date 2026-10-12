// Cartão "Visualização": qualidade gráfica (automática ou manual, salva no navegador), exposição, efeitos de partículas,
// volume do som e indicador de quadros por segundo (tecla F). Botão de som da barra da obra (tecla M).
import { $, lsGet, lsSet } from './dom.js';
import { visual, escolherQualidade, definirExposicao, definirEfeitos, definirSom, definirVolume, som } from '../motor/index.js';
import { PERFIS, CHAVE, CHAVE_EXPOSICAO, escolhaValida, FPS_MINIMO } from '../motor/qualidade.js';
import { nf } from '../dominio/util.js';

const DESC = {
  baixa:
    'Sombra de 1024 px perto da câmera, sem pós-processamento, texturas de 512 px sem relevo e sem disfarce de repetição, 35% das árvores, até 700 partículas.',
  media:
    'Sombra de 2048 px, oclusão de ambiente em meia resolução, FXAA, texturas de 1K com relevo e disfarce de repetição, 70% das árvores, até 1800 partículas.',
  alta: 'Sombra de 4096 px, oclusão de ambiente (GTAO), SMAA, céu em 4K, texturas de 2K, todas as árvores com sombra, até 4000 partículas.'
};
const CHAVE_EFEITOS = 'vm4d.efeitos',
  CHAVE_VOLUME = 'vm4d.volume';

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

async function alternarSom() {
  const b = $('som');
  const on = !som.ligado;
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'Carregando o som…' : 'Som desligado';
  await definirSom(on);
  b.setAttribute('aria-pressed', String(som.ligado));
  b.textContent = som.ligado ? 'Som ligado' : 'Som desligado';
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
  // efeitos de partículas: ligados por padrão, escolha salva
  const ef = lsGet(CHAVE_EFEITOS) !== '0';
  $('optEfeitos').checked = ef;
  definirEfeitos(ef);
  $('optEfeitos').onchange = e => {
    definirEfeitos(e.target.checked);
    lsSet(CHAVE_EFEITOS, e.target.checked ? '1' : '0');
  };
  // som: o volume fica salvo, mas o som sempre começa desligado (só toca depois de um clique)
  const vs = Number(lsGet(CHAVE_VOLUME));
  const vol = lsGet(CHAVE_VOLUME) !== null && vs >= 0 && vs <= 1 ? vs : som.volume;
  const mostrarVol = v => ($('volVal').textContent = nf(v * 100, 0) + ' %');
  $('optVol').value = vol;
  mostrarVol(vol);
  definirVolume(vol);
  $('optVol').oninput = e => {
    const v = +e.target.value;
    definirVolume(v);
    mostrarVol(v);
    lsSet(CHAVE_VOLUME, String(v));
  };
  $('som').onclick = alternarSom;
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') mostrarFps(!fpsLigado);
    if (e.key === 'm' || e.key === 'M') alternarSom();
  });
  escolherQualidade(escolha);
  descrever();
}
