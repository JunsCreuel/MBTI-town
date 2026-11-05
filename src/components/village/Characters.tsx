'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { townConfig } from '@/config/game';
import { shiftLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { isAvatarBody, profileTag, type AccessoryId, type AvatarBody, type AvatarColor } from '@/shared/avatar';
import { CHARACTER_HEIGHT, HAND_SOCKET, faceFor, type ClipName } from '@/shared/character';
import { attachAccessory, bodyTintOf, characterActions, characterRig, cloneCharacter, faceControl, tintOutfit } from '@/lib/characterRig';
import { gesturePose, hopHeight } from '@/shared/gesture';
import { lerpAngle, moveWithCollision, yawFromVector } from '@/shared/movement';
import { FishingRig } from './FishingRig';
import { PetFollower } from './Pets';
import { drunkLevel } from './drunk';
import type { FishingState } from './context';
import { findPath, type Point } from '@/shared/pathfinding';
import { castTarget, groundHeightAt } from '@/shared/townMap';
import type { EmoteKind } from '@/shared/protocol';
import { loadCharacter, tagTexture } from './assets';
import { useTown } from './context';
import { SELF_GESTURE, now, type TownSession } from './session';

/** 화면에 그릴 캐릭터 상태. 소유 컴포넌트가 매 프레임 고친다. */
export interface Actor {
  x: number;
  y: number;
  z: number;
  rot: number;
  clip: ClipName;
  /** 지금 동작을 시작한 시각 (같은 동작을 다시 하면 처음부터 다시 그린다) */
  clipStart?: number;
  emote: EmoteKind | null;
  emoteStart: number;
  /** 낚시 중이면 찌 자리와 단계 */
  fish?: FishingState | null;
  /** 점프 중이면 0~1 (몸이 솟았다 내려오는 정도를 정한다) */
  hop?: number;
}


/** 오른손에 든 낚싯대: 팔 관절 기준 손 위치와, 팔을 앞으로 들었을 때 앞위로 뻗는 방향 */
const ROD_GRIP = new THREE.Vector3(-0.045, -0.19, 0.04);
const ROD_DIR = new THREE.Vector3(0, -0.342, 0.94).normalize();

const TAG_HEIGHT = 0.3;
const EMOTE_SIZE = 0.62;

/** 캐릭터 모습: 색과 머리 소품, 이름표 */
interface Look {
  name: string;
  /** 캐릭터 몸 (예전 서버가 비워 보내면 남자) */
  body?: AvatarBody | '';
  color: AvatarColor;
  acc: AccessoryId;
  /** 피부색·머리 색 (avatar.ts의 id, 없으면 원래 색) */
  skin?: string;
  hair?: string;
  /** 이름표 둘째 줄 (MBTI) */
  mbti?: string;
}

/** 그림자를 드리운다 (얼굴 그림은 빼고) */
function castShadows(root: THREE.Object3D) {
  root.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
}

/** 몸 모델을 받아 둔 것이 있으면 바로, 없으면 받은 뒤에 그린다 (여자 캐릭터는 처음 쓸 때 받는다) */
function Character(props: { actor: RefObject<Actor>; look: Look; self?: boolean }) {
  const { assets } = useTown();
  const body: AvatarBody = isAvatarBody(props.look.body) ? props.look.body : 'male';
  const [loaded, setLoaded] = useState<Partial<Record<AvatarBody, GLTF>>>(assets.characters);
  const gltf = loaded[body];
  useEffect(() => {
    if (gltf) return;
    let live = true;
    loadCharacter(body)
      .then((g) => live && setLoaded((m) => ({ ...m, [body]: g })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [body, gltf]);
  if (!gltf) return null;
  return <CharacterModel {...props} gltf={gltf} />;
}

function CharacterModel({ actor, look, self = false, gltf }: { actor: RefObject<Actor>; look: Look; self?: boolean; gltf: GLTF }) {
  const { assets } = useTown();
  const color = tokens.avatar[look.color] ?? tokens.avatar.mint;
  const { skin, hair } = look;
  const { model, mixer, actions, rod, face, tinted } = useMemo(() => {
    const model = cloneCharacter(gltf);
    castShadows(model);
    const tinted = tintOutfit(model, color, bodyTintOf({ skin, hair }));
    const face = faceControl(model);
    const acc = assets.accessories[look.acc];
    if (acc) {
      const prop = acc.clone();
      tinted.push(...tintOutfit(prop, shiftLightness(color, -0.18)));
      attachAccessory(model, look.acc, prop);
    }
    const rod = assets.rod.clone();
    rod.visible = false;
    rod.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const grip = characterRig(gltf).rod;
    const hand = model.getObjectByName(HAND_SOCKET);
    if (grip && hand) {
      rod.position.copy(grip.position);
      rod.quaternion.copy(grip.quaternion);
      hand.add(rod);
    } else {
      // 예전 임시 모델: 팔 관절에 단다
      rod.position.copy(ROD_GRIP);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ROD_DIR);
      model.getObjectByName('armR')?.add(rod);
    }
    const mixer = new THREE.AnimationMixer(model);
    const actions = characterActions(gltf, mixer);
    actions.idle.play();
    return { model, mixer, actions, rod, face, tinted };
  }, [assets, gltf, color, look.acc, skin, hair]);

  const sub = profileTag(look.mbti);
  const tag = useMemo(() => tagTexture(self ? `나 · ${look.name}` : look.name, color, self, sub), [look.name, color, self, sub]);
  const group = useRef<THREE.Group>(null);
  const emote = useRef<THREE.Sprite>(null);
  const playing = useRef<ClipName>('idle');
  const playingStart = useRef(0);

  // 붙을 때마다 서 있기부터 (개발 모드는 붙였다 뗐다 다시 붙인다: 떼면서 멈춘 동작을 다시 튼다)
  useEffect(() => {
    actions.idle.reset().play();
    playing.current = 'idle';
    return () => {
      mixer.stopAllAction();
      for (const m of tinted) m.dispose();
      face?.dispose();
    };
  }, [actions, mixer, tinted, face]);

  useFrame((_, dt) => {
    const a = actor.current;
    const g = group.current;
    if (!a || !g) return;
    g.position.set(a.x, a.y + hopHeight(a.hop, townConfig.jumpHeight), a.z);
    model.rotation.y = a.rot;
    // 모르는 동작(새 버전에서 생긴 동작 등)은 서 있는 것으로 그린다
    const clip: ClipName = actions[a.clip] ? a.clip : 'idle';
    const start = a.clipStart ?? 0;
    if (clip !== playing.current || (start !== playingStart.current && clip !== 'idle' && clip !== 'walk')) {
      const next = actions[clip].reset().play();
      if (clip !== playing.current) actions[playing.current].crossFadeTo(next, 0.18, false);
      playing.current = clip;
      playingStart.current = start;
    }
    rod.visible = clip === 'fish';
    // 취했으면 (내 화면에서만) 몸이 휘청인다
    const lean = self ? drunkLevel() : 0;
    model.rotation.z = lean > 0 ? Math.sin(now() * 1.8) * 0.09 * lean : 0;
    mixer.update(Math.min(dt, 0.1));

    const em = emote.current!;
    const t = now() - a.emoteStart;
    const showing = !!a.emote && t < townConfig.emoteDurationMs / 1000;
    // 표정: 이모티콘이 떠 있으면 그 표정, 몸짓 중이면 몸짓 표정
    face?.set(faceFor(showing ? a.emote : null, clip));
    if (showing && a.emote) {
      em.visible = true;
      em.material.map = assets.emotes[a.emote];
      // 톡 튀어나왔다가 살짝 떠 있는 느낌
      const pop = Math.min(1, t / 0.15);
      em.scale.setScalar(EMOTE_SIZE * (0.6 + 0.4 * pop));
      em.position.y = CHARACTER_HEIGHT + TAG_HEIGHT + 0.3 * (tag.rel - 1) + 0.42 + Math.sin(t * 5) * 0.03;
    } else {
      em.visible = false;
    }
  });

  return (
    <>
    <FishingRig actor={actor} rod={rod} />
    <group ref={group}>
      <primitive object={model} />
      <sprite position-y={CHARACTER_HEIGHT + TAG_HEIGHT + 0.15 * (tag.rel - 1)} scale={[0.3 * tag.rel * tag.aspect, 0.3 * tag.rel, 1]} renderOrder={1000}>
        <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
      </sprite>
      <sprite ref={emote} visible={false} renderOrder={1001}>
        <spriteMaterial depthTest={false} depthWrite={false} transparent />
      </sprite>
    </group>
    </>
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
  // 점프는 걸으면서도 한다 (달리다 폴짝). 다른 동작은 걸으면 끝난다
  const pose = gesturePose(g, t, walking, townConfig.jumpMs / 1000);
  a.clip = pose.clip;
  a.clipStart = pose.clipStart;
  a.hop = pose.hop;
  if (pose.stop && g) g.actionUntil = 0;
}

/** 방향 전환은 부드럽게 (초당 회전 비율) */
const TURN_RATE = 12;

/**
 * 내 캐릭터. 실시간 서버를 기다리지 않고 화면이 정한 자리(spawn)에 바로 선다.
 * 서버에 붙으면 움직임을 보내고, 서버가 자리를 바로잡으면(snap) 따른다.
 */
export function LocalPlayer() {
  const { session, map, input, spawn, look } = useTown();
  const actor = useRef<Actor>({
    x: spawn.x, y: groundHeightAt(map, spawn.x, spawn.z), z: spawn.z, rot: 0, clip: 'idle', emote: null, emoteStart: 0,
  });
  const facing = useRef(0);
  const path = useRef<Point[] | null>(null);
  /** 서버에 마지막으로 보낸 상태 (아직 못 보냈으면 처음 자리와 다르게 둬서 붙자마자 한 번 보낸다) */
  const lastSent = useRef({ x: Number.NaN, z: Number.NaN, rot: 0, moving: false, at: 0 });

  useEffect(() => {
    input.self.x = actor.current.x;
    input.self.z = actor.current.z;
    input.self.ready = true;
    return session.onSnap((s) => {
      actor.current.x = s.x;
      actor.current.z = s.z;
      path.current = null;
    });
  }, [session, input]);

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
    // 취했으면 걷는 방향이 좌우로 흔들린다 (클럽 바에서 세 잔부터)
    const sway = drunkLevel();
    const drift = sway > 0 ? (Math.sin(now() * 1.4) * 0.5 + Math.sin(now() * 3.3) * 0.18) * sway : 0;
    if (kx || kz) {
      path.current = null;
      const len = Math.hypot(kx, kz);
      const ux = (kx / len) * Math.cos(drift) - (kz / len) * Math.sin(drift);
      const uz = (kx / len) * Math.sin(drift) + (kz / len) * Math.cos(drift);
      const p = moveWithCollision(map, a.x, a.z, ux * step, uz * step);
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
        const ux = (dx / dist) * Math.cos(drift * 0.6) - (dz / dist) * Math.sin(drift * 0.6);
        const uz = (dx / dist) * Math.sin(drift * 0.6) + (dz / dist) * Math.cos(drift * 0.6);
        const p = moveWithCollision(map, a.x, a.z, ux * step, uz * step);
        a.x = p.x;
        a.z = p.z;
      }
      facing.current = yawFromVector(dx, dz, facing.current);
    }
    const walking = Math.hypot(a.x - before.x, a.z - before.z) > 1e-4;
    // 낚시: 찌를 던질 물 쪽을 본다
    // 걸으면 낚시는 끝난다 (낚시 판은 열려 있어도 다시 던지면 된다)
    if (walking && input.fishing) input.fishing = null;
    const f = input.fishing;
    if (f && !walking) {
      if (a.fish !== f) facing.current = yawFromVector(f.tx - a.x, f.tz - a.z, facing.current);
      a.fish = f;
    } else a.fish = null;
    a.rot = lerpAngle(a.rot, facing.current, 1 - Math.exp(-dt * TURN_RATE));
    a.y += (groundHeightAt(map, a.x, a.z) - a.y) * (1 - Math.exp(-dt * 15));
    applyGesture(a, SELF_GESTURE, session, walking);
    input.self.x = a.x;
    input.self.z = a.z;

    // 바뀐 게 있으면 초당 moveSendHz회 이하로 서버에 보낸다
    const s = lastSent.current;
    const t = performance.now();
    const changed = s.x !== a.x || s.z !== a.z || Math.abs(s.rot - facing.current) > 0.01 || s.moving !== walking;
    if (changed && t - s.at >= 1000 / townConfig.moveSendHz) {
      if (session.sendMove({ x: a.x, z: a.z, rot: facing.current, moving: walking })) {
        Object.assign(s, { x: a.x, z: a.z, rot: facing.current, moving: walking, at: t });
      }
    }
  });

  return (
    <>
      <Character actor={actor} look={look} self />
      <PetFollower owner={actor} petOf={() => session.pet} />
    </>
  );
}

/**
 * 다른 사람. 서버 위치는 0.1초마다 띄엄띄엄(휴대폰 네트워크에서는 몰려서) 도착하므로,
 * 받은 위치를 시각과 함께 쌓아 두고 remoteDelaySec만큼 지난 시점을 두 위치 사이에서 고르게 그린다.
 */
export function RemotePlayer({ id }: { id: string }) {
  const { session, map } = useTown();
  const p = session.player(id);
  const actor = useRef<Actor>({
    x: p?.x ?? 0, y: p ? groundHeightAt(map, p.x, p.z) : 0, z: p?.z ?? 0, rot: p?.rot ?? 0, clip: 'idle', emote: null, emoteStart: 0,
  });
  const samples = useRef<{ t: number; x: number; z: number }[]>(p ? [{ t: now(), x: p.x, z: p.z }] : []);

  useFrame((_, rawDt) => {
    const s = session.player(id);
    if (!s) return;
    const a = actor.current;
    const dt = Math.min(rawDt, 0.1);
    const t = now();
    const buf = samples.current;
    const last = buf[buf.length - 1];
    if (!last || last.x !== s.x || last.z !== s.z) {
      if (last && Math.hypot(s.x - last.x, s.z - last.z) > 4) {
        // 지도 이동 같은 순간이동은 이어 그리지 않는다
        buf.length = 0;
        a.x = s.x;
        a.z = s.z;
      } else if (last && t - last.t > 0.25) {
        // 서 있다가 다시 걸으면, 마지막 자리에서 한 주기 전에 출발한 것으로 친다
        buf.push({ t: t - townConfig.patchRateMs / 1000, x: last.x, z: last.z });
      }
      buf.push({ t, x: s.x, z: s.z });
    }
    const at = t - townConfig.remoteDelaySec;
    while (buf.length > 2 && buf[1].t <= at) buf.shift();
    const bx = a.x;
    const bz = a.z;
    if (buf.length >= 2 && buf[0].t <= at) {
      const [p0, p1] = buf;
      const u = Math.min(1, (at - p0.t) / Math.max(1e-3, p1.t - p0.t));
      a.x = p0.x + (p1.x - p0.x) * u;
      a.z = p0.z + (p1.z - p0.z) * u;
    } else if (buf.length) {
      a.x = buf[0].x;
      a.z = buf[0].z;
    }
    const moved = Math.hypot(a.x - bx, a.z - bz);
    a.rot = lerpAngle(a.rot, s.rot, 1 - Math.exp(-dt * TURN_RATE));
    a.y += (groundHeightAt(map, a.x, a.z) - a.y) * (1 - Math.exp(-dt * 15));
    applyGesture(a, id, session, s.moving || moved > 0.002);
    // 다른 사람의 낚시: 바라보는 쪽 물에 찌를 던진 것으로 그린다 (입질·잡은 것은 보이지 않는다)
    if (a.clip === 'fish') {
      if (!a.fish || a.fish.castAt !== a.clipStart) {
        const target = castTarget(map, a.x, a.z, s.rot);
        a.fish = target ? { castAt: a.clipStart ?? now(), tx: target.x, tz: target.z } : null;
      }
    } else a.fish = null;
  });

  if (!p) return null;
  return (
    <>
      <Character actor={actor} look={p} />
      <PetFollower owner={actor} petOf={() => session.player(id)?.pet ?? ''} />
    </>
  );
}
