// Perfis de qualidade (baixa, média e alta), detecção automática pela GPU e pela taxa de quadros dos primeiros segundos,
// escolha manual salva no navegador e medidor de quadros por segundo.

/**
 * Cada perfil define: densidade de pixels máxima, lado do mapa de sombra e raio do filtro PCF, alcance máximo da sombra
 * em torno do alvo da câmera (m), pós-processamento (null = direto na tela com MSAA; ao = resolução do GTAO; aa = SMAA
 * ou FXAA), distância de desenho (plano distante da câmera, m), fração das árvores desenhadas, sombra das árvores,
 * resolução do céu de fundo, lado das texturas PBR do terreno e do pavimento (px), relevo (mapas de normais e projeção
 * triplanar nas faces inclinadas) e disfarce de repetição das texturas (amostragem estocástica e manchas de grande escala). Fase 7: distância (m) a partir da qual os modelos 3D usam o nível 1. Fase 6: distâncias (m) até as quais as árvores usam o modelo perto e o reduzido (além
 * delas, o impostor) e gramado (raio em torno do alvo da câmera, m, e tufos por m² de área gramada). Fase 8: efeitos de
 * partículas (máximo de partículas vivas e fator da taxa de emissão).
 */
export const PERFIS = {
  baixa: {
    nome: 'Baixa',
    modelos: { lod1: 40 },
    pixelRatio: 1,
    sombra: 1024,
    filtro: 1,
    alcanceSombra: 260,
    pos: null,
    distancia: 3200,
    vegetacao: 0.35,
    sombraVegetacao: false,
    ceu: '2k',
    texturas: 512,
    relevo: false,
    antirepeticao: false,
    arvores: { perto: 40, medio: 120 },
    gramado: { raio: 30, densidade: 0.8 },
    efeitos: { max: 700, taxa: 0.35 }
  },
  media: {
    nome: 'Média',
    modelos: { lod1: 70 },
    pixelRatio: 1.5,
    sombra: 2048,
    filtro: 1.5,
    alcanceSombra: 420,
    pos: { ao: 0.5, aa: 'fxaa' },
    distancia: 4500,
    vegetacao: 0.7,
    sombraVegetacao: false,
    ceu: '2k',
    texturas: 1024,
    relevo: true,
    antirepeticao: true,
    arvores: { perto: 70, medio: 200 },
    gramado: { raio: 55, densidade: 1.6 },
    efeitos: { max: 1800, taxa: 0.7 }
  },
  alta: {
    nome: 'Alta',
    modelos: { lod1: 110 },
    pixelRatio: 2,
    sombra: 4096,
    filtro: 2,
    alcanceSombra: 600,
    pos: { ao: 1, aa: 'smaa' },
    distancia: 6000,
    vegetacao: 1,
    sombraVegetacao: true,
    ceu: '4k',
    texturas: 2048,
    relevo: true,
    antirepeticao: true,
    arvores: { perto: 100, medio: 280 },
    gramado: { raio: 85, densidade: 2.6 },
    efeitos: { max: 4000, taxa: 1 }
  }
};
export const ORDEM = ['baixa', 'media', 'alta'];
export const CHAVE = 'vm4d.qualidade';
export const CHAVE_EXPOSICAO = 'vm4d.exposicao';
// abaixo desta taxa média (quadros por segundo) a detecção automática desce um perfil
export const FPS_MINIMO = 45;

/** Perfil inicial pelo nome da GPU (WEBGL_debug_renderer_info); sem nome, média. */
export function perfilPelaGpu(gpu) {
  const g = (gpu || '').toLowerCase();
  if (!g) return 'media';
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return 'baixa';
  if (/mali|adreno|powervr|videocore|intel\(r\) (hd|uhd)|intel hd|intel uhd|gma/.test(g)) return 'baixa';
  if (/iris|apple|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|intel/.test(g)) return 'media';
  if (/nvidia|geforce|quadro|rtx|gtx|radeon|amd/.test(g)) return 'alta';
  return 'media';
}

/** Perfil um nível abaixo quando a taxa média fica abaixo do mínimo; null se não há o que mudar. */
export function ajustePelaTaxa(fps, perfil) {
  if (fps >= FPS_MINIMO) return null;
  const i = ORDEM.indexOf(perfil);
  return i > 0 ? ORDEM[i - 1] : null;
}

/** Escolha salva: 'auto' ou o nome de um perfil. */
export const escolhaValida = v => (v === 'auto' || ORDEM.includes(v) ? v : 'auto');

/** Nome da GPU informado pelo navegador (pode vir mascarado). */
export function nomeDaGpu(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e) {
    return '';
  }
}

/**
 * Medidor de quadros: média móvel de 1 s para o indicador e janelas de medição para a detecção automática.
 * quadro(t) recebe o tempo em ms (performance.now).
 */
export class Medidor {
  constructor() {
    this.fps = 0;
    this._t0 = null;
    this._n = 0;
    this._janela = null;
  }
  quadro(t) {
    // conta intervalos entre quadros a partir do primeiro
    if (this._t0 === null) this._t0 = t;
    else this._n++;
    if (t - this._t0 >= 1000) {
      this.fps = (this._n * 1000) / (t - this._t0);
      this._t0 = t;
      this._n = 0;
    }
    const j = this._janela;
    if (j) {
      if (t < j.inicio) return;
      j.n++;
      if (j.ini === null) j.ini = t;
      if (t - j.ini >= j.dur) {
        this._janela = null;
        j.fim(((j.n - 1) * 1000) / (t - j.ini));
      }
    }
  }
  cancelar() {
    this._janela = null;
  }
  // mede a taxa média por dur ms, depois de espera ms; fim(fps) é chamado ao terminar
  medir(espera, dur, fim, agora) {
    this._janela = { inicio: agora + espera, dur, fim, n: 0, ini: null };
  }
}
