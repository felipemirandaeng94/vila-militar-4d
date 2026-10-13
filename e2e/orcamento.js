// Orçamento de desempenho por perfil de qualidade (Fase 10). Justificativa e medições em docs/DESEMPENHO.md.
// carga: s até todos os arquivos chegarem (build local, sem cache) e MB transferidos; gpu: MB de memória de vídeo
// alocada pelo app (e2e/instrumentacao.js); desenhos: chamadas de desenho por quadro (máximo entre as vistas medidas);
// fps: mínimo entre as vistas, só conferido com GPU de verdade (sem renderização por software).
export const ORCAMENTO = {
  baixa: { cargaS: 15, redeMb: 55, gpuMb: 256, desenhos: 500, fps: 45 },
  media: { cargaS: 15, redeMb: 55, gpuMb: 450, desenhos: 500, fps: 45 },
  alta: { cargaS: 15, redeMb: 80, gpuMb: 800, desenhos: 550, fps: 45 }
};

/** Renderização por software (SwiftShader, llvmpipe): a taxa de quadros não diz nada do app. */
export const gpuDeSoftware = gpu => /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu || '');

/** Itens fora do orçamento numa medição de e2e/medicao.js (lista vazia: dentro). */
export function conferir(r) {
  const o = ORCAMENTO[r.perfil];
  if (!o) return [];
  const v = Object.values(r.vistas);
  const f = [];
  if (r.cargaMs / 1000 > o.cargaS) f.push(`carga ${(r.cargaMs / 1000).toFixed(1)} s > ${o.cargaS} s`);
  if (r.rede.mb > o.redeMb) f.push(`rede ${r.rede.mb} MB > ${o.redeMb} MB`);
  if (r.memoria.total > o.gpuMb) f.push(`GPU ${r.memoria.total} MB > ${o.gpuMb} MB`);
  const d = Math.max(...v.map(x => x.desenhos));
  if (d > o.desenhos) f.push(`desenhos ${d} > ${o.desenhos}`);
  const fps = Math.min(...v.map(x => x.fps));
  if (!gpuDeSoftware(r.gpu) && fps < o.fps) f.push(`fps ${fps} < ${o.fps}`);
  if (r.aplicado !== r.perfil) f.push(`perfil aplicado ${r.aplicado}, pedido ${r.perfil}`);
  return f;
}
