'use client';

import { type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tokens } from '@/design/tokens';
import type { PlazaMap } from '@/shared/plazaMap';
import { usePlaza } from './context';

// 맵의 terrain 속성으로 3D 땅을 만든다. 장식은 모두 인스턴싱으로 그려 그리기 호출을 줄인다.

const S = tokens.scene;

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
      const h = terrain === 'hedge' ? 0 : (map.tileHeights[gid] ?? 0);
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
      return out.set(S.water);
    default:
      return out.copy(grassA).lerp(grassB, noise(wx * 0.45, wz * 0.45) * 0.9);
  }
}

const SIDE_COLOR: Record<string, string> = { stone: S.stoneSide, stoneEdge: S.stoneSide, flowerbed: S.planter };

/** 바닥 윗면과 솟은 칸의 옆면을 메시 하나로 만든다 */
function buildGround(map: PlazaMap, all: Cell[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const heightAt = (x: number, z: number) =>
    x < 0 || z < 0 || x >= map.width || z >= map.height ? 0 : all[z * map.width + x].h;
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
    quad(corners, corners.map(([wx, , wz]) => topColor(terrain, wx, wz, new THREE.Color())));
    if (h <= 0) continue;
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
const blobGeometry = new THREE.SphereGeometry(1, 12, 9);
// 잔디 위 클로버 덤불: 납작한 구 몇 개
const cloverGeometry = mergeGeometries(
  [[0, 0, 0, 1], [0.9, 0, 0.3, 0.75], [-0.7, 0, 0.5, 0.7], [0.2, 0, -0.8, 0.65]].map(([x, y, z, r]) =>
    new THREE.SphereGeometry(r, 10, 6).scale(1, 0.35, 1).translate(x, y, z),
  ),
);

const FLOWER_COLORS = [S.flowerPink, S.flowerYellow, S.flowerWhite, S.flowerLilac];
const LOW_HEDGE = 0.4;

export function Terrain({ onGroundClick }: { onGroundClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const { map, assets } = usePlaza();
  const all = useMemo(() => cells(map), [map]);
  const ground = useMemo(() => buildGround(map, all), [map, all]);

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
          if (terrain.startsWith('grass') && r(50) < 0.3) {
            const s = 0.09 + r(52) * 0.06;
            tufts.push({ p: [x + 0.15 + r(54) * 0.7, 0, z + 0.15 + r(56) * 0.7], s: [s, s, s], r: r(58) * 6, color: S.grassTuft, shade: (r(59) - 0.5) * 0.04 });
          }
      }
    }
    return { slabs, hedges, leaves, flowers, tufts, pebbles };
  }, [all, map]);

  // 산울타리 밖을 둘러싼 나무 (광장 소품 나무 모델을 그대로 인스턴싱).
  // 카메라는 남쪽에서 북쪽을 보므로 남쪽 줄은 심지 않는다 (화면 아래를 가린다).
  const forest = useMemo(() => {
    const tree = assets.props['prop.plaza.tree'];
    let mesh: THREE.Mesh | undefined;
    tree?.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) return null;
    const items: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    const W = map.width;
    const H = map.height;
    let k = 0;
    const place = (x: number, z: number) => {
      const s = 0.95 + hash(x, z, 3) * 0.55;
      o.position.set(x, 0, z);
      o.scale.setScalar(s);
      o.rotation.set(0, hash(x, z, 4) * 6, 0);
      o.updateMatrix();
      items.push(o.matrix.clone());
      k++;
    };
    for (let ring = 0; ring < 3; ring++) {
      const d = 1.6 + ring * 2.1;
      for (let x = -d; x <= W + d; x += 2.2 + hash(ring, x) * 0.8) {
        place(x + hash(x, ring) * 0.8, -d - hash(ring, x, 1));
      }
      for (let z = -d + 1.5; z <= H - 4; z += 2.2 + hash(z, ring) * 0.8) {
        place(-d - hash(z, ring, 6), z);
        place(W + d + hash(ring, z, 7), z);
      }
    }
    return { geometry: mesh.geometry, material: mesh.material as THREE.Material, items, count: k };
  }, [assets, map]);

  const forestRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = forestRef.current;
    if (!m || !forest) return;
    forest.items.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [forest]);

  return (
    <>
      <mesh geometry={ground} receiveShadow onClick={onGroundClick}>
        <meshStandardMaterial vertexColors roughness={0.95} />
      </mesh>
      {/* 맵 바깥 잔디 */}
      <mesh rotation-x={-Math.PI / 2} position={[map.width / 2, -0.01, map.height / 2]} receiveShadow onClick={onGroundClick}>
        <planeGeometry args={[map.width + 160, map.height + 160]} />
        <meshStandardMaterial color={S.grass} roughness={1} />
      </mesh>
      <Instances geometry={slabGeometry} items={deco.slabs} roughness={0.85} />
      <Instances geometry={hedgeGeometry} items={deco.hedges} castShadow />
      <Instances geometry={blobGeometry} items={deco.leaves} castShadow />
      <Instances geometry={blobGeometry} items={deco.flowers} roughness={0.7} />
      <Instances geometry={blobGeometry} items={deco.pebbles} />
      <Instances geometry={cloverGeometry} items={deco.tufts} />
      {forest && (
        <instancedMesh ref={forestRef} args={[forest.geometry, forest.material, forest.count]} castShadow receiveShadow />
      )}
    </>
  );
}
