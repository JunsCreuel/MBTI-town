'use client';

// 나의 방 3D 장면 (PROJECT_GUIDE.md 6장). 마을의 내 집 문으로 들어온 집 안.
// 보기: 1인칭. 내 눈높이에서 방을 바라보고(내 캐릭터는 그리지 않는다), 화면을 끌면 둘러본다. 앞 벽·현관문·천장이 있고,
//       들어설 때 문이 열리며 걸어 들어온다. 바닥을 누르면 걸어가고, 기능 소품을 누르면 onAction.
// 방 전체 보기(꾸미기·가입 미리보기·보기 전환): 앞 벽과 천장을 걷어 내고 앞쪽 위에서 비스듬히 내려다본다.
//       꾸미기에서는 소품을 눌러 고르고, 끌어서 칸에 맞춰 옮긴다 (놓을 수 있는 자리로만).
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { roomConfig, townConfig } from '@/config/game';
import { shiftLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { profileTag, type Avatar, type AvatarBody } from '@/shared/avatar';
import { useBodyModel } from './useBodyModel';
import { CHARACTER_HEIGHT, LIFT_SEC, PLACE_SEC, faceFor, type ClipName } from '@/shared/character';
import { panelOpen } from '../app/panelState';
import { AdaptiveResolution, ShadowThrottle, usePanelOpen } from '../app/RenderQuality';
import { lowQuality, quality } from '@/lib/quality';
import { attachAccessory, bodyTintOf, brightenFur, characterActions, cloneCharacter, faceControl, petInstance, tintOutfit, withMeshopt } from '@/lib/characterRig';
import { PET_REACTION_SEC, petDef, petReactionPose, type PetPose } from '@/shared/pets';
import { themeOf, type District } from '@/shared/districts';
import {
  blockedCells, canPlace, canStandInRoom, findRoomPath, footprintSize, furnitureDef, itemCenter, moveInRoom,
  type FurnitureAction, type PlacedItem, type Point, type RoomLayout,
} from '@/shared/room';
import type { EmoteKind } from '@/shared/protocol';
import { bubbleTexture, loadEmoteTextures, tagTexture } from '../village/assets';
import { SELF_GESTURE, now as clockNow } from '../village/session';
import type { RoomAssets } from './assets';
import type { HousePresence } from './presence';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '@/assets/manifest';
import { floorTexture, wallTexture } from './textures';

const W = roomConfig.width;
const D = roomConfig.depth;
const H = roomConfig.wallHeight;
const R = tokens.room;
const WALL_T = 0.14;
const deg = THREE.MathUtils.degToRad;

export type RoomMode = 'view' | 'edit';
/** inside: 1인칭으로 방 안을 본다 / overview: 방 전체를 위에서 본다 (꾸미기, 가입 미리보기, 보기 전환) */
export type RoomFraming = 'inside' | 'overview';
type TimeOfDay = 'day' | 'evening' | 'night';

export interface RoomSceneProps {
  assets: RoomAssets;
  layout: RoomLayout;
  district: District;
  /** 내 캐릭터 모습 (내 방이면 주인, 놀러 가면 나) */
  avatar: Avatar;
  /** 내 이름 (다른 사람이 함께 있을 때 머리 위에 보인다) */
  selfName?: string;
  /** 내 이름표 둘째 줄 (MBTI) */
  selfTag?: string;
  /** 같은 방에 있는 사람들 (주인·손님). 없으면 혼자 본다 */
  presence?: HousePresence | null;
  mode: RoomMode;
  /** 기본: 보기는 inside, 꾸미기는 overview */
  framing?: RoomFraming;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** 꾸미기에서 소품을 옮겼을 때 (놓을 수 있는 자리일 때만 부른다) */
  onMove?: (item: PlacedItem) => void;
  onAction?: (action: FurnitureAction, item: PlacedItem) => void;
  /** BGM이 나오는 중이면 턴테이블 위에 음표가 뜬다 */
  playing?: boolean;
  /** 오늘의 편지를 아직 안 읽었으면 우편함 위에 편지가 뜬다 */
  mailUnread?: boolean;
  photoUrl?: (id: string) => string;
  /** 방 강아지 이름 (방 주인이 지어 준 이름, 없으면 '강아지') */
  petName?: string;
  /** 강아지를 눌렀을 때 (방 주인 화면은 이름 짓기를 띄운다). 누르면 쓰다듬으러 간다 */
  onPetTap?: () => void;
  /** 쓰다듬기 버튼을 누른 횟수: 바뀔 때마다 내 캐릭터가 강아지 곁으로 걸어가 쓰다듬는다 */
  petCall?: number;
  /** 집 주인이 꾸미기를 끝냈다 (저장·취소). 손님 화면은 저장된 방을 다시 받는다 */
  onLayoutStale?: () => void;
  /** 화면 위아래를 가리는 HUD 높이 (px). 방이 그 사이에 들어오게 맞춘다. */
  insetTop?: number;
  insetBottom?: number;
  onReady?: () => void;
}

function timeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 19 || h < 6) return 'night';
  if (h >= 17) return 'evening';
  return 'day';
}

// ───────────────────────── 카메라 ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/**
 * 1인칭 보기 상태 (장면 안에서 같이 쓴다). yaw = 바라보는 방향 (0 = +z, π = 방 안쪽), pitch = 위아래 (음수 = 내려다봄).
 * enter = 들어서기 진행 (0 = 문 밖, 1 = 내 자리), shut = 다 들어온 뒤 현관문 닫힘 진행 (0~1), door = 현관문 열림 (0~1)
 */
export interface FirstPersonView {
  yaw: number;
  pitch: number;
  enter: number;
  shut: number;
  door: number;
  /** 화면을 끌어 둘러보는 중 (걷는 쪽으로 따라 돌지 않는다) */
  looking: boolean;
  /** 쪼그려 앉기 (0 = 선 눈높이, 1 = 앉은 눈높이): crouch는 바라는 값, crouchNow는 지금 값 */
  crouch: number;
  crouchNow: number;
  /** 이쪽으로 천천히 고개를 돌린다 (쓰다듬을 강아지 쪽). 화면을 끌면 그만둔다 */
  aim: { yaw: number; pitch: number } | null;
}

/** 내 캐릭터가 지금 어느 쪽으로 걷는지 (1인칭 카메라가 길 따라 걸을 때 그쪽으로 돈다) */
interface Heading {
  facing: number;
  /** 바닥을 눌러 길을 따라 걷는 중 */
  pathWalking: boolean;
}

/**
 * 방 전체 보기: 화면 크기와 HUD에 맞춘 카메라 자리. 내려다보는 각도와, 방 상자 전체가 HUD 사이에 들어오는 거리.
 * 화면 중심은 HUD 사이 가운데로 옮겨 둔다 (setViewOffset).
 */
function frameFor(width: number, height: number, availH: number) {
  const tanV = Math.tan(deg(roomConfig.fovDeg) / 2);
  const tanH = tanV * (width / height);
  // HUD 사이에서 위아래로 보이는 범위
  const tanAvail = tanV * (availH / height);
  const pitch = deg(roomConfig.overviewPitchDeg);
  const center = new THREE.Vector3(W / 2, H * 0.3, D / 2);
  const probe = new THREE.PerspectiveCamera();
  const corner = new THREE.Vector3();
  const pad = roomConfig.framePadding;
  let dist = 4;
  for (; dist < 80; dist += 0.1) {
    probe.position.set(center.x, center.y + Math.sin(pitch) * dist, center.z + Math.cos(pitch) * dist);
    probe.lookAt(center);
    probe.updateMatrixWorld();
    let ok = true;
    for (const x of [0, W]) for (const y of [0, H]) for (const z of [0, D]) {
      corner.set(x, y, z).applyMatrix4(probe.matrixWorldInverse);
      const depth = -corner.z;
      if (depth <= 0 || Math.abs(corner.x) * pad > tanH * depth || Math.abs(corner.y) * pad > tanAvail * depth) ok = false;
    }
    if (ok) break;
  }
  return { pitch, dist, center };
}

/** 1인칭 세로 시야각: 가로 시야각을 맞추되 50도~상한 (휴대폰 세로 화면은 상한에 걸린다) */
function firstPersonFov(width: number, height: number) {
  const v = 2 * Math.atan(Math.tan(deg(roomConfig.firstPersonHFovDeg) / 2) / (width / height));
  return clamp(THREE.MathUtils.radToDeg(v), 50, roomConfig.firstPersonMaxVFovDeg);
}

/** 벽에서 이만큼 안쪽까지만 카메라가 간다 (칸) */
const EYE_MARGIN = 0.15;

/**
 * 보기(1인칭): 내 캐릭터 눈높이에서 바라본다. 화면을 끌면 둘러보고, 바닥을 눌러 걸으면 걷는 쪽으로 천천히 돈다.
 * 처음 들어설 때는 현관문 밖에서 문이 열리고 방 안 내 자리까지 걸어 들어온다.
 * 방 전체 보기(꾸미기·미리보기): 방 상자 전체가 HUD 사이에 들어오게 앞쪽 위에서 내려다본다.
 */
function CameraRig({
  framing, insetTop = 0, insetBottom = 0, focus, view, heading,
}: {
  framing: RoomFraming;
  insetTop?: number;
  insetBottom?: number;
  focus: React.RefObject<Point>;
  view: React.RefObject<FirstPersonView>;
  heading: React.RefObject<Heading>;
}) {
  const { camera, size, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const firstPerson = framing === 'inside';
  const availH = Math.max(160, size.height - insetTop - insetBottom);
  const frame = useMemo(() => frameFor(size.width, size.height, availH), [size.width, size.height, availH]);
  // 움직임 줄이기를 켠 사람에게는 다가오는 연출을 하지 않는다
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const over = useRef({ look: new THREE.Vector3(W / 2, 0.6, D / 2), enter: reduced ? 1 : 0 });
  const eye = useRef(new THREE.Vector3());
  const seat = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  // 시야각과 화면 중심 (HUD 사이 가운데)
  useEffect(() => {
    cam.fov = firstPerson ? firstPersonFov(size.width, size.height) : roomConfig.fovDeg;
    cam.near = firstPerson ? 0.05 : 0.1;
    cam.far = 200;
    cam.setViewOffset(size.width, size.height, 0, (insetBottom - insetTop) / 2, size.width, size.height);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
    };
  }, [cam, size.width, size.height, insetTop, insetBottom, firstPerson]);

  // 방 전체 보기로 바꿀 때마다 다가오는 연출을 다시 한다 (지금 카메라 자리에서 출발)
  useEffect(() => {
    if (firstPerson) return;
    over.current.enter = reduced ? 1 : 0;
  }, [firstPerson, reduced]);
  useEffect(() => {
    if (reduced) {
      view.current.enter = 1;
      view.current.shut = 1;
    }
  }, [reduced, view]);

  // 1인칭: 화면을 끌어 둘러본다 (손가락 하나·마우스). 누르기와 구별하려고 조금 움직인 뒤부터 돈다
  useEffect(() => {
    if (!firstPerson) return;
    const el = gl.domElement;
    let active: { id: number; x: number; y: number; moved: boolean } | null = null;
    const v = view.current;
    const onDown = (e: PointerEvent) => {
      if (active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      active = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const dx = e.clientX - active.x;
      const dy = e.clientY - active.y;
      if (!active.moved && Math.hypot(dx, dy) < 6) return;
      active.moved = true;
      v.looking = true;
      v.yaw -= dx * roomConfig.lookPerPx;
      v.pitch = clamp(v.pitch - dy * roomConfig.lookPerPx * 0.8, deg(-55), deg(25));
      active.x = e.clientX;
      active.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (active?.id !== e.pointerId) return;
      active = null;
      v.looking = false;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      v.looking = false;
    };
  }, [firstPerson, gl, view]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const f = focus.current;
    if (firstPerson) {
      const v = view.current;
      // 들어서기: 문이 열리고(처음 35%) 문 밖에서 내 자리까지 걸어 들어온 뒤, 등 뒤에서 문이 닫힌다
      v.enter = Math.min(1, v.enter + dt / roomConfig.doorEnterSec);
      if (v.enter >= 1) v.shut = Math.min(1, v.shut + dt / roomConfig.doorShutSec);
      v.door = smooth(0, 0.35, v.enter) * (1 - smooth(0, 1, v.shut));
      const walkIn = smooth(0.25, 1, v.enter);
      // 쓰다듬으러 가면 강아지 쪽으로 고개를 돌리고, 쪼그려 앉으면 눈높이가 내려간다
      if (v.looking) v.aim = null;
      if (v.aim) {
        const k = 1 - Math.exp(-dt * 4);
        const dyaw = Math.atan2(Math.sin(v.aim.yaw - v.yaw), Math.cos(v.aim.yaw - v.yaw));
        v.yaw += dyaw * k;
        v.pitch += (v.aim.pitch - v.pitch) * k;
        if (Math.abs(dyaw) < 0.01 && Math.abs(v.aim.pitch - v.pitch) < 0.01) v.aim = null;
      }
      v.crouchNow += (v.crouch - v.crouchNow) * (1 - Math.exp(-dt * 5));
      const eyeY = roomConfig.eyeHeight - v.crouchNow * (roomConfig.eyeHeight - roomConfig.crouchEyeHeight);
      // 내 자리에서 바라보는 반대쪽으로 조금 뺀 자리 (방이 더 넓게 담긴다, 벽 안쪽까지만)
      const back = roomConfig.eyeBack;
      seat.current.set(
        clamp(f.x - Math.sin(v.yaw) * back, EYE_MARGIN, W - EYE_MARGIN),
        eyeY,
        clamp(f.z - Math.cos(v.yaw) * back, EYE_MARGIN, D - EYE_MARGIN),
      );
      const e = eye.current;
      e.set(W / 2, roomConfig.eyeHeight, D + DOOR_OUTSIDE).lerp(seat.current, walkIn);
      // 바닥을 눌러 걸어가면 걷는 쪽으로 천천히 돈다 (둘러보는 중이면 그대로)
      const h = heading.current;
      if (v.enter >= 1 && h.pathWalking && !v.looking) v.yaw = lerpAngle(v.yaw, h.facing, 1 - Math.exp(-dt * 3));
      const cp = Math.cos(v.pitch);
      dir.current.set(Math.sin(v.yaw) * cp, Math.sin(v.pitch), Math.cos(v.yaw) * cp);
      cam.position.copy(e);
      cam.up.copy(UP);
      cam.lookAt(e.x + dir.current.x, e.y + dir.current.y, e.z + dir.current.z);
      return;
    }
    // 방 전체 보기: 열려 있던 현관문은 닫고, 조금 멀고 높은 곳에서 방 가운데로 다가온다
    const v = view.current;
    if (v.door > 0) v.door = Math.max(0, v.door - dt / roomConfig.doorShutSec);
    const st = over.current;
    st.enter = Math.min(1, st.enter + dt / roomConfig.enterSec);
    const away = Math.pow(1 - st.enter, 3);
    const d = frame.dist * (1 + 0.4 * away);
    const pitch = frame.pitch + deg(12) * away;
    st.look.copy(frame.center);
    cam.position.set(st.look.x, st.look.y + Math.sin(pitch) * d, st.look.z + Math.cos(pitch) * d);
    cam.up.copy(UP);
    cam.lookAt(st.look);
  });
  return null;
}

function Lights({ time }: { time: TimeOfDay }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sun.current!;
    l.target.position.set(W / 2, 0, D / 2);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -7;
    cam.right = 7;
    cam.top = 7;
    cam.bottom = -7;
    cam.near = 1;
    cam.far = 40;
    cam.updateProjectionMatrix();
  }, []);
  const k = time === 'night' ? 0.45 : time === 'evening' ? 0.8 : 1;
  const sunColor = time === 'night' ? R.night : time === 'evening' ? R.evening : R.sun;
  // 가벼운 모드(휴대폰)는 그림자 해상도를 낮춘다
  const mapSize = quality().shadowMapSize;
  return (
    <>
      <hemisphereLight args={[R.hemiSky, R.hemiGround, 1.7 * k]} />
      <directionalLight
        ref={sun}
        position={[W / 2 + 5, 9, D / 2 + 7]}
        color={sunColor}
        intensity={1.9 * k}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  );
}

// ───────────────────────── 바닥과 벽 ─────────────────────────

/** 현관문 (앞 벽 가운데): 폭·높이 (칸). 1인칭으로 들어설 때 문 밖 이만큼에서 출발한다 */
/** 현관문 너비·높이 (m, 실제 문 크기) */
const DOOR_W = 1.0;
const DOOR_H = 2.05;
const DOOR_OUTSIDE = 1.4;

/** 벽지를 칠한 벽 한 조각 (안쪽 면). 벽지 무늬가 칸 크기에 맞게 반복된다 */
function WallPanel({ wallpaper, w, h, position, rotationY = 0 }: { wallpaper: RoomLayout['wallpaper']; w: number; h: number; position: [number, number, number]; rotationY?: number }) {
  const map = useMemo(() => {
    const t = wallTexture(wallpaper).clone();
    t.repeat.set(w, h);
    t.needsUpdate = true;
    return t;
  }, [wallpaper, w, h]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh position={position} rotation-y={rotationY} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} roughness={0.95} />
    </mesh>
  );
}

/**
 * 1인칭에서만: 앞 벽(가운데 현관문), 천장, 문 밖 마당. 방 전체 보기에서는 걷어 내 방 안을 들여다본다.
 * 현관문은 들어설 때 안쪽으로 열렸다가 다 들어오면 닫힌다 (view.door).
 */
function FrontAndCeiling({ layout, view }: { layout: RoomLayout; view: React.RefObject<FirstPersonView> }) {
  const door = useRef<THREE.Group>(null);
  useFrame(() => {
    if (door.current) door.current.rotation.y = view.current.door * deg(100);
  });
  const side = (W - DOOR_W) / 2;
  const wallEdge = shiftLightness(R.wall[layout.wallpaper], -0.06);
  const ceiling = shiftLightness(R.wall[layout.wallpaper], 0.04);
  return (
    <group>
      {/* 앞 벽 안쪽 면 (z = D, 방 안을 본다): 문 왼쪽·오른쪽·위 */}
      <WallPanel wallpaper={layout.wallpaper} w={side} h={H} position={[side / 2, H / 2, D - 0.006]} rotationY={Math.PI} />
      <WallPanel wallpaper={layout.wallpaper} w={side} h={H} position={[W - side / 2, H / 2, D - 0.006]} rotationY={Math.PI} />
      <WallPanel wallpaper={layout.wallpaper} w={DOOR_W} h={H - DOOR_H} position={[W / 2, (H + DOOR_H) / 2, D - 0.006]} rotationY={Math.PI} />
      {/* 앞 벽 두께와 바깥 면 */}
      <mesh position={[side / 2, H / 2, D + WALL_T / 2]}>
        <boxGeometry args={[side + WALL_T * 2, H, WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      <mesh position={[W - side / 2, H / 2, D + WALL_T / 2]}>
        <boxGeometry args={[side + WALL_T * 2, H, WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      <mesh position={[W / 2, (H + DOOR_H) / 2, D + WALL_T / 2]}>
        <boxGeometry args={[DOOR_W, H - DOOR_H, WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      {/* 문틀 */}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[W / 2 + k * (DOOR_W / 2 + 0.03), DOOR_H / 2, D + WALL_T / 2]}>
          <boxGeometry args={[0.06, DOOR_H, WALL_T + 0.04]} />
          <meshStandardMaterial color={R.trim} />
        </mesh>
      ))}
      <mesh position={[W / 2, DOOR_H + 0.03, D + WALL_T / 2]}>
        <boxGeometry args={[DOOR_W + 0.12, 0.06, WALL_T + 0.04]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      {/* 현관문: 왼쪽 경첩에서 안쪽으로 열린다 */}
      <group ref={door} position={[W / 2 - DOOR_W / 2, 0, D + 0.02]}>
        <mesh position={[DOOR_W / 2, DOOR_H / 2, 0]} castShadow>
          <boxGeometry args={[DOOR_W - 0.02, DOOR_H - 0.02, 0.05]} />
          <meshStandardMaterial color={R.door} roughness={0.7} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[DOOR_W - 0.14, 1.0, k * 0.04]}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshStandardMaterial color={R.doorKnob} metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* 천장 */}
      <mesh position={[W / 2, H, D / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={ceiling} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* 문 밖: 마당과 햇빛 (들어서기 전에 서 있는 곳, 문 너머로 보인다) */}
      <mesh position={[W / 2, -0.005, D + 2.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W + 6, 5]} />
        <meshStandardMaterial color={tokens.scene.grass} roughness={1} />
      </mesh>
      <mesh position={[W / 2, 0.002, D + 1.2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[DOOR_W + 0.2, 2.4]} />
        <meshStandardMaterial color={tokens.scene.path} roughness={1} />
      </mesh>
      <mesh position={[W / 2, H / 2, D + 4.5]} rotation-y={Math.PI}>
        <planeGeometry args={[W + 10, H + 6]} />
        <meshBasicMaterial color={tokens.scene.skyHorizon} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Shell({ layout, onFloorClick }: { layout: RoomLayout; onFloorClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const floorMap = useMemo(() => {
    const t = floorTexture(layout.floor).clone();
    t.repeat.set(W, D);
    t.needsUpdate = true;
    return t;
  }, [layout.floor]);
  const backMap = useMemo(() => {
    const t = wallTexture(layout.wallpaper).clone();
    t.repeat.set(W, H);
    t.needsUpdate = true;
    return t;
  }, [layout.wallpaper]);
  const leftMap = useMemo(() => {
    const t = wallTexture(layout.wallpaper).clone();
    t.repeat.set(D, H);
    t.needsUpdate = true;
    return t;
  }, [layout.wallpaper]);
  useEffect(() => () => floorMap.dispose(), [floorMap]);
  useEffect(() => () => backMap.dispose(), [backMap]);
  useEffect(() => () => leftMap.dispose(), [leftMap]);
  const front = shiftLightness(R.floor[layout.floor], -0.22);
  const floorEdge = shiftLightness(R.floor[layout.floor], -0.12);
  const wallEdge = shiftLightness(R.wall[layout.wallpaper], -0.06);

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation-x={-Math.PI / 2} position={[W / 2, 0, D / 2]} receiveShadow onClick={onFloorClick}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorMap} roughness={0.85} />
      </mesh>
      {/* 바닥 판 (윗면을 바닥 그림보다 살짝 낮춰 두 면이 깜빡이며 겹치지 않게) */}
      <mesh position={[W / 2, -0.1, D / 2 - WALL_T / 2]} receiveShadow>
        <boxGeometry args={[W + WALL_T * 2, 0.18, D + WALL_T]} />
        <meshStandardMaterial color={floorEdge} roughness={0.9} />
      </mesh>
      {/* 뒤 벽 (z = 0) */}
      <mesh position={[W / 2, H / 2, 0.006]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={backMap} roughness={0.95} />
      </mesh>
      <mesh position={[W / 2, H / 2, -WALL_T / 2 - 0.002]} castShadow>
        <boxGeometry args={[W + WALL_T * 2, H, WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      {/* 왼쪽 벽 (x = 0) */}
      <mesh position={[0.006, H / 2, D / 2]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={leftMap} roughness={0.95} />
      </mesh>
      <mesh position={[-WALL_T / 2 - 0.002, H / 2, D / 2 - WALL_T / 2]} castShadow>
        <boxGeometry args={[WALL_T, H, D + WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      {/* 오른쪽 벽 (x = W). 소품은 걸지 않고, 앞에서 들여다볼 때 방을 감싼다 */}
      <mesh position={[W - 0.006, H / 2, D / 2]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial map={leftMap} roughness={0.95} />
      </mesh>
      <mesh position={[W + WALL_T / 2 + 0.002, H / 2, D / 2 - WALL_T / 2]} castShadow>
        <boxGeometry args={[WALL_T, H, D + WALL_T]} />
        <meshStandardMaterial color={wallEdge} roughness={0.95} />
      </mesh>
      <mesh position={[W + WALL_T / 2, H + 0.02, D / 2 - WALL_T / 2]}>
        <boxGeometry args={[WALL_T + 0.02, 0.04, D + WALL_T]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      <mesh position={[W - 0.015, 0.06, D / 2]} receiveShadow>
        <boxGeometry args={[0.03, 0.12, D]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      {/* 앞쪽 문턱: 방 바닥이 끝나는 곳 (앞 벽은 없다) */}
      <mesh position={[W / 2, -0.1, D + 0.04]}>
        <boxGeometry args={[W + WALL_T * 2, 0.2, 0.08]} />
        <meshStandardMaterial color={front} roughness={0.9} />
      </mesh>
      {/* 벽 윗면과 걸레받이 */}
      <mesh position={[W / 2, H + 0.02, -WALL_T / 2]}>
        <boxGeometry args={[W + WALL_T * 2, 0.04, WALL_T + 0.02]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      <mesh position={[-WALL_T / 2, H + 0.02, D / 2 - WALL_T / 2]}>
        <boxGeometry args={[WALL_T + 0.02, 0.04, D + WALL_T]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      <mesh position={[W / 2, 0.06, 0.015]} receiveShadow>
        <boxGeometry args={[W, 0.12, 0.03]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
      <mesh position={[0.015, 0.06, D / 2]} receiveShadow>
        <boxGeometry args={[0.03, 0.12, D]} />
        <meshStandardMaterial color={R.trim} />
      </mesh>
    </group>
  );
}

// ───────────────────────── 소품 ─────────────────────────

const noteTexture = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = R.note;
    ctx.font = `700 96px ${tokens.font.base}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', 64, 70);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

/** 새 편지: 우편함 위에서 편지 말풍선이 통통 뛴다 */
function MailFlag() {
  const sprite = useRef<THREE.Sprite>(null);
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    bubbleTexture('ui.icon.mail', tokens.color.accent).then((t) => alive && setMap(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useFrame(({ clock }) => {
    const s = sprite.current;
    if (s) s.position.y = 1.45 + Math.abs(Math.sin(clock.elapsedTime * 2.6)) * 0.12;
  });
  if (!map) return null;
  return (
    <sprite ref={sprite} scale={0.5} renderOrder={1001}>
      <spriteMaterial map={map} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}

function MusicNotes() {
  const a = useRef<THREE.Sprite>(null);
  const b = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    [a.current, b.current].forEach((s, i) => {
      if (!s) return;
      const k = (t * 0.6 + i * 0.5) % 1;
      s.position.set(0.15 * Math.sin(t * 2 + i * 2) + (i ? 0.2 : -0.1), 0.95 + k * 0.7, 0);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
    });
  });
  const map = noteTexture();
  return (
    <>
      <sprite ref={a} scale={0.32}>
        <spriteMaterial map={map} transparent depthWrite={false} />
      </sprite>
      <sprite ref={b} scale={0.24}>
        <spriteMaterial map={map} transparent depthWrite={false} />
      </sprite>
    </>
  );
}

interface ItemProps {
  item: PlacedItem;
  assets: RoomAssets;
  district: District;
  time: TimeOfDay;
  mode: RoomMode;
  selected: boolean;
  playing: boolean;
  mailUnread: boolean;
  photoUrl?: (id: string) => string;
  onPick: (item: PlacedItem, e: ThreeEvent<PointerEvent>) => void;
  onAction?: (action: FurnitureAction, item: PlacedItem) => void;
  /** 누가 이 가구를 들고 있으면 떠오른다 (방 꾸미기 실시간) */
  presence?: HousePresence | null;
}

/** 누가 이 가구를 들고 있는지 */
function carried(presence: HousePresence | null | undefined, id: string): boolean {
  if (!presence) return false;
  for (const c of presence.carries.values()) if (c.holding === id) return true;
  return false;
}

/** 든 가구가 떠오르는 높이 (m), 벽 가구는 벽에서 떨어지는 거리 */
const CARRY_LIFT = 0.22;
const CARRY_OFF_WALL = 0.12;

function Item({ item, assets, district, time, mode, selected, playing, mailUnread, photoUrl, onPick, onAction, presence }: ItemProps) {
  const def = furnitureDef(item.key)!;
  const root = useRef<THREE.Group>(null);
  const lift = useRef({ now: 0, placed: false });
  const photoMat = useRef<THREE.MeshBasicMaterial | null>(null);
  const object = useMemo(() => {
    const o = assets.furniture[item.key].clone(true);
    photoMat.current = null;
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = def.kind !== 'rug';
      mesh.receiveShadow = true;
      const name = (mesh.material as THREE.Material).name;
      if (name === 'view') {
        // 푸른 호숫가(SJ) 창밖은 원래 밤 풍경이라 시간대 색을 입히지 않는다
        const night = themeOf(district) === 'SJ';
        const tint = time === 'night' && !night ? R.night : time === 'evening' && !night ? R.evening : '#FFFFFF';
        mesh.material = new THREE.MeshBasicMaterial({ map: assets.views[themeOf(district)], color: tint });
      } else if (name === 'photo') {
        photoMat.current = new THREE.MeshBasicMaterial({ color: R.wall.cream });
        mesh.material = photoMat.current;
      }
    });
    return o;
  }, [assets, item.key, def.kind, district, time]);

  // 액자 사진
  useEffect(() => {
    const mat = photoMat.current;
    if (!mat || !item.photoId || !photoUrl) return;
    let alive = true;
    let tex: THREE.Texture | null = null;
    new THREE.TextureLoader().loadAsync(photoUrl(item.photoId)).then((t) => {
      if (!alive) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      // 사진을 액자 비율(가로 0.44 : 세로 0.58)에 맞게 가운데를 잘라 쓴다
      const img = t.image as { width: number; height: number };
      const frame = 0.44 / 0.58;
      const ratio = img.width / img.height;
      if (ratio > frame) {
        t.repeat.set(frame / ratio, 1);
        t.offset.set((1 - frame / ratio) / 2, 0);
      } else {
        t.repeat.set(1, ratio / frame);
        t.offset.set(0, (1 - ratio / frame) / 2);
      }
      tex = t;
      mat.map = t;
      mat.color.set('#FFFFFF');
      mat.needsUpdate = true;
    }).catch(() => {});
    return () => {
      alive = false;
      tex?.dispose();
      if (mat.map) {
        mat.map = null;
        mat.color.set(R.wall.cream);
        mat.needsUpdate = true;
      }
    };
  }, [object, item.photoId, photoUrl]);

  const c = itemCenter(item, def);
  const isWall = def.kind === 'wall';
  const position: [number, number, number] = isWall
    ? item.wall === 'left' ? [0.02, c.y, c.z] : [c.x, c.y, 0.02]
    : [c.x, 0, c.z];
  const rotationY = isWall ? (item.wall === 'left' ? Math.PI / 2 : 0) : (item.rot * Math.PI) / 2;
  const interactive = mode === 'edit' || !!def.action;
  const [fw, fd] = isWall ? [def.size[0], 1] : footprintSize(def, item.rot);

  // 칸을 옮기면 미끄러지듯 따라가고, 누가 들고 있으면 살짝 떠올라 흔들린다 (다른 사람 화면도 같이)
  useFrame(({ clock }, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const l = lift.current;
    l.now += ((carried(presence, item.id) ? 1 : 0) - l.now) * (1 - Math.exp(-dt * 10));
    const up = l.now < 1e-3 ? 0 : l.now * (CARRY_LIFT + 0.02 * Math.sin(clock.elapsedTime * 4));
    const tx = position[0] + (isWall && item.wall === 'left' ? l.now * CARRY_OFF_WALL : 0);
    const ty = position[1] + (isWall ? 0 : up);
    const tz = position[2] + (isWall && item.wall !== 'left' ? l.now * CARRY_OFF_WALL : 0);
    if (!l.placed) {
      g.position.set(tx, ty, tz);
      l.placed = true;
      return;
    }
    const k = 1 - Math.exp(-dt * 14);
    g.position.set(g.position.x + (tx - g.position.x) * k, g.position.y + (ty - g.position.y) * k, g.position.z + (tz - g.position.z) * k);
  });

  return (
    // 자리는 아래 useFrame이 정한다 (props로 주면 칸을 옮길 때마다 순간 이동해 미끄러지지 않는다)
    <group ref={root}>
      <group rotation-y={rotationY}>
        <primitive
          object={object}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (mode !== 'edit') return;
            e.stopPropagation();
            onPick(item, e);
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (mode !== 'view' || !def.action || e.delta > 8) return;
            e.stopPropagation();
            onAction?.(def.action, item);
          }}
          onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        />
      </group>
      {item.key === 'furn.turntable' && playing && <MusicNotes />}
      {item.key === 'furn.mailbox' && mailUnread && <MailFlag />}
      {selected &&
        (isWall ? (
          <mesh rotation-y={rotationY} position={[0, 0, 0]} renderOrder={5}>
            <planeGeometry args={[fw + 0.2, (def.key === 'furn.window' ? 1.5 : 0.95) + 0.1]} />
            <meshBasicMaterial color={R.select} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} renderOrder={5}>
            <planeGeometry args={[fw - 0.04, fd - 0.04]} />
            <meshBasicMaterial color={R.select} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        ))}
    </group>
  );
}

// ───────────────────────── 꾸미기: 끌어서 옮기기 ─────────────────────────

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const BACK_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const LEFT_PLANE = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

function DragController({
  drag, items, onMove, onDrop,
}: {
  drag: React.RefObject<{ id: string; pointerId: number } | null>;
  items: React.RefObject<PlacedItem[]>;
  onMove: React.RefObject<((item: PlacedItem) => void) | undefined>;
  /** 손가락을 뗐다 (끌던 가구 id) */
  onDrop?: (id: string) => void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const item = items.current.find((i) => i.id === d.id);
      const def = item && furnitureDef(item.key);
      if (!item || !def) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let next: PlacedItem | null = null;
      if (def.kind === 'wall') {
        // 두 벽 중 실제로 맞닿는 쪽
        const back = ray.ray.intersectPlane(BACK_PLANE, new THREE.Vector3());
        const left = ray.ray.intersectPlane(LEFT_PLANE, new THREE.Vector3());
        const onBack = back && back.x >= -0.2 && back.x <= W && back.y >= 0 && back.y <= H + 0.5;
        const onLeft = left && left.z >= -0.2 && left.z <= D && left.y >= 0 && left.y <= H + 0.5;
        let wall: 'back' | 'left' | null = onBack && (!onLeft || back!.x >= 0.3) ? 'back' : onLeft ? 'left' : null;
        let along = wall === 'back' ? back!.x : wall === 'left' ? left!.z : 0;
        // 위에서 내려다보면 벽이 화면에 얇게 보여 손가락이 바닥 쪽으로 내려가기 쉽다 (그러면 벽에 닿지 않아 안 옮겨졌다).
        // 바닥을 끌고 있으면 바닥에 닿은 자리에서 가까운 벽을 따라 옮긴다 (지금 벽을 조금 더 좋아한다)
        if (!wall && ray.ray.intersectPlane(FLOOR_PLANE, hit)) {
          const preferLeft = item.wall === 'left';
          wall = preferLeft ? (hit.x <= hit.z + 1 ? 'left' : 'back') : hit.z <= hit.x + 1 ? 'back' : 'left';
          along = wall === 'back' ? hit.x : hit.z;
        }
        if (wall) {
          const len = wall === 'back' ? W : D;
          const x = Math.max(0, Math.min(len - def.size[0], Math.round(along - def.size[0] / 2)));
          next = { ...item, wall, x };
        }
      } else if (ray.ray.intersectPlane(FLOOR_PLANE, hit)) {
        const [w, dd] = footprintSize(def, item.rot);
        const x = Math.max(0, Math.min(W - w, Math.round(hit.x - w / 2)));
        const z = Math.max(0, Math.min(D - dd, Math.round(hit.z - dd / 2)));
        next = { ...item, x, z };
      }
      if (!next || (next.x === item.x && next.z === item.z && next.wall === item.wall)) return;
      if (canPlace(items.current, next)) onMove.current?.(next);
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.pointerId !== e.pointerId) return;
      const id = drag.current.id;
      drag.current = null;
      onDrop?.(id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [camera, gl, drag, items, onMove, onDrop]);
  return null;
}

// ───────────────────────── 캐릭터 ─────────────────────────

/** 집 안 캐릭터 크기 배율: 키를 roomConfig.personHeight에 맞춘다 (가구가 실제 크기라서) */
const AVATAR_SCALE = roomConfig.personHeight / CHARACTER_HEIGHT;
const TURN_RATE = 12;

/** 방 앞쪽 가운데에서 가장 가까운 빈 칸 */
function startSpot(blocked: Uint8Array): Point {
  let best: Point = { x: W / 2, z: D - 1.5 };
  let bestD = Infinity;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (blocked[z * W + x]) continue;
    const d = Math.hypot(x + 0.5 - W / 2, z + 0.5 - (D - 1.5));
    if (d < bestD) {
      bestD = d;
      best = { x: x + 0.5, z: z + 0.5 };
    }
  }
  return best;
}

/** 이 자리에서 가장 가까운 빈 칸 가운데 (가구가 옮겨 와 갇혔을 때 비킨다) */
function nearestFree(blocked: Uint8Array, p: Point): Point {
  let best: Point = { x: W / 2, z: D - 1.5 };
  let bestD = Infinity;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (blocked[z * W + x]) continue;
    const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
    if (d < bestD) {
      bestD = d;
      best = { x: x + 0.5, z: z + 0.5 };
    }
  }
  return best;
}

/** 쓰다듬을 때 강아지에서 이만큼 떨어져 선다 (m), 이만큼 안이면 쓰다듬는다 */
const PET_STAND = 0.6;
const PET_REACH = 0.85;

/** 강아지 곁 설 자리: 강아지에서 나 쪽으로. 막혔으면 강아지 둘레를 돌며 설 수 있는 곳 */
function petSpot(dog: Point, from: Point, blocked: Uint8Array): Point {
  const a0 = Math.atan2(from.x - dog.x, from.z - dog.z);
  for (let k = 0; k < 8; k++) {
    const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
    const p = { x: dog.x + Math.sin(a) * PET_STAND, z: dog.z + Math.cos(a) * PET_STAND };
    if (canStandInRoom(blocked, p.x, p.z)) return p;
  }
  return nearestFree(blocked, dog);
}

/**
 * 가구를 든 사람이 설 자리: 가구 가장자리에서 반 칸쯤. 되도록 가구 뒤(방 안쪽)에 서서 방 앞쪽을 보며 든다
 * (방 앞쪽에서 보는 사람에게 얼굴과 든 팔이 보인다). 뒤가 막혔으면 가까운 옆, 그다음 앞. 벽 가구는 그 벽 앞
 */
function carrySpot(item: PlacedItem, from: Point, blocked: Uint8Array): Point {
  const def = furnitureDef(item.key);
  if (!def) return from;
  const c = itemCenter(item, def);
  const inRoom = (p: Point) => p.x >= 0.3 && p.z >= 0.3 && p.x <= W - 0.3 && p.z <= D - 0.3 && canStandInRoom(blocked, p.x, p.z);
  if (def.kind === 'wall') {
    const spot = item.wall === 'left' ? { x: 0.8, z: c.z } : { x: c.x, z: 0.8 };
    return inRoom(spot) ? spot : nearestFree(blocked, spot);
  }
  const [w, d] = footprintSize(def, item.rot);
  const gap = 0.45;
  const sides = [{ x: c.x - w / 2 - gap, z: c.z }, { x: c.x + w / 2 + gap, z: c.z }].sort(
    (a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z),
  );
  const spots = [{ x: c.x, z: c.z - d / 2 - gap }, ...sides, { x: c.x, z: c.z + d / 2 + gap }];
  return spots.find(inRoom) ?? nearestFree(blocked, spots[0]);
}

/** 길을 찾고 끝에 정확한 자리를 붙인다 (길은 칸 가운데를 잇는다) */
function pathTo(blocked: Uint8Array, from: Point, to: Point): Point[] | null {
  const path = findRoomPath(blocked, from, to);
  if (path && canStandInRoom(blocked, to.x, to.z)) path.push({ ...to });
  return path;
}

/** 캐릭터 모델: 옷 색·피부색·머리 색을 입히고 머리 소품을 단다 */
function useAvatarModel(assets: RoomAssets, body: AvatarBody | '' | undefined, colorKey: string, accessory: string, skin?: string, hair?: string) {
  const color = tokens.avatar[colorKey as Avatar['color']] ?? tokens.avatar.mint;
  const gltf = useBodyModel(assets, body);
  const built = useMemo(() => {
    const model = cloneCharacter(gltf);
    model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const tinted = tintOutfit(model, color, bodyTintOf({ skin, hair }));
    const face = faceControl(model);
    const acc = assets.accessories[accessory];
    if (acc) {
      const a = acc.clone();
      tinted.push(...tintOutfit(a, shiftLightness(color, -0.18)));
      attachAccessory(model, accessory, a);
    }
    model.scale.setScalar(AVATAR_SCALE);
    const mixer = new THREE.AnimationMixer(model);
    const actions = characterActions(gltf, mixer);
    actions.idle.play();
    return { model, mixer, actions, face, tinted, clip: { current: 'idle' as ClipName } };
  }, [assets, gltf, accessory, color, skin, hair]);
  // 붙을 때마다 서 있기부터 (개발 모드의 붙였다 뗐다에도 동작이 멈추지 않게)
  useEffect(() => {
    built.actions.idle.reset().play();
    built.clip.current = 'idle';
    return () => {
      built.mixer.stopAllAction();
      for (const m of built.tinted) m.dispose();
      built.face?.dispose();
    };
  }, [built]);
  return { ...built, color };
}

/** 지금 머리 위에 떠 있는 이모티콘 (없으면 null) */
function activeEmote(presence: HousePresence | null | undefined, gid: string): string | null {
  const g = presence?.gestures.get(gid);
  return g?.emote && clockNow() - g.emoteStart <= townConfig.emoteDurationMs / 1000 ? g.emote : null;
}

/** 걷기·서기 동작을 부드럽게 바꾸고, 표정을 맞춘다 */
function playClip(m: ReturnType<typeof useAvatarModel>, clip: ClipName, emote: string | null = null) {
  m.face?.set(faceFor(emote, clip));
  if (clip === m.clip.current) return;
  const next = m.actions[clip].reset().play();
  m.actions[m.clip.current].crossFadeTo(next, 0.18, false);
  m.clip.current = clip;
}

/** 머리 위 이름표 */
function NameTag({ label, color, self = false, sub = '' }: { label: string; color: string; self?: boolean; sub?: string }) {
  const tag = useMemo(() => tagTexture(self ? `나 · ${label}` : label, color, self, sub), [label, color, self, sub]);
  return (
    <sprite
      position-y={CHARACTER_HEIGHT * AVATAR_SCALE + 0.28 + 0.13 * (tag.rel - 1)}
      scale={[0.26 * tag.rel * tag.aspect, 0.26 * tag.rel, 1]}
      renderOrder={1000}
    >
      <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}

const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

type EmoteTextures = Record<EmoteKind, THREE.Texture>;

/** 걷기·몸짓·서기 중 지금 보여 줄 동작. 걸으면 몸짓은 끝난다 */
function clipFor(presence: HousePresence | null | undefined, gid: string, walking: boolean): ClipName {
  const g = presence?.gestures.get(gid);
  if (walking) {
    if (g) g.actionUntil = 0;
    return 'walk';
  }
  return g?.action && clockNow() < g.actionUntil ? g.action : 'idle';
}

/** 가구를 들어 올리는·들고 있는·내려놓는 중이면 그 동작, 아니면 걷기·몸짓·서기 */
function bodyClip(presence: HousePresence | null | undefined, gid: string, walking: boolean): ClipName {
  const c = presence?.carries.get(gid);
  if (c) {
    const t = clockNow();
    if (c.holding) return t - c.liftAt < LIFT_SEC ? 'lift' : walking ? 'carryWalk' : 'carry';
    if (t - c.dropAt < PLACE_SEC) return 'place';
  }
  return clipFor(presence, gid, walking);
}

/** 머리 위 이모티콘 말풍선: 톡 튀어나왔다가 살짝 떠 있다 */
function EmoteBubble({
  presence, gid, model, textures,
}: {
  presence: HousePresence;
  gid: string;
  model: THREE.Object3D;
  textures: EmoteTextures | null;
}) {
  const sprite = useRef<THREE.Sprite>(null);
  useFrame(() => {
    const sp = sprite.current;
    if (!sp) return;
    const g = presence.gestures.get(gid);
    const t = clockNow() - (g?.emoteStart ?? 0);
    if (!g?.emote || !textures || t > townConfig.emoteDurationMs / 1000) {
      sp.visible = false;
      return;
    }
    sp.visible = true;
    sp.material.map = textures[g.emote];
    const pop = Math.min(1, t / 0.15);
    sp.scale.setScalar(0.7 * (0.6 + 0.4 * pop));
    sp.position.set(model.position.x, CHARACTER_HEIGHT * AVATAR_SCALE + 0.72 + Math.sin(t * 5) * 0.03, model.position.z);
  });
  return (
    <sprite ref={sprite} visible={false} renderOrder={1001}>
      <spriteMaterial depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}

/**
 * 내 캐릭터: 바닥을 누르면 길을 찾아 걷고, 방향키(WASD)로도 걷는다. 위쪽 키 = 바라보는 쪽 (방 전체 보기는 방 안쪽).
 * 1인칭에서는 캐릭터를 그리지 않는다 (다른 사람 화면에는 보인다). 같은 방에 다른 사람이 있으면 내 위치를 보낸다.
 */
/** 쓰다듬기 진행: goAt = 버튼을 누른 시각 (0 = 가는 중 아님), pathAt = 길을 마지막으로 찾은 시각, lookUntil = 강아지를 바라볼 때까지 */
interface PetGo {
  goAt: number;
  pathAt: number;
  lookUntil: number;
}

function RoomAvatar({
  assets, avatar, layout, walkTo, focus, mode, presence, name, tag, together, emotes, firstPerson, view, heading, dogPos, pet, petLocal,
}: {
  assets: RoomAssets;
  avatar: Avatar;
  layout: RoomLayout;
  walkTo: React.RefObject<Point | null>;
  /** 카메라가 따라갈 캐릭터 자리 */
  focus: React.RefObject<Point>;
  mode: RoomMode;
  presence?: HousePresence | null;
  name?: string;
  /** 이름표 둘째 줄 (MBTI) */
  tag?: string;
  /** 다른 사람이 함께 있는지 (이름표를 띄운다) */
  together: boolean;
  emotes: EmoteTextures | null;
  /** 1인칭: 내 캐릭터는 그리지 않고, 방향키는 바라보는 쪽 기준 (←→ 돌기, A·D 옆걸음) */
  firstPerson: boolean;
  view: React.RefObject<FirstPersonView>;
  heading: React.RefObject<Heading>;
  /** 방 강아지 자리 (PetDog가 매 장면 알린다) */
  dogPos: React.RefObject<Point | null>;
  pet: React.RefObject<PetGo>;
  /** 같은 방 연결이 없을 때 강아지에게 쓰다듬었다고 알린다 */
  petLocal: () => void;
}) {
  const m = useAvatarModel(assets, avatar.body, avatar.color, avatar.accessory, avatar.skin, avatar.hair);
  const blockedAll = useMemo(() => blockedCells(layout.items), [layout.items]);
  // 든 가구는 막지 않는다 (가구 곁을 따라다닌다)
  const blockCache = useRef<{ items: readonly PlacedItem[] | null; except: string | null; grid: Uint8Array }>({ items: null, except: null, grid: blockedAll });
  const blockedFor = (except: string | null) => {
    const c = blockCache.current;
    if (c.items !== layout.items || c.except !== except) {
      c.items = layout.items;
      c.except = except;
      c.grid = except ? blockedCells(layout.items, except) : blockedAll;
    }
    return c.grid;
  };
  const carryGoal = useRef<Point | null>(null);
  const state = useRef({ pos: startSpot(blockedAll), rot: 0, facing: 0, path: null as Point[] | null });
  const keys = useRef(new Set<string>());
  const sent = useRef({ x: Number.NaN, z: Number.NaN, rot: 0, moving: false, at: 0 });

  // 방향키: 꾸미기 중이거나 글을 쓰는 중에는 받지 않는다
  useEffect(() => {
    const held = keys.current;
    if (mode !== 'view') {
      held.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (!MOVE_KEYS.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey || panelOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      e.preventDefault();
      held.add(e.code);
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      held.clear();
    };
  }, [mode]);

  // 서버가 자리를 바로잡으면 따른다
  useEffect(
    () =>
      presence?.onSnap((p) => {
        state.current.pos = { x: p.x, z: p.z };
        state.current.path = null;
      }),
    [presence],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    const t = clockNow();
    // 꾸미기에서 가구를 들고 있으면 그 가구 곁을 따라다닌다
    const carry = presence?.carries.get(SELF_GESTURE);
    const held = carry?.holding ? (layout.items.find((i) => i.id === carry.holding) ?? null) : null;
    const blocked = blockedFor(held?.id ?? null);
    // 가구가 캐릭터 자리로 옮겨 오면 가까운 빈 칸으로 비킨다
    const cell = Math.floor(s.pos.z) * W + Math.floor(s.pos.x);
    if (blocked[cell]) {
      s.pos = nearestFree(blocked, s.pos);
      s.path = null;
    }
    const pg = pet.current;
    if (walkTo.current) {
      s.path = findRoomPath(blocked, s.pos, walkTo.current);
      walkTo.current = null;
      pg.goAt = 0;
    }
    const step = roomConfig.walkSpeed * dt;
    let walking = false;
    let pathWalking = false;
    const k = keys.current;
    const v = view.current;
    // 들어서는 동안에는 서 있는다 (카메라가 문 밖에서 걸어 들어온다)
    const entering = firstPerson && v.enter < 1;
    // 방향키는 바라보는 쪽 기준. 방 전체 보기는 카메라가 방 앞에서 보므로 바라보는 쪽 = 방 안쪽 (π)
    const yaw = firstPerson ? v.yaw : Math.PI;
    const fwd = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    const right = firstPerson
      ? (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
      : (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    if (firstPerson && !entering) v.yaw += ((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * roomConfig.turnSpeed * dt;
    const kx = Math.sin(yaw) * fwd - Math.cos(yaw) * right;
    const kz = Math.cos(yaw) * fwd + Math.sin(yaw) * right;
    // 쓰다듬기: 강아지 곁까지 걸어가 쪼그려 앉는다 (방향키·바닥 누르기로 그만둔다)
    const dog = dogPos.current;
    if (pg.goAt) {
      if (kx || kz || entering || !dog || mode !== 'view' || t - pg.goAt > 10) pg.goAt = 0;
      else if (Math.hypot(dog.x - s.pos.x, dog.z - s.pos.z) <= PET_REACH) {
        pg.goAt = 0;
        s.path = null;
        s.facing = Math.atan2(dog.x - s.pos.x, dog.z - s.pos.z);
        if (presence) presence.sendAction('pet');
        else petLocal();
        pg.lookUntil = t + PET_REACTION_SEC;
        if (firstPerson) {
          const dist = Math.hypot(dog.x - s.pos.x, dog.z - s.pos.z) + roomConfig.eyeBack;
          v.aim = { yaw: s.facing, pitch: -Math.atan2(roomConfig.crouchEyeHeight - PET_HEIGHT * 0.4, dist) };
        }
      } else if (t - pg.pathAt > 0.4) {
        pg.pathAt = t;
        s.path = pathTo(blocked, s.pos, petSpot(dog, s.pos, blocked));
      }
    }
    // 쓰다듬는 동안 쪼그려 앉고, 강아지가 다 좋아하면 고개를 처음 높이로 든다
    const petting = !!presence && clipFor(presence, SELF_GESTURE, false) === 'pet';
    v.crouch = petting ? 1 : 0;
    if (pg.lookUntil && t > pg.lookUntil) {
      pg.lookUntil = 0;
      if (firstPerson && !v.looking) v.aim = { yaw: v.yaw, pitch: deg(roomConfig.firstPersonPitchDeg) };
    }
    // 들고 있는 가구 곁으로 (들어 올리는 동안은 서 있는다)
    if (held && t - carry!.liftAt >= LIFT_SEC) {
      const spot = carrySpot(held, s.pos, blocked);
      const goal = carryGoal.current;
      if (!goal || Math.hypot(goal.x - spot.x, goal.z - spot.z) > 0.3) {
        carryGoal.current = spot;
        s.path = Math.hypot(spot.x - s.pos.x, spot.z - s.pos.z) > 0.15 ? pathTo(blocked, s.pos, spot) : null;
      }
    } else carryGoal.current = null;
    if (entering) {
      s.path = null;
      walkTo.current = null;
    } else if (kx || kz) {
      s.path = null;
      const len = Math.hypot(kx, kz);
      const next = moveInRoom(blocked, s.pos.x, s.pos.z, (kx / len) * step, (kz / len) * step);
      walking = Math.hypot(next.x - s.pos.x, next.z - s.pos.z) > 1e-4;
      s.pos = next;
      s.facing = Math.atan2(kx, kz);
    } else if (s.path?.length) {
      pathWalking = true;
      const next = s.path[0];
      const dx = next.x - s.pos.x;
      const dz = next.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= step) {
        s.pos = { ...next };
        s.path.shift();
      } else {
        s.pos = { x: s.pos.x + (dx / dist) * step, z: s.pos.z + (dz / dist) * step };
      }
      if (dist > 1e-4) s.facing = Math.atan2(dx, dz);
      walking = true;
    }
    // 가구를 들고 서 있으면 가구 쪽을 본다
    if (held && !walking) {
      const def = furnitureDef(held.key);
      const c = def ? itemCenter(held, def) : null;
      if (c && Math.hypot(c.x - s.pos.x, c.z - s.pos.z) > 0.05) s.facing = Math.atan2(c.x - s.pos.x, c.z - s.pos.z);
    }
    // 1인칭에서 서 있으면 바라보는 쪽을 본다 (다른 사람 화면에서 내가 보는 쪽을 향한다)
    else if (firstPerson && !walking) s.facing = v.yaw;
    s.rot += Math.atan2(Math.sin(s.facing - s.rot), Math.cos(s.facing - s.rot)) * (1 - Math.exp(-dt * TURN_RATE));
    playClip(m, bodyClip(presence, SELF_GESTURE, walking), activeEmote(presence, SELF_GESTURE));
    m.mixer.update(dt);
    m.model.position.set(s.pos.x, 0, s.pos.z);
    m.model.rotation.y = s.rot;
    m.model.visible = !firstPerson;
    focus.current = s.pos;
    heading.current.facing = s.facing;
    heading.current.pathWalking = pathWalking;

    // 같은 방 사람들에게 내 자리를 보낸다 (초당 moveSendHz회 이하, 바뀐 것만)
    if (presence) {
      const last = sent.current;
      const t = performance.now();
      const changed = last.x !== s.pos.x || last.z !== s.pos.z || Math.abs(last.rot - s.facing) > 0.01 || last.moving !== walking;
      if (changed && t - last.at >= 1000 / townConfig.moveSendHz) {
        if (presence.sendMove({ x: s.pos.x, z: s.pos.z, rot: s.facing, moving: walking })) {
          Object.assign(last, { x: s.pos.x, z: s.pos.z, rot: s.facing, moving: walking, at: t });
        }
      }
    }
  });

  return (
    <group>
      <primitive object={m.model} />
      {!firstPerson && together && name && <FollowTag model={m.model} label={name} color={m.color} self sub={tag} />}
      {!firstPerson && presence && <EmoteBubble presence={presence} gid={SELF_GESTURE} model={m.model} textures={emotes} />}
    </group>
  );
}

/** 모델을 따라다니는 이름표 */
function FollowTag({
  model, label, color, self = false, sub = '',
}: {
  model: THREE.Object3D;
  label: string;
  color: string;
  self?: boolean;
  /** 둘째 줄 (MBTI) */
  sub?: string;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    g.current?.position.copy(model.position);
  });
  return (
    <group ref={g}>
      <NameTag label={label} color={color} self={self} sub={sub} />
    </group>
  );
}

/**
 * 같은 방의 다른 사람. 받은 위치를 remoteDelaySec만큼 늦게 두 위치 사이로 고르게 그린다 (마을과 같다).
 */
function RemoteAvatar({
  presence, id, assets, emotes,
}: {
  presence: HousePresence;
  id: string;
  assets: RoomAssets;
  emotes: EmoteTextures | null;
}) {
  const p = presence.player(id);
  const m = useAvatarModel(assets, p?.body, p?.color ?? 'mint', p?.acc ?? 'none', p?.skin, p?.hair);
  const samples = useRef<{ t: number; x: number; z: number }[]>(p ? [{ t: performance.now() / 1000, x: p.x, z: p.z }] : []);
  const pose = useRef({ x: p?.x ?? W / 2, z: p?.z ?? D - 1.5, rot: p?.rot ?? 0 });

  useFrame((_, rawDt) => {
    const s = presence.player(id);
    if (!s) return;
    const dt = Math.min(rawDt, 0.1);
    const t = performance.now() / 1000;
    const buf = samples.current;
    const last = buf[buf.length - 1];
    if (!last || last.x !== s.x || last.z !== s.z) {
      if (last && t - last.t > 0.25) buf.push({ t: t - townConfig.patchRateMs / 1000, x: last.x, z: last.z });
      buf.push({ t, x: s.x, z: s.z });
    }
    const at = t - townConfig.remoteDelaySec;
    while (buf.length > 2 && buf[1].t <= at) buf.shift();
    const a = pose.current;
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
    a.rot += Math.atan2(Math.sin(s.rot - a.rot), Math.cos(s.rot - a.rot)) * (1 - Math.exp(-dt * TURN_RATE));
    playClip(m, bodyClip(presence, id, s.moving || Math.hypot(a.x - bx, a.z - bz) > 0.002), activeEmote(presence, id));
    m.mixer.update(dt);
    m.model.position.set(a.x, 0, a.z);
    m.model.rotation.y = a.rot;
  });

  if (!p) return null;
  return (
    <>
      <primitive object={m.model} />
      <FollowTag model={m.model} label={p.name} color={m.color} sub={profileTag(p.mbti)} />
      <EmoteBubble presence={presence} gid={id} model={m.model} textures={emotes} />
    </>
  );
}

function RemoteAvatars({ presence, assets, emotes }: { presence: HousePresence; assets: RoomAssets; emotes: EmoteTextures | null }) {
  const snap = useSyncExternalStore(presence.subscribe, presence.getSnapshot, presence.getSnapshot);
  const ids = useMemo(() => presence.others(snap), [presence, snap]);
  return (
    <>
      {ids.map((id) => (
        <RemoteAvatar key={id} presence={presence} id={id} assets={assets} emotes={emotes} />
      ))}
    </>
  );
}

// ───────────────────────── 장면 ─────────────────────────

const noopSubscribe = () => () => {};

function FirstFrame({ onFrame }: { onFrame?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onFrame?.();
    }
  });
  return null;
}

// ───────────────────────── 펫 (강아지) ─────────────────────────

/** 방 강아지 키: 실제 작은 개 크기 (마을 강아지는 멀리서 보여 더 크게 그린다) */
const PET_HEIGHT = roomConfig.petHeight;
/** 방 강아지 걷는 빠르기 (m/초): 작은 개가 느긋하게 걷는 빠르기 (다리 동작이 다다닥거리지 않게) */
const PET_SPEED = 0.6;
let petModel: Promise<GLTF> | null = null;
/** 강아지 모델 (뼈대와 걷기·서 있기 동작 포함, 한 번만 받는다) */
function loadPetModel(): Promise<GLTF> {
  petModel ??= withMeshopt(new GLTFLoader())
    .loadAsync(assetUrl('pet.dog'))
    .then((g) => {
      brightenFur(g.scene);
      return g;
    });
  petModel.catch(() => {
    petModel = null;
  });
  return petModel;
}

/**
 * 방에 사는 강아지. 빈 칸을 골라 다리로 걸어 다니다(걷기 동작) 잠깐 쉰다(서 있기 동작).
 * 쓰다듬으면 쓰다듬은 사람을 보며 앉고 → 옆으로 눕고 → 일어나 깡총거리며 꼬리를 흔든다 (하트와 이름이 뜬다).
 * 같은 방에 여럿이면 먼저 들어온 사람의 화면이 강아지를 움직이고 자리·자세를 알린다. 다른 화면은 그대로 따라 그린다.
 * 모델은 방을 그린 뒤에 받는다.
 */
function PetDog({
  layout, name, hidden = false, onTap, presence, dogPos, petBus, selfPos,
}: {
  layout: RoomLayout;
  name: string;
  /** 꾸미는 동안: 그리지 않고 움직이기만 한다 */
  hidden?: boolean;
  onTap?: () => void;
  presence?: HousePresence | null;
  /** 지금 강아지 자리 (내 캐릭터가 쓰다듬으러 올 때 쓴다) */
  dogPos: React.RefObject<Point | null>;
  /** 누가 쓰다듬었는지 듣는다 (나는 SELF_GESTURE) */
  petBus: Set<(id: string) => void>;
  selfPos: React.RefObject<Point>;
}) {
  const [inst, setInst] = useState<ReturnType<typeof petInstance> | null>(null);
  const [heart, setHeart] = useState<THREE.Texture | null>(null);
  const blocked = useMemo(() => blockedCells(layout.items), [layout.items]);
  const group = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);
  const tag = useMemo(() => tagTexture(name, tokens.color.accent, false), [name]);
  const state = useRef({
    pos: { x: W / 2 + 1, z: D - 1.2 } as Point, path: null as Point[] | null, rest: 1.5, facing: 0, rot: 0,
    /** 쓰다듬은 시각 (clockNow), 쓰다듬은 사람 자리 */
    petAt: -100, petFrom: null as Point | null,
    /** 맡은 화면이 알린 자리를 마지막으로 보낸 때 */
    sent: { at: 0, pose: null as PetPose | null, moving: false },
  });

  useEffect(() => {
    let alive = true;
    loadPetModel()
      .then((gltf) => alive && setInst(petInstance(gltf, PET_HEIGHT)))
      .catch(() => {});
    bubbleTexture('ui.icon.heart', tokens.scene.heart).then((t) => alive && setHeart(t)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!inst) return;
    inst.restart();
    return () => inst.stop();
  }, [inst]);

  // 누가 쓰다듬었다: 그 사람을 보며 반응을 처음부터 (반응 중이면 앉고 눕는 동안은 그대로 둔다)
  useEffect(() => {
    const onPet = (id: string) => {
      const s = state.current;
      const t = clockNow();
      if (t - s.petAt < PET_REACTION_SEC * 0.7) return;
      const p = id === SELF_GESTURE ? selfPos.current : presence?.player(id);
      s.petAt = t;
      s.petFrom = p ? { x: p.x, z: p.z } : null;
    };
    petBus.add(onPet);
    return () => {
      petBus.delete(onPet);
    };
  }, [petBus, presence, selfPos]);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g || !inst) return;
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    const t = clockNow();
    let moving = false;
    let pose: PetPose | null = null;
    const remote = presence?.followsDog() ? presence.dog : null;
    if (remote) {
      // 다른 화면이 맡은 강아지: 알려 온 자리로 부드럽게 따라간다 (멀면 바로)
      const far = Math.hypot(remote.x - s.pos.x, remote.z - s.pos.z) > 2;
      const k = far ? 1 : 1 - Math.exp(-dt * 6);
      s.pos = { x: s.pos.x + (remote.x - s.pos.x) * k, z: s.pos.z + (remote.z - s.pos.z) * k };
      s.facing = remote.rot;
      s.path = null;
      moving = remote.moving;
      // 내가 막 쓰다듬었으면 맡은 화면의 자세가 오기 전까지 내 화면이 먼저 반응한다
      pose = remote.pose ?? (t - s.petAt < 0.8 ? petReactionPose(t - s.petAt) : null);
    } else {
      // 가구가 옮겨 와 갇히면 가까운 빈 칸으로 비킨다
      if (blocked[Math.floor(s.pos.z) * W + Math.floor(s.pos.x)]) {
        s.pos = nearestFree(blocked, s.pos);
        s.path = null;
      }
      pose = inst.canPose ? petReactionPose(t - s.petAt) : null;
      if (pose) {
        // 쓰다듬는 사람을 본다 (반응하는 동안은 걷지 않는다)
        s.path = null;
        s.rest = 1.5;
        if (s.petFrom && Math.hypot(s.petFrom.x - s.pos.x, s.petFrom.z - s.pos.z) > 0.05) s.facing = Math.atan2(s.petFrom.x - s.pos.x, s.petFrom.z - s.pos.z);
      } else if (s.path?.length) {
        const next = s.path[0];
        const dx = next.x - s.pos.x;
        const dz = next.z - s.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = PET_SPEED * dt;
        if (dist <= step) {
          s.pos = { ...next };
          s.path.shift();
        } else {
          s.pos = { x: s.pos.x + (dx / dist) * step, z: s.pos.z + (dz / dist) * step };
        }
        if (dist > 1e-4) s.facing = Math.atan2(dx, dz);
        moving = true;
      } else {
        s.rest -= dt;
        if (s.rest <= 0) {
          // 다음에 갈 빈 칸 (가까운 곳 위주)
          const free: Point[] = [];
          for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (!blocked[z * W + x] && Math.hypot(x + 0.5 - s.pos.x, z + 0.5 - s.pos.z) < 3.5) free.push({ x: x + 0.5, z: z + 0.5 });
          const goal = free[Math.floor(Math.random() * free.length)];
          s.path = goal ? findRoomPath(blocked, s.pos, goal) : null;
          s.rest = 2 + Math.random() * 3;
        }
      }
      // 강아지를 맡았으면 자리·자세를 알린다 (걸을 때 초당 5번, 쉴 때 1번, 자세가 바뀌면 바로)
      const last = s.sent;
      if (presence?.dogLead && (pose !== last.pose || moving !== last.moving || t - last.at > (moving ? 0.2 : 1))) {
        presence.sendDog({ x: s.pos.x, z: s.pos.z, rot: s.facing, moving, pose });
        Object.assign(last, { at: t, pose, moving });
      }
    }
    dogPos.current = s.pos;
    s.rot += Math.atan2(Math.sin(s.facing - s.rot), Math.cos(s.facing - s.rot)) * (1 - Math.exp(-dt * 8));
    // 다리로 걷고 쉴 때는 서 있기 동작 (뼈대 없는 예전 모델이면 깡총깡총). 쓰다듬으면 앉기·눕기·좋아하기
    inst.pose(pose);
    inst.update(dt, moving ? PET_SPEED : 0);
    const petted = t - s.petAt;
    // 자세 동작이 없는 예전 모델은 쓰다듬으면 한 번 크게 뛴다
    const jump = !inst.canPose && petted < 0.5 ? Math.sin((petted / 0.5) * Math.PI) * 0.25 : 0;
    const hop = !inst.animated && moving ? Math.abs(Math.sin(t * 11)) * 0.06 : 0;
    g.position.set(s.pos.x, hop + jump, s.pos.z);
    g.rotation.y = s.rot;
    g.visible = !hidden;
    const b = bubble.current;
    if (b) {
      b.visible = !hidden && (!!pose || petted < 2.4);
      b.position.set(s.pos.x, PET_HEIGHT + 0.35 + jump + Math.sin(t * 5) * 0.02, s.pos.z);
    }
  });

  if (!inst) return null;
  return (
    <>
      <group
        ref={group}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 8 || hidden) return;
          e.stopPropagation();
          onTap?.();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <primitive object={inst.model} />
      </group>
      <group ref={bubble} visible={false}>
        {heart && (
          <sprite position-y={0.32} scale={0.42} renderOrder={1001}>
            <spriteMaterial map={heart} depthTest={false} depthWrite={false} transparent />
          </sprite>
        )}
        <sprite scale={[0.22 * tag.aspect, 0.22, 1]} renderOrder={1000}>
          <spriteMaterial map={tag.texture} depthTest={false} depthWrite={false} transparent />
        </sprite>
      </group>
    </>
  );
}

/**
 * 손님 화면: 집 주인이 꾸미는 동안 보내온 가구 자리를 저장된 방 위에 덧입힌다.
 * 주인이 꾸미기를 끝내면(reset) onStale로 저장된 방을 다시 받는다 (새 방이 오면 덧입힌 것은 지운다).
 */
function useLiveLayout(layout: RoomLayout, presence: HousePresence | null | undefined, onStale?: () => void): RoomLayout {
  const [over, setOver] = useState<{ base: RoomLayout; map: Map<string, PlacedItem | null> }>(() => ({ base: layout, map: new Map() }));
  const base = useRef(layout);
  base.current = layout;
  const stale = useRef(onStale);
  stale.current = onStale;
  useEffect(
    () =>
      presence?.onFurni((m) => {
        if (m.op === 'reset') {
          stale.current?.();
          return;
        }
        setOver((prev) => {
          const map = prev.base === base.current ? new Map(prev.map) : new Map<string, PlacedItem | null>();
          if (m.op === 'remove') map.set(m.id, null);
          else map.set(m.item.id, m.item);
          return { base: base.current, map };
        });
      }),
    [presence],
  );
  return useMemo(() => {
    if (over.base !== layout || !over.map.size) return layout;
    const items: PlacedItem[] = [];
    for (const it of layout.items) {
      const o = over.map.get(it.id);
      if (o === undefined) items.push(it);
      else if (o) items.push(o);
    }
    for (const [id, o] of over.map) if (o && !layout.items.some((i) => i.id === id)) items.push(o);
    return { ...layout, items };
  }, [layout, over]);
}

function SceneContent(props: RoomSceneProps) {
  const { assets, district, avatar, mode, selectedId = null, onSelect, onMove, onAction, playing = false, photoUrl, presence } = props;
  // 손님 화면은 집 주인이 꾸미는 대로 가구가 바로 움직인다 (저장 전에도)
  const layout = useLiveLayout(props.layout, presence, props.onLayoutStale);
  const framing: RoomFraming = mode === 'edit' ? 'overview' : (props.framing ?? 'inside');
  const time = useMemo(timeOfDay, []);
  const walkTo = useRef<Point | null>(null);
  const focus = useRef<Point>({ x: W / 2, z: D - 1.5 });
  const firstPerson = framing === 'inside';
  const view = useRef<FirstPersonView>({ yaw: Math.PI, pitch: deg(roomConfig.firstPersonPitchDeg), enter: 0, shut: 0, door: 0, looking: false, crouch: 0, crouchNow: 0, aim: null });
  const heading = useRef<Heading>({ facing: Math.PI, pathWalking: false });
  // 같은 방에 들어간다 (화면은 먼저 뜨고, 붙는 순간의 내 자리를 알린다)
  useEffect(() => {
    if (presence) void presence.join(() => ({ ...focus.current }));
  }, [presence]);
  // 이모티콘 말풍선 그림 (같은 방 연결이 있을 때만)
  const [emotes, setEmotes] = useState<EmoteTextures | null>(null);
  useEffect(() => {
    if (presence) void loadEmoteTextures().then(setEmotes).catch(() => {});
  }, [presence]);
  const together = useSyncExternalStore(
    presence?.subscribe ?? noopSubscribe,
    () => (presence ? presence.others().length > 0 : false),
    () => false,
  );
  const drag = useRef<{ id: string; pointerId: number } | null>(null);
  const itemsRef = useRef(layout.items);
  itemsRef.current = layout.items;

  // 꾸미기: 가구를 끌기 시작하면 '들었다', 칸을 옮기면 '옮겼다'(초당 10번까지), 손을 떼면 '내려놓았다'를 같은 방에 알린다
  const carrying = useRef<string | null>(null);
  const furniOut = useRef<{ at: number; pending: PlacedItem | null; timer: ReturnType<typeof setTimeout> | null }>({ at: 0, pending: null, timer: null });
  const flushMove = () => {
    const f = furniOut.current;
    if (f.timer) clearTimeout(f.timer);
    f.timer = null;
    f.pending = null;
  };
  useEffect(() => {
    if (mode === 'edit') return;
    carrying.current = null;
    flushMove();
  }, [mode]);
  const onMoveRef = useRef<((item: PlacedItem) => void) | undefined>(undefined);
  onMoveRef.current = (item: PlacedItem) => {
    onMove?.(item);
    if (!presence || mode !== 'edit') return;
    if (carrying.current !== item.id) {
      const before = itemsRef.current.find((i) => i.id === item.id) ?? item;
      presence.sendFurni({ op: 'carry', item: before });
      carrying.current = item.id;
    }
    const f = furniOut.current;
    const t = performance.now();
    if (t - f.at >= 100) {
      presence.sendFurni({ op: 'move', item });
      f.at = t;
      f.pending = null;
      return;
    }
    f.pending = item;
    f.timer ??= setTimeout(() => {
      f.timer = null;
      if (!f.pending) return;
      presence.sendFurni({ op: 'move', item: f.pending });
      f.at = performance.now();
      f.pending = null;
    }, 100 - (t - f.at));
  };
  const onDrop = (id: string) => {
    if (!presence || carrying.current !== id) return;
    flushMove();
    carrying.current = null;
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) presence.sendFurni({ op: 'drop', item });
  };

  // 강아지 쓰다듬기: 버튼(petCall)이나 강아지를 누르면 내 캐릭터가 곁으로 가서 쓰다듬는다
  const dogPos = useRef<Point | null>(null);
  const petGo = useRef<PetGo>({ goAt: 0, pathAt: 0, lookUntil: 0 });
  const petBus = useMemo(() => new Set<(id: string) => void>(), []);
  useEffect(() => presence?.onPet((id) => petBus.forEach((fn) => fn(id))), [presence, petBus]);
  const goPet = () => {
    petGo.current.goAt = clockNow();
    petGo.current.pathAt = 0;
  };
  const petCall = props.petCall ?? 0;
  const seenCall = useRef(petCall);
  useEffect(() => {
    if (petCall === seenCall.current) return;
    seenCall.current = petCall;
    goPet();
  }, [petCall]);

  return (
    <>
      <CameraRig framing={framing} insetTop={props.insetTop} insetBottom={props.insetBottom} focus={focus} view={view} heading={heading} />
      <Lights time={time} />
      {firstPerson && <FrontAndCeiling layout={layout} view={view} />}
      <Shell
        layout={layout}
        onFloorClick={(e) => {
          if (e.delta > 8) return;
          if (mode === 'edit') onSelect?.(null);
          else walkTo.current = { x: e.point.x, z: e.point.z };
        }}
      />
      {layout.items.map((item) => (
        <Item
          key={item.id}
          item={item}
          assets={assets}
          district={district}
          time={time}
          mode={mode}
          selected={item.id === selectedId}
          playing={playing}
          mailUnread={!!props.mailUnread}
          photoUrl={photoUrl}
          onAction={onAction}
          onPick={(it, e) => {
            onSelect?.(it.id);
            drag.current = { id: it.id, pointerId: e.pointerId };
          }}
          presence={presence}
        />
      ))}
      <RoomAvatar
        assets={assets}
        avatar={avatar}
        layout={layout}
        walkTo={walkTo}
        focus={focus}
        mode={mode}
        presence={presence}
        name={props.selfName}
        tag={props.selfTag}
        together={together}
        emotes={emotes}
        firstPerson={firstPerson}
        view={view}
        heading={heading}
        dogPos={dogPos}
        pet={petGo}
        petLocal={() => petBus.forEach((fn) => fn(SELF_GESTURE))}
      />
      {presence && <RemoteAvatars presence={presence} assets={assets} emotes={emotes} />}
      {/* 꾸미는 동안에는 숨기기만 한다 (강아지를 맡은 화면이면 다른 사람 화면의 강아지가 멈추지 않게) */}
      <PetDog
        layout={layout}
        name={props.petName || petDef('dog')!.name}
        hidden={mode === 'edit'}
        onTap={() => {
          goPet();
          props.onPetTap?.();
        }}
        presence={presence}
        dogPos={dogPos}
        petBus={petBus}
        selfPos={focus}
      />
      {mode === 'edit' && <DragController drag={drag} items={itemsRef} onMove={onMoveRef} onDrop={onDrop} />}
      <FirstFrame onFrame={props.onReady} />
    </>
  );
}

export default function RoomScene(props: RoomSceneProps) {
  const low = lowQuality();
  // 가방·도감 같은 창이 화면을 다 덮으면 뒤 장면은 그리지 않는다
  const paused = usePanelOpen();
  return (
    <Canvas
      shadows="percentage"
      dpr={low ? [1, 1.25] : [1, 2]}
      gl={{ antialias: !low, alpha: true, powerPreference: 'high-performance' }}
      frameloop={paused ? 'never' : 'always'}
      camera={{ fov: roomConfig.fovDeg, position: [W / 2, 8, D + 8], near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ touchAction: 'none' }}
    >
      <SceneContent {...props} />
      <AdaptiveResolution />
      <ShadowThrottle every={quality().shadowEvery} />
    </Canvas>
  );
}
