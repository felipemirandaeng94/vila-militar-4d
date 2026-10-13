// Instrumentação do WebGL para as medições de desempenho (Fase 10), injetada na página antes do app (addInitScript).
// Intercepta as chamadas do contexto WebGL 2 e conta:
//   - memória de vídeo alocada pelo app: texturas (texStorage, texImage e compressedTexImage, por nível e camada),
//     buffers (bufferData) e renderbuffers (com as amostras do MSAA), descontando o que é apagado;
//   - chamadas de desenho e triângulos por quadro (drawArrays, drawElements e as versões instanciadas).
// O resultado fica em window.__gpu. A memória do framebuffer da tela (canvas) é estimada à parte em memoria().
// Os tamanhos dos formatos comprimidos seguem os blocos 4 × 4 (BC1 e ETC2 RGB: 8 bytes; BC3, BC7, ETC2 RGBA e ASTC
// 4 × 4: 16 bytes). É uma estimativa do que o app pede ao driver; o driver pode alinhar ou guardar cópias.
export function instrumentar() {
  const BPP = {
    0x8058: 4, // RGBA8
    0x8c43: 4, // SRGB8_ALPHA8
    0x8051: 4, // RGB8 (alinhado a 4)
    0x8229: 1, // R8
    0x822b: 2, // RG8
    0x822d: 2, // R16F
    0x822f: 4, // RG16F
    0x881a: 8, // RGBA16F
    0x881b: 8, // RGB16F (alinhado)
    0x822e: 4, // R32F
    0x8230: 8, // RG32F
    0x8814: 16, // RGBA32F
    0x8c3a: 4, // R11F_G11F_B10F
    0x8d62: 2, // RGB565
    0x8056: 2, // RGBA4
    0x8057: 2, // RGB5_A1
    0x81a5: 2, // DEPTH_COMPONENT16
    0x81a6: 4, // DEPTH_COMPONENT24
    0x8cac: 4, // DEPTH_COMPONENT32F
    0x88f0: 4, // DEPTH24_STENCIL8
    0x8cad: 8, // DEPTH32F_STENCIL8
    0x8d48: 1, // STENCIL_INDEX8
    0x1908: 4, // RGBA (texImage sem formato interno de tamanho)
    0x1907: 4, // RGB
    0x1903: 1, // RED
    0x8227: 2 // RG
  };
  // bytes por bloco 4 × 4
  const BLOCO = {
    0x83f0: 8,
    0x83f1: 8,
    0x83f2: 16,
    0x83f3: 16, // S3TC
    0x8c4c: 8,
    0x8c4d: 8,
    0x8c4e: 16,
    0x8c4f: 16, // S3TC sRGB
    0x8e8c: 16,
    0x8e8d: 16,
    0x8e8e: 16,
    0x8e8f: 16, // BPTC (BC7, BC6H)
    0x8dbb: 8,
    0x8dbc: 8,
    0x8dbd: 16,
    0x8dbe: 16, // RGTC (BC4, BC5)
    0x9274: 8,
    0x9275: 8,
    0x9276: 8,
    0x9277: 8,
    0x9278: 16,
    0x9279: 16,
    0x9270: 8,
    0x9272: 16, // ETC2 e EAC
    0x93b0: 16,
    0x93d0: 16, // ASTC 4 × 4
    0x8d64: 8 // ETC1
  };
  const tamanho = (fmt, w, h, d) => {
    if (BLOCO[fmt]) return Math.ceil(w / 4) * Math.ceil(h / 4) * BLOCO[fmt] * d;
    return w * h * d * (BPP[fmt] || 4);
  };
  const g = (window.__gpu = { texturas: 0, buffers: 0, renderbuffers: 0, desenhos: 0, triangulos: 0, nTexturas: 0, nBuffers: 0 });
  const tex = new Map(),
    buf = new Map(),
    rb = new Map();
  const ctxs = new Set();
  const P = WebGL2RenderingContext.prototype;
  const estado = new WeakMap();
  const st = gl => {
    let s = estado.get(gl);
    if (!s) estado.set(gl, (s = { unidade: 0, tex: {}, buf: {}, rb: null }));
    return s;
  };
  const embrulhar = (nome, depois) => {
    const orig = P[nome];
    P[nome] = function (...a) {
      const r = orig.apply(this, a);
      depois.call(this, a, r);
      return r;
    };
  };
  // descrição de cada textura (formato e lado) para a lista das maiores
  const desc = new Map();
  const somarTex = (t, chave, bytes, d) => {
    if (!t) return;
    let e = tex.get(t);
    if (!e) tex.set(t, (e = new Map()));
    g.texturas += bytes - (e.get(chave) || 0);
    e.set(chave, bytes);
    if (d && !desc.has(t)) desc.set(t, d);
  };
  const atual = (gl, alvo) => {
    // faces do cubemap usam a textura ligada em TEXTURE_CUBE_MAP
    const a = alvo >= 0x8515 && alvo <= 0x851a ? 0x8513 : alvo;
    return st(gl).tex[st(gl).unidade + ':' + a];
  };
  embrulhar('getExtension', function () {
    ctxs.add(this);
  });
  embrulhar('activeTexture', function ([u]) {
    st(this).unidade = u;
  });
  embrulhar('bindTexture', function ([alvo, t]) {
    st(this).tex[st(this).unidade + ':' + alvo] = t;
  });
  embrulhar('createTexture', () => g.nTexturas++);
  embrulhar('deleteTexture', function ([t]) {
    const e = tex.get(t);
    if (e) for (const v of e.values()) g.texturas -= v;
    tex.delete(t);
    if (t) g.nTexturas--;
  });
  embrulhar('texStorage2D', function ([alvo, niveis, fmt, w, h]) {
    const faces = alvo === 0x8513 ? 6 : 1;
    let s = 0;
    for (let i = 0; i < niveis; i++) s += tamanho(fmt, Math.max(1, w >> i), Math.max(1, h >> i), faces);
    somarTex(atual(this, alvo), 'storage', s, `${w}×${h}${faces > 1 ? ' cubo' : ''} fmt 0x${fmt.toString(16)} ${niveis} níveis`);
  });
  embrulhar('texStorage3D', function ([alvo, niveis, fmt, w, h, d]) {
    let s = 0;
    // arrays: as camadas não diminuem com o nível; 3D: diminuem
    for (let i = 0; i < niveis; i++) s += tamanho(fmt, Math.max(1, w >> i), Math.max(1, h >> i), alvo === 0x806f ? Math.max(1, d >> i) : d);
    somarTex(atual(this, alvo), 'storage', s, `${w}×${h}×${d} fmt 0x${fmt.toString(16)} ${niveis} níveis`);
  });
  embrulhar('texImage2D', function (a) {
    const [alvo, nivel, fmt] = a;
    let w, h;
    if (a.length >= 8) [w, h] = [a[3], a[4]];
    else {
      const img = a[5];
      w = img && (img.width || img.videoWidth || img.naturalWidth);
      h = img && (img.height || img.videoHeight || img.naturalHeight);
    }
    if (w && h) somarTex(atual(this, alvo), alvo + ':' + nivel, tamanho(fmt, w, h, 1), `${w}×${h} fmt 0x${fmt.toString(16)} (texImage)`);
  });
  embrulhar('texImage3D', function ([alvo, nivel, fmt, w, h, d]) {
    somarTex(atual(this, alvo), alvo + ':' + nivel, tamanho(fmt, w, h, d));
  });
  embrulhar('compressedTexImage2D', function ([alvo, nivel, fmt, w, h]) {
    somarTex(atual(this, alvo), alvo + ':' + nivel, tamanho(fmt, w, h, 1), `${w}×${h} fmt 0x${fmt.toString(16)} (comprimida)`);
  });
  embrulhar('compressedTexImage3D', function ([alvo, nivel, fmt, w, h, d]) {
    somarTex(atual(this, alvo), alvo + ':' + nivel, tamanho(fmt, w, h, d));
  });
  embrulhar('bindBuffer', function ([alvo, b]) {
    st(this).buf[alvo] = b;
  });
  embrulhar('createBuffer', () => g.nBuffers++);
  embrulhar('bufferData', function ([alvo, dados]) {
    const b = st(this).buf[alvo];
    if (!b) return;
    const n = typeof dados === 'number' ? dados : dados ? dados.byteLength : 0;
    g.buffers += n - (buf.get(b) || 0);
    buf.set(b, n);
  });
  embrulhar('deleteBuffer', function ([b]) {
    g.buffers -= buf.get(b) || 0;
    buf.delete(b);
    if (b) g.nBuffers--;
  });
  embrulhar('bindRenderbuffer', function ([, r]) {
    st(this).rb = r;
  });
  const somarRb = (r, bytes) => {
    if (!r) return;
    g.renderbuffers += bytes - (rb.get(r) || 0);
    rb.set(r, bytes);
  };
  embrulhar('renderbufferStorage', function ([, fmt, w, h]) {
    somarRb(st(this).rb, tamanho(fmt, w, h, 1));
  });
  embrulhar('renderbufferStorageMultisample', function ([, amostras, fmt, w, h]) {
    somarRb(st(this).rb, tamanho(fmt, w, h, 1) * Math.max(1, amostras));
  });
  embrulhar('deleteRenderbuffer', function ([r]) {
    g.renderbuffers -= rb.get(r) || 0;
    rb.delete(r);
  });
  // triângulos pelo modo (TRIANGLES = 4, STRIP = 5, FAN = 6)
  const tri = (modo, n) => (modo === 4 ? n / 3 : modo === 5 || modo === 6 ? Math.max(0, n - 2) : 0);
  embrulhar('drawArrays', ([modo, , n]) => {
    g.desenhos++;
    g.triangulos += tri(modo, n);
  });
  embrulhar('drawElements', ([modo, n]) => {
    g.desenhos++;
    g.triangulos += tri(modo, n);
  });
  embrulhar('drawArraysInstanced', ([modo, , n, k]) => {
    g.desenhos++;
    g.triangulos += tri(modo, n) * k;
  });
  embrulhar('drawElementsInstanced', ([modo, n, , , k]) => {
    g.desenhos++;
    g.triangulos += tri(modo, n) * k;
  });
  // memória total (MB), com o framebuffer da tela: cor e profundidade, vezes as amostras do MSAA
  g.memoria = () => {
    let tela = 0;
    for (const c of document.querySelectorAll('canvas')) {
      const gl = c.getContext('webgl2');
      if (!gl) continue;
      const aa = gl.getContextAttributes().antialias ? 4 : 1;
      tela += c.width * c.height * 4 * (aa + 1) + c.width * c.height * 4;
    }
    const mb = v => Math.round((v / 1048576) * 10) / 10;
    return {
      texturas: mb(g.texturas),
      buffers: mb(g.buffers),
      renderbuffers: mb(g.renderbuffers),
      tela: mb(tela),
      total: mb(g.texturas + g.buffers + g.renderbuffers + tela)
    };
  };
  // as n texturas que mais ocupam (MB e descrição), para achar o que pesa na memória
  g.maiores = (n = 15) =>
    [...tex.entries()]
      .map(([t, e]) => [Math.round(([...e.values()].reduce((a, b) => a + b, 0) / 1048576) * 10) / 10, desc.get(t) || '?'])
      .sort((a, b) => b[0] - a[0])
      .slice(0, n);
  // mede por dur ms: quadros por segundo (requestAnimationFrame), chamadas de desenho e triângulos por quadro e o
  // pior intervalo entre quadros
  g.medir = dur =>
    new Promise(ok => {
      let n = 0,
        t0 = null,
        d0 = 0,
        tr0 = 0,
        ant = 0,
        pior = 0;
      const passo = t => {
        if (t0 === null) {
          t0 = ant = t;
          d0 = g.desenhos;
          tr0 = g.triangulos;
        } else {
          n++;
          pior = Math.max(pior, t - ant);
          ant = t;
        }
        if (t0 !== null && t - t0 >= dur) {
          const s = (t - t0) / 1000;
          return ok({ fps: n / s, desenhos: (g.desenhos - d0) / n, triangulos: (g.triangulos - tr0) / n, piorQuadroMs: pior });
        }
        requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
}
