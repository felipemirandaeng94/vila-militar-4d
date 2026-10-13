// Carrega os arquivos do local real (public/local/, gerados por scripts/geo/). Sem eles, o app usa o eixo reto e o
// terreno fictício e avisa na tela.
import { buscar } from './carga.js';

const ARQUIVOS = ['eixo', 'meta', 'vias', 'areas', 'edificacoes'];

export async function carregarLocal() {
  const base = import.meta.env.BASE_URL + 'local/';
  try {
    const [jsons, terreno] = await Promise.all([Promise.all(ARQUIVOS.map(f => buscar(base + f + '.json'))), buscar(base + 'terreno.bin', 'arrayBuffer')]);
    const local = Object.fromEntries(ARQUIVOS.map((f, i) => [f, jsons[i]]));
    local.terreno = terreno;
    return local;
  } catch (e) {
    console.warn('Local real indisponível; usando o eixo reto e o terreno fictício.', e);
    return null;
  }
}
