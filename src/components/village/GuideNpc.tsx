'use client';

// 광장 안내 NPC 몬냥이 (3D). 가까이 오면 그쪽을 보고, 처음 다가오면 손을 흔든다.
// 아직 이야기하지 않았으면 머리 위에 느낌표가 뜬다. 이야기를 시작하면 폴짝 뛴다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { tokens } from '@/design/tokens';
import { CHARACTER_HEIGHT } from '@/shared/character';
import { lerpAngle } from '@/shared/movement';
import { groundHeightAt } from '@/shared/townMap';
import { tagTexture } from './assets';
import { useTown } from './context';
import { NPC_NAME, guideNpcSpot } from './npc';
import { now } from './session';

/** 이 거리(칸) 안이면 내 쪽을 본다 */
const LOOK_REACH = 8;
/** 처음 이 거리 안으로 들어오면 손을 흔든다 */
const WAVE_REACH = 3.4;

type Clip = 'idle' | 'wave' | 'jump';

export function GuideNpc() {
  const { map, assets, input } = useTown();
  const spot = useMemo(() => guideNpcSpot(map), [map]);
  const gltf = assets.npcs.guide;
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
  const tag = useMemo(() => tagTexture(`${NPC_NAME} · 안내`, tokens.color.accent, false, '처음이면 말 걸어 주세요'), []);
  const bang = useRef<THREE.Sprite>(null);
  const st = useRef({ playing: 'idle' as Clip, until: 0, wasNear: false, wasTalking: false, yaw: spot?.yaw ?? 0 });

  useFrame((_, rawDt) => {
    if (!rig || !spot) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const t = now();
    const d = Math.hypot(input.self.x - spot.x, input.self.z - spot.z);
    // 가까이 있으면 나를 본다
    const want = d < LOOK_REACH ? Math.atan2(input.self.x - spot.x, input.self.z - spot.z) : spot.yaw;
    s.yaw = lerpAngle(s.yaw, want, 1 - Math.exp(-dt * 5));
    rig.model.rotation.y = s.yaw;

    let next: Clip | null = null;
    const near = d < WAVE_REACH;
    if (near && !s.wasNear) next = 'wave';
    s.wasNear = near;
    if (input.npc.talking && !s.wasTalking) next = 'jump';
    s.wasTalking = input.npc.talking;
    if (next) s.until = t + (next === 'wave' ? 1.6 : 0.7);
    else if (s.playing !== 'idle' && t > s.until) next = 'idle';
    if (next && next !== s.playing) {
      const a = rig.actions[next].reset().play();
      rig.actions[s.playing].crossFadeTo(a, 0.2, false);
      s.playing = next;
    }
    rig.mixer.update(dt);

    const b = bang.current;
    if (b) {
      b.visible = !input.npc.talked && !input.npc.talking;
      b.position.y = CHARACTER_HEIGHT + 0.72 + Math.abs(Math.sin(t * 3)) * 0.08;
    }
  });

  if (!rig || !spot) return null;
  const y = groundHeightAt(map, spot.x, spot.z);
  return (
    <group position={[spot.x, y, spot.z]}>
      <primitive object={rig.model} />
      <sprite position-y={CHARACTER_HEIGHT + 0.3 + 0.15 * (tag.rel - 1)} scale={[0.3 * tag.rel * tag.aspect, 0.3 * tag.rel, 1]} renderOrder={1000}>
        <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
      </sprite>
      <sprite ref={bang} scale={[0.5, 0.5, 1]} renderOrder={1001}>
        <spriteMaterial map={assets.emotes.wow} depthTest={false} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}
