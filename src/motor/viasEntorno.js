// Vias existentes do entorno (Fase 6): sarjeta, meio-fio caiado, calçada, postes de iluminação, faixas pintadas e placas
// (parada obrigatória nas vias que chegam a uma via mais importante e velocidade máxima nas principais), a partir do
// traçado e da largura do OpenStreetMap. Interrompidos nos cruzamentos, na faixa da obra e no canteiro.
import * as THREE from 'three';
import { wy, mat, mundoDeLocal } from './base.js';
import { cotaNoLocal } from './terreno.js';
import { pbr } from './superficies.js';
import { reamostrar, amostrarAoLongo, distanciaAoSegmento, dentroPoligono, HIERARQUIA } from './entornoGeo.js';

// vias com meio-fio e calçada; as demais (serviço, BRT, via expressa) só interrompem as outras nos cruzamentos
const COM_GUIA = ['primary', 'secondary', 'tertiary', 'residential', 'living_street'];
const VEICULOS = Object.keys(HIERARQUIA);
const ERGUE = 0.07; // a faixa de asfalto fica 7 cm acima do terreno (entorno.js)
const H_GUIA = 0.15;
const L_SARJETA = 0.45;
const CALCADA = { primary: 2.5, secondary: 2.5, tertiary: 2.0, residential: 1.8, living_street: 1.5 };

// índice espacial dos segmentos das vias e dos contornos das edificações (células de 20 m)
function indice(itens, caixa) {
  const cel = 20,
    m = new Map();
  itens.forEach((it, i) => {
    const [x0, x1, y0, y1] = caixa(it);
    for (let a = Math.floor(x0 / cel); a <= Math.floor(x1 / cel); a++)
      for (let b = Math.floor(y0 / cel); b <= Math.floor(y1 / cel); b++) {
        const k = a * 100003 + b;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }
  });
  return (x, y) => m.get(Math.floor(x / cel) * 100003 + Math.floor(y / cel)) || [];
}

export function construirViasDoEntorno(pai, vias, edificacoes, bloqueado) {
  // segmentos das vias de veículos
  const segs = [];
  vias.forEach((v, iv) => {
    if (!VEICULOS.includes(v.tipo)) return;
    for (let i = 0; i < v.pts.length - 1; i++) segs.push({ iv, a: v.pts[i], b: v.pts[i + 1], w: v.largura / 2 });
  });
  const perto = indice(segs, s => [
    Math.min(s.a[0], s.b[0]) - s.w - 3,
    Math.max(s.a[0], s.b[0]) + s.w + 3,
    Math.min(s.a[1], s.b[1]) - s.w - 3,
    Math.max(s.a[1], s.b[1]) + s.w + 3
  ]);
  // ponto sobre o leito de outra via (cruzamento)
  const emOutraVia = (x, y, iv, folga = 0.6) =>
    perto(x, y).some(k => {
      const s = segs[k];
      return s.iv !== iv && distanciaAoSegmento(x, y, s.a[0], s.a[1], s.b[0], s.b[1]) < s.w + folga;
    });
  const edifs = edificacoes.filter(e => e.c.length >= 3);
  const pertoEdif = indice(edifs, e => {
    const xs = e.c.map(p => p[0]),
      ys = e.c.map(p => p[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  });
  const emEdificacao = (x, y) => pertoEdif(x, y).some(k => dentroPoligono(edifs[k].c, x, y));
  const livre = (x, y, iv) => !bloqueado(x, y) && !emOutraVia(x, y, iv);

  const tiras = { sarjeta: [], guia: [], calcada: [] };
  const postes = [],
    tracos = { amarelo: [], branco: [] },
    placas = { pare: [], velocidade: [] },
    retencao = [];
  vias.forEach((v, iv) => {
    if (!COM_GUIA.includes(v.tipo) || v.eixo_obra) return;
    const w = v.largura / 2,
      lc = CALCADA[v.tipo];
    const amostras = reamostrar(v.pts, 4);
    // meio-fio, sarjeta e calçada de cada lado, em trechos contínuos
    for (const sd of [-1, 1]) {
      let ant = null;
      for (const a of amostras) {
        const px = (d, dy = 0) => [a.x + a.nx * sd * d, a.y + a.ny * sd * d, dy];
        const [bx, by] = px(w);
        const [ox, oy] = px(w + H_GUIA + lc);
        const ok = livre(bx, by, iv) && livre(a.x, a.y, iv) && !emEdificacao(bx, by);
        const okCalc = ok && !emEdificacao(ox, oy) && !bloqueado(ox, oy) && !emOutraVia(ox, oy, iv, 0.2);
        const base = wy(cotaNoLocal(bx, by)) + ERGUE;
        const fora = Math.max(base + H_GUIA, wy(cotaNoLocal(ox, oy)) + 0.03);
        const lado = { x: a.nx * sd, y: a.ny * sd };
        const sec = {
          ok,
          okCalc,
          lado,
          sarjeta: [P(px(w - L_SARJETA), base + 0.006), P(px(w), base + 0.006)],
          guia: [P(px(w), base + 0.006), P(px(w), base + H_GUIA), P(px(w + H_GUIA), base + H_GUIA)],
          calcada: [P(px(w + H_GUIA), base + H_GUIA), P(px(w + H_GUIA + lc), fora), P(px(w + H_GUIA + lc), wy(cotaNoLocal(ox, oy)) - 0.15)]
        };
        if (ant) {
          if (ant.ok && sec.ok) {
            tira(tiras.sarjeta, ant.sarjeta, sec.sarjeta, [[0, 1]], lado);
            tira(
              tiras.guia,
              ant.guia,
              sec.guia,
              [
                [-1, 0],
                [0, 1]
              ],
              lado
            );
          }
          if (ant.okCalc && sec.okCalc)
            tira(
              tiras.calcada,
              ant.calcada,
              sec.calcada,
              [
                [0, 1],
                [1, 0]
              ],
              lado
            );
        }
        ant = sec;
      }
    }
    // postes a cada 32 m, de um lado só (alternado entre as vias), junto ao meio-fio
    const sdPoste = iv % 2 ? 1 : -1;
    for (const p of amostrarAoLongo(v.pts, 32, sdPoste * (w + H_GUIA + 0.45), 12)) {
      const bx = p.x + p.ty * sdPoste * 0.6,
        by = p.y - p.tx * sdPoste * 0.6;
      if (!livre(p.x, p.y, iv) || !livre(bx, by, iv) || emEdificacao(p.x, p.y)) continue;
      // o braço aponta para a pista
      postes.push({ x: p.x, y: p.y, dir: [-p.ty * sdPoste, p.tx * sdPoste] });
    }
    // faixas: dupla contínua amarela nas principais (com divisão de faixas branca), tracejada amarela nas demais
    const principal = HIERARQUIA[v.tipo] >= 4;
    if (v.largura >= 5.5) {
      const linhas = principal
        ? [
            [0.12, 1, 0],
            [-0.12, 1, 0]
          ]
        : [[0, 2, 4]];
      if (principal && v.largura >= 12) linhas.push([w / 2, 3, 6, 'branco'], [-w / 2, 3, 6, 'branco']);
      for (const [d, traco, vao, cor = 'amarelo'] of linhas) {
        const passo = vao ? traco + vao : 1;
        const comp = vao ? traco : 1;
        for (const p of amostrarAoLongo(v.pts, passo, d, 1)) {
          if (!livre(p.x, p.y, iv) || emOutraVia(p.x + p.tx * comp, p.y + p.ty * comp, iv) || emOutraVia(p.x - p.tx * comp, p.y - p.ty * comp, iv)) continue;
          tracos[cor].push({ x: p.x, y: p.y, tx: p.tx, ty: p.ty, comp: comp + 0.02 });
        }
      }
    }
    // velocidade máxima a cada 300 m nas principais
    if (principal)
      amostrarAoLongo(v.pts, 300, -(w + H_GUIA + 0.5), 60).forEach(p => {
        // à direita de quem segue o sentido da polilinha, voltada para ele
        if (livre(p.x, p.y, iv) && !emEdificacao(p.x, p.y)) placas.velocidade.push({ x: p.x, y: p.y, frente: [-p.tx, -p.ty] });
      });
  });
  // parada obrigatória: extremidade de uma via que chega a outra mais importante (ou igual), com a linha de retenção
  vias.forEach((v, iv) => {
    if (!COM_GUIA.includes(v.tipo) || v.eixo_obra || v.pts.length < 2) return;
    for (const fim of [0, 1]) {
      const pts = fim ? [...v.pts].reverse() : v.pts;
      const [ex, ey] = pts[0];
      const outra = perto(ex, ey)
        .map(k => segs[k])
        .find(s => s.iv !== iv && HIERARQUIA[vias[s.iv].tipo] >= HIERARQUIA[v.tipo] && distanciaAoSegmento(ex, ey, s.a[0], s.a[1], s.b[0], s.b[1]) < s.w + 1.5);
      if (!outra) continue;
      // recuo até sair do leito da outra via, mais 1,5 m
      const recuo = outra.w + 1.5;
      const [p] = amostrarAoLongo(pts, 1, 0, recuo);
      if (!p) continue;
      // o veículo chega ao cruzamento em sentido oposto à polilinha invertida: a placa fica à direita de quem chega
      const chega = [-p.tx, -p.ty];
      const dir = [chega[1], -chega[0]];
      const w = v.largura / 2;
      const sx = p.x + dir[0] * (w + H_GUIA + 0.6),
        sy = p.y + dir[1] * (w + H_GUIA + 0.6);
      if (bloqueado(sx, sy) || emEdificacao(sx, sy)) continue;
      placas.pare.push({ x: sx, y: sy, frente: [-chega[0], -chega[1]] });
      // linha de retenção na meia pista de quem chega, do eixo até a sarjeta
      retencao.push({ x: p.x + dir[0] * 0.15, y: p.y + dir[1] * 0.15, tx: dir[0], ty: dir[1], comp: w - 0.15 - L_SARJETA });
    }
  });

  // ---------- malhas ----------
  const concreto = (cor, nome, info) => {
    const geo = geometria(tiras[nome]);
    if (!geo) return;
    const o = new THREE.Mesh(geo, pbr(new THREE.MeshStandardMaterial({ color: cor, roughness: 1, metalness: 0 }), { camada: 'concreto' }));
    o.receiveShadow = true;
    o.castShadow = nome === 'guia';
    o.userData.info = info;
    pai.add(o);
  };
  const fonte = { Fonte: 'Traçado e largura: © colaboradores do OpenStreetMap (ODbL); seção ilustrativa', Situação: 'Fora da obra' };
  concreto(0xaaa79f, 'sarjeta', { t: 'Sarjeta existente', d: fonte });
  concreto(0xe2e0d8, 'guia', { t: 'Meio-fio existente (caiado)', d: fonte });
  concreto(0xb9b4a8, 'calcada', { t: 'Calçada existente', d: fonte });
  instanciarPostes(pai, postes);
  const tinta = (cor, lista, larg, info) => {
    if (!lista.length) return;
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), pbr(mat(cor, { roughness: 0.8 }).clone(), { camada: 'asfalto_usado' }), lista.length);
    const o = new THREE.Object3D();
    lista.forEach((t, i) => {
      const c = mundoDeLocal(t.x + (t.tx * t.comp) / 2, t.y + (t.ty * t.comp) / 2);
      o.position.set(c.x, wy(cotaNoLocal(t.x, t.y)) + ERGUE + 0.012, c.z);
      o.rotation.set(0, Math.atan2(t.ty, t.tx), 0);
      o.scale.set(t.comp, 1, larg);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.receiveShadow = true;
    m.userData.info = info;
    pai.add(m);
  };
  const ref = { Referência: 'Manual Brasileiro de Sinalização de Trânsito (CONTRAN), vol. IV', Situação: 'Existente, fora da obra' };
  tinta(0xd9b13a, tracos.amarelo, 0.1, { t: 'Linha de divisão de fluxos opostos', d: ref });
  tinta(0xdedcd4, tracos.branco, 0.1, { t: 'Linha de divisão de fluxos de mesmo sentido', d: ref });
  tinta(0xdedcd4, retencao, 0.4, { t: 'Linha de retenção', d: ref });
  instanciarPlacas(pai, placas);
  return { postes, placas: placas.pare.length + placas.velocidade.length };
}

// ponto local (x, y) com altura y do mundo
function P([x, y], h) {
  const m = mundoDeLocal(x, y);
  return new THREE.Vector3(m.x, h, m.z);
}
// liga duas seções (listas de pontos) com triângulos; normais é a direção desejada de cada face no plano da seção
// ([lateral, vertical]: lateral + = para fora da via), usada para acertar a ordem dos vértices
function tira(out, A, B, normais, lado) {
  const ld = mundoDeLocal(lado.x, lado.y),
    l0 = mundoDeLocal(0, 0);
  const lx = ld.x - l0.x,
    lz = ld.z - l0.z;
  for (let k = 0; k < A.length - 1; k++) {
    const [dl, dv] = normais[k];
    const alvo = new THREE.Vector3(lx * dl, dv, lz * dl);
    for (const t of [
      [A[k], B[k], B[k + 1]],
      [A[k], B[k + 1], A[k + 1]]
    ]) {
      const n = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0]));
      const tri = n.dot(alvo) < 0 ? [t[0], t[2], t[1]] : t;
      for (const p of tri) out.push(p.x, p.y, p.z);
    }
  }
}
function geometria(pos) {
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// poste de concreto com braço e luminária LED; +X aponta para a pista
function geometriaDoPoste() {
  const partes = [];
  const cor = (g, c) => {
    const col = new THREE.Color(c);
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        new Array(g.attributes.position.count).fill(0).flatMap(() => [col.r, col.g, col.b]),
        3
      )
    );
    return g.toNonIndexed ? g.toNonIndexed() : g;
  };
  partes.push(cor(new THREE.CylinderGeometry(0.09, 0.15, 9, 8).translate(0, 4.5, 0), 0xb4b1a8));
  const braco = new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6);
  braco.rotateZ(-Math.PI / 2 + 0.2);
  braco.translate(0.85, 8.85, 0);
  partes.push(cor(braco, 0x8c9095));
  partes.push(cor(new THREE.BoxGeometry(0.62, 0.1, 0.28).translate(1.75, 9.05, 0), 0x4a4e52));
  const pos = [],
    col = [];
  for (const g of partes) {
    const gi = g.index ? g.toNonIndexed() : g;
    pos.push(...gi.attributes.position.array);
    col.push(...gi.attributes.color.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function instanciarPostes(pai, postes) {
  if (!postes.length) return;
  const m = new THREE.InstancedMesh(geometriaDoPoste(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 }), postes.length);
  const o = new THREE.Object3D();
  postes.forEach((p, i) => {
    const w = mundoDeLocal(p.x, p.y),
      d0 = mundoDeLocal(0, 0),
      d = mundoDeLocal(p.dir[0], p.dir[1]);
    o.position.set(w.x, wy(cotaNoLocal(p.x, p.y)) + ERGUE + H_GUIA - 0.05, w.z);
    // rotação em Y que leva +X à direção do braço (no mundo)
    o.rotation.set(0, -Math.atan2(d.z - d0.z, d.x - d0.x), 0);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = m.receiveShadow = true;
  m.userData.info = { t: 'Poste de iluminação pública existente', d: { Tipo: 'Concreto, braço com luminária LED (ilustrativo)', Situação: 'Fora da obra' } };
  pai.add(m);
}

// ---------- placas ----------
function texturaDePlaca(desenho) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  desenho(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const PARE = g => {
  const oct = r => {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      g.lineTo(128 + r * Math.cos(a), 128 + r * Math.sin(a));
    }
    g.closePath();
  };
  g.fillStyle = '#ffffff';
  oct(126);
  g.fill();
  g.fillStyle = '#c4161c';
  oct(114);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = 'bold 74px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PARE', 128, 132);
};
const VELOCIDADE = g => {
  g.fillStyle = '#c4161c';
  g.beginPath();
  g.arc(128, 128, 126, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(128, 128, 98, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111111';
  g.font = 'bold 92px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('40', 128, 134);
  g.font = 'bold 30px Arial, Helvetica, sans-serif';
  g.fillText('km/h', 128, 196);
};
function instanciarPlacas(pai, placas) {
  const todas = [...placas.pare.map(p => ({ ...p, tipo: 'pare' })), ...placas.velocidade.map(p => ({ ...p, tipo: 'velocidade' }))];
  if (!todas.length) return;
  const o = new THREE.Object3D();
  const pose = (p, y, plano) => {
    const w = mundoDeLocal(p.x, p.y),
      d0 = mundoDeLocal(0, 0),
      d = mundoDeLocal(p.frente[0], p.frente[1]);
    o.position.set(w.x, wy(cotaNoLocal(p.x, p.y)) + ERGUE + H_GUIA + y, w.z);
    // o plano (normal +Z) olha para quem chega
    o.rotation.set(0, plano ? Math.atan2(d.x - d0.x, d.z - d0.z) : 0, 0);
    o.updateMatrix();
    return o.matrix;
  };
  const haste = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6).translate(0, 1.3, 0),
    mat(0x8c9095, { metalness: 0.4, roughness: 0.6 }),
    todas.length
  );
  todas.forEach((p, i) => haste.setMatrixAt(i, pose(p, 0, false)));
  haste.castShadow = haste.receiveShadow = true;
  const ref = { Referência: 'Manual Brasileiro de Sinalização de Trânsito (CONTRAN), vol. I', Situação: 'Existente, fora da obra' };
  haste.userData.info = { t: 'Placa de regulamentação existente', d: ref };
  pai.add(haste);
  for (const [tipo, desenho, nome, geo] of [
    ['pare', PARE, 'R-1 Parada obrigatória', new THREE.CircleGeometry(0.4, 8, Math.PI / 8)],
    ['velocidade', VELOCIDADE, 'R-19 Velocidade máxima permitida (40 km/h, ilustrativa)', new THREE.CircleGeometry(0.4, 24)]
  ]) {
    const lista = todas.filter(p => p.tipo === tipo);
    if (!lista.length) continue;
    // a textura vai na face da frente; o verso da chapa é cinza
    const frente = new THREE.MeshStandardMaterial({ map: texturaDePlaca(desenho), roughness: 0.45, metalness: 0 });
    // chapa à frente da haste (raio de 3,5 cm): face a 5 cm e verso a 4 cm do eixo
    const m = new THREE.InstancedMesh(geo.clone().translate(0, 0, 0.05), frente, lista.length);
    const verso = new THREE.InstancedMesh(geo.clone().rotateY(Math.PI).translate(0, 0, 0.04), mat(0x9a9c9e, { metalness: 0.5 }), lista.length);
    lista.forEach((p, i) => {
      const mm = pose(p, 2.3, true);
      m.setMatrixAt(i, mm);
      verso.setMatrixAt(i, mm);
    });
    for (const x of [m, verso]) {
      x.castShadow = x.receiveShadow = true;
      x.userData.info = { t: 'Placa ' + nome, d: ref };
      pai.add(x);
    }
  }
}
