'use client';

// 마을의 작은 생명: 낮에는 나비가 꽃 사이를 팔랑이고, 밤에는 반딧불이가 반짝인다.
// 내 캐릭터 둘레에만 두고, 멀어지면 다시 근처로 데려온다 (몇 마리만 그려 가볍다).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tokens } from '@/design/tokens';
import { groundHeightAt, isBlockedAt } from '@/shared/townMap';
import { useTown } from './context';
import { day } from './daylight';
import { now } from './session';

const S = tokens.scene;
const BUTTERFLIES = 14;
const FIREFLIES = 40;
/** 내 캐릭터에서 이만큼 안에 둔다 (칸) */
const AREA = 10;
const BUTTERFLY_COLORS = [S.butterfly, S.flowerYellow, S.flowerPink, S.dawnTop, S.flowerLilac];

interface Flier {
  hx: number;
  hz: number;
  phase: number;
  speed: number;
  color: THREE.Color;
}

function placeNear(map: ReturnType<typeof useTown>['map'], cx: number, cz: number, f: Flier, rand = Math.random) {
  for (let i = 0; i < 8; i++) {
    const x = cx + (rand() - 0.5) * 2 * AREA;
    const z = cz + (rand() - 0.5) * 2 * AREA;
    if (!isBlockedAt(map, x, z)) {
      f.hx = x;
      f.hz = z;
      return;
    }
  }
  f.hx = cx;
  f.hz = cz;
}

/** 날개 한 장: 몸통 쪽이 원점, 바깥으로 둥근 날개 */
function wingGeometry(side: 1 | -1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(side * 0.05, 0.12, side * 0.17, 0.12, side * 0.16, 0.02);
  shape.bezierCurveTo(side * 0.17, -0.06, side * 0.08, -0.1, 0, -0.03);
  const g = new THREE.ShapeGeometry(shape, 6);
  g.rotateX(-Math.PI / 2);
  return g;
}

function Butterflies() {
  const { map, input } = useTown();
  const left = useRef<THREE.InstancedMesh>(null);
  const right = useRef<THREE.InstancedMesh>(null);
  const geos = useMemo(() => [wingGeometry(-1), wingGeometry(1)] as const, []);
  const fliers = useMemo<Flier[]>(
    () =>
      Array.from({ length: BUTTERFLIES }, (_, i) => ({
        hx: input.self.x,
        hz: input.self.z,
        phase: i * 1.7,
        speed: 0.6 + (i % 5) * 0.12,
        color: new THREE.Color(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]),
      })),
    [input],
  );
  const placed = useRef(false);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const l = left.current;
    const r = right.current;
    if (!l || !r) return;
    const visible = day.look.day > 0.3 && input.view === 'walk';
    l.visible = r.visible = visible;
    if (!visible || !input.self.ready) return;
    if (!placed.current) {
      for (const f of fliers) placeNear(map, input.self.x, input.self.z, f);
      placed.current = true;
    }
    const t = now();
    fliers.forEach((f, i) => {
      if (Math.hypot(f.hx - input.self.x, f.hz - input.self.z) > AREA * 1.6) placeNear(map, input.self.x, input.self.z, f);
      const a = t * f.speed + f.phase;
      const x = f.hx + Math.sin(a) * 1.4 + Math.sin(a * 2.3) * 0.4;
      const z = f.hz + Math.cos(a * 0.8) * 1.2;
      const y = groundHeightAt(map, x, z) + 0.6 + Math.sin(a * 3.1) * 0.25;
      const heading = Math.atan2(Math.cos(a) * 1.4, -Math.sin(a * 0.8) * 1.2 * 0.8);
      const flap = Math.sin(t * 16 + f.phase) * 0.9;
      for (const [mesh, side] of [[l, -1], [r, 1]] as const) {
        o.position.set(x, y, z);
        o.rotation.set(0, heading, side * flap, 'YXZ');
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, f.color);
      }
    });
    for (const m of [l, r]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });
  return (
    <>
      {geos.map((g, k) => (
        <instancedMesh key={k} ref={k ? right : left} args={[g, undefined, BUTTERFLIES]} frustumCulled={false}>
          <meshStandardMaterial side={THREE.DoubleSide} roughness={0.7} />
        </instancedMesh>
      ))}
    </>
  );
}

/** 빛 번짐 점 그림 */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Fireflies() {
  const { map, input } = useTown();
  const points = useRef<THREE.Points>(null);
  const { geometry, material, fliers } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FIREFLIES * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.35, map: glowTexture(), color: S.firefly, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const fliers: Flier[] = Array.from({ length: FIREFLIES }, (_, i) => ({ hx: 0, hz: 0, phase: i * 2.1, speed: 0.3 + (i % 7) * 0.05, color: new THREE.Color() }));
    return { geometry, material, fliers };
  }, []);
  const placed = useRef(false);
  useFrame(() => {
    const p = points.current;
    if (!p) return;
    const n = day.look.night;
    p.visible = n > 0.4 && input.view === 'walk';
    if (!p.visible || !input.self.ready) return;
    if (!placed.current) {
      for (const f of fliers) placeNear(map, input.self.x, input.self.z, f);
      placed.current = true;
    }
    const t = now();
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    fliers.forEach((f, i) => {
      if (Math.hypot(f.hx - input.self.x, f.hz - input.self.z) > AREA * 1.6) placeNear(map, input.self.x, input.self.z, f);
      const a = t * f.speed + f.phase;
      const x = f.hx + Math.sin(a) * 0.9;
      const z = f.hz + Math.cos(a * 1.3) * 0.9;
      pos.setXYZ(i, x, groundHeightAt(map, x, z) + 0.5 + Math.sin(a * 2.2) * 0.35, z);
    });
    pos.needsUpdate = true;
    // 깜빡깜빡
    material.opacity = (n - 0.4) * 1.6 * (0.65 + 0.35 * Math.sin(t * 3));
  });
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

export function Ambient() {
  return (
    <>
      <Butterflies />
      <Fireflies />
    </>
  );
}
