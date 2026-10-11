// Canteiro de obras e usina: contêineres, bandeira, placa, baias de agregados e montagem da usina ao longo do tempo.
import * as THREE from 'three';
import { P, nat } from '../dominio/geometria.js';
import { winProg } from '../dominio/cronograma.js';
import { M, D } from '../estado.js';
import { wx, wy, mat, C, bx, info, mkPile } from './base.js';
import { mkContainer, mkFlag } from './modelos.js';
import { mkUsina } from './usina.js';
import { cena } from './renderizador.js';

export const SITE = {};
// usina montada (g, parts) e posição do silo de massa em coordenadas da obra (siloS, siloZ)
export const USI = {};

export function placeOn(o, s, z, rot = 0) {
  o.position.set(wx(s), wy(nat(s, z)), z);
  o.rotation.y = rot;
  return o;
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
  info(pl, 'Placa da obra', { Obra: 'Implantação de via interna em CBUQ', Local: 'Vila Militar, Deodoro (RJ)', Execução: D.obra.obra.om });
  pl.userData.mob = 0.8;
  LAY.canteiro.add(pl);
  // baias de agregados (alimentação da usina)
  const piles = [
    ['Brita 1', 0x8d8f8c, 5.2, 3.0],
    ['Brita 0', 0xa8aaa6, 5.0, 2.8],
    ['Pó de pedra', 0xc7c6c0, 5.2, 2.6],
    ['Areia média', 0xcdb88d, 5.0, 2.4],
    ['Brita graduada (base)', 0x9d9d97, 6.0, 3.0],
    ['Solo-brita (sub-base)', 0xb79a72, 6.0, 2.8]
  ];
  piles.forEach(([n, c, r, h], i) => {
    const p = mkPile(r, h, c);
    const s = 100 + (i % 3) * 12,
      z = -100 + Math.floor(i / 3) * 12;
    placeOn(p, s, z);
    info(p, 'Estoque: ' + n, { Uso: i < 4 ? 'Agregado do CBUQ' : 'Material de camada granular', Controle: 'Granulometria a cada 4 h na produção' });
    p.userData.mob = 0.86 + i * 0.02;
    LAY.canteiro.add(p);
  });
  for (let i = 0; i < 4; i++) {
    const w = bx(0.4, 1.6, 12, mat(C.conc), wx(94 + i * 12), wy(P.CANT.cota) + 0.8, -100);
    w.userData.mob = 0.84;
    LAY.canteiro.add(w);
  }
  // usina
  Object.assign(USI, mkUsina());
  USI.g.position.set(wx(60), wy(P.CANT.cota), -80);
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
  USI.siloS = 60 + USI.parts.siloPos.x;
  USI.siloZ = -80 + USI.parts.siloPos.z;
  // pátio de estacionamento
  for (let i = 0; i < 8; i++) {
    const l = bx(0.12, 0.02, 5, mat(0xf2f0e6), wx(64 + i * 5), wy(P.CANT.cota) + 0.04, -52);
    l.castShadow = false;
    LAY.canteiro.add(l);
  }
}

// monte de fresado na baia do canteiro, que cresce com a fresagem das frentes
let fresado = null;
export function buildFresado() {
  fresado = mkPile(7, 3.2, 0x34363a);
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
  for (const o of USI.g.children) {
    const k = o.userData.stage;
    if (k == null) continue;
    o.visible = pu >= k && pout < 1 - k;
  }
  USI.ready = pu >= 1 && pout < 0.1;
  if (fresado) {
    const fr = M.svc.find(x => x.meta && x.meta.representacao === 'fresagem');
    let feito = 0;
    if (fr) for (const w of fr.jan) feito += Math.min(1, Math.max(0, (d - w.a) / (w.b - w.a))) * (w.s1 - w.s0);
    const k = feito / P.L;
    fresado.visible = k > 0.005 && pout < 0.5;
    fresado.scale.set(0.3 + 0.7 * Math.sqrt(k), 0.2 + 0.8 * k, 0.3 + 0.7 * Math.sqrt(k));
    fresado.position.y = wy(P.CANT.cota) + (3.2 * fresado.scale.y) / 2;
  }
}
