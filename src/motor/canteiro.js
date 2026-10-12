// Canteiro de obras e usina: contêineres, bandeira, placa, baias de agregados e montagem da usina ao longo do tempo.
import * as THREE from 'three';
import { P, nat, noCanteiro, acessoDoCanteiro } from '../dominio/geometria.js';
import { winProg } from '../dominio/cronograma.js';
import { M, D } from '../estado.js';
import { wy, mat, C, bx, info, mkPile, colocar, mundo, rumo } from './base.js';
import { mkContainer, mkFlag } from './modelos.js';
import { mkUsina } from './usina.js';
import { cena } from './renderizador.js';
import { vestir, CATALOGO, geometriaPlana } from './modelos3d.js';
import { pbr } from './superficies.js';
import { geometriaMonte } from './soltos.js';

export const SITE = {};
// usina montada (g, parts) e posição do silo de massa em coordenadas da obra (siloS, siloZ)
export const USI = {};

// posiciona no canteiro: (s, z) do arranjo de referência, transladado para a área confirmada (meta.json)
export function placeOn(o, s, z, rot = 0, y) {
  const c = noCanteiro(s, z);
  return colocar(o, c.s, c.z, y != null ? y : wy(nat(c.s, c.z)), rot);
}

export function buildCanteiro() {
  const LAY = cena.LAY;
  const usinaTxt = D.obra.usina;
  const cs = [
    [
      'Escritório da obra e da fiscalização',
      0xe6e8e2,
      12,
      -48,
      { Uso: 'Engenheiro residente, fiscalização e arquivo técnico', Documentos: 'Diário de obra, BLC, notas de serviço' }
    ],
    [
      'Laboratório de solos e asfalto',
      0xdfe8e1,
      20,
      -48,
      { Uso: 'Ensaios de campo e de laboratório', Equipamentos: 'Estufa, balanças, frasco de areia, Speedy, prensa CBR, compactador Marshall, Rotarex' }
    ],
    ['Almoxarifado', 0xc9cec5, 28, -48, { Uso: 'Ferramentas, EPI, peças e lonas' }],
    ['Refeitório', 0xe6e8e2, 12, -56, { Uso: 'Efetivo da obra' }],
    ['Sanitários e vestiário', 0xe6e8e2, 20, -56, { Uso: 'Efetivo da obra' }]
  ];
  cs.forEach(([n, c, s, z, d], i) => {
    const o = mkContainer(c);
    placeOn(o, s, z);
    info(o, n, d);
    // contêiner GLB: porta voltada para +z, como no procedural
    vestir(o, 'conteiner', { rot: Math.PI });
    o.userData.mob = 0.08 + i * 0.12;
    LAY.canteiro.add(o);
    if (n.startsWith('Lab')) SITE.lab = o;
  });
  const fl = mkFlag();
  placeOn(fl, 4, -46);
  info(fl, 'Mastro com a Bandeira Nacional', { Local: 'Entrada do canteiro' });
  fl.userData.mob = 0.7;
  LAY.canteiro.add(fl);
  SITE.flag = fl.userData.flag;
  const pl = new THREE.Group();
  pl.add(bx(0.15, 3.2, 0.15, mat(C.greyD), -1.8, 1.6, 0));
  pl.add(bx(0.15, 3.2, 0.15, mat(C.greyD), 1.8, 1.6, 0));
  pl.add(bx(4.2, 2.2, 0.08, mat(0xf4f1e8), 0, 3.0, 0));
  pl.add(bx(4.2, 0.5, 0.09, mat(0x2f5c3a), 0, 3.85, 0));
  placeOn(pl, -6, -41, Math.PI / 2);
  info(pl, 'Placa da obra', { Obra: D.obra.obra.titulo, Local: D.obra.obra.local, Execução: D.obra.obra.om });
  pl.userData.mob = 0.8;
  LAY.canteiro.add(pl);
  // estoques de agregados separados por material (arranjo da referência do canteiro): baias de concreto (GLB) para as
  // britas, na linha de trás, e pilhas para pó de pedra, areia e solo-brita, na linha da frente
  const piles = [
    ['Brita 1', 0x8d8f8c, 5.2, 3.0, true],
    ['Brita 0', 0xa8aaa6, 5.0, 2.8, true],
    ['Brita graduada (base)', 0x9d9d97, 6.0, 3.0, true],
    ['Pó de pedra', 0xc7c6c0, 5.2, 2.6, false],
    ['Areia média', 0xcdb88d, 5.0, 2.4, false],
    ['Solo-brita (sub-base)', 0xb79a72, 6.0, 2.8, false]
  ];
  let nb = 0,
    np = 0;
  piles.forEach(([n, c, r, h, baia], i) => {
    const g = new THREE.Group();
    g.add(mkPile(r, h, c));
    const s = baia ? 100 + nb++ * 8 : 100 + np++ * 12,
      z = baia ? -100 : -86;
    placeOn(g, s, z);
    info(g, 'Estoque: ' + n, {
      Uso: /Brita [01]|Pó|Areia/.test(n) ? 'Agregado do CBUQ' : 'Material de camada granular',
      Controle: 'Granulometria a cada 4 h na produção'
    });
    // baia aberta para +z (lado da pá carregadeira)
    if (baia) vestir(g, 'baia-brita', { rot: Math.PI });
    g.userData.mob = 0.86 + i * 0.02;
    LAY.canteiro.add(g);
  });
  // usina
  Object.assign(USI, mkUsina());
  placeOn(USI.g, 60, -80, 0, wy(P.CANT.cota));
  LAY.usina.add(
    info(USI.g, 'Usina de CBUQ contínua (tambor secador-misturador)', {
      Produção: '60 t/h',
      Ligante: 'CAP 50/70',
      Mistura: 'Faixa C-12,5 · 5,6 %',
      Norma: 'DNIT 031/2024-ES'
    })
  );
  const part = (o, n, d) => {
    o.traverse(c => {
      if (c.isMesh) c.userData.info = { t: n, d };
    });
  };
  part(USI.parts.drum, 'Tambor secador-misturador', { Função: usinaTxt[2].descricao });
  USI.g.children.forEach((c, i) => {
    if (i < 4) part(c, 'Silo dosador frio ' + (i + 1), { Material: ['Brita 1', 'Brita 0', 'Pó de pedra', 'Areia média'][i], Função: usinaTxt[0].descricao });
  });
  const cu = noCanteiro(60, -80);
  USI.siloS = cu.s + USI.parts.siloPos.x;
  USI.siloZ = cu.z + USI.parts.siloPos.z;
  vestirUsina();
  buildArredores(LAY);
  // pátio de estacionamento
  for (let i = 0; i < 8; i++) {
    const l = placeOn(bx(0.12, 0.02, 5, mat(0xf2f0e6)), 64 + i * 5, -52, 0, wy(P.CANT.cota) + 0.04);
    l.castShadow = false;
    LAY.canteiro.add(l);
  }
}

// usina GLB: girada de 180° e deslocada para o silo de massa ficar onde o caminhão carrega (USI.parts.siloPos); entra
// quando a montagem procedural chega a 88 % e fica até a desmobilização; tanques, bacia, cabine e base continuam
function vestirUsina() {
  const m = CATALOGO['usina-cbuq'];
  if (!m) return;
  const rot = Math.PI,
    eixo = new THREE.Vector3(0, 1, 0);
  const silo = new THREE.Vector3(...m.pontos.siloDeMassa).applyAxisAngle(eixo, rot);
  const pos = USI.parts.siloPos.clone().sub(silo).setY(0);
  const manter = USI.g.children.filter(c => c.userData.manter);
  USI.glb = vestir(USI.g, 'usina-cbuq', { rot, pos: pos.toArray(), manter });
  USI.glb.userData.stage = 0.88;
  USI.glb.userData.manter = true;
  USI.parts.chimneyGlb = new THREE.Vector3(...m.pontos.chamine).applyAxisAngle(eixo, rot).add(pos);
}
// chaminé em uso (para a fumaça): a do GLB quando ele está na cena
export const chamineDaUsina = () => (USI.glb && USI.glb.userData.pronto && USI.glb.visible ? USI.parts.chimneyGlb : USI.parts.chimney);

// tapume no perímetro (com o portão no acesso), tambores no portão e estoques da drenagem no pátio
function buildArredores(LAY) {
  const c = P.CANT,
    ac = acessoDoCanteiro()[0];
  const o = new THREE.Object3D();
  const paineis = [];
  const lado = (a, b, fixo, aoLongo) => {
    for (let t = a + 1.5; t < b; t += 3) {
      const s = aoLongo ? t : fixo,
        z = aoLongo ? fixo : t;
      if (Math.hypot(s - ac.s, z - ac.z) < 7) continue; // portão
      paineis.push({ s, z, ry: aoLongo ? 0 : Math.PI / 2 });
    }
  };
  lado(c.s0, c.s1, c.z0, true);
  lado(c.s0, c.s1, c.z1, true);
  lado(c.z0, c.z1, c.s0, false);
  lado(c.z0, c.z1, c.s1, false);
  const tap = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, 2.2, 0.06), mat(0xc9c5b6, { roughness: 0.6, metalness: 0.3 }), paineis.length);
  paineis.forEach((p, i) => {
    const w = mundo(p.s, p.z);
    o.position.set(w.x, wy(nat(p.s, p.z)) + 1.1, w.z);
    o.rotation.set(0, p.ry + rumo(p.s), 0);
    o.updateMatrix();
    tap.setMatrixAt(i, o.matrix);
  });
  tap.castShadow = tap.receiveShadow = true;
  tap.userData.info = { t: 'Tapume do canteiro', d: { Uso: 'Fechamento do perímetro, com portão no acesso' } };
  tap.userData.mob = 0.05;
  LAY.canteiro.add(tap);
  // tambores canalizadores no portão
  for (const k of [-1, 1])
    for (const d of [5, 9]) {
      const g = new THREE.Group();
      colocar(g, ac.s + k * d, ac.z + 2.5, wy(nat(ac.s + k * d, ac.z + 2.5)));
      g.add(new THREE.Object3D());
      vestir(g, 'tambor-sinalizacao', { rot: 0, info: { t: 'Tambor canalizador', d: { Local: 'Acesso do canteiro' } } });
      g.userData.mob = 0.1;
      LAY.canteiro.add(g);
    }
  // estoques da drenagem: tubos de 1 m deitados em pirâmide, peças de meio-fio e caixas de boca de lobo
  const y0 = wy(P.CANT.cota);
  const estoque = (id, nome, d, lista) =>
    geometriaPlana(id, 0)
      .then(({ geometria, material }) => {
        const m = new THREE.InstancedMesh(geometria, material, lista.length);
        lista.forEach(([s, z, y, ry], i) => {
          const cc = noCanteiro(s, z),
            w = mundo(cc.s, cc.z);
          o.position.set(w.x, y0 + y, w.z);
          o.rotation.set(0, ry + rumo(cc.s), 0);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
        });
        m.castShadow = m.receiveShadow = true;
        m.userData.info = { t: nome, d };
        m.userData.mob = 0.9;
        m.visible = false;
        LAY.canteiro.add(m);
      })
      .catch(() => {});
  // tubos (eixo em x no GLB) deitados ao longo de z, em pirâmide de 4 + 3 + 2, diâmetro externo de cerca de 0,6 m
  const tubos = [];
  [4, 3, 2].forEach((n, cam) => {
    for (let i = 0; i < n; i++) tubos.push([56 + i * 0.62 + cam * 0.31, -103, cam * 0.52, Math.PI / 2]);
  });
  for (let i = 0; i < 4; i++) tubos.push([56 + i * 0.62, -105.2, 0, Math.PI / 2]);
  estoque('tubo-concreto', 'Estoque de tubos de concreto', { Uso: 'Rede de drenagem', Peça: '1 m, ponta e bolsa' }, tubos);
  // meio-fio (comprimento em z no GLB): 3 camadas de 6 peças
  const mf = [];
  for (let cam = 0; cam < 3; cam++) for (let i = 0; i < 6; i++) mf.push([61 + i * 0.22, -103, cam * 0.21, 0]);
  estoque('meio-fio', 'Estoque de meio-fio pré-moldado', { Uso: 'Meio-fio da caixa do pavimento', Peça: '1 m' }, mf);
  estoque('boca-de-lobo', 'Caixas de boca de lobo pré-moldadas', { Uso: 'Bocas de lobo da sarjeta' }, [
    [64, -103, 0, 0],
    [64, -105, 0, 0],
    [66, -103, 0, 0]
  ]);
}

// monte de fresado na baia do canteiro, que cresce com a fresagem das frentes: monte procedural com a textura de
// cascalho solto recolorida para o cinza-escuro do asfalto fresado
let fresado = null;
export function buildFresado() {
  fresado = new THREE.Mesh(geometriaMonte(7, 3.2, 31), pbr(mat(0x34363a, { roughness: 1 }).clone(), { camada: 'cascalho_solto' }));
  fresado.castShadow = fresado.receiveShadow = true;
  placeOn(fresado, 22, -98);
  info(fresado, 'Estoque de fresado', {
    Uso: 'Reaproveitamento no CBUQ (DNIT 033/2021-ES) ou bota-fora',
    Controle: 'Teor de ligante e granulometria por frente'
  });
  cena.LAY.canteiro.add(fresado);
}

const winRep = (rep, d) => {
  const s = M.svc.find(x => x.meta && x.meta.representacao === rep);
  return s ? winProg(M.svc, s.id, d) : 0;
};
// mobilização, montagem da usina e desmobilização conforme o progresso desses serviços
export function updateSite(st) {
  const d = st.d,
    pin = winRep('mobilizacao', d),
    pu = winRep('usina', d),
    pout = winRep('desmobilizacao', d);
  for (const o of cena.LAY.canteiro.children) {
    const k = o.userData.mob;
    if (k == null) continue;
    o.visible = pin >= k && pout < 1 - k * 0.5;
  }
  // com o GLB da usina pronto, as partes procedurais substituídas somem quando ele entra (88 % da montagem)
  const glb = USI.glb && USI.glb.userData.pronto;
  for (const o of USI.g.children) {
    const k = o.userData.stage;
    if (k == null) continue;
    o.visible = pu >= k && pout < 1 - k && !(glb && !o.userData.manter && pu >= 0.88 && pout < 0.12);
    if (o === USI.glb) o.visible = o.visible && !!glb;
  }
  USI.ready = pu >= 1 && pout < 0.1;
  if (fresado) {
    const fr = M.svc.find(x => x.meta && x.meta.representacao === 'fresagem');
    let feito = 0;
    if (fr) for (const w of fr.jan) feito += Math.min(1, Math.max(0, (d - w.a) / (w.b - w.a))) * (w.s1 - w.s0);
    const k = feito / P.L;
    fresado.visible = k > 0.005 && pout < 0.5;
    fresado.scale.set(0.3 + 0.7 * Math.sqrt(k), 0.2 + 0.8 * k, 0.3 + 0.7 * Math.sqrt(k));
    fresado.position.y = wy(P.CANT.cota);
  }
}
