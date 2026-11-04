'use client';

// 광장 사주상담소의 부엉 도사 (3D). 첫 화면 용량을 아끼려고 마을을 다 그린 뒤에 따로 받는다.
// 가까이 오면 그쪽을 보고, 처음 다가오면 손(날개)을 흔든다. 상담을 시작하면 폴짝 뛴다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { CHARACTER_HEIGHT } from '@/shared/character';
import { lerpAngle } from '@/shared/movement';
import { groundHeightAt } from '@/shared/townMap';
import { tagTexture } from './assets';
import { useTown } from './context';
import { SAJU_NAME, sajuNpcSpot } from './npc';
import { now } from './session';

const LOOK_REACH = 7;
const WAVE_REACH = 3.2;
type Clip = 'idle' | 'wave' | 'jump';

/** 상담 시작을 알린다 (시트를 열 때 화면이 부른다) */
export const sajuNpcState = { talking: false };

export function SajuNpc() {
  const { map, input } = useTown();
  const spot = useMemo(() => sajuNpcSpot(map), [map]);
  const [gltf, setGltf] = useState<GLTF | null>(null);
  useEffect(() => {
    if (!spot) return;
    let alive = true;
    new GLTFLoader()
      .loadAsync(assetUrl('char.npc.saju'))
      .then((g) => alive && setGltf(g))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [spot]);
  const rig = useMemo(() => {
    if (!gltf) return null;
    const model = SkeletonUtils.clone(gltf.scene);
    model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const mixer = new THREE.AnimationMixer(model);
    const clip = (name: Clip) => mixer.clipAction(gltf.animations.find((a) => a.name === name)!);
    const actions = { idle: clip('idle'), wave: clip('wave'), jump: clip('jump') };
    actions.idle.play();
    return { model, mixer, actions };
  }, [gltf]);
  useEffect(() => () => void rig?.mixer.stopAllAction(), [rig]);
  const tag = useMemo(() => tagTexture(`${SAJU_NAME} · 사주상담소`, tokens.color.goldInk, false), []);
  const st = useRef({ playing: 'idle' as Clip, until: 0, wasNear: false, wasTalking: false, yaw: spot?.yaw ?? 0 });

  useFrame((_, rawDt) => {
    if (!rig || !spot) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const t = now();
    const d = Math.hypot(input.self.x - spot.x, input.self.z - spot.z);
    const want = d < LOOK_REACH ? Math.atan2(input.self.x - spot.x, input.self.z - spot.z) : spot.yaw;
    s.yaw = lerpAngle(s.yaw, want, 1 - Math.exp(-dt * 5));
    rig.model.rotation.y = s.yaw;
    let next: Clip | null = null;
    const near = d < WAVE_REACH;
    if (near && !s.wasNear) next = 'wave';
    s.wasNear = near;
    if (sajuNpcState.talking && !s.wasTalking) next = 'jump';
    s.wasTalking = sajuNpcState.talking;
    if (next) s.until = t + (next === 'wave' ? 1.6 : 0.7);
    else if (s.playing !== 'idle' && t > s.until) next = 'idle';
    if (next && next !== s.playing) {
      const a = rig.actions[next].reset().play();
      rig.actions[s.playing].crossFadeTo(a, 0.2, false);
      s.playing = next;
    }
    rig.mixer.update(dt);
  });

  if (!rig || !spot) return null;
  const y = groundHeightAt(map, spot.x, spot.z);
  return (
    <group position={[spot.x, y, spot.z]}>
      <primitive object={rig.model} />
      <sprite position-y={CHARACTER_HEIGHT + 0.42 + 0.15 * (tag.rel - 1)} scale={[0.3 * tag.rel * tag.aspect, 0.3 * tag.rel, 1]} renderOrder={1000}>
        <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}
