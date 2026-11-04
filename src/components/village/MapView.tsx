'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import { DISTRICTS, type District } from '@/shared/districts';
import { lotDoor, type TownMap } from '@/shared/townMap';
import { useTown } from './context';
import { now } from './session';

// 전체 지도(위에서 내려다보기)에서만 진하게 보이는 표시.
// - 다섯 지역 땅을 지역 색으로 칠한다
// - 지역 사이 경계선 (걷기 화면에서도 옅게 보인다)
// - 내 위치 표시
// - 이름표(HTML) 위치를 매 프레임 화면 좌표로 옮긴다

const DISTRICT_COLORS = DISTRICTS.map((d) => new THREE.Color(tokens.district[d]));
const FILL_Y = 0.08;
const BORDER_Y = 0.1;
const BORDER_W = 0.16;
/** 걷기 화면의 경계선 진하기 */
const WALK_BORDER_OPACITY = 0.28;

function buildFill(map: TownMap): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const o = map.districtGrid[z * map.width + x];
      if (o < 0) continue;
      const i = pos.length / 3;
      pos.push(x, FILL_Y, z, x + 1, FILL_Y, z, x + 1, FILL_Y, z + 1, x, FILL_Y, z + 1);
      const c = DISTRICT_COLORS[o];
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** 서로 다른 지역 땅이 맞닿은 칸 변마다 얇은 띠를 깐다 */
function buildBorders(map: TownMap): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const owner = (x: number, z: number) =>
    x < 0 || z < 0 || x >= map.width || z >= map.height ? -1 : map.districtGrid[z * map.width + x];
  const strip = (x0: number, z0: number, x1: number, z1: number) => {
    const i = pos.length / 3;
    const h = BORDER_W / 2;
    if (z0 === z1) pos.push(x0, BORDER_Y, z0 - h, x1, BORDER_Y, z0 - h, x1, BORDER_Y, z0 + h, x0, BORDER_Y, z0 + h);
    else pos.push(x0 - h, BORDER_Y, z0, x0 + h, BORDER_Y, z0, x0 + h, BORDER_Y, z1, x0 - h, BORDER_Y, z1);
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  };
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const o = owner(x, z);
      if (o < 0) continue;
      const right = owner(x + 1, z);
      const down = owner(x, z + 1);
      if (right >= 0 && right !== o) strip(x + 1, z, x + 1, z + 1);
      if (down >= 0 && down !== o) strip(x, z + 1, x + 1, z + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** self = 내 위치 고리 (둘러보기 지도에는 내가 없다) */
export function DistrictOverlay({ self = true }: { self?: boolean } = {}) {
  const { map, input } = useTown();
  const fill = useMemo(() => buildFill(map), [map]);
  const borders = useMemo(() => buildBorders(map), [map]);
  useEffect(() => () => fill.dispose(), [fill]);
  useEffect(() => () => borders.dispose(), [borders]);
  const fillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    [],
  );
  const borderMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tokens.scene.mapBorder, transparent: true, opacity: WALK_BORDER_OPACITY, depthWrite: false }),
    [],
  );
  const fillMesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const b = input.mapBlend;
    fillMat.opacity = 0.62 * b;
    if (fillMesh.current) fillMesh.current.visible = b > 0.01;
    borderMat.opacity = WALK_BORDER_OPACITY + (0.9 - WALK_BORDER_OPACITY) * b;
  });

  return (
    <>
      <mesh ref={fillMesh} geometry={fill} material={fillMat} renderOrder={2} visible={false} />
      <mesh geometry={borders} material={borderMat} renderOrder={3} />
      {self && <SelfMarker />}
    </>
  );
}

/** 전체 지도에서 내 위치: 커지고 작아지는 고리 */
function SelfMarker() {
  const { input } = useTown();
  const ring = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tokens.color.accent, transparent: true, depthWrite: false, fog: false }),
    [],
  );
  useFrame(() => {
    const m = ring.current!;
    const b = input.mapBlend;
    m.visible = b > 0.05;
    if (!m.visible) return;
    const pulse = 1 + 0.18 * Math.sin(now() * 5);
    m.position.set(input.self.x, 0.4, input.self.z);
    m.scale.setScalar(pulse * (0.6 + 0.4 * b));
    material.opacity = b;
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} material={material} renderOrder={4} visible={false}>
      <ringGeometry args={[1.3, 2.1, 40]} />
    </mesh>
  );
}

/** 지역 땅 칸들의 가운데 (지도 이름표 자리). 땅이 없는 지역은 빠진다. */
export function districtCentroids(map: TownMap): Partial<Record<District, { x: number; z: number }>> {
  const sum = DISTRICTS.map(() => ({ x: 0, z: 0, n: 0 }));
  map.districtGrid.forEach((d, i) => {
    if (d < 0) return;
    sum[d].x += (i % map.width) + 0.5;
    sum[d].z += Math.floor(i / map.width) + 0.5;
    sum[d].n++;
  });
  return Object.fromEntries(
    DISTRICTS.flatMap((d, i) => (sum[i].n ? [[d, { x: sum[i].x / sum[i].n, z: sum[i].z / sum[i].n }]] : [])),
  );
}

/** 전체 지도 이름표를 지역 한가운데·중앙광장·내 집 위에 붙인다 (HTML이라 글자가 또렷하다) */
export function MapLabelSync() {
  const { map, input, session, hood } = useTown();
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const pass = session.getSnapshot().pass;
  const anchors = useMemo(() => {
    const out: [string, { x: number; z: number }][] = [
      ['plaza', { x: map.width / 2, z: map.height / 2 }],
      ...Object.entries(districtCentroids(map)),
    ];
    const home = pass?.district && pass.hood === hood ? map.lots[pass.district].find((l) => l.index === pass.lot) : undefined;
    if (home) out.push(['home', lotDoor(home)]);
    return out;
  }, [map, pass, hood]);
  useFrame(() => {
    const b = input.mapBlend;
    for (const [key, p] of anchors) {
      const el = input.labels.get(key);
      if (!el) continue;
      if (b < 0.5) {
        el.style.visibility = 'hidden';
        continue;
      }
      v.set(p.x, 1.2, p.z).project(camera);
      el.style.visibility = 'visible';
      el.style.opacity = String(Math.min(1, (b - 0.5) * 4));
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
    }
  });
  return null;
}
