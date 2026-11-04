'use client';

// 클럽 벽 조명: 벽마다 위쪽에 전구 줄, 가운데에 빛 패널. 지금 흐르는 곡의 박자(clubPulse)에 맞춰
// 전구는 한 박마다 한 칸씩 돌아가며 켜지고(체이스), 패널은 박마다 몇 장씩 번쩍이며 네온 색이 바뀐다.
// 카메라 쪽 벽(반투명해지는 벽)의 조명은 허공에 떠 보이므로 숨긴다 (네온 띠와 같은 기준).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import { groundHeightAt } from '@/shared/townMap';
import { clubPulse, mod } from './club';
import { useTown } from './context';
import { now } from './session';

const S = tokens.scene;
const COLORS = S.clubNeon;
/** 벽 한 칸(폭 2)에 다는 전구 수와 높이, 벽 앞으로 나온 거리 */
const BULBS = 5;
const BULB_Y = 2.48;
const PANEL_Y = 1.45;
const FRONT = 0.27;
/** 곡 정보가 없을 때 넘어가는 빠르기 (초당 박자) */
const IDLE_BPS = 2;

interface Spot {
  /** 벽 가운데 (카메라 쪽인지 볼 때) */
  wx: number;
  wz: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 벽 둘레를 따라 붙인 번호 (체이스 순서) */
  k: number;
}

export function ClubLights() {
  const { map, input } = useTown();
  const walls = useMemo(() => map.props.filter((p) => p.key === 'prop.club.wall'), [map]);
  const { bulbs, panels } = useMemo(() => {
    const c = map.width / 2;
    const cz = map.height / 2;
    // 벽을 홀 둘레 각도 순서로 줄 세워 체이스가 방을 빙 돌게 한다
    const order = [...walls].sort((a, b) => Math.atan2(a.z - cz, a.x - c) - Math.atan2(b.z - cz, b.x - c));
    const bulbs: Spot[] = [];
    const panels: Spot[] = [];
    order.forEach((p, w) => {
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      // 벽의 가로 방향 (정면을 오른쪽으로 90도)
      const rx = Math.cos(p.yaw);
      const rz = -Math.sin(p.yaw);
      const base = groundHeightAt(map, p.x, p.z);
      for (let i = 0; i < BULBS; i++) {
        const t = (i - (BULBS - 1) / 2) * 0.38;
        bulbs.push({ wx: p.x, wz: p.z, x: p.x + fx * FRONT + rx * t, y: base + BULB_Y, z: p.z + fz * FRONT + rz * t, yaw: p.yaw, k: w * BULBS + i });
      }
      // 빛 패널: 흡음 판 둘 자리마다 하나씩 (벽이 통째로 번쩍이는 느낌)
      for (const t of [-0.5, 0.5]) {
        panels.push({ wx: p.x, wz: p.z, x: p.x + fx * (FRONT - 0.02) + rx * t, y: base + PANEL_Y, z: p.z + fz * (FRONT - 0.02) + rz * t, yaw: p.yaw, k: w * 2 + (t > 0 ? 1 : 0) });
      }
    });
    return { bulbs, panels };
  }, [map, walls]);

  const bulbMesh = useRef<THREE.InstancedMesh>(null);
  const panelMesh = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const offColor = useMemo(() => new THREE.Color(S.clubTileOff), []);
  /** 보이는지 (-1 = 아직 안 정함) */
  const shownBulbs = useRef(new Int8Array(0));
  const shownPanels = useRef(new Int8Array(0));
  useEffect(() => {
    shownBulbs.current = new Int8Array(bulbs.length).fill(-1);
    shownPanels.current = new Int8Array(panels.length).fill(-1);
  }, [bulbs, panels]);
  const level = useRef(0);

  useFrame((_, dt) => {
    const yaw = input.camera.yawNow;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const visible = (s: Spot) => (input.view !== 'walk' || (s.wx - input.self.x) * sy + (s.wz - input.self.z) * cy <= 0.4 ? 1 : 0);
    const place = (m: THREE.InstancedMesh | null, list: Spot[], shown: Int8Array, scale: [number, number, number]) => {
      if (!m) return;
      let moved = false;
      list.forEach((s, i) => {
        const v = visible(s);
        if (shown[i] === v) return;
        shown[i] = v;
        o.position.set(s.x, s.y, s.z);
        o.rotation.set(0, s.yaw, 0);
        o.scale.set(scale[0] * v, scale[1] * v, scale[2] * v);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        moved = true;
      });
      if (moved) m.instanceMatrix.needsUpdate = true;
    };
    place(bulbMesh.current, bulbs, shownBulbs.current, [1, 1, 1]);
    place(panelMesh.current, panels, shownPanels.current, [1, 1, 1]);

    // 박자: 곡이 있으면 그 박자, 없으면 정해진 빠르기
    const beat = clubPulse();
    const t = now();
    const step = beat ? beat.step : Math.floor(t * IDLE_BPS);
    const target = beat ? beat.level : 0.5;
    level.current += (target - level.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 18));
    const glow = 0.45 + 0.75 * level.current;

    const bm = bulbMesh.current;
    if (bm) {
      bulbs.forEach((s, i) => {
        // 세 칸마다 하나씩 켜진 채로 한 박에 한 칸씩 돈다
        const on = mod(s.k - step, 3) === 0;
        bm.setColorAt(i, on ? col.set(COLORS[mod(Math.floor(s.k / BULBS) + Math.floor(step / 4), COLORS.length)]).multiplyScalar(glow) : col.copy(offColor).multiplyScalar(1.6));
      });
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    }
    const pm = panelMesh.current;
    if (pm) {
      panels.forEach((s, i) => {
        // 박마다 패널 몇 장이 번쩍인다 (자리마다 다른 차례)
        const on = mod(s.k * 7 + step * 3, 5) < 2;
        pm.setColorAt(i, on ? col.set(COLORS[mod(s.k + step, COLORS.length)]).multiplyScalar(0.45 + 0.9 * level.current) : col.copy(offColor).multiplyScalar(1.3));
      });
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
  });

  if (!walls.length) return null;
  return (
    <>
      <instancedMesh ref={bulbMesh} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={panelMesh} args={[undefined, undefined, panels.length]} frustumCulled={false}>
        <boxGeometry args={[0.7, 1.2, 0.03]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
