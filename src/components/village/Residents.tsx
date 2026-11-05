'use client';

// 동물 주민 NPC (3D): MBTI 마을마다 한두 마리가 집에서 나와 둘레를 들르고 다시 집으로 들어간다 (일과는 src/shared/residents.ts).
// 모델은 그 집 가까이 가야 받고(같은 모습끼리 같이 쓴다), 멀리 있는 주민은 그리지 않는다.
// 가까이 가면 말풍선으로 인사하고, 서 있을 때는 나를 보고 손을 흔든다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { townConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { WALK_TIME_SCALE, characterActions, cloneCharacter } from '@/lib/characterRig';
import { CHARACTER_HEIGHT } from '@/shared/character';
import { lerpAngle } from '@/shared/movement';
import { RESIDENT_WALK_SPEED, residentDef, residentLine, residentPose, type ResidentDef } from '@/shared/residents';
import { groundHeightAt, type ResidentHome } from '@/shared/townMap';
import { loadResident, speechTexture, tagTexture } from './assets';
import { useTown } from './context';
import { serverNowMs } from './plazaBoard';
import { HOUSE_TAG_FORWARD, HOUSE_TAG_Y } from './Props';
import { now } from './session';

/** 이만큼 가까워지면 모델을 받는다 (칸) */
const LOAD_REACH = 24;
/** 집이 이보다 멀면 주민을 그리지 않는다 (움직임도 세지 않는다) */
const DRAW_REACH = 34;
/** 이만큼 가까이 오면 인사한다 */
const GREET_REACH = 3;
/** 서 있을 때 이 거리 안이면 나를 본다 */
const LOOK_REACH = 4;
const SPEECH_SECONDS = 4.5;
/** 말풍선 아래 끝 높이 (두 줄 이름표 위) */
const SPEECH_BOTTOM = CHARACTER_HEIGHT + 0.66;

type Clip = 'idle' | 'walk' | 'wave' | 'think' | 'dance';
const CLIPS: Clip[] = ['idle', 'walk', 'wave', 'think', 'dance'];

export function Residents() {
  const { map } = useTown();
  return (
    <>
      {map.residents.map((home) => {
        const def = residentDef(home.id);
        return def ? <Resident key={home.id} home={home} def={def} /> : null;
      })}
    </>
  );
}

function Resident({ home, def }: { home: ResidentHome; def: ResidentDef }) {
  const { map, input } = useTown();
  const [near, setNear] = useState(false);
  const [gltf, setGltf] = useState<GLTF>();
  useEffect(() => {
    if (!near) return;
    let live = true;
    loadResident(def.key)
      .then((g) => live && setGltf(g))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [near, def.key]);

  const rig = useMemo(() => {
    if (!gltf) return null;
    const model = cloneCharacter(gltf);
    // 문을 드나들 때 흐려지도록 재질을 따로 갖는다
    const materials: THREE.Material[] = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      materials.push(...[m.material].flat());
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = characterActions(gltf, mixer, CLIPS) as Record<Clip, THREE.AnimationAction>;
    // 걸음 빠르기에 맞춘다 (사람 걸음 동작 빠르기는 마을 걷는 속도 기준)
    actions.walk.timeScale = (WALK_TIME_SCALE * RESIDENT_WALK_SPEED) / townConfig.walkSpeed;
    return { model, mixer, actions, materials };
  }, [gltf]);

  const st = useRef({ playing: 'idle' as Clip, waveUntil: 0, speakUntil: 0, wasNear: false, said: 0, yaw: home.yaw, opacity: 1 });
  // 붙을 때마다 서 있기부터 (개발 모드의 붙였다 뗐다에도 멈추지 않게)
  useEffect(() => {
    if (!rig) return;
    rig.actions.idle.reset().play();
    st.current.playing = 'idle';
    st.current.opacity = 1;
    return () => {
      rig.mixer.stopAllAction();
      rig.materials.forEach((m) => m.dispose());
    };
  }, [rig]);

  const tag = useMemo(() => tagTexture(def.name, tokens.district[home.district], false, `${home.district} 마을 주민`), [def, home]);
  const houseTag = useMemo(() => tagTexture(`${def.name}네 집`, tokens.district[home.district]), [def, home]);
  const housePos = useMemo(
    () => [home.x + Math.sin(home.yaw) * HOUSE_TAG_FORWARD, groundHeightAt(map, home.x, home.z) + HOUSE_TAG_Y, home.z + Math.cos(home.yaw) * HOUSE_TAG_FORWARD] as const,
    [map, home],
  );

  const group = useRef<THREE.Group>(null);
  const tagRef = useRef<THREE.Sprite>(null);
  const speechRef = useRef<THREE.Sprite>(null);
  const houseTagRef = useRef<THREE.Sprite>(null);

  useFrame((_, rawDt) => {
    const walkView = input.view === 'walk';
    const dHome = Math.hypot(input.self.x - home.x, input.self.z - home.z);
    if (!near && dHome < LOAD_REACH) setNear(true);
    if (houseTagRef.current) houseTagRef.current.visible = walkView && dHome < townConfig.nameplateDistance;
    const g = group.current;
    if (!rig || !g) return;
    const s = st.current;
    if (dHome > DRAW_REACH) {
      g.visible = false;
      s.wasNear = false;
      return;
    }
    const p = residentPose(map, home, serverNowMs() / 1000);
    g.visible = !p.inside;
    if (p.inside) {
      s.wasNear = false;
      s.speakUntil = 0;
      return;
    }
    const dt = Math.min(rawDt, 0.1);
    const t = now();
    g.position.set(p.x, groundHeightAt(map, p.x, p.z), p.z);
    const dx = input.self.x - p.x;
    const dz = input.self.z - p.z;
    const d = Math.hypot(dx, dz);

    // 가까이 오면 인사: 말풍선 (서 있으면 손도 흔든다)
    const close = walkView && d < GREET_REACH && p.opacity === 1;
    if (close && !s.wasNear) {
      s.said++;
      const speech = speechTexture(residentLine(def, home, p.cycle + s.said));
      const sp = speechRef.current;
      if (sp) {
        sp.material.map = speech.texture;
        sp.material.needsUpdate = true;
        sp.scale.set(speech.height * speech.aspect, speech.height, 1);
        sp.position.y = SPEECH_BOTTOM + speech.height / 2;
      }
      s.speakUntil = t + SPEECH_SECONDS;
      if (!p.walking) s.waveUntil = t + 1.6;
    }
    s.wasNear = close;

    // 걸을 때는 가는 쪽, 서 있을 때 내가 가까우면 나를 본다
    const look = !p.walking && walkView && d < LOOK_REACH;
    const want = look ? Math.atan2(dx, dz) : p.yaw;
    s.yaw = lerpAngle(s.yaw, want, 1 - Math.exp(-dt * (p.walking ? 12 : 5)));
    rig.model.rotation.y = s.yaw;

    const next: Clip = p.walking ? 'walk' : t < s.waveUntil ? 'wave' : look ? 'idle' : p.act;
    if (next !== s.playing) {
      const a = rig.actions[next].reset().play();
      rig.actions[s.playing].crossFadeTo(a, 0.25, false);
      s.playing = next;
    }
    rig.mixer.update(dt);

    // 문을 드나들 때 흐려진다
    if (p.opacity !== s.opacity) {
      const transparent = p.opacity < 1;
      for (const m of rig.materials) {
        m.opacity = p.opacity;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.needsUpdate = true;
        }
      }
      s.opacity = p.opacity;
    }

    if (tagRef.current) tagRef.current.visible = walkView && d < townConfig.nameplateDistance && p.opacity > 0.5;
    if (speechRef.current) speechRef.current.visible = walkView && t < s.speakUntil;
  });

  return (
    <>
      <sprite ref={houseTagRef} position={housePos} scale={[0.34 * houseTag.aspect, 0.34, 1]} renderOrder={900} visible={false}>
        <spriteMaterial map={houseTag.texture} depthTest={false} depthWrite={false} transparent />
      </sprite>
      {rig && (
        <group ref={group} visible={false}>
          <primitive object={rig.model} />
          <sprite ref={tagRef} position-y={CHARACTER_HEIGHT + 0.3 + 0.15 * (tag.rel - 1)} scale={[0.3 * tag.rel * tag.aspect, 0.3 * tag.rel, 1]} renderOrder={1000} visible={false}>
            <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
          </sprite>
          <sprite ref={speechRef} renderOrder={1001} visible={false}>
            <spriteMaterial depthTest={false} depthWrite={false} transparent />
          </sprite>
        </group>
      )}
    </>
  );
}
