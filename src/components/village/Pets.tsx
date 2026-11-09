'use client';

// 데리고 다니는 펫 (3D): 주인 옆(조금 뒤)을 따라다닌다. 걸을 때는 다리로 걷고(빠르기에 맞춰), 멈추면 주인이 보는 쪽을 같이 본다.
// 주인이 멀리 순간이동(지도 이동)하거나 길이 막혀 처지면 주인 곁으로 옮겨 온다.
// 내 펫과 다른 사람 펫을 똑같이 그린다 (자리는 화면마다 따로 계산한다. 서버는 누가 어떤 펫을 데리고 있는지만 안다).
import { call } from '@/lib/api';
import { localDate } from '@/shared/debate';
import { miniToast } from '../app/miniToast';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { petCareConfig, townConfig } from '@/config/game';
import { petInstance } from '@/lib/characterRig';
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
  const [inst, setInst] = useState<ReturnType<typeof petInstance> | null>(null);

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
      setInst(null);
      return;
    }
    let live = true;
    loadPet(def.key)
      .then((gltf) => live && setInst(petInstance(gltf, def.height)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pet]);

  const group = useRef<THREE.Group>(null);
  const st = useRef({ placed: false, x: 0, z: 0, rot: 0, born: 0, stuck: 0, t: 0, speed: 0 });
  useEffect(() => {
    st.current.placed = false;
    if (!inst) return;
    inst.restart();
    return () => inst.stop();
  }, [inst]);

  useFrame((_, rawDt) => {
    const g = group.current;
    const a = owner.current;
    if (!g || !a || !inst) return;
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
    let moved = 0;
    if (d > STOP) {
      // 멀수록 빨리 (주인보다 조금 더 빨리 따라잡는다)
      const speed = Math.min(townConfig.walkSpeed * 1.3, Math.max(0.9, d * 2.4));
      const step = Math.min(speed * dt, d - STOP * 0.5);
      const p = moveWithCollision(map, s.x, s.z, (dx / d) * step, (dz / d) * step);
      moved = Math.hypot(p.x - s.x, p.z - s.z);
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
    // 다리로 걷는다 (걸음 빠르기를 맞춘다). 뼈대 없는 예전 모델이면 깡총깡총 튄다. 불러오면 톡 커지며 나타난다
    s.speed += ((moving ? moved / Math.max(dt, 1e-3) : 0) - s.speed) * Math.min(1, dt * 10);
    inst.update(dt, s.speed);
    const hop = !inst.animated && moving ? Math.abs(Math.sin(s.t * 13)) * 0.07 : 0;
    const age = (s.t - s.born) / APPEAR;
    const grow = age >= 1 ? 1 : 1 - (1 - age) ** 3 + Math.sin(age * Math.PI) * 0.15;
    g.position.set(s.x, groundHeightAt(map, s.x, s.z) + hop, s.z);
    g.rotation.y = s.rot;
    g.scale.setScalar(grow);
  });

  if (!inst) return null;
  return (
    <group ref={group} scale={0}>
      <primitive object={inst.model} />
    </group>
  );
}

/**
 * 강아지와 산책 (내 펫만): 펫을 데리고 petCareConfig.walkTiles칸 넘게 걸으면 하루 한 번 친밀도가 오른다.
 * 오늘 이미 했으면 다시 묻지 않는다 (이 기기에 날짜를 적어 둔다, 서버도 하루 한 번만 올린다)
 */
export function PetWalkTracker({ owner, petOf }: { owner: RefObject<Actor>; petOf: () => string }) {
  const st = useRef({ last: null as { x: number; z: number } | null, dist: 0, sent: false });
  useFrame(() => {
    const s = st.current;
    const a = owner.current;
    if (s.sent || !a) return;
    if (!petOf()) {
      s.last = null;
      return;
    }
    if (s.last) {
      const d = Math.hypot(a.x - s.last.x, a.z - s.last.z);
      // 순간 이동(동네 옮기기 등)은 세지 않는다
      if (d < 2) s.dist += d;
    }
    s.last = { x: a.x, z: a.z };
    if (s.dist < petCareConfig.walkTiles) return;
    s.sent = true;
    const today = localDate(new Date());
    try {
      if (window.localStorage.getItem(WALK_KEY) === today) return;
    } catch {}
    call<{ gained: number; levelUp: boolean }>('POST', '/api/pet', { action: 'walk' })
      .then((r) => {
        try {
          window.localStorage.setItem(WALK_KEY, today);
        } catch {}
        if (r.gained) miniToast(r.levelUp ? `산책 덕분에 더 친해졌어요! (친밀도 +${r.gained})` : `즐거운 산책! 친밀도 +${r.gained}`);
      })
      .catch(() => {});
  });
  return null;
}

const WALK_KEY = 'mt_pet_walk';
