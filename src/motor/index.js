// Interface pública do motor 3D para o controlador.
import { M, ST } from '../estado.js';
import { cena, iniciarRenderizador, applyTheme, renderizar } from './renderizador.js';
import { buildTerrain, updateTerrain, resetTerrKey } from './terreno.js';
import { buildSurroundings } from './entorno.js';
import { buildPavement, updatePavement, surfC } from './pavimento.js';
import { buildCanteiro, updateSite } from './canteiro.js';
import { buildEquipment, updateEquipment, liftExtents } from './equipamentos.js';
import { buildMarkers, updateMarkers } from './marcadores.js';
import { buildLabels, updateLabels, mostrarRotulos } from './rotulos.js';
import { setView, setProfileClip, frontPoint, seguirFrente, passoCamera, camAt, focarPonto } from './camera.js';
import { iniciarSelecao } from './selecao.js';

export { cena, applyTheme, setView, setProfileClip, camAt, focarPonto, surfC, resetTerrKey, buildMarkers, buildPavement, mostrarRotulos };

export function montarMotor(vp) {
  iniciarRenderizador(vp);
  liftExtents();
  buildTerrain();
  buildSurroundings();
  buildPavement();
  buildCanteiro();
  buildEquipment();
  buildMarkers();
  buildLabels();
  setView('iso', true);
  iniciarSelecao();
}

// troca de cenário: novos ensaios e frentes
export function reconstruirMotor() {
  buildMarkers();
  resetTerrKey();
}

// troca do exagero das espessuras do pavimento
export function trocarExagero() {
  buildPavement();
  buildMarkers();
  if (ST.profile) setProfileClip(true);
  resetTerrKey();
}

let lastTerrT = 0;
// atualiza o modelo para o estado st das frentes; curtoDe(id) devolve o nome curto do serviço para o rótulo da frente
export function atualizarMotor(st, clk, force, curtoDe) {
  const now = performance.now();
  if (force || !ST.playing || now - lastTerrT > 110) {
    updateTerrain(st);
    lastTerrT = now;
  }
  updateSite(st);
  updatePavement(st);
  updateEquipment(st, clk);
  updateMarkers(st, clk);
  const fp = frontPoint(st);
  updateLabels(st, fp, fp ? curtoDe(fp.id) : null);
  seguirFrente(st, fp);
}

export function quadro(dt) {
  passoCamera(dt);
}
export { renderizar };
export const modeloPronto = () => !!M.svc;
