// Testes da renderização (Fase 4): análise do HDRI do céu, orientação do sol e perfis de qualidade.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { DataUtils } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { analisarCeu, direcaoDoTexel, limitarSol, preencherChao, azimuteNoMundo, elevacaoDaLinha } from '../src/motor/ceuHdr.js';
import { PERFIS, ORDEM, perfilPelaGpu, ajustePelaTaxa, escolhaValida, Medidor, FPS_MINIMO } from '../src/motor/qualidade.js';

const graus = r => (r * 180) / Math.PI;
const h = DataUtils.toHalfFloat;

// céu sintético: azul uniforme 0,5, com um "sol" de 3 × 3 texels de valor 5000 na coluna c e linha l
function ceuSintetico(w, hh, c, l) {
  const data = new Uint16Array(w * hh * 4);
  for (let i = 0; i < w * hh; i++) {
    data[i * 4] = h(0.3);
    data[i * 4 + 1] = h(0.4);
    data[i * 4 + 2] = h(0.6);
    data[i * 4 + 3] = h(1);
  }
  for (let dl = -1; dl <= 1; dl++)
    for (let dc = -1; dc <= 1; dc++) {
      const i = ((l + dl) * w + c + dc) * 4;
      data[i] = data[i + 1] = data[i + 2] = h(5000);
    }
  return { data, width: w, height: hh };
}

describe('céu HDRI', () => {
  it('a direção do texel segue a convenção equirretangular do three', () => {
    // centro da imagem (u = 0,5, v = 0,5): direção +X no horizonte
    const d = direcaoDoTexel(99.5, 49.5, 200, 100);
    expect(d[0]).toBeCloseTo(1, 3);
    expect(d[1]).toBeCloseTo(0, 3);
    // linha 0 (topo do arquivo) é o zênite, com flipY
    expect(direcaoDoTexel(0, 0, 200, 100)[1]).toBeGreaterThan(0.99);
    expect(elevacaoDaLinha(0, 100)).toBeGreaterThan(1.5);
  });

  it('acha o sol de um céu sintético', () => {
    // coluna 150 de 200: u = 0,7525, φ = 90,9°; linha 20 de 100: v = 0,795, elevação = 53,1°
    const a = analisarCeu(ceuSintetico(200, 100, 150, 20), 1);
    expect(graus(a.elevacao)).toBeCloseTo(53.1, 0);
    const esperado = direcaoDoTexel(150, 20, 200, 100);
    for (let k = 0; k < 3; k++) expect(a.sol[k]).toBeCloseTo(esperado[k], 2);
    expect(a.horizonte[0]).toBeCloseTo(0.3, 2);
    expect(a.horizonte[2]).toBeCloseTo(0.6, 2);
    // a média do céu exclui o disco do sol
    expect(a.mediaCeu).toBeCloseTo(0.2126 * 0.3 + 0.7152 * 0.4 + 0.0722 * 0.6, 2);
  });

  it('limita o sol e preenche o chão com a cor do horizonte', () => {
    const img = ceuSintetico(200, 100, 150, 20);
    const lim = limitarSol(img, 2);
    expect(DataUtils.fromHalfFloat(lim.data[(20 * 200 + 150) * 4])).toBeCloseTo(2, 2);
    // o original não muda
    expect(DataUtils.fromHalfFloat(img.data[(20 * 200 + 150) * 4])).toBeGreaterThan(4000);
    preencherChao(img, [0.1, 0.2, 0.3]);
    const i = (90 * 200 + 10) * 4;
    expect(DataUtils.fromHalfFloat(img.data[i + 1])).toBeCloseTo(0.2, 2);
    // o hemisfério de cima continua igual
    expect(DataUtils.fromHalfFloat(img.data[(10 * 200 + 10) * 4 + 1])).toBeCloseTo(0.4, 2);
  });

  it('converte o azimute geográfico para o mundo do app', () => {
    // eixo x com azimute 62,08°: a direção do eixo é +X (90°) e a esquerda do eixo é −Z (180°)
    expect(graus(azimuteNoMundo(62.08, 62.08))).toBeCloseTo(90, 6);
    expect(Math.abs(graus(azimuteNoMundo(-27.92, 62.08)))).toBeCloseTo(180, 6);
    // norte: 62,08° à esquerda do eixo
    expect(graus(azimuteNoMundo(0, 62.08))).toBeCloseTo(90 + 62.08, 6);
  });

  const arq = new URL('../public/hdri/ceu_2k.hdr', import.meta.url);
  it.skipIf(!existsSync(arq))('o HDRI baixado é um céu diurno com o sol alto', () => {
    const b = readFileSync(arq);
    const img = new HDRLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(img.width).toBe(2048);
    const a = analisarCeu(img);
    expect(graus(a.elevacao)).toBeGreaterThan(30);
    expect(graus(a.elevacao)).toBeLessThan(70);
    expect(a.picoSol / a.mediaCeu).toBeGreaterThan(1000);
    // horizonte azulado
    expect(a.horizonte[2]).toBeGreaterThan(a.horizonte[0]);
  });
});

describe('qualidade', () => {
  it('os perfis crescem em custo da baixa para a alta', () => {
    expect(ORDEM).toEqual(['baixa', 'media', 'alta']);
    const [b, m, a] = ORDEM.map(k => PERFIS[k]);
    expect(b.sombra).toBeLessThan(m.sombra);
    expect(m.sombra).toBeLessThan(a.sombra);
    expect(b.pixelRatio).toBeLessThanOrEqual(m.pixelRatio);
    expect(b.vegetacao).toBeLessThan(a.vegetacao);
    expect(b.pos).toBeNull();
    expect(a.pos.ao).toBe(1);
    expect(a.ceu).toBe('4k');
  });

  it('escolhe o perfil inicial pelo nome da GPU', () => {
    expect(perfilPelaGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('baixa');
    expect(perfilPelaGpu('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('media');
    expect(perfilPelaGpu('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('media');
    expect(perfilPelaGpu('ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti (0x00002182) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('alta');
    expect(perfilPelaGpu('ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('alta');
    expect(perfilPelaGpu('Google SwiftShader')).toBe('baixa');
    expect(perfilPelaGpu('Mali-G78')).toBe('baixa');
    expect(perfilPelaGpu('')).toBe('media');
  });

  it('desce um perfil quando a taxa fica abaixo do mínimo', () => {
    expect(ajustePelaTaxa(30, 'alta')).toBe('media');
    expect(ajustePelaTaxa(30, 'media')).toBe('baixa');
    expect(ajustePelaTaxa(30, 'baixa')).toBeNull();
    expect(ajustePelaTaxa(FPS_MINIMO + 1, 'alta')).toBeNull();
  });

  it('aceita só escolhas válidas salvas no navegador', () => {
    expect(escolhaValida('alta')).toBe('alta');
    expect(escolhaValida(null)).toBe('auto');
    expect(escolhaValida('ultra')).toBe('auto');
  });

  it('o medidor calcula a taxa média da janela depois da espera', () => {
    const m = new Medidor();
    let medido = null;
    m.medir(100, 1000, f => (medido = f), 0);
    // 50 quadros/s: um quadro a cada 20 ms
    for (let t = 0; t <= 1300; t += 20) m.quadro(t);
    expect(medido).toBeCloseTo(50, 0);
    expect(m.fps).toBeCloseTo(50, 0);
  });
});
