// Edificações do entorno (Fase 6): contorno e altura do IPP (Lidar 2019; OSM onde o IPP não cobre), com fachada pelo tipo
// (residencial de vila militar, alojamento, administrativo, utilitário e cobertura aberta) sem reproduzir prédios
// específicos. Reboco, barra, janelas com caixilho, venezianas, portas, escorrimento sob os peitoris, telha cerâmica,
// laje e telha metálica são desenhados no shader a partir de coordenadas da fachada (atributos aF e aG); prédios baixos e
// quase retangulares recebem telhado cerâmico de quatro águas sobre o retângulo mínimo, com beiral. Uma malha por tipo.
import * as THREE from 'three';
import { wy, mundoDeLocal } from './base.js';
import { cotaNoLocal } from './terreno.js';
import { areaPoligono, classificarEdificacao, temTelhadoCeramico, retanguloMinimo, telhadoQuatroAguas } from './entornoGeo.js';
import { rng } from '../dominio/util.js';

// códigos do shader
const COD = { telha: 0, residencial: 1, alojamento: 2, administrativo: 3, utilitario: 4, laje: 5, metal: 6, forro: 7 };
const NOME = {
  residencial: 'Residencial (casas e blocos da vila militar)',
  alojamento: 'Alojamento (bloco longo)',
  administrativo: 'Administrativo',
  utilitario: 'Utilitário (galpão, casa de máquinas, reservatório)',
  cobertura: 'Cobertura aberta (telheiro ou marquise)'
};
// cores de reboco por tipo, telhas e coberturas (sRGB)
const PAREDES = {
  residencial: [0xe8dcc0, 0xebd9a0, 0xedebe4, 0xe6cfc2, 0xd9dcc6, 0xe9d3a8],
  alojamento: [0xe6d7b0, 0xdccfae, 0xe8dfc6],
  administrativo: [0xe9e4d8, 0xd8d2c4, 0xe3d6b8],
  utilitario: [0xbdbdb4, 0xc9c2b0, 0xb5b3aa],
  cobertura: [0xbdbcb4]
};
const TELHAS = [0xa8553a, 0x9c4b33, 0xb0623f, 0x8e4a35, 0xa65a3c];

const VERT = /* glsl */ `
attribute vec4 aF;
attribute vec4 aG;
varying vec4 vF;
varying vec4 vG;
`;
const FRAG = /* glsl */ `
varying vec4 vF;
varying vec4 vG;
float hashE(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruidoE(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashE(i), hashE(i + vec2(1.0, 0.0)), f.x), mix(hashE(i + vec2(0.0, 1.0)), hashE(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbmE(vec2 p) { return 0.55 * ruidoE(p) + 0.3 * ruidoE(p * 2.3 + 7.1) + 0.15 * ruidoE(p * 5.1 + 3.3); }
`;
// fachada: cor (diffuseColor), rugosidade e metal por pixel
const FRAG_MAP = /* glsl */ `
float eRough = roughness, eMetal = metalness;
{
  float cod = floor(vF.w + 0.5);
  vec2 p = vF.xy;
  float L = vF.z, hp = vG.x, sem = vG.y, lado = vG.z;
  vec3 c = diffuseColor.rgb;
  // manchas de umidade e sujeira (comuns no reboco e nas telhas do Rio)
  float mancha = fbmE(p * vec2(0.35, 0.22) + sem * 13.0);
  if (cod < 0.5) {
    // telha cerâmica capa e canal: ondas a cada 0,21 m ao longo do beiral, fiadas de 0,38 m ao longo da água
    // o desenho some quando fica menor que o pixel (sem moiré de longe)
    float nitU = 1.0 - smoothstep(0.03, 0.09, fwidth(p.x));
    float nitV = 1.0 - smoothstep(0.06, 0.18, fwidth(p.y));
    float onda = sin(p.x * 29.92) * nitU;
    float fiada = fract(p.y / 0.38);
    float degrau = mix(1.0, mix(0.62, 1.0, smoothstep(0.0, 0.12, fiada)), nitV);
    c *= (0.84 + 0.16 * onda) * mix(0.86, degrau, nitV) * (0.8 + 0.35 * mancha);
    c = mix(c, c * vec3(0.55, 0.6, 0.55), smoothstep(0.55, 0.85, fbmE(p * 0.5 + sem)) * 0.5);
    eRough = 0.72;
  } else if (cod < 4.5) {
    float temJanela = cod < 3.5 ? 1.0 : 0.0;
    float andar = cod > 2.5 ? 3.2 : 2.9;
    float baia = cod < 1.5 ? 3.0 : (cod < 2.5 ? 3.1 : 3.4);
    float jl = cod > 2.5 ? 1.8 : 1.2;
    float ja = cod > 2.5 ? 1.5 : 1.25;
    float peit = cod > 2.5 ? 0.9 : 1.0;
    // reboco: textura fina e escorrimentos verticais
    float fino = ruidoE(p * 9.0 + sem) * 0.5 + ruidoE(p * 23.0) * 0.5;
    c *= 0.93 + 0.1 * fino;
    float escorre = fbmE(vec2(p.x * 1.7 + sem * 5.0, p.y * 0.08));
    c *= 1.0 - 0.14 * smoothstep(0.45, 0.8, escorre) * smoothstep(hp, hp * 0.4, p.y);
    c *= 0.9 + 0.12 * mancha;
    // barra junto ao chão e cimalha no topo
    if (p.y < 0.45) c *= vec3(0.62, 0.62, 0.6);
    if (p.y > hp - 0.25 && cod > 2.5) c = mix(c, vec3(0.8), 0.5);
    float n = floor((L - 0.6) / baia);
    if (temJanela > 0.5 && n >= 1.0) {
      float off = (L - n * baia) * 0.5;
      float k = floor((p.x - off) / baia);
      float lu = p.x - off - (k + 0.5) * baia;
      float fl = floor(p.y / andar);
      float lv = p.y - fl * andar - peit;
      float cabe = step(fl * andar + peit + ja, hp - 0.25);
      float h = hashE(vec2(k + sem * 31.0, fl + lado * 7.0));
      // porta no térreo do vão central de uma das paredes das casas
      bool porta = cod < 1.5 && fl < 0.5 && abs(k - floor(n * 0.5)) < 0.5 && hashE(vec2(lado, sem)) < 0.35 && L > 5.0;
      float pl = porta ? 0.95 : jl;
      float pv = porta ? p.y : lv;
      float pa = porta ? 2.1 : ja;
      if (k >= 0.0 && k < n && cabe > 0.5 && abs(lu) < pl * 0.5 + 0.08 && pv > -0.08 && pv < pa + 0.08) {
        float dentro = step(abs(lu), pl * 0.5) * step(0.0, pv) * step(pv, pa);
        if (dentro < 0.5) {
          // guarnição e peitoril
          c = vec3(0.86, 0.85, 0.82);
          eRough = 0.6;
        } else {
          float borda = min(pl * 0.5 - abs(lu), min(pv, pa - pv));
          if (porta) {
            c = vec3(0.24, 0.16, 0.1) * (0.85 + 0.15 * step(0.08, fract(lu * 3.0)));
            eRough = 0.65;
          } else if (cod < 2.5 && h < 0.4) {
            // veneziana de madeira (verde, marrom ou branca), com as palhetas
            vec3 cv = h < 0.15 ? vec3(0.17, 0.27, 0.19) : (h < 0.3 ? vec3(0.32, 0.2, 0.12) : vec3(0.78, 0.77, 0.73));
            c = cv * (0.75 + 0.25 * step(0.35, fract(pv * 14.0)));
            eRough = 0.7;
          } else {
            // vidro com caixilho: escuro, liso (reflete o céu) e com o montante no meio
            float mont = step(abs(lu), 0.03) + step(abs(pv - pa * 0.55), 0.03);
            c = mix(vec3(0.03, 0.045, 0.06) * (0.8 + 0.6 * h), vec3(0.8, 0.8, 0.78), clamp(mont, 0.0, 1.0));
            eRough = mont > 0.5 ? 0.5 : 0.08;
            eMetal = mont > 0.5 ? 0.0 : 0.15;
          }
          // sombra do vão (o caixilho fica recuado)
          c *= mix(0.55, 1.0, smoothstep(0.0, 0.07, borda));
        }
      }
      // escorrimento sob o peitoril
      float sob = -(p.y - fl * andar - peit);
      if (k >= 0.0 && k < n && abs(lu) < jl * 0.5 && sob > 0.0 && sob < 1.2 && cabe > 0.5)
        c *= 1.0 - 0.18 * (1.0 - sob / 1.2) * smoothstep(0.3, 0.7, ruidoE(vec2(lu * 6.0, sem)));
    }
    if (cod > 3.5 && p.y > hp - 1.2 && p.y < hp - 0.6 && L > 6.0) {
      // galpões: faixa de venezianas de ventilação no alto
      c *= 0.55 + 0.45 * step(0.4, fract(p.y * 9.0));
    }
  } else if (cod < 5.5) {
    // laje impermeabilizada: manchas escuras
    c *= 0.75 + 0.4 * mancha;
    eRough = 0.95;
  } else if (cod < 6.5) {
    // telha metálica trapezoidal
    float tr = fract(p.x / 0.25);
    c *= 0.82 + 0.18 * smoothstep(0.2, 0.3, tr) * (1.0 - smoothstep(0.7, 0.8, tr));
    c *= 0.85 + 0.25 * mancha;
    eRough = 0.42;
    eMetal = 0.55;
  } else {
    // forro sob o beiral
    c *= 0.55;
  }
  diffuseColor.rgb = c;
}
`;
function material() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvF = aF;\nvG = aG;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = eRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = eMetal;');
  };
  m.customProgramCacheKey = () => 'fachadas';
  return m;
}

// acumulador de triângulos com os atributos da fachada
function acumulador() {
  const A = { pos: [], cor: [], f: [], g: [] };
  A.tri = (pts, cor, fs, g) => {
    pts.forEach((p, i) => {
      A.pos.push(p.x, p.y, p.z);
      A.cor.push(cor.r, cor.g, cor.b);
      A.f.push(...fs[i]);
      A.g.push(...g);
    });
  };
  A.geometria = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(A.cor, 3));
    geo.setAttribute('aF', new THREE.Float32BufferAttribute(A.f, 4));
    geo.setAttribute('aG', new THREE.Float32BufferAttribute(A.g, 4));
    geo.computeVertexNormals();
    return geo;
  };
  return A;
}
const V = (x, y, h) => {
  const w = mundoDeLocal(x, y);
  return new THREE.Vector3(w.x, h, w.z);
};
// triângulo com a face para cima (ou para fora): inverte a ordem se a normal no mundo apontar para baixo
function triCima(A, ps, cor, fs, g, baixo = false) {
  const n = new THREE.Vector3().subVectors(ps[1], ps[0]).cross(new THREE.Vector3().subVectors(ps[2], ps[0]));
  if (n.y < 0 !== baixo) {
    ps = [ps[0], ps[2], ps[1]];
    fs = [fs[0], fs[2], fs[1]];
  }
  A.tri(ps, cor, fs, g);
}

function predio(A, e, tipo, R) {
  let pts = e.c.map(p => [p[0], p[1]]);
  if (areaPoligono(pts) < 0) pts = pts.reverse();
  const chao = Math.min(...pts.map(([x, y]) => cotaNoLocal(x, y)));
  const g0 = wy(chao),
    yb = g0 - 0.3,
    h = Math.max(2.5, e.h);
  const sem = R();
  const corParede = new THREE.Color(PAREDES[tipo][Math.floor(R() * PAREDES[tipo].length)]);
  const ceramico = temTelhadoCeramico(tipo, e);
  const r = retanguloMinimo(pts);
  const tel = ceramico ? telhadoQuatroAguas(r, 0.5, 0.32) : null;
  const hp = tipo === 'cobertura' ? h : ceramico ? Math.max(2.6, h - tel.altura) : h;
  const cod = tipo === 'cobertura' ? COD.utilitario : COD[tipo];
  // paredes (contorno anti-horário no plano local: no mundo, z = −y, as faces ficam para fora)
  if (tipo !== 'cobertura')
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i],
        [bx, by] = pts[(i + 1) % pts.length];
      const L = Math.hypot(bx - ax, by - ay);
      if (L < 0.05) continue;
      const g = [hp, sem, i, 0];
      const a0 = V(ax, ay, yb),
        b0 = V(bx, by, yb),
        b1 = V(bx, by, g0 + hp),
        a1 = V(ax, ay, g0 + hp);
      const f = (u, v) => [u, v, L, cod];
      A.tri([a0, b0, b1], corParede, [f(0, -0.3), f(L, -0.3), f(L, hp)], g);
      A.tri([a0, b1, a1], corParede, [f(0, -0.3), f(L, hp), f(0, hp)], g);
    }
  const g = [hp, sem, 0, 0];
  if (ceramico) {
    const corTelha = new THREE.Color(TELHAS[Math.floor(R() * TELHAS.length)]);
    const forro = new THREE.Color(0xd8d4c8);
    for (const t of tel.tris) {
      const ps = t.map(([x, y, dz]) => V(x, y, g0 + hp - 0.05 + dz));
      triCima(
        A,
        ps,
        corTelha,
        t.map(([, , , u, v]) => [u, v, 0, COD.telha]),
        g
      );
      triCima(
        A,
        ps.map(p => p.clone().setY(p.y - 0.06)),
        forro,
        t.map(() => [0, 0, 0, COD.forro]),
        g,
        true
      );
    }
    return;
  }
  // cobertura plana: laje nos prédios, telha metálica nos utilitários e telheiros
  const metal = tipo === 'utilitario' || (tipo === 'cobertura' && e.uso === 'telheiro');
  const corTopo = new THREE.Color(metal ? 0xa9adad : 0x9e9c96);
  const tri = THREE.ShapeUtils.triangulateShape(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    []
  );
  const fTopo = ([x, y]) => [x * r.u[0] + y * r.u[1], -x * r.u[1] + y * r.u[0], 0, metal ? COD.metal : COD.laje];
  for (const [a, b, c] of tri) {
    const q = [pts[a], pts[b], pts[c]];
    triCima(
      A,
      q.map(([x, y]) => V(x, y, g0 + hp)),
      corTopo,
      q.map(fTopo),
      g
    );
    if (tipo === 'cobertura')
      triCima(
        A,
        q.map(([x, y]) => V(x, y, g0 + hp - 0.2)),
        corTopo,
        q.map(() => [0, 0, 0, COD.forro]),
        g,
        true
      );
  }
  if (tipo === 'cobertura') {
    // pilares nos cantos do retângulo mínimo
    const cor = new THREE.Color(0x9a9890);
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ]) {
      const cx = r.c[0] + r.u[0] * su * (r.comp / 2 - 0.3) + r.v[0] * sv * (r.larg / 2 - 0.3),
        cy = r.c[1] + r.u[1] * su * (r.comp / 2 - 0.3) + r.v[1] * sv * (r.larg / 2 - 0.3);
      const q = [
        [cx - 0.12, cy - 0.12],
        [cx + 0.12, cy - 0.12],
        [cx + 0.12, cy + 0.12],
        [cx - 0.12, cy + 0.12]
      ];
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = q[i],
          [bx, by] = q[(i + 1) % 4];
        const f = [0, 0, 0, COD.utilitario];
        const gg = [0.1, 0, 0, 0];
        A.tri([V(ax, ay, yb), V(bx, by, yb), V(bx, by, g0 + hp)], cor, [f, f, f], gg);
        A.tri([V(ax, ay, yb), V(bx, by, g0 + hp), V(ax, ay, g0 + hp)], cor, [f, f, f], gg);
      }
    }
  }
}

/** Monta as edificações: uma malha por tipo de fachada. */
export function construirEdificacoes(pai, edificacoes) {
  const porTipo = {};
  const R = rng(4242);
  for (const e of edificacoes) {
    if (e.c.length < 3) continue;
    const tipo = classificarEdificacao(e);
    porTipo[tipo] = porTipo[tipo] || acumulador();
    predio(porTipo[tipo], e, tipo, R);
  }
  const mat = material();
  const contagem = {};
  for (const [tipo, A] of Object.entries(porTipo)) {
    const geo = A.geometria();
    const o = new THREE.Mesh(geo, mat);
    o.castShadow = o.receiveShadow = true;
    contagem[tipo] = geo.attributes.position.count / 3;
    o.userData.info = {
      t: 'Edificação existente',
      d: {
        Tipo: NOME[tipo],
        Fachada: 'Ilustrativa, pelo tipo de uso; não reproduz o prédio real',
        Fonte:
          'Prefeitura da Cidade do Rio de Janeiro – Instituto Pereira Passos (Edificações 2019, altura do Lidar); complemento © colaboradores do OpenStreetMap (ODbL)',
        Interferência: 'Nenhuma; fora da faixa da obra'
      }
    };
    pai.add(o);
  }
  return contagem;
}
