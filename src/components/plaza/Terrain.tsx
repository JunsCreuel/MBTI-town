'use client';

import { type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { townConfig } from '@/config/game';
import { MBTI_TYPES, mbtiColor } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { PlazaMap } from '@/shared/plazaMap';
import type { Territory } from '@/shared/territory';
import { usePlaza } from './context';

// 맵의 terrain 속성으로 3D 땅을 만든다. 장식은 모두 인스턴싱으로 그려 그리기 호출을 줄인다.
// 유형 마을 땅의 잔디에는 땅 주인 색을 살짝 섞는다 (땅따먹기로 주인이 바뀌면 다시 칠한다).

const S = tokens.scene;
/** 바다 수면 높이. 모래사장이 바다보다 살짝 높다. */
export const WATER_LEVEL = -0.14;
const OWNER_COLORS = MBTI_TYPES.map((t) => new THREE.Color(mbtiColor(t)));

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

interface Cell {
  x: number;
  z: number;
  terrain: string;
  h: number;
}

function cells(map: PlazaMap): Cell[] {
  const out: Cell[] = [];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const gid = map.ground[z * map.width + x];
      const terrain = map.terrain[gid] ?? 'grass';
      // 산울타리는 덤불 모델로 세우므로 바닥은 평평하게 둔다
      const h = terrain === 'water' ? WATER_LEVEL : terrain === 'hedge' ? 0 : (map.tileHeights[gid] ?? 0);
      out.push({ x, z, terrain, h });
    }
  }
  return out;
}

const grassA = new THREE.Color(S.grass);
const grassB = new THREE.Color(S.grassDark);

function topColor(terrain: string, wx: number, wz: number, out: THREE.Color): THREE.Color {
  switch (terrain) {
    case 'path':
      return out.set(S.path).offsetHSL(0, 0, (noise(wx * 0.9, wz * 0.9) - 0.5) * 0.04);
    case 'stone':
    case 'stoneEdge':
      return out.set(S.stoneGrout);
    case 'flowerbed':
      return out.set(S.soil);
    case 'water':
      return out.set(S.sea);
    case 'sand':
      return out.set(S.sand).offsetHSL(0, 0, (noise(wx * 0.7, wz * 0.7) - 0.5) * 0.05);
    default:
      return out.copy(grassA).lerp(grassB, noise(wx * 0.45, wz * 0.45) * 0.9);
  }
}

const SIDE_COLOR: Record<string, string> = {
  stone: S.stoneSide, stoneEdge: S.stoneSide, flowerbed: S.planter, sand: S.sandSide, grass: S.sandSide, grass2: S.sandSide,
};

/** 바닥 윗면과 솟은 칸의 옆면을 메시 하나로 만든다 */
function buildGround(map: PlazaMap, all: Cell[], territory: Territory): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const heightAt = (x: number, z: number) =>
    x < 0 || z < 0 || x >= map.width || z >= map.height ? WATER_LEVEL : all[z * map.width + x].h;
  const quad = (pts: number[][], colors: THREE.Color[]) => {
    const i = pos.length / 3;
    pts.forEach((p, k) => {
      pos.push(p[0], p[1], p[2]);
      col.push(colors[k].r, colors[k].g, colors[k].b);
    });
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  };
  for (const cell of all) {
    const { x, z, h, terrain } = cell;
    const corners = [[x, h, z], [x + 1, h, z], [x + 1, h, z + 1], [x, h, z + 1]];
    const owner = territory.owner[z * map.width + x];
    const tint = owner >= 0 && terrain.startsWith('grass') ? OWNER_COLORS[owner] : null;
    quad(
      corners,
      corners.map(([wx, , wz]) => {
        const out = topColor(terrain, wx, wz, new THREE.Color());
        return tint ? out.lerp(tint, townConfig.groundTint) : out;
      }),
    );
    if (h <= WATER_LEVEL) continue;
    const side = c.set(SIDE_COLOR[terrain] ?? S.stoneSide).clone();
    const sides: [number, number, number[][]][] = [
      [x, z - 1, [[x + 1, h, z], [x, h, z]]],
      [x + 1, z, [[x + 1, h, z + 1], [x + 1, h, z]]],
      [x, z + 1, [[x, h, z + 1], [x + 1, h, z + 1]]],
      [x - 1, z, [[x, h, z], [x, h, z + 1]]],
    ];
    for (const [nx, nz, [a, b]] of sides) {
      const nh = heightAt(nx, nz);
      if (nh >= h) continue;
      quad([a, b, [b[0], nh, b[2]], [a[0], nh, a[2]]], [side, side, side, side]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
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
// 잔디 위 클로버 덤불: 납작한 구 몇 개 (마을 전체에 깔리므로 면 수를 아낀다)
const cloverGeometry = mergeGeometries(
  [[0, 0, 0, 1], [0.9, 0, 0.3, 0.75], [-0.7, 0, 0.5, 0.7], [0.2, 0, -0.8, 0.65]].map(([x, y, z, r]) =>
    new THREE.SphereGeometry(r, 8, 4).scale(1, 0.35, 1).translate(x, y, z),
  ),
);
/** 잔디 칸 가운데 클로버 덤불을 심는 비율 */
const TUFT_RATE = 0.14;

const FLOWER_COLORS = [S.flowerPink, S.flowerYellow, S.flowerWhite, S.flowerLilac];
const LOW_HEDGE = 0.4;

export function Terrain({ onGroundClick }: { onGroundClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const { map, territory } = usePlaza();
  const all = useMemo(() => cells(map), [map]);
  const ground = useMemo(() => buildGround(map, all, territory), [map, all, territory]);
  useEffect(() => () => ground.dispose(), [ground]);

  const deco = useMemo(() => {
    const slabs: Instance[] = [];
    const hedges: Instance[] = [];
    const leaves: Instance[] = [];
    const flowers: Instance[] = [];
    const tufts: Instance[] = [];
    const pebbles: Instance[] = [];
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
              color: terrain === 'stone' ? S.stone : S.stoneSide,
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
        case 'flowerbed':
          for (let i = 0; i < 3; i++) {
            const s = 0.15 + r(11 + i) * 0.05;
            leaves.push({ p: [x + 0.2 + r(13 + i) * 0.6, h + 0.06, z + 0.2 + r(15 + i) * 0.6], s: [s, s * 0.75, s], color: S.leaf });
          }
          for (let i = 0; i < 5; i++) {
            flowers.push({
              p: [x + 0.15 + r(21 + i) * 0.7, h + 0.17 + r(27 + i) * 0.05, z + 0.15 + r(33 + i) * 0.7],
              s: [0.075, 0.05, 0.075],
              color: FLOWER_COLORS[Math.floor(r(39 + i) * FLOWER_COLORS.length)],
            });
          }
          break;
        case 'path':
          if (r(41) < 0.55) {
            const s = 0.04 + r(42) * 0.04;
            pebbles.push({ p: [x + r(43), 0.01, z + r(44)], s: [s * 1.4, s * 0.5, s], r: r(45) * 6, color: S.pathPebble });
          }
          break;
        default:
          if (terrain.startsWith('grass') && r(50) < TUFT_RATE) {
            const s = 0.09 + r(52) * 0.06;
            tufts.push({ p: [x + 0.15 + r(54) * 0.7, 0, z + 0.15 + r(56) * 0.7], s: [s, s, s], r: r(58) * 6, color: S.grassTuft, shade: (r(59) - 0.5) * 0.04 });
          }
      }
    }
    return { slabs, hedges, leaves, flowers, tufts, pebbles };
  }, [all, map]);

  return (
    <>
      <mesh geometry={ground} receiveShadow onClick={onGroundClick}>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      {/* 섬을 둘러싼 바다 */}
      <mesh rotation-x={-Math.PI / 2} position={[map.width / 2, WATER_LEVEL - 0.01, map.height / 2]} receiveShadow>
        <planeGeometry args={[map.width + 900, map.height + 900]} />
        <meshStandardMaterial color={S.sea} roughness={0.35} metalness={0.05} />
      </mesh>
      <Instances geometry={slabGeometry} items={deco.slabs} roughness={0.85} />
      <Instances geometry={hedgeGeometry} items={deco.hedges} castShadow />
      <Instances geometry={blobGeometry} items={deco.leaves} castShadow />
      <Instances geometry={blobGeometry} items={deco.flowers} roughness={0.7} />
      <Instances geometry={blobGeometry} items={deco.pebbles} />
      <Instances geometry={cloverGeometry} items={deco.tufts} />
    </>
  );
}
