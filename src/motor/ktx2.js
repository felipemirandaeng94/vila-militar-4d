// Carregador KTX2 único (Fase 10): as texturas do terreno e as dos modelos 3D usam o mesmo transcodificador Basis
// (public/modelos/basis/) e o mesmo conjunto de workers. Os arquivos passam pelo gerenciador da carga (barra de progresso).
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { gerenciador } from '../carga.js';

let carregador = null;
/** Carregador KTX2 com o formato de destino escolhido pela GPU do renderizador. */
export function carregadorKTX2(renderer) {
  if (!carregador) carregador = new KTX2Loader(gerenciador).setTranscoderPath(import.meta.env.BASE_URL + 'modelos/basis/').detectSupport(renderer);
  return carregador;
}
