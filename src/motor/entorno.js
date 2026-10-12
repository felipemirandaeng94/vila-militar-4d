// Entorno real do trecho (public/local/): vias existentes do OpenStreetMap sobre o relevo, com sarjeta, meio-fio, calçada,
// postes e sinalização (viasEntorno.js); edificações do IPP (contorno e altura do Lidar 2019; OSM onde o IPP não cobre)
// com fachadas por tipo (edificacoes.js); árvores nas matas, nas áreas verdes, nas calçadas e nas margens da avenida da
// obra (arvores.js, com níveis de detalhe) e gramado perto da câmera (gramado.js). Vias e edificações são geometrias
// únicas por material; árvores e tufos usam InstancedMesh, para manter o desempenho em 1,6 km.
// Área militar: só dados de fontes públicas, sem nomes de edificações.
import * as THREE from 'three';
import { P } from '../dominio/geometria.js';
import { obraDeLocal, localDeObra, gradeDoTerreno } from '../dominio/local.js';
import { rng } from '../dominio/util.js';
import { wy, mundoDeLocal, localDoMundo } from './base.js';
import { cena, registrarVegetacao } from './renderizador.js';
import { cotaNoLocal } from './terreno.js';
import { NUNCA } from './dias.js';
import { pbr } from './superficies.js';
import { construirEdificacoes } from './edificacoes.js';
import { construirViasDoEntorno } from './viasEntorno.js';
import { criarArvores, ajustarArvores, atualizarArvores, uVento } from './arvores.js';
import { criarGramado, ajustarGramado, atualizarGramado } from './gramado.js';
import { dentroPoligono, distanciaAoSegmento, amostrarAoLongo, reamostrar, areaPoligono, HIERARQUIA } from './entornoGeo.js';
import { M, D } from '../estado.js';

// ---------- vias ----------
const COR_VIA = {
  asfalto: 0x55595a,
  concreto: 0x9c9a94,
  bloco: 0x8a817a,
  terra: 0x9a8566,
  pedestre: 0xb9b5aa
};
// textura PBR de cada tipo de via (superficies.js)
const TEX_VIA = { asfalto: 'asfalto_usado', concreto: 'concreto', bloco: 'concreto', terra: 'solo', pedestre: 'concreto' };
function corDaVia(v) {
  if (['footway', 'steps', 'pedestrian'].includes(v.tipo)) return 'pedestre';
  if (v.tipo === 'bridleway') return 'terra';
  const sf = v.superficie || '';
  if (/concrete/.test(sf) || v.tipo === 'busway') return 'concreto';
  if (/paving|stones|sett/.test(sf)) return 'bloco';
  if (/unpaved|dirt|ground|gravel|sand/.test(sf)) return 'terra';
  return 'asfalto';
}
// o trecho da via que coincide com a obra é desenhado pela faixa do eixo (terreno.js) e pelo pavimento
function cobertoPelaObra(v, x, y) {
  const o = obraDeLocal(x, y, true);
  if (!o) return false;
  if (v.eixo_obra) return o.s > -40 && o.s < P.L + 40 && Math.abs(o.z) < 24;
  return o.s > -2 && o.s < P.L + 2 && Math.abs(o.z) < P.Z_VIA + 2.2;
}
// faixa da via sobre o relevo, reamostrada a cada 4 m (a mesma amostragem do meio-fio e da calçada)
function faixaDaVia(v, pos, idx) {
  const w = v.largura / 2,
    ergue = v.tipo === 'footway' ? 0.05 : 0.07;
  let ant = null;
  for (const a of reamostrar(v.pts, 4)) {
    const base = pos.length / 3;
    for (const sd of [-1, 1]) {
      const px = a.x + a.nx * w * sd,
        py = a.y + a.ny * w * sd,
        m = mundoDeLocal(px, py);
      pos.push(m.x, wy(cotaNoLocal(px, py)) + ergue, m.z);
    }
    const cob = cobertoPelaObra(v, a.x, a.y);
    if (ant != null && !cob && !ant.cob) idx.push(ant.base, ant.base + 1, base, base, ant.base + 1, base + 1);
    ant = { base, cob };
  }
}
function construirVias(LAY) {
  const grupos = {};
  for (const v of D.local.vias) {
    const k = corDaVia(v);
    grupos[k] = grupos[k] || { pos: [], idx: [] };
    faixaDaVia(v, grupos[k].pos, grupos[k].idx);
  }
  for (const [k, g] of Object.entries(grupos)) {
    if (!g.idx.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: COR_VIA[k],
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide
    });
    const o = new THREE.Mesh(geo, pbr(material, { camada: TEX_VIA[k] }));
    o.receiveShadow = true;
    o.userData.info = {
      t: k === 'pedestre' ? 'Caminho de pedestres existente' : 'Via existente',
      d: { Fonte: '© colaboradores do OpenStreetMap (ODbL)', Situação: 'Fora da obra' }
    };
    LAY.entorno.add(o);
  }
}

// ---------- ocupação do chão ----------
// faixa da obra (pista e passeios), canteiro e acesso do canteiro: sem árvores, tufos, meio-fio ou calçada do entorno
function bloqueio() {
  const c = P.CANT,
    m = 8;
  const canteiro = [
    [c.s0 - m, c.z0 - m],
    [c.s1 + m, c.z0 - m],
    [c.s1 + m, c.z1 + m],
    [c.s0 - m, c.z1 + m]
  ].map(([s, z]) => localDeObra(s, z));
  const acesso = (D.local.meta.canteiro && D.local.meta.canteiro.acesso_pts) || [];
  return (x, y) => {
    const o = obraDeLocal(x, y, true);
    if (o && o.s > -40 && o.s < P.L + 40 && Math.abs(o.z) < P.Z_VIA + 2.6) return true;
    if (dentroPoligono(canteiro, x, y)) return true;
    for (let i = 0; i < acesso.length - 1; i++) if (distanciaAoSegmento(x, y, ...acesso[i], ...acesso[i + 1]) < 5) return true;
    return false;
  };
}
// grade de 3 m com as edificações (folga de 2 m) e as vias (folga de 1,5 m)
function ocupacao() {
  const cel = 3,
    set = new Set();
  const marca = (x, y) => set.add(Math.floor(x / cel) * 100003 + Math.floor(y / cel));
  for (const e of D.local.edificacoes) {
    const xs = e.c.map(p => p[0]),
      ys = e.c.map(p => p[1]);
    for (let x = Math.min(...xs) - 2; x <= Math.max(...xs) + 2; x += cel) for (let y = Math.min(...ys) - 2; y <= Math.max(...ys) + 2; y += cel) marca(x, y);
  }
  for (const v of D.local.vias)
    for (let i = 0; i < v.pts.length - 1; i++) {
      const [x0, y0] = v.pts[i],
        [x1, y1] = v.pts[i + 1],
        n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5) + 1;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n,
          y = y0 + ((y1 - y0) * k) / n;
        for (let dx = -v.largura / 2 - 1.5; dx <= v.largura / 2 + 1.5; dx += cel)
          for (let dy = -v.largura / 2 - 1.5; dy <= v.largura / 2 + 1.5; dy += cel) marca(x + dx, y + dy);
      }
    }
  return (x, y) => set.has(Math.floor(x / cel) * 100003 + Math.floor(y / cel));
}
// uso do solo (áreas do OSM) num ponto, com a prioridade do terreno
const PRIORIDADE = ['agua', 'quadra', 'estacionamento', 'mata', 'campo', 'verde'];
function usoDoSolo() {
  const areas = D.local.areas.map(a => {
    const xs = a.pts.map(p => p[0]),
      ys = a.pts.map(p => p[1]);
    return { ...a, bb: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] };
  });
  return (x, y) => {
    let melhor = null;
    for (const a of areas) {
      if (x < a.bb[0] || x > a.bb[1] || y < a.bb[2] || y > a.bb[3] || !dentroPoligono(a.pts, x, y)) continue;
      if (!melhor || PRIORIDADE.indexOf(a.tipo) < PRIORIDADE.indexOf(melhor)) melhor = a.tipo;
    }
    return melhor || 'chao';
  };
}

// ---------- vegetação ----------
// tons de copa (multiplicam a textura do jacarandá): jacarandá, oiti, ficus e amendoeira, comuns na arborização do Rio
const TONS = [
  [1.0, 1.0, 0.95],
  [0.6, 0.76, 0.58],
  [0.7, 0.86, 0.62],
  [1.08, 1.02, 0.72]
].map(c => new THREE.Color().setRGB(...c));
const TOM_PALMEIRA = new THREE.Color().setRGB(0.95, 1.0, 0.88);

function pontosNasAreas(R) {
  const out = [];
  const densidade = { mata: 1 / 45, verde: 1 / 260, campo: 1 / 900 };
  for (const a of D.local.areas) {
    const d = densidade[a.tipo];
    if (!d) continue;
    const xs = a.pts.map(p => p[0]),
      ys = a.pts.map(p => p[1]);
    const bb = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const n = Math.min(900, Math.round(Math.abs(areaPoligono(a.pts)) * d));
    for (let k = 0, t = 0; k < n && t < n * 6; t++) {
      const x = bb[0] + R() * (bb[1] - bb[0]),
        y = bb[2] + R() * (bb[3] - bb[2]);
      if (!dentroPoligono(a.pts, x, y)) continue;
      out.push({ x, y, tipo: a.tipo });
      k++;
    }
  }
  return out;
}
// árvores dos pátios e quintais: uma candidata por célula de 18 m, no chão sem uso definido e fora das ocupações
function pontosNosPatios(R, uso, ocupado) {
  const T = gradeDoTerreno();
  if (!T) return [];
  const out = [],
    cel = 18;
  for (let x = T.x0 + 20; x < T.x0 + (T.nx - 1) * T.passo - 20; x += cel)
    for (let y = T.y0 + 20; y < T.y0 + (T.ny - 1) * T.passo - 20; y += cel) {
      if (R() > 0.7) continue;
      const px = x + R() * cel,
        py = y + R() * cel;
      if (uso(px, py) !== 'chao' || ocupado(px, py)) continue;
      out.push({ x: px, y: py, tipo: 'patio' });
    }
  return out;
}
// árvores das calçadas: a cada 13 m, nos dois lados, no fundo da calçada; palmeiras-imperiais em parte das principais
function pontosNasCalcadas(R, postes, livre) {
  const out = [];
  const LARG = { primary: 2.5, secondary: 2.5, tertiary: 2.0, residential: 1.8, living_street: 1.5 };
  D.local.vias.forEach((v, iv) => {
    if (!LARG[v.tipo] || v.eixo_obra) return;
    const palmas = HIERARQUIA[v.tipo] >= 4 && iv % 2 === 0;
    for (const sd of [-1, 1])
      for (const p of amostrarAoLongo(v.pts, 13, sd * (v.largura / 2 + 0.15 + LARG[v.tipo] - 0.5), 4 + R() * 6)) {
        if (R() < 0.3 || !livre(p.x, p.y) || postes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 4)) continue;
        out.push({ x: p.x, y: p.y, tipo: palmas ? 'palmeiras' : 'calcada' });
      }
  });
  return out;
}
// margens da avenida da obra, além dos passeios: palmeiras à direita e copas à esquerda (na faixa do desvio)
function pontosNaAvenida(R, livre) {
  const out = [];
  for (const [z, passo, tipo] of [
    [P.Z_VIA + 3.9, 14, 'palmeiras'],
    [-(P.Z_VIA + 3.9), 19, 'calcada']
  ])
    for (let s = -30 + R() * 6; s < P.L + 30; s += passo + (R() - 0.5) * 3) {
      const [x, y] = localDeObra(s, z + (R() - 0.5) * 0.8);
      if (R() < 0.15 || !livre(x, y)) continue;
      out.push({ x, y, tipo });
    }
  return out;
}

function construirVegetacao(LAY, ocupado, livreDeVias, postes) {
  const R = rng(31),
    K = rng(77);
  const c = P.CANT;
  const limpeza = M.svc.find(x => x.meta && x.meta.representacao === 'limpeza');
  const fimLimpeza = limpeza ? limpeza.b : NUNCA;
  // árvores e tufos na faixa do desvio provisório saem com a limpeza (S04)
  const naFaixaDoDesvio = (x, y) => {
    const o = obraDeLocal(x, y, true);
    return !!o && o.z < -5 && o.z > -12 && o.s > -30 && o.s < P.L + 30;
  };
  const fontes = {
    areas: pontosNasAreas(R).filter(t => !ocupado(t.x, t.y)),
    patios: pontosNosPatios(R, usoDoSolo(), ocupado),
    calcadas: pontosNasCalcadas(R, postes, livreDeVias),
    avenida: pontosNaAvenida(R, livreDeVias)
  };
  if (import.meta.env.DEV) console.info('Árvores candidatas:', Object.fromEntries(Object.entries(fontes).map(([k, v]) => [k, v.length])));
  const pontos = Object.values(fontes).flat();
  const lista = [];
  for (const t of pontos) {
    const o = obraDeLocal(t.x, t.y, true);
    if (o && o.s > -40 && o.s < P.L + 40 && Math.abs(o.z) < P.Z_VIA + 3) continue;
    const oc = obraDeLocal(t.x, t.y);
    if (oc.s > c.s0 - 8 && oc.s < c.s1 + 8 && oc.z > c.z0 - 8 && oc.z < c.z1 + 8) continue;
    const r = R();
    const palmeira = t.tipo === 'palmeiras' || (t.tipo === 'verde' && r < 0.15) || (t.tipo === 'campo' && r < 0.1) || (t.tipo === 'mata' && r < 0.04);
    const rua = t.tipo === 'calcada' || t.tipo === 'palmeiras';
    const w = mundoDeLocal(t.x, t.y);
    lista.push({
      especie: palmeira ? 'palmeira' : 'jacaranda',
      p: new THREE.Vector3(w.x, wy(cotaNoLocal(t.x, t.y)) - 0.1, w.z),
      rot: R() * 6.283,
      h: palmeira ? 13 + R() * 7 : rua ? 7 + R() * 4 : 8 + R() * 7,
      largura: palmeira ? 1 : rua ? 0.7 + R() * 0.15 : 0.85 + R() * 0.3,
      tom: palmeira ? TOM_PALMEIRA : TONS[t.tipo === 'mata' ? 1 + Math.floor(R() * 2) : Math.floor(R() * TONS.length)],
      dias: [-1, naFaixaDoDesvio(t.x, t.y) ? fimLimpeza : NUNCA],
      k: K()
    });
  }
  const info = {
    t: 'Árvore existente',
    d: {
      Situação: 'Preservada; só as árvores da faixa do desvio provisório são removidas na limpeza (S04)',
      Posição: 'Ilustrativa: matas e áreas verdes do OpenStreetMap, calçadas e margens da avenida',
      Modelo: 'Jacarandá do Poly Haven (CC0), com tons de oiti, ficus e amendoeira, e palmeira-imperial'
    }
  };
  criarArvores(lista, LAY.entorno, cena.renderer, info).then(() => registrarVegetacao(ajustarArvores));
  return { fimLimpeza, naFaixaDoDesvio };
}

function construirGramado(LAY, ocupado, bloqueado, limpeza) {
  const uso = usoDoSolo();
  // fração da densidade máxima por uso do solo; no chão sem uso definido, capim esparso
  const DENS = { verde: 1, campo: 1, mata: 0.45, chao: 0.15 };
  criarGramado(LAY.entorno, {
    densidade: (x, y) => (ocupado(x, y) || bloqueado(x, y) ? 0 : DENS[uso(x, y)] || 0),
    // altura do chão exibido no mundo
    cota: (x, y) => wy(cotaNoLocal(x, y)),
    mundo: mundoDeLocal,
    local: localDoMundo,
    removido: (x, y) => (limpeza.naFaixaDoDesvio(x, y) ? limpeza.fimLimpeza : null)
  });
  registrarVegetacao(ajustarGramado);
}

export function buildSurroundings() {
  // sem os dados do local (modo de reserva) não há entorno: só o terreno fictício
  if (!D.local) return;
  const t0 = performance.now();
  const LAY = cena.LAY;
  construirVias(LAY);
  const edif = construirEdificacoes(LAY.entorno, D.local.edificacoes);
  const bloqueado = bloqueio();
  const vias = construirViasDoEntorno(LAY.entorno, D.local.vias, D.local.edificacoes, bloqueado);
  const ocupado = ocupacao();
  // árvores das calçadas: fora da obra, do leito das vias e das edificações
  const livreDeVias = (x, y) => {
    if (bloqueado(x, y)) return false;
    for (const v of D.local.vias) {
      if (v.tipo === 'footway' || v.tipo === 'steps') continue;
      for (let i = 0; i < v.pts.length - 1; i++) if (distanciaAoSegmento(x, y, ...v.pts[i], ...v.pts[i + 1]) < v.largura / 2 + 0.6) return false;
    }
    return !D.local.edificacoes.some(e => {
      const [x0, y0] = e.c[0];
      if (Math.abs(x - x0) > 120 || Math.abs(y - y0) > 120) return false;
      return dentroPoligono(e.c, x, y) || e.c.some((a, i) => distanciaAoSegmento(x, y, ...a, ...e.c[(i + 1) % e.c.length]) < 2.2);
    });
  };
  const limpeza = construirVegetacao(LAY, ocupado, livreDeVias, vias.postes);
  construirGramado(LAY, ocupado, bloqueado, limpeza);
  if (import.meta.env.DEV)
    console.info('Entorno:', { edificacoes: edif, postes: vias.postes.length, placas: vias.placas, ms: Math.round(performance.now() - t0) });
}

/** A cada quadro: vento, níveis de detalhe das árvores e gramado em torno do alvo da câmera. */
export function atualizarEntorno(dt) {
  uVento.value += dt;
  if (!D.local) return;
  atualizarArvores(cena.camera);
  atualizarGramado(cena.camera, cena.controls.target);
}
