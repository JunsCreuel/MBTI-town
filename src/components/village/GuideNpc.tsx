'use client';

// 광장 안내 NPC 몬냥이 (3D). 가까이 오면 그쪽을 보고, 처음 다가오면 손을 흔든다.
// 아직 이야기하지 않았으면 머리 위에 느낌표가 뜬다. 이야기를 시작하면 폴짝 뛴다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { tokens } from '@/design/tokens';
import { CHARACTER_HEIGHT } from '@/shared/character';
import { characterActions, cloneCharacter } from '@/lib/characterRig';
import { lerpAngle } from '@/shared/movement';
import { groundHeightAt } from '@/shared/townMap';
import { loadNpc, tagTexture } from './assets';
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
  // 첫 화면을 그린 뒤에 받는다 (첫 화면 용량을 아낀다)
  const [gltf, setGltf] = useState<GLTF | undefined>(assets.npcs.guide);
  useEffect(() => {
    if (gltf || !spot) return;
    let live = true;
    loadNpc('guide')
      .then((g) => live && setGltf(g))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [gltf, spot]);
  const rig = useMemo(() => {
    if (!gltf) return null;
    const model = cloneCharacter(gltf);
    model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const mixer = new THREE.AnimationMixer(model);
    const actions = characterActions(gltf, mixer, ['idle', 'wave', 'jump']) as Record<Clip, THREE.AnimationAction>;
    return { model, mixer, actions };
  }, [gltf]);
  // 붙을 때마다 서 있기부터 (개발 모드의 붙였다 뗐다에도 멈추지 않게)
  useEffect(() => {
    if (!rig) return;
    rig.actions.idle.reset().play();
    st.current.playing = 'idle';
    return () => void rig.mixer.stopAllAction();
  }, [rig]);
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
