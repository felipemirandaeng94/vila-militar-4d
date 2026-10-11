// Sinalização de obra por frente (cones, cavaletes, placas e faixa de desvio) e sinalização definitiva
// (faixa central, bordos e placas). O estado do desvio de cada frente vem do domínio (frente.desvio).
import * as THREE from 'three';
import { P, nat } from '../dominio/geometria.js';
import { M } from '../estado.js';
import { wx, wy, mat } from './base.js';
import { cena } from './renderizador.js';
import { comDias, NUNCA, finito, diasPorInstancia } from './dias.js';
import { CAMADAS, alturas, diaRep, servicoRep } from './pavimento.js';

const grupo = new THREE.Group();
grupo.name = 'sinalizacao';
const matriz = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.rotation.y = ry;
  o.scale.set(sx, sy, sz);
  o.updateMatrix();
  return o.matrix.clone();
};
function instancias(geo, material, lista, info) {
  if (!lista.length) return null;
  const m = new THREE.InstancedMesh(geo, comDias(material), lista.length);
  lista.forEach((it, i) => m.setMatrixAt(i, it.matrix));
  diasPorInstancia(
    m,
    lista.map(it => it.dias)
  );
  m.castShadow = false;
  m.receiveShadow = true;
  m.userData.info = info;
  m.userData.instancias = lista;
  m.userData.diasInst = lista.map(it => it.dias);
  CAMADAS.push(m);
  grupo.add(m);
  return m;
}
// fases do desvio de uma frente: [{ estado, de, ate }]
export function fasesDoDesvio(f) {
  return f.desvio.map((x, i) => ({ estado: x.estado, de: x.d, ate: i + 1 < f.desvio.length ? f.desvio[i + 1].d : NUNCA }));
}

export function buildSinalizacao() {
  grupo.clear();
  cena.LAY.pavimento.remove(grupo);
  cena.LAY.pavimento.add(grupo);
  const cones = [],
    cavaletes = [],
    placas = [];
  const desvios = [];
  const topo = s => alturas(s).top;
  for (const f of M.frentes) {
    const fases = fasesDoDesvio(f);
    const ini = fases[0].de,
      lib = f.lib;
    // cones nos bordos da frente durante toda a obra na frente
    for (let s = f.s0 + 4; s < f.s1; s += 8) for (const sd of [-1, 1]) cones.push({ s, matrix: matriz(wx(s), wy(topo(s)), sd * (P.W_CX / 2 + 0.5)), dias: [ini, lib] });
    // cones no eixo nas fases em meia pista; cavaletes e faixa de desvio no desvio total
    for (const fs of fases) {
      if (fs.estado === 'meiaPista') for (let s = f.s0 + 2; s < f.s1; s += 6) cones.push({ s, matrix: matriz(wx(s), wy(topo(s)), 0.25), dias: [fs.de, fs.ate] });
      if (fs.estado === 'total') {
        for (const s of [f.s0 + 1, f.s1 - 1]) for (let z = -3; z <= 3; z += 2) cavaletes.push({ s, matrix: matriz(wx(s), wy(topo(s)) + 0.5, z, 0, 0.12, 1.0, 1.9), dias: [fs.de, fs.ate] });
        desvios.push({ f, de: fs.de, ate: fs.ate });
      }
    }
    for (const s of [f.s0 - 12, f.s1 + 12]) if (s > -40 && s < P.L + 40) placas.push({ s, matrix: matriz(wx(s), wy(nat(s, 6.5)) + 1.6, 6.5, Math.PI / 2, 1, 1, 1), dias: [ini, lib] });
  }
  const cone = new THREE.ConeGeometry(0.22, 0.75, 10);
  cone.translate(0, 0.375, 0);
  instancias(cone, mat(0xe8641f, { roughness: 0.6 }).clone(), cones, { t: 'Cones de sinalização de obra', d: { Referência: 'Manual de Sinalização de Obras e Emergências (DNIT, IPR 738)' } });
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0xf2efe6).clone(), cavaletes, { t: 'Cavaletes de bloqueio (desvio total)', d: { Situação: 'Frente fechada ao tráfego' } });
  instancias(new THREE.BoxGeometry(0.1, 1.4, 2.4), mat(0xf0a020).clone(), placas, { t: 'Placa de advertência de obra', d: { Texto: 'Obras na pista · desvio sinalizado' } });
  // faixa de desvio provisória ao lado da via, em cada fase de desvio total
  for (const dv of desvios) {
    const s0 = Math.max(-30, dv.f.s0 - 25),
      s1 = Math.min(P.L + 30, dv.f.s1 + 25);
    const pos = [],
      dd = [],
      idx = [];
    let n = 0;
    for (let s = s0; s <= s1; s += 4) {
      for (const z of [-10.5, -6.5]) {
        pos.push(wx(s), wy(nat(s, z)) + 0.08, z);
        dd.push(dv.de, dv.ate);
      }
      if (n) {
        const a = (n - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aDias', new THREE.Float32BufferAttribute(dd, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const o = new THREE.Mesh(geo, comDias(new THREE.MeshStandardMaterial({ color: 0x8b8577, roughness: 1, side: THREE.DoubleSide })));
    o.receiveShadow = true;
    o.userData.info = { t: `Faixa de desvio provisória (${dv.f.nome})`, d: { Uso: 'Tráfego da Vila Militar durante o desvio total da frente', Revestimento: 'Brita compactada' } };
    o.userData.dias = () => [dv.de, dv.ate];
    CAMADAS.push(o);
    grupo.add(o);
  }
  // sinalização horizontal definitiva: faixa central tracejada e linhas de bordo
  const nomeSH = (servicoRep('sinalizacaoHorizontal') || {}).nome || '';
  const tracos = [];
  for (let s = 4; s < P.L; s += 12) tracos.push({ s, matrix: matriz(wx(s), wy(topo(s)) + 0.012, 0, 0, 4, 0.02, 0.12), dias: [finito(diaRep('sinalizacaoHorizontal', s)), NUNCA] });
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0xf5c400, { roughness: 0.6 }).clone(), tracos, { t: 'Faixa central tracejada', d: { Serviço: nomeSH, Norma: 'DNIT 100/2018-ES' } });
  const bordos = [];
  for (let s = 1; s < P.L; s += 2) for (const sd of [-1, 1]) bordos.push({ s, matrix: matriz(wx(s), wy(topo(s)) + 0.012, sd * (P.W_RV / 2 - 0.15), 0, 2, 0.02, 0.1), dias: [finito(diaRep('sinalizacaoHorizontal', s)), NUNCA] });
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0xf2f0e6, { roughness: 0.6 }).clone(), bordos, { t: 'Linha de bordo', d: { Serviço: nomeSH, Norma: 'DNIT 100/2018-ES' } });
  // sinalização vertical definitiva: placas a cada 200 m, alternando os lados
  const nomeSV = (servicoRep('sinalizacaoVertical') || {}).nome || '';
  const postes = [],
    chapas = [];
  for (let s = 100, k = 0; s < P.L; s += 200, k++) {
    const z = (k % 2 ? -1 : 1) * (P.W_CX / 2 + 1.2),
      y = wy(nat(s, z));
    const d = [finito(diaRep('sinalizacaoVertical', s)), NUNCA];
    postes.push({ s, matrix: matriz(wx(s), y + 1.25, z, 0, 0.08, 2.5, 0.08), dias: d });
    chapas.push({ s, matrix: matriz(wx(s), y + 2.3, z, Math.PI / 2, 0.8, 0.8, 0.04), dias: d });
  }
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0x7d8287, { metalness: 0.5 }).clone(), postes, { t: 'Placa de sinalização vertical', d: { Serviço: nomeSV, Norma: 'DNIT 101/2009-ES' } });
  instancias(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff).clone(), chapas, { t: 'Placa de sinalização vertical', d: { Serviço: nomeSV, Norma: 'DNIT 101/2009-ES' } });
}
