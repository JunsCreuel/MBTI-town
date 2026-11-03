'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { townConfig } from '@/config/game';
import { shiftLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { AccessoryId, AvatarColor } from '@/shared/avatar';
import { CHARACTER_CLIPS, CHARACTER_HEIGHT, HEAD_SOCKET, TINT_MATERIAL, type ClipName } from '@/shared/character';
import { lerpAngle, moveWithCollision, yawFromVector } from '@/shared/movement';
import { findPath, type Point } from '@/shared/pathfinding';
import { groundHeightAt } from '@/shared/townMap';
import type { EmoteKind } from '@/shared/protocol';
import { tagTexture } from './assets';
import { useTown } from './context';
import { now, type PlayerView, type TownSession } from './session';

/** 화면에 그릴 캐릭터 상태. 소유 컴포넌트가 매 프레임 고친다. */
export interface Actor {
  x: number;
  y: number;
  z: number;
  rot: number;
  clip: ClipName;
  emote: EmoteKind | null;
  emoteStart: number;
}

const TAG_HEIGHT = 0.3;
const EMOTE_SIZE = 0.62;

/** 캐릭터 모습: 색과 머리 소품, 이름표 */
interface Look {
  name: string;
  color: AvatarColor;
  acc: AccessoryId;
}

/** 캐릭터 색을 입힐 재질만 복제해서 색을 바꾼다. 나머지 재질은 모든 캐릭터가 같이 쓴다. */
function tint(root: THREE.Object3D, color: string) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.name === TINT_MATERIAL) {
      mesh.material = mat.clone();
      (mesh.material as THREE.MeshStandardMaterial).color.set(color);
    }
  });
}

function Character({ actor, look, self = false }: { actor: RefObject<Actor>; look: Look; self?: boolean }) {
  const { assets } = useTown();
  const color = tokens.avatar[look.color] ?? tokens.avatar.mint;
  const { model, mixer, actions } = useMemo(() => {
    const model = SkeletonUtils.clone(assets.character.scene);
    tint(model, color);
    const acc = assets.accessories[look.acc];
    if (acc) {
      const prop = acc.clone();
      tint(prop, shiftLightness(color, -0.18));
      model.getObjectByName(HEAD_SOCKET)?.add(prop);
    }
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      CHARACTER_CLIPS.map((name) => {
        const clip = assets.character.animations.find((a) => a.name === name);
        if (!clip) throw new Error(`캐릭터 모델에 ${name} 애니메이션이 없습니다`);
        return [name, mixer.clipAction(clip)];
      }),
    ) as Record<ClipName, THREE.AnimationAction>;
    actions.idle.play();
    return { model, mixer, actions };
  }, [assets, color, look.acc]);

  const tag = useMemo(() => tagTexture(self ? `나 · ${look.name}` : look.name, color, self), [look.name, color, self]);
  const group = useRef<THREE.Group>(null);
  const emote = useRef<THREE.Sprite>(null);
  const playing = useRef<ClipName>('idle');

  useEffect(
    () => () => {
      mixer.stopAllAction();
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).name === TINT_MATERIAL) (mesh.material as THREE.Material).dispose();
      });
    },
    [mixer, model],
  );

  useFrame((_, dt) => {
    const a = actor.current;
    const g = group.current;
    if (!a || !g) return;
    g.position.set(a.x, a.y, a.z);
    model.rotation.y = a.rot;
    if (a.clip !== playing.current) {
      const next = actions[a.clip].reset().play();
      actions[playing.current].crossFadeTo(next, 0.18, false);
      playing.current = a.clip;
    }
    mixer.update(Math.min(dt, 0.1));

    const em = emote.current!;
    const t = now() - a.emoteStart;
    if (a.emote && t < townConfig.emoteDurationMs / 1000) {
      em.visible = true;
      em.material.map = assets.emotes[a.emote];
      // 톡 튀어나왔다가 살짝 떠 있는 느낌
      const pop = Math.min(1, t / 0.15);
      em.scale.setScalar(EMOTE_SIZE * (0.6 + 0.4 * pop));
      em.position.y = CHARACTER_HEIGHT + TAG_HEIGHT + 0.42 + Math.sin(t * 5) * 0.03;
    } else {
      em.visible = false;
    }
  });

  return (
    <group ref={group}>
      <primitive object={model} />
      <sprite position-y={CHARACTER_HEIGHT + TAG_HEIGHT} scale={[0.3 * tag.aspect, 0.3, 1]} renderOrder={1000}>
        <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
      </sprite>
      <sprite ref={emote} visible={false} renderOrder={1001}>
        <spriteMaterial depthTest={false} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}

/** 몸짓(응원·박수·이모티콘)을 캐릭터 상태에 반영한다 */
function applyGesture(a: Actor, id: string, session: TownSession, walking: boolean) {
  const g = session.gestures.get(id);
  const t = now();
  if (g?.emote && g.emoteStart !== a.emoteStart) {
    a.emote = g.emote;
    a.emoteStart = g.emoteStart;
  }
  const acting = !!g?.action && t < g.actionUntil && !walking;
  a.clip = walking ? 'walk' : acting ? g!.action! : 'idle';
  // 걸으면 동작은 끝난다
  if (walking && g) g.actionUntil = 0;
}

/** 방향 전환은 부드럽게 (초당 회전 비율) */
const TURN_RATE = 12;

/** 내 캐릭터. 서버 상태에 내가 들어오기 전에는 그리지 않는다 */
export function LocalPlayer() {
  const { session, selfId } = useTown();
  const me = session.player(selfId);
  return me ? <LocalPlayerInner me={me} /> : null;
}

function LocalPlayerInner({ me }: { me: PlayerView }) {
  const { session, selfId, map, input } = useTown();
  const actor = useRef<Actor>({
    x: me.x, y: groundHeightAt(map, me.x, me.z), z: me.z, rot: me.rot, clip: 'idle', emote: null, emoteStart: 0,
  });
  const facing = useRef(me.rot);
  const path = useRef<Point[] | null>(null);
  const lastSent = useRef({ x: me.x, z: me.z, rot: me.rot, moving: false, at: 0 });

  useEffect(() => {
    input.self.x = me.x;
    input.self.z = me.z;
    input.self.ready = true;
    return session.onSnap((s) => {
      actor.current.x = s.x;
      actor.current.z = s.z;
      path.current = null;
    });
  }, [session, input, me]);

  useFrame((_, rawDt) => {
    const a = actor.current;
    const dt = Math.min(rawDt, 0.1);
    const step = townConfig.walkSpeed * dt;

    // 방향키 입력은 화면 기준이다 (위쪽 키 = 화면 안쪽). 카메라가 돈 만큼 돌려서 마을 방향으로 바꾼다.
    let sx = 0;
    let sz = 0;
    const k = input.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) sx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) sx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) sz -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) sz += 1;
    const cy = Math.cos(input.camera.yawNow);
    const sy = Math.sin(input.camera.yawNow);
    const kx = cy * sx + sy * sz;
    const kz = -sy * sx + cy * sz;

    if (input.tapTarget) {
      path.current = findPath(map, a, input.tapTarget);
      input.tapTarget = null;
    }

    const before = { x: a.x, z: a.z };
    if (kx || kz) {
      path.current = null;
      const len = Math.hypot(kx, kz);
      const p = moveWithCollision(map, a.x, a.z, (kx / len) * step, (kz / len) * step);
      a.x = p.x;
      a.z = p.z;
      facing.current = yawFromVector(kx, kz, facing.current);
    } else if (path.current?.length) {
      // 경로는 길찾기에서 이미 검사했으므로 그대로 따라간다
      const next = path.current[0];
      const dx = next.x - a.x;
      const dz = next.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        a.x = next.x;
        a.z = next.z;
        path.current.shift();
      } else {
        a.x += (dx / dist) * step;
        a.z += (dz / dist) * step;
      }
      facing.current = yawFromVector(dx, dz, facing.current);
    }
    const walking = Math.hypot(a.x - before.x, a.z - before.z) > 1e-4;
    a.rot = lerpAngle(a.rot, facing.current, 1 - Math.exp(-dt * TURN_RATE));
    a.y += (groundHeightAt(map, a.x, a.z) - a.y) * (1 - Math.exp(-dt * 15));
    applyGesture(a, selfId, session, walking);
    input.self.x = a.x;
    input.self.z = a.z;

    // 바뀐 게 있으면 초당 moveSendHz회 이하로 서버에 보낸다
    const s = lastSent.current;
    const t = performance.now();
    const changed = s.x !== a.x || s.z !== a.z || Math.abs(s.rot - facing.current) > 0.01 || s.moving !== walking;
    if (changed && t - s.at >= 1000 / townConfig.moveSendHz) {
      session.sendMove({ x: a.x, z: a.z, rot: facing.current, moving: walking });
      Object.assign(s, { x: a.x, z: a.z, rot: facing.current, moving: walking, at: t });
    }
  });

  return <Character actor={actor} look={me} self />;
}

export function RemotePlayer({ id }: { id: string }) {
  const { session, map } = useTown();
  const p = session.player(id);
  const actor = useRef<Actor>({
    x: p?.x ?? 0, y: 0, z: p?.z ?? 0, rot: p?.rot ?? 0, clip: 'idle', emote: null, emoteStart: 0,
  });

  useFrame((_, rawDt) => {
    const s = session.player(id);
    if (!s) return;
    const a = actor.current;
    const dt = Math.min(rawDt, 0.1);
    const dx = s.x - a.x;
    const dz = s.z - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 4) {
      a.x = s.x;
      a.z = s.z;
    } else {
      // 서버 위치를 부드럽게 따라간다 (초당 10회 갱신 사이를 메운다)
      const k = 1 - Math.exp(-dt * 12);
      a.x += dx * k;
      a.z += dz * k;
    }
    a.rot = lerpAngle(a.rot, s.rot, 1 - Math.exp(-dt * TURN_RATE));
    a.y += (groundHeightAt(map, a.x, a.z) - a.y) * (1 - Math.exp(-dt * 15));
    applyGesture(a, id, session, s.moving || dist > 0.08);
  });

  if (!p) return null;
  return <Character actor={actor} look={p} />;
}
