// 바람: 잎·풀 재질(이름 'foliage')의 꼭짓점을 높이에 비례해 살랑살랑 흔든다.
// 시간은 장면이 매 프레임 windUniforms에 넣는다. 인스턴스마다 위치로 박자를 달리한다.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const FOLIAGE_MATERIAL = 'foliage';
export const windUniforms = { uWindTime: { value: 0 } };

/** 다른 셰이더 고침(반투명 등)과 같이 쓸 수 있게 바람 부분만 셰이더 문자열에 넣는다 */
export function injectWind(shader: { uniforms: Record<string, unknown>; vertexShader: string }) {
  shader.uniforms.uWindTime = windUniforms.uWindTime;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 windAt = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 windAt = vec2(modelMatrix[3][0], modelMatrix[3][2]);
      #endif
      float windH = max(position.y, 0.0);
      float windPh = windAt.x * 0.37 + windAt.y * 0.23;
      transformed.x += sin(uWindTime * 1.7 + windPh) * 0.045 * windH;
      transformed.z += cos(uWindTime * 1.3 + windPh * 1.3) * 0.03 * windH;`,
    );
}

const cache = new WeakMap<THREE.Material, THREE.Material>();

/** 잎 재질이면 바람에 흔들리는 재질로 (같은 재질은 한 번만 만든다) */
export function withWind(src: THREE.Material): THREE.Material {
  if (src.name !== FOLIAGE_MATERIAL) return src;
  let m = cache.get(src);
  if (!m) {
    m = src.clone();
    m.onBeforeCompile = injectWind;
    m.customProgramCacheKey = () => 'wind';
    cache.set(src, m);
  }
  return m;
}

const smoothCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * 잎 모양을 둥글게: 각진 면마다 따로인 꼭짓점을 합쳐 법선을 부드럽게 다시 계산한다
 * (낮은 면 수 그대로 동글동글한 덩어리로 보인다). 잎이 아니면 그대로.
 */
export function softFoliage(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.BufferGeometry {
  if (material.name !== FOLIAGE_MATERIAL) return geometry;
  let g = smoothCache.get(geometry);
  if (!g) {
    const c = geometry.clone();
    // 위치와 꼭짓점 색(코드로 만든 나무는 색을 꼭짓점에 칠한다)만 남기고 합친다
    for (const name of Object.keys(c.attributes)) if (name !== 'position' && name !== 'color') c.deleteAttribute(name);
    g = mergeVertices(c, 1e-4);
    g.computeVertexNormals();
    smoothCache.set(geometry, g);
  }
  return g;
}
