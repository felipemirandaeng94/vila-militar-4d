// Visibilidade por dia: cada vértice (ou instância) guarda [dia em que aparece, dia em que some] no atributo aDias,
// e o uniforme uDia (dia exibido) descarta o que ainda não existe ou já foi removido. Assim o avanço das frentes
// não exige refazer geometria a cada quadro.
import * as THREE from 'three';

export const uDia = { value: 0 };
export const NUNCA = 1e6;

export function comDias(material, { crescer = false } = {}) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uDia = uDia;
    sh.vertexShader =
      'attribute vec2 aDias;\nvarying vec2 vDias;\nuniform float uDia;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDias = aDias;' + (crescer ? '\ntransformed *= 0.4 + 0.6 * clamp((uDia - aDias.x) * 6.0, 0.0, 1.0);' : '')
      );
    sh.fragmentShader = 'uniform float uDia;\nvarying vec2 vDias;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (uDia < vDias.x || uDia >= vDias.y) discard;');
  };
  material.customProgramCacheKey = () => 'comDias' + (crescer ? 'C' : '');
  return material;
}

// atributo por instância [aparece, some]
export function diasPorInstancia(mesh, lista) {
  const a = new Float32Array(lista.length * 2);
  lista.forEach(([x, y], i) => {
    a[i * 2] = x;
    a[i * 2 + 1] = y;
  });
  mesh.geometry.setAttribute('aDias', new THREE.InstancedBufferAttribute(a, 2));
  return mesh;
}
export const finito = v => (Number.isFinite(v) ? v : NUNCA);
