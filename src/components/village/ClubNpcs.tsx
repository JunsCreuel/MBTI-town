'use client';

// 클럽 NPC (3D): DJ 여우비(여우)는 부스 뒤에서 늘 춤추고, 신청곡이 바뀌면 손을 번쩍 든다.
// 바텐더 곰은 바 안쪽에 서서 가까이 오면 나를 보고, 처음 다가오면 손을 흔들고, 술을 내주면 건배한다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { tokens } from '@/design/tokens';
import { CHARACTER_HEIGHT } from '@/shared/character';
import { characterActions, cloneCharacter } from '@/lib/characterRig';
import { lerpAngle } from '@/shared/movement';
import { groundHeightAt } from '@/shared/townMap';
import { tagTexture } from './assets';
import { clubBar, onClubDj } from './club';
import { useTown } from './context';
import { clubNpcSpots, type NpcSpot } from './npc';
import { now } from './session';

type Clip = 'idle' | 'wave' | 'cheer' | 'dance';

export const DJ_NAME = 'DJ 여우비';
export const BARTENDER_NAME = '바텐더 곰돌';

function useRig(gltf: GLTF | undefined, clips: Clip[]) {
  const rig = useMemo(() => {
    if (!gltf) return null;
    const model = cloneCharacter(gltf);
    model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const mixer = new THREE.AnimationMixer(model);
    const actions = characterActions(gltf, mixer, clips) as Record<Clip, THREE.AnimationAction>;
    return { model, mixer, actions };
    // clips는 고정 목록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);
  useEffect(() => () => void rig?.mixer.stopAllAction(), [rig]);
  return rig;
}

function NameTag({ label, sub }: { label: string; sub: string }) {
  const tag = useMemo(() => tagTexture(label, tokens.color.accent, false, sub), [label, sub]);
  return (
    <sprite position-y={CHARACTER_HEIGHT + 0.3 + 0.15 * (tag.rel - 1)} scale={[0.3 * tag.rel * tag.aspect, 0.3 * tag.rel, 1]} renderOrder={1000}>
      <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}

function Dj({ gltf, spot }: { gltf: GLTF; spot: NpcSpot }) {
  const { map } = useTown();
  const rig = useRig(gltf, ['dance', 'cheer']);
  const st = useRef({ playing: 'dance' as Clip, until: 0 });
  useEffect(() => {
    if (!rig) return;
    rig.actions.dance.play();
    // 신청곡이 바뀌면 손을 번쩍
    return onClubDj(() => {
      st.current.until = now() + 1.8;
    });
  }, [rig]);
  useFrame((_, dt) => {
    if (!rig) return;
    const s = st.current;
    const want: Clip = now() < s.until ? 'cheer' : 'dance';
    if (want !== s.playing) {
      const a = rig.actions[want].reset().play();
      rig.actions[s.playing].crossFadeTo(a, 0.2, false);
      s.playing = want;
    }
    rig.model.rotation.y = spot.yaw;
    rig.mixer.update(Math.min(dt, 0.1));
  });
  if (!rig) return null;
  return (
    <group position={[spot.x, groundHeightAt(map, spot.x, spot.z), spot.z]}>
      <primitive object={rig.model} />
      <NameTag label={DJ_NAME} sub="신청곡 받아요" />
    </group>
  );
}

function Bartender({ gltf, spot }: { gltf: GLTF; spot: NpcSpot }) {
  const { map, input } = useTown();
  const rig = useRig(gltf, ['idle', 'wave', 'cheer']);
  const st = useRef({ playing: 'idle' as Clip, until: 0, wasNear: false, served: clubBar.servedAt, yaw: spot.yaw });
  useEffect(() => void rig?.actions.idle.play(), [rig]);
  useFrame((_, rawDt) => {
    if (!rig) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const t = now();
    const d = Math.hypot(input.self.x - spot.x, input.self.z - spot.z);
    // 가까우면 나를 본다 (카운터 너머라 너무 돌지는 않는다)
    const toMe = Math.atan2(input.self.x - spot.x, input.self.z - spot.z);
    const want = d < 7 ? spot.yaw + THREE.MathUtils.clamp(Math.atan2(Math.sin(toMe - spot.yaw), Math.cos(toMe - spot.yaw)), -1, 1) : spot.yaw;
    s.yaw = lerpAngle(s.yaw, want, 1 - Math.exp(-dt * 5));
    rig.model.rotation.y = s.yaw;
    let next: Clip | null = null;
    const near = d < 3.6;
    if (near && !s.wasNear) next = 'wave';
    s.wasNear = near;
    if (clubBar.servedAt !== s.served) {
      s.served = clubBar.servedAt;
      next = 'cheer';
    }
    if (next) s.until = t + (next === 'wave' ? 1.6 : 1.4);
    else if (s.playing !== 'idle' && t > s.until) next = 'idle';
    if (next && next !== s.playing) {
      const a = rig.actions[next].reset().play();
      rig.actions[s.playing].crossFadeTo(a, 0.2, false);
      s.playing = next;
    }
    rig.mixer.update(dt);
  });
  if (!rig) return null;
  return (
    <group position={[spot.x, groundHeightAt(map, spot.x, spot.z), spot.z]}>
      <primitive object={rig.model} />
      <NameTag label={BARTENDER_NAME} sub="한 잔 할래요?" />
    </group>
  );
}

/** 클럽 맵에만 있다 */
export function ClubNpcs() {
  const { map, assets } = useTown();
  const spots = useMemo(() => clubNpcSpots(map), [map]);
  if (!spots || !assets.npcs.dj || !assets.npcs.bartender) return null;
  return (
    <>
      <Dj gltf={assets.npcs.dj} spot={spots.dj} />
      <Bartender gltf={assets.npcs.bartender} spot={spots.bartender} />
    </>
  );
}
