'use client';

import { type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { townConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { DISTRICTS } from '@/shared/districts';
import { GROUND_BLEND_RADIUS, WATER_LEVEL, blendWeight, groundHeightAt, type TownMap } from '@/shared/townMap';
import { isIndoor } from './club';
import { useTown } from './context';
import { windUniforms } from './wind';

// 맵의 terrain 속성으로 3D 땅을 만든다. 장식은 모두 인스턴싱으로 그려 그리기 호출을 줄인다.
// 지역 땅의 잔디에는 지역 색을 살짝 섞어 어느 지역인지 걸으면서도 느껴지게 한다.
// 땅은 칸마다 따로 그리지 않고, 주변 칸과 높이·색을 섞은 한 장의 매끈한 지형이다 (경계가 둥글다).

const S = tokens.scene;
const DISTRICT_COLORS = DISTRICTS.map((d) => new THREE.Color(tokens.district[d]));
/** 땅 한 칸을 몇 조각으로 나눠 그릴지 (높을수록 경계가 매끈하다) */
const SUB = 2;

/** 위치로 정해지는 0~1 난수 (같은 맵은 항상 같은 모양) */
function hash(x: number, z: number, seed = 0): number {
  const h = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** 부드러운 값 노이즈 (잔디 얼룩용) */
function noise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** 땅 색을 섞을 종류 */
const KINDS = ['grass', 'path', 'stone', 'sand', 'water'] as const;
type Kind = (typeof KINDS)[number];
const kindOf = (terrain: string): Kind =>
  terrain === 'path' ? 'path' : terrain === 'stone' || terrain === 'stoneEdge' ? 'stone' : terrain === 'sand' ? 'sand' : terrain === 'water' ? 'water' : 'grass';

interface Cell {
  x: number;
  z: number;
  terrain: string;
  h: number;
}

function cells(map: TownMap): Cell[] {
  const out: Cell[] = [];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const gid = map.ground[z * map.width + x];
      out.push({ x, z, terrain: map.terrain[gid] ?? 'grass', h: groundHeightAt(map, x + 0.5, z + 0.5) });
    }
  }
  return out;
}

const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * 땅을 한 장의 매끈한 지형으로 만든다. 칸 하나를 SUB×SUB로 나누고, 꼭짓점마다 주변 칸의 높이와 색을 거리로 섞는다.
 * 그래서 길·모래·물의 경계가 계단이 아니라 둥글게 이어지고, 모래사장은 물로 완만하게 내려간다.
 */
function buildGround(map: TownMap, indoor: boolean): THREE.BufferGeometry {
  const kinds = Int8Array.from(map.ground, (gid) => KINDS.indexOf(kindOf(map.terrain[gid] ?? 'grass')));
  const n = map.width * SUB + 1;
  const m = map.height * SUB + 1;
  const pos = new Float32Array(n * m * 3);
  const col = new Float32Array(n * m * 3);
  const colors = {
    path: new THREE.Color(S.path),
    // 실내(클럽): 바닥은 짙게, 벽 밖(물 자리)은 어둠
    stone: new THREE.Color(indoor ? S.clubFloorEdge : S.stoneGrout),
    sand: new THREE.Color(S.sand),
    water: new THREE.Color(indoor ? S.clubVoid : S.sandSide),
  };
  const grassA = new THREE.Color(S.grass);
  const grassB = new THREE.Color(S.grassDark);
  const out = new THREE.Color();
  const tint = new THREE.Color();
  const w = new Float32Array(KINDS.length);
  const r = GROUND_BLEND_RADIUS;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const x = i / SUB;
      const z = j / SUB;
      w.fill(0);
      let wsum = 0;
      let tr = 0;
      let tg = 0;
      let tb = 0;
      let tw = 0;
      for (let tz = Math.floor(z - r - 0.5); tz <= Math.floor(z + r - 0.5) + 1; tz++) {
        for (let tx = Math.floor(x - r - 0.5); tx <= Math.floor(x + r - 0.5) + 1; tx++) {
          const bw = blendWeight(Math.hypot(tx + 0.5 - x, tz + 0.5 - z));
          if (!bw) continue;
          const inside = tx >= 0 && tz >= 0 && tx < map.width && tz < map.height;
          const k = inside ? kinds[tz * map.width + tx] : KINDS.indexOf('water');
          w[k] += bw;
          wsum += bw;
          const d = inside ? map.districtGrid[tz * map.width + tx] : -1;
          if (d >= 0 && k === 0) {
            const c = DISTRICT_COLORS[d];
            tr += c.r * bw;
            tg += c.g * bw;
            tb += c.b * bw;
            tw += bw;
          }
        }
      }
      // 잔디: 얼룩 + 지역 색
      out.copy(grassA).lerp(grassB, noise(x * 0.45, z * 0.45) * 0.9);
      if (tw > 0) out.lerp(tint.setRGB(tr / tw, tg / tw, tb / tw), townConfig.groundTint * Math.min(1, tw / wsum + 0.3));
      // 다른 땅은 경계를 살짝 날카롭게 (둥근 모서리는 남긴다)
      const share = (k: Kind) => smooth(0.36, 0.64, w[KINDS.indexOf(k)] / wsum);
      const sand = share('sand');
      const water = share('water');
      const stone = share('stone');
      const path = share('path');
      out.lerp(colors.sand, sand).lerp(colors.water, water).lerp(colors.stone, stone);
      out.lerp(colors.path, path);
      if (path > 0) out.offsetHSL(0, 0, (noise(x * 0.9, z * 0.9) - 0.5) * 0.04 * path);
      if (sand > 0) out.offsetHSL(0, 0, (noise(x * 0.7, z * 0.7) - 0.5) * 0.05 * sand);
      const v = (j * n + i) * 3;
      pos[v] = x;
      pos[v + 1] = groundHeightAt(map, x, z);
      pos[v + 2] = z;
      col[v] = out.r;
      col[v + 1] = out.g;
      col[v + 2] = out.b;
    }
  }
  const idx = new Uint32Array(map.width * SUB * map.height * SUB * 6);
  let k = 0;
  for (let j = 0; j < m - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** 물가 가까운 정도 (0 = 먼바다, 1 = 땅). 물 색과 물거품에 쓴다 */
function shoreTexture(map: TownMap): THREE.DataTexture {
  const W = map.width;
  const H = map.height;
  const land = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) land[i] = map.terrain[map.ground[i]] === 'water' ? 0 : 1;
  // 상자 흐리기 세 번 (가우스 흐림에 가깝다)
  let a = land;
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(W * H);
    const R = 2;
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        let s = 0;
        let c = 0;
        for (let dz = -R; dz <= R; dz++) {
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            const zz = z + dz;
            if (xx < 0 || zz < 0 || xx >= W || zz >= H) {
              c++;
              continue;
            }
            s += a[zz * W + xx];
            c++;
          }
        }
        b[z * W + x] = s / c;
      }
    }
    a = b;
  }
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.max(land[i], Math.min(1, a[i] * 1.6));
    data.set([Math.round(v * 255), 0, 0, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, W, H);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** 물: 땅 가까이는 옅은 청록, 멀리는 깊은 파랑. 물가에는 물거품 띠가 천천히 밀려왔다 간다 */
function waterMaterial(map: TownMap, shore: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: S.sea, roughness: 0.3, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShore = { value: shore };
    shader.uniforms.uMapSize = { value: new THREE.Vector2(map.width, map.height) };
    shader.uniforms.uWaterTime = windUniforms.uWindTime;
    shader.uniforms.uDeep = { value: new THREE.Color(S.seaDeep) };
    shader.uniforms.uShallow = { value: new THREE.Color(S.seaShallow) };
    shader.uniforms.uFoam = { value: new THREE.Color(S.foam) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vWaterXZ;
        uniform sampler2D uShore;
        uniform vec2 uMapSize;
        uniform float uWaterTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uFoam;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 suv = vWaterXZ / uMapSize;
        float near = (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) ? 0.0 : texture2D(uShore, suv).r;
        vec3 waterCol = mix(uDeep, uShallow, smoothstep(0.05, 0.75, near));
        // 잔물결 무늬
        float ripple = sin(vWaterXZ.x * 1.3 + uWaterTime * 0.9) * sin(vWaterXZ.y * 1.1 - uWaterTime * 0.7);
        waterCol += ripple * 0.025;
        // 물가 물거품: 밀려왔다 가는 띠 두 줄
        float wave = 0.5 + 0.5 * sin(uWaterTime * 1.2 - near * 9.0);
        float foam = smoothstep(0.78, 0.92, near) * (0.55 + 0.45 * wave);
        foam += smoothstep(0.6, 0.66, near) * smoothstep(0.72, 0.66, near) * wave * 0.6;
        diffuseColor.rgb = mix(waterCol, uFoam, clamp(foam, 0.0, 1.0));`,
      );
  };
  return m;
}

interface Instance {
  p: [number, number, number];
  s: [number, number, number];
  r?: number;
  color: string;
  shade?: number;
}

/** 같은 모양을 여러 개 그린다 (그리기 호출 1번) */
function Instances({
  geometry, items, castShadow = false, receiveShadow = true, roughness = 0.9,
}: {
  geometry: THREE.BufferGeometry;
  items: Instance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  roughness?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.scale.set(...it.s);
      o.rotation.set(0, it.r ?? 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(it.color).offsetHSL(0, 0, it.shade ?? 0));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  );
}

const slabGeometry = new RoundedBoxGeometry(0.46, 0.06, 0.46, 2, 0.025);
const hedgeGeometry = new RoundedBoxGeometry(1.02, 0.75, 1.02, 3, 0.2);
const blobGeometry = new THREE.SphereGeometry(1, 10, 7);
const FLOWER_COLORS = [S.flowerPink, S.flowerYellow, S.flowerWhite, S.flowerLilac];
const LOW_HEDGE = 0.4;
/** 중앙광장 화단 높이 */
const PLANTER_H = 0.22;
const planterGeometry = new RoundedBoxGeometry(1, PLANTER_H, 1, 2, 0.05);
const soilGeometry = new THREE.BoxGeometry(0.84, 0.02, 0.84);

export function Terrain({ onGroundClick }: { onGroundClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const { map } = useTown();
  const all = useMemo(() => cells(map), [map]);
  const indoor = useMemo(() => isIndoor(map), [map]);
  const ground = useMemo(() => buildGround(map, indoor), [map, indoor]);
  useEffect(() => () => ground.dispose(), [ground]);
  const water = useMemo(() => {
    const shore = shoreTexture(map);
    return { shore, material: waterMaterial(map, shore) };
  }, [map]);
  useEffect(
    () => () => {
      water.shore.dispose();
      water.material.dispose();
    },
    [water],
  );

  const deco = useMemo(() => {
    const slabs: Instance[] = [];
    const hedges: Instance[] = [];
    const leaves: Instance[] = [];
    const flowers: Instance[] = [];
    const pebbles: Instance[] = [];
    const planters: Instance[] = [];
    const soils: Instance[] = [];
    for (const { x, z, h, terrain } of all) {
      const r = (k: number) => hash(x, z, k);
      switch (terrain) {
        case 'stone':
        case 'stoneEdge':
          for (const [ox, oz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
            slabs.push({
              p: [x + ox, h, z + oz],
              s: [1, 1, 1],
              r: (r(ox * 10 + oz) - 0.5) * 0.06,
              color: indoor ? (terrain === 'stone' ? S.clubFloor : S.clubFloorEdge) : terrain === 'stone' ? S.stone : S.stoneSide,
              shade: (r(ox + oz * 7) - 0.5) * 0.05,
            });
          }
          break;
        case 'hedge': {
          // 카메라 쪽(남쪽) 테두리는 화면을 가리지 않게 낮게 깎는다
          const sy = (z >= map.height - 1 ? LOW_HEDGE : 1) * (1 + r(1) * 0.12);
          hedges.push({ p: [x + 0.5, 0.375 * sy, z + 0.5], s: [1, sy, 1], color: S.hedge, shade: (r(2) - 0.5) * 0.05 });
          for (let i = 0; i < 2; i++) {
            const s = 0.24 + r(3 + i) * 0.08;
            leaves.push({ p: [x + 0.2 + r(5 + i) * 0.6, 0.72 * sy, z + 0.2 + r(7 + i) * 0.6], s: [s, s * 0.8, s], color: S.leaf, shade: (r(9 + i) - 0.5) * 0.06 });
          }
          break;
        }
        case 'flowerbed': {
          // 나무 화단 상자 + 흙 + 잎·꽃
          const top = h + PLANTER_H;
          planters.push({ p: [x + 0.5, h + PLANTER_H / 2, z + 0.5], s: [1, 1, 1], color: S.planter, shade: (r(10) - 0.5) * 0.04 });
          soils.push({ p: [x + 0.5, top, z + 0.5], s: [1, 1, 1], color: S.soil });
          for (let i = 0; i < 3; i++) {
            const s = 0.15 + r(11 + i) * 0.05;
            leaves.push({ p: [x + 0.2 + r(13 + i) * 0.6, top + 0.06, z + 0.2 + r(15 + i) * 0.6], s: [s, s * 0.75, s], color: S.leaf });
          }
          for (let i = 0; i < 5; i++) {
            flowers.push({
              p: [x + 0.15 + r(21 + i) * 0.7, top + 0.12 + r(27 + i) * 0.05, z + 0.15 + r(33 + i) * 0.7],
              s: [0.075, 0.05, 0.075],
              color: FLOWER_COLORS[Math.floor(r(39 + i) * FLOWER_COLORS.length)],
            });
          }
          break;
        }
        case 'path':
          if (r(41) < 0.55) {
            const s = 0.04 + r(42) * 0.04;
            pebbles.push({ p: [x + r(43), h + 0.01, z + r(44)], s: [s * 1.4, s * 0.5, s], r: r(45) * 6, color: S.pathPebble });
          }
          break;
        default:
          // 잔디 위 풀·꽃은 Decor가 흩뿌린다
      }
    }
    return { slabs, hedges, leaves, flowers, pebbles, planters, soils };
  }, [all, map, indoor]);

  return (
    <>
      <mesh geometry={ground} receiveShadow onClick={onGroundClick}>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      {/* 바다와 호수 (땅이 수면 아래로 내려간 곳에 보인다). 실내에는 없다 */}
      {!indoor && (
        <mesh rotation-x={-Math.PI / 2} position={[map.width / 2, WATER_LEVEL, map.height / 2]} receiveShadow material={water.material}>
          <planeGeometry args={[map.width + 900, map.height + 900]} />
        </mesh>
      )}
      <Instances geometry={planterGeometry} items={deco.planters} castShadow />
      <Instances geometry={soilGeometry} items={deco.soils} />
      <Instances geometry={slabGeometry} items={deco.slabs} roughness={0.85} />
      <Instances geometry={hedgeGeometry} items={deco.hedges} castShadow />
      <Instances geometry={blobGeometry} items={deco.leaves} castShadow />
      <Instances geometry={blobGeometry} items={deco.flowers} roughness={0.7} />
      <Instances geometry={blobGeometry} items={deco.pebbles} />
    </>
  );
}
