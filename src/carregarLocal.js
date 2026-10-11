// Carrega os arquivos do local real (public/local/, gerados por scripts/geo/). Sem eles, o app usa o eixo reto e o
// terreno fictício e avisa na tela.
const ARQUIVOS = ['eixo', 'meta', 'vias', 'areas', 'edificacoes'];

export async function carregarLocal() {
  const base = import.meta.env.BASE_URL + 'local/';
  try {
    const [jsons, terreno] = await Promise.all([
      Promise.all(
        ARQUIVOS.map(f =>
          fetch(base + f + '.json').then(r => {
            if (!r.ok) throw new Error(f + '.json: ' + r.status);
            return r.json();
          })
        )
      ),
      fetch(base + 'terreno.bin').then(r => {
        if (!r.ok) throw new Error('terreno.bin: ' + r.status);
        return r.arrayBuffer();
      })
    ]);
    const local = Object.fromEntries(ARQUIVOS.map((f, i) => [f, jsons[i]]));
    local.terreno = terreno;
    return local;
  } catch (e) {
    console.warn('Local real indisponível; usando o eixo reto e o terreno fictício.', e);
    return null;
  }
}
