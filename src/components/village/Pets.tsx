'use client';

// 데리고 다니는 펫 (3D): 주인 옆(조금 뒤)을 따라다닌다. 걸을 때는 깡총깡총, 멈추면 주인이 보는 쪽을 같이 본다.
// 주인이 멀리 순간이동(지도 이동)하거나 길이 막혀 처지면 주인 곁으로 옮겨 온다.
// 내 펫과 다른 사람 펫을 똑같이 그린다 (자리는 화면마다 따로 계산한다. 서버는 누가 어떤 펫을 데리고 있는지만 안다).
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { townConfig } from '@/config/game';
import { lerpAngle, moveWithCollision } from '@/shared/movement';
import { petDef } from '@/shared/pets';
import { groundHeightAt, isBlockedAt } from '@/shared/townMap';
import { loadPet } from './assets';
import type { Actor } from './Characters';
import { useTown } from './context';

/** 주인 옆으로, 조금 뒤로 떨어진 자리 (칸). 바로 뒤에 서면 카메라 쪽을 보는 주인 몸에 가린다 */
const BEHIND = 0.4;
const BESIDE = 0.8;
/** 이 거리 안이면 멈춘다 */
const STOP = 0.3;
/** 이보다 멀어지면 주인 곁으로 옮긴다 */
const TELEPORT = 9;
/** 불러올 때 커지며 나타나는 시간 (초) */
const APPEAR = 0.35;

export function PetFollower({ owner, petOf }: { owner: RefObject<Actor>; petOf: () => string }) {
  const { map } = useTown();
  const [pet, setPet] = useState('');
  const want = useRef('');
  const [model, setModel] = useState<THREE.Object3D | null>(null);

  // 주인이 펫을 바꾸거나 돌려보내면 따른다 (실시간 상태는 렌더를 부르지 않으므로 매 프레임 본다)
  useFrame(() => {
    const p = petOf() ?? '';
    if (p !== want.current) {
      want.current = p;
      setPet(p);
    }
  });

  useEffect(() => {
    const def = pet ? petDef(pet) : undefined;
    if (!def) {
      setModel(null);
      return;
    }
    let live = true;
    loadPet(def.key)
      .then((src) => {
        if (!live) return;
        const o = src.clone(true);
        o.traverse((c) => void ((c as THREE.Mesh).isMesh && ((c as THREE.Mesh).castShadow = true)));
        setModel(o);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pet]);

  const group = useRef<THREE.Group>(null);
  const st = useRef({ placed: false, x: 0, z: 0, rot: 0, born: 0, stuck: 0, t: 0 });
  useEffect(() => {
    st.current.placed = false;
  }, [model]);

  useFrame((_, rawDt) => {
    const g = group.current;
    const a = owner.current;
    if (!g || !a || !model) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    s.t += dt;
    // 주인 옆 조금 뒤 (막혀 있으면 바로 뒤, 그것도 막혀 있으면 주인 자리)
    const fx = Math.sin(a.rot);
    const fz = Math.cos(a.rot);
    let tx = a.x - fx * BEHIND - fz * BESIDE;
    let tz = a.z - fz * BEHIND + fx * BESIDE;
    if (isBlockedAt(map, tx, tz)) {
      tx = a.x - fx * BEHIND;
      tz = a.z - fz * BEHIND;
      if (isBlockedAt(map, tx, tz)) {
        tx = a.x;
        tz = a.z;
      }
    }
    if (!s.placed || Math.hypot(s.x - a.x, s.z - a.z) > TELEPORT || s.stuck > 1.2) {
      s.x = tx;
      s.z = tz;
      s.rot = a.rot;
      s.stuck = 0;
      if (!s.placed) s.born = s.t;
      s.placed = true;
    }
    const dx = tx - s.x;
    const dz = tz - s.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > STOP) {
      // 멀수록 빨리 (주인보다 조금 더 빨리 따라잡는다)
      const speed = Math.min(townConfig.walkSpeed * 1.3, Math.max(0.9, d * 2.4));
      const step = Math.min(speed * dt, d - STOP * 0.5);
      const p = moveWithCollision(map, s.x, s.z, (dx / d) * step, (dz / d) * step);
      const moved = Math.hypot(p.x - s.x, p.z - s.z);
      // 막혀서 못 가고 처지면 잠시 뒤 주인 곁으로 옮긴다
      s.stuck = moved < step * 0.3 && d > 2 ? s.stuck + dt : 0;
      s.x = p.x;
      s.z = p.z;
      moving = moved > 1e-4;
      if (moving) s.rot = lerpAngle(s.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
    } else {
      s.stuck = 0;
      s.rot = lerpAngle(s.rot, a.rot, 1 - Math.exp(-dt * 4));
    }
    // 걸을 때는 깡총깡총, 쉴 때는 숨쉬기. 불러오면 톡 커지며 나타난다
    const hop = moving ? Math.abs(Math.sin(s.t * 13)) * 0.07 : 0;
    const age = (s.t - s.born) / APPEAR;
    const grow = age >= 1 ? 1 : 1 - (1 - age) ** 3 + Math.sin(age * Math.PI) * 0.15;
    g.position.set(s.x, groundHeightAt(map, s.x, s.z) + hop, s.z);
    g.rotation.y = s.rot;
    g.scale.setScalar(grow * (moving ? 1 : 1 + Math.sin(s.t * 2.4) * 0.015));
  });

  if (!model) return null;
  return (
    <group ref={group} scale={0}>
      <primitive object={model} />
    </group>
  );
}
