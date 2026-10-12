// Interface pública do motor 3D para o controlador.
import { ST } from '../estado.js';
import { cena, iniciarRenderizador, applyTheme, renderizar, carregarCeu, visual, escolherQualidade, definirExposicao } from './renderizador.js';
import { centrarMundo } from './base.js';
import { buildTerrain } from './terreno.js';
import { buildSurroundings, atualizarEntorno } from './entorno.js';
import { buildPavement, superficie } from './pavimento.js';
import { buildDrenagem } from './drenagem.js';
import { buildSinalizacao } from './sinalizacao.js';
import { buildCanteiro, buildFresado, updateSite } from './canteiro.js';
import { buildEquipment, updateEquipment } from './equipamentos.js';
import { buildEfeitos, atualizarEfeitos, definirEfeitos, efeitos } from './efeitos.js';
import { atualizarSom, definirSom, definirVolume, som } from './som.js';
import { buildMarkers, updateMarkers } from './marcadores.js';
import { buildLabels, updateLabels, mostrarRotulos } from './rotulos.js';
import { setView, setProfileClip, frontPoint, seguirFrente, passoCamera, camAt, focarPonto } from './camera.js';
import { iniciarSelecao } from './selecao.js';
import { uDia } from './dias.js';
import { noCanteiro } from '../dominio/geometria.js';
import { ceu } from './ceu.js';

export { definirEfeitos, efeitos, definirSom, definirVolume, som };
export { cena, visual, escolherQualidade, definirExposicao, applyTheme, setView, setProfileClip, camAt, focarPonto, buildMarkers, mostrarRotulos, superficie };

// partes que dependem do cronograma (dias de execução de cada estaca)
function construirObra() {
  buildPavement();
  buildDrenagem();
  buildSinalizacao();
  buildMarkers();
  buildLabels();
  if (ST.profile) setProfileClip(true);
}

export function montarMotor(vp) {
  centrarMundo();
  iniciarRenderizador(vp);
  buildTerrain();
  buildSurroundings();
  buildCanteiro();
  buildFresado();
  buildEquipment();
  buildEfeitos();
  construirObra();
  setView('iso', true);
  iniciarSelecao();
  carregarCeu();
  // inspeção no console e nos testes de navegador, só no servidor de desenvolvimento
  if (import.meta.env.DEV) window.__vm4d = { cena, visual, ceu, setView, camAt, escolherQualidade, noCanteiro, efeitos, definirEfeitos, som };
}

// troca de cenário ou decisão com retrabalho: o cronograma mudou
export const reconstruirMotor = construirObra;
// troca do exagero das espessuras do pavimento
export const trocarExagero = construirObra;

// atualiza o modelo para o estado st; curtoDe(id) devolve o nome curto do serviço para o rótulo da frente
export function atualizarMotor(st, clk, force, curtoDe) {
  uDia.value = st.d;
  updateSite(st);
  updateEquipment(st, clk);
  updateMarkers(st, clk);
  const fp = frontPoint(st);
  updateLabels(st, fp, fp ? curtoDe(fp.id) : null);
  seguirFrente(st, fp);
}

export function quadro(dt) {
  passoCamera(dt);
  atualizarEntorno(dt);
  // efeitos e som com o tempo real do quadro (a fumaça e o vapor continuam com a obra pausada)
  atualizarEfeitos({ d: ST.day }, dt);
  atualizarSom(dt);
}
export { renderizar };
