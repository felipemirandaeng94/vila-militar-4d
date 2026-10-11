// Elementos repetidos da drenagem com InstancedMesh: tubos de concreto, escoramento, bocas de lobo, ramais e poços de visita.
import * as THREE from 'three';
import { P, sg, diametroRede, larguraVala, profundidadeVala, bocasDeLobo, pocosDeVisita } from '../dominio/geometria.js';
import { wx, wy, mat } from './base.js';
import { cena } from './renderizador.js';
import { comDias, NUNCA, finito, diasPorInstancia } from './dias.js';
import { CAMADAS, alturas, diasDaVala, diaRep, servicoRep } from './pavimento.js';

const grupo = new THREE.Group();
grupo.name = 'drenagem';

function instancias(geo, material, lista, info, sombra = false) {
  const m = new THREE.InstancedMesh(geo, comDias(material), lista.length);
  lista.forEach((it, i) => m.setMatrixAt(i, it.matrix));
  diasPorInstancia(
    m,
    lista.map(it => it.dias)
  );
  m.castShadow = sombra;
  m.receiveShadow = true;
  m.userData.info = info;
  m.userData.instancias = lista;
  m.userData.diasInst = lista.map(it => it.dias);
  CAMADAS.push(m);
  grupo.add(m);
  return m;
}
const matriz = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.scale.set(sx, sy, sz);
  o.updateMatrix();
  return o.matrix.clone();
};

export function buildDrenagem() {
  grupo.clear();
  cena.LAY.pavimento.remove(grupo);
  cena.LAY.pavimento.add(grupo);
  const zr = P.DRN.afastamentoRede;
  const nome = rep => (servicoRep(rep) || {}).nome || '';
  // tubos da rede, um a cada comprimento de tubo
  const passo = P.DRN.comprimentoTubo;
  const tubos = [];
  for (let s = passo / 2; s < P.L; s += passo) {
    const D = diametroRede(s),
      fundo = sg(s) - (profundidadeVala(D) - P.E_EX);
    const v = diasDaVala(s);
    tubos.push({
      s,
      matrix: matriz(wx(s), wy(fundo + P.DRN.berco + D / 2 + 0.06), zr, 0, 0, Math.PI / 2, (D / 2 + 0.06) / 0.5, passo * 0.98, (D / 2 + 0.06) / 0.5),
      dias: [finito(v.tubo), NUNCA],
      D
    });
  }
  instancias(new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, true), mat(0xa9a69c, { side: THREE.DoubleSide }).clone(), tubos, {
    t: 'Tubos de concreto da rede',
    d: { Serviço: nome('vala'), Norma: 'DNIT 023/2024-ES · NBR 8890', Diâmetros: 'ø 0,40 m até a est. 40 e ø 0,60 m depois' }
  });
  // escoramento metálico nas duas paredes enquanto a vala está aberta
  const esc = [];
  for (let s = 1; s < P.L; s += 2) {
    const D = diametroRede(s),
      w = larguraVala(D),
      h = profundidadeVala(D),
      v = diasDaVala(s);
    const topo = alturas(s).exBa,
      fundo = sg(s) - (h - P.E_EX);
    for (const sd of [-1, 1])
      esc.push({
        s,
        matrix: matriz(wx(s), wy((topo + 0.35 + fundo) / 2), zr + (sd * w) / 2, 0, 0, 0, 1.9, topo + 0.35 - fundo, 0.06),
        dias: [finito(v.esc), finito(v.reat)]
      });
  }
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0x4f5a62, { metalness: 0.4, roughness: 0.5 }).clone(), esc, {
    t: 'Escoramento metálico da vala',
    d: { Situação: 'Instalado enquanto a vala está aberta', Serviço: nome('vala') }
  });
  // bocas de lobo (caixa de concreto com grelha) nas sarjetas
  const bl = bocasDeLobo().map(b => {
    const h = alturas(b.s),
      prof = 1.2;
    return {
      s: b.s,
      lado: b.lado,
      matrix: matriz(wx(b.s), wy(h.top - prof / 2), b.z, 0, 0, 0, 1.0, prof, 0.9),
      dias: [finito(diaRep('bocasDeLobo', b.s)), NUNCA]
    };
  });
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0x8e8b84).clone(), bl, {
    t: 'Boca de lobo (caixa coletora com grelha)',
    d: { Serviço: nome('bocasDeLobo'), Norma: 'DNIT 026/2025-ES', Espaçamento: '40 m em cada lado' }
  });
  const grelhas = bl.map(b => ({
    s: b.s,
    matrix: matriz(wx(b.s), wy(alturas(b.s).top + 0.01), b.lado === 'BD' ? P.Z_SAR : -P.Z_SAR, 0, 0, 0, 0.9, 0.04, 0.6),
    dias: b.dias
  }));
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0x2b2d2f, { metalness: 0.6, roughness: 0.4 }).clone(), grelhas, {
    t: 'Grelha da boca de lobo',
    d: { Serviço: nome('bocasDeLobo') }
  });
  // ramais das bocas de lobo até a rede (visíveis só enquanto a caixa é executada)
  const ramais = bocasDeLobo().map(b => {
    const z0 = b.z,
      L = Math.abs(z0 - zr),
      zc = (z0 + zr) / 2;
    const y = sg(b.s) - (profundidadeVala(P.DRN.diametroRamal) - P.E_EX) * 0.8;
    const d = finito(diaRep('bocasDeLobo', b.s));
    return { s: b.s, matrix: matriz(wx(b.s), wy(y), zc, Math.PI / 2, 0, 0, 0.45, L, 0.45), dias: [d, d + 0.3] };
  });
  instancias(new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, true), mat(0xa9a69c, { side: THREE.DoubleSide }).clone(), ramais, {
    t: 'Ramal da boca de lobo',
    d: { Diâmetro: 'ø 0,40 m', Serviço: nome('bocasDeLobo') }
  });
  // poços de visita na rede
  const pv = pocosDeVisita().map(p => {
    const D = diametroRede(Math.min(p.s, P.L - 1)),
      fundo = sg(p.s) - (profundidadeVala(D) - P.E_EX);
    const topo = alturas(p.s).top;
    return {
      s: p.s,
      matrix: matriz(wx(p.s), wy((topo + fundo) / 2), zr, 0, 0, 0, 1.3, topo - fundo, 1.3),
      dias: [finito(diaRep('pocosDeVisita', p.s)), NUNCA]
    };
  });
  instancias(new THREE.CylinderGeometry(0.5, 0.5, 1, 18), mat(0x9c988f).clone(), pv, {
    t: 'Poço de visita',
    d: { Serviço: nome('pocosDeVisita'), Norma: 'DNIT 030/2004-ES (a confirmar)', Espaçamento: '80 m' }
  });
  const tampas = pv.map(p => ({ s: p.s, matrix: matriz(wx(p.s), wy(alturas(p.s).top + 0.01), zr, 0, 0, 0, 0.75, 0.03, 0.75), dias: p.dias }));
  instancias(new THREE.CylinderGeometry(0.5, 0.5, 1, 18), mat(0x2b2d2f, { metalness: 0.6 }).clone(), tampas, {
    t: 'Tampão do poço de visita',
    d: { Serviço: nome('pocosDeVisita') }
  });
  // marcação das interferências no pavimento (sai com a fresagem)
  const marcas = [];
  for (let s = 5; s < P.L; s += 10) {
    const d = finito(diaRep('interferencias', s));
    marcas.push({ s, matrix: matriz(wx(s), wy(alturas(s).exTop + 0.01), zr, 0, 0, 0, 3, 0.02, 0.12), dias: [d, finito(diaRep('fresagem', s))] });
  }
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0xf0c419, { roughness: 0.6 }).clone(), marcas, {
    t: 'Marcação de interferências e do eixo da rede',
    d: { Serviço: nome('interferencias') }
  });
}
