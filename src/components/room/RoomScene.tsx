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
import { CHARACTER_HEIGHT, faceFor, type ClipName } from '@/shared/character';
import { attachAccessory, brightenFur, characterActions, cloneCharacter, faceControl, petInstance, tintOutfit, withMeshopt } from '@/lib/characterRig';
import { petDef } from '@/shared/pets';
import { themeOf, type District } from '@/shared/districts';
import {
  blockedCells, canPlace, findRoomPath, footprintSize, furnitureDef, itemCenter, moveInRoom,
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
  /** 강아지를 눌렀을 때 (방 주인 화면은 이름 짓기를 띄운다) */
  onPetTap?: () => void;
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
 * enter = 들어서기 진행 (0 = 문 밖, 1 = 내 자리), door = 현관문 열림 (0~1)
 */
export interface FirstPersonView {
  yaw: number;
  pitch: number;
  enter: number;
  door: number;
  /** 화면을 끌어 둘러보는 중 (걷는 쪽으로 따라 돌지 않는다) */
  looking: boolean;
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
    if (reduced) view.current.enter = 1;
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
      // 들어서기: 문이 열리고(처음 35%) 문 밖에서 내 자리까지 걸어 들어온다
      v.enter = Math.min(1, v.enter + dt / roomConfig.doorEnterSec);
      v.door = smooth(0, 0.35, v.enter);
      const walkIn = smooth(0.25, 1, v.enter);
      // 내 자리에서 바라보는 반대쪽으로 조금 뺀 자리 (방이 더 넓게 담긴다, 벽 안쪽까지만)
      const back = roomConfig.eyeBack;
      seat.current.set(
        clamp(f.x - Math.sin(v.yaw) * back, EYE_MARGIN, W - EYE_MARGIN),
        roomConfig.eyeHeight,
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
    // 방 전체 보기: 조금 멀고 높은 곳에서 방 가운데로 다가온다
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
  const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
  return (
    <>
      <hemisphereLight args={[R.hemiSky, R.hemiGround, 1.7 * k]} />
      <directionalLight
        ref={sun}
        position={[W / 2 + 5, 9, D / 2 + 7]}
        color={sunColor}
        intensity={1.9 * k}
        castShadow
        shadow-mapSize={[small ? 1024 : 2048, small ? 1024 : 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </>
  );
}

// ───────────────────────── 바닥과 벽 ─────────────────────────

/** 현관문 (앞 벽 가운데): 폭·높이 (칸). 1인칭으로 들어설 때 문 밖 이만큼에서 출발한다 */
const DOOR_W = 1.1;
const DOOR_H = 2.15;
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
 * 현관문은 들어설 때 안쪽으로 열린다 (view.door).
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
}

function Item({ item, assets, district, time, mode, selected, playing, mailUnread, photoUrl, onPick, onAction }: ItemProps) {
  const def = furnitureDef(item.key)!;
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

  return (
    <group position={position}>
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
  drag, items, onMove,
}: {
  drag: React.RefObject<{ id: string; pointerId: number } | null>;
  items: React.RefObject<PlacedItem[]>;
  onMove: React.RefObject<((item: PlacedItem) => void) | undefined>;
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
        const wall = onBack && (!onLeft || back!.x >= 0.3) ? 'back' : onLeft ? 'left' : null;
        if (wall) {
          const along = wall === 'back' ? back!.x : left!.z;
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
      if (drag.current?.pointerId === e.pointerId) drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [camera, gl, drag, items, onMove]);
  return null;
}

// ───────────────────────── 캐릭터 ─────────────────────────

const AVATAR_SCALE = 0.92;
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

/** 캐릭터 모델: 몸 색을 입히고 머리 소품을 단다 */
function useAvatarModel(assets: RoomAssets, body: AvatarBody | '' | undefined, colorKey: string, accessory: string) {
  const color = tokens.avatar[colorKey as Avatar['color']] ?? tokens.avatar.mint;
  const gltf = useBodyModel(assets, body);
  const built = useMemo(() => {
    const model = cloneCharacter(gltf);
    model.traverse((o) => void ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).castShadow = true)));
    const tinted = tintOutfit(model, color);
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
  }, [assets, gltf, accessory, color]);
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
    sp.scale.setScalar(0.55 * (0.6 + 0.4 * pop));
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
function RoomAvatar({
  assets, avatar, layout, walkTo, focus, mode, presence, name, tag, together, emotes, firstPerson, view, heading,
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
}) {
  const m = useAvatarModel(assets, avatar.body, avatar.color, avatar.accessory);
  const blocked = useMemo(() => blockedCells(layout.items), [layout.items]);
  const state = useRef({ pos: startSpot(blocked), rot: 0, facing: 0, path: null as Point[] | null });
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
      if (!MOVE_KEYS.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
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
    // 가구가 캐릭터 자리로 옮겨 오면 가까운 빈 칸으로 비킨다
    const cell = Math.floor(s.pos.z) * W + Math.floor(s.pos.x);
    if (blocked[cell]) {
      s.pos = startSpot(blocked);
      s.path = null;
    }
    if (walkTo.current) {
      s.path = findRoomPath(blocked, s.pos, walkTo.current);
      walkTo.current = null;
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
    // 1인칭에서 서 있으면 바라보는 쪽을 본다 (다른 사람 화면에서 내가 보는 쪽을 향한다)
    if (firstPerson && !walking) s.facing = v.yaw;
    s.rot += Math.atan2(Math.sin(s.facing - s.rot), Math.cos(s.facing - s.rot)) * (1 - Math.exp(-dt * TURN_RATE));
    playClip(m, clipFor(presence, SELF_GESTURE, walking), activeEmote(presence, SELF_GESTURE));
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
  const m = useAvatarModel(assets, p?.body, p?.color ?? 'mint', p?.acc ?? 'none');
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
    playClip(m, clipFor(presence, id, s.moving || Math.hypot(a.x - bx, a.z - bz) > 0.002), activeEmote(presence, id));
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

/** 방 강아지 키 (마을에서 데리고 다니는 강아지와 같다) */
const PET_HEIGHT = petDef('dog')!.height;
const PET_SPEED = 1.3;
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
 * 방에 사는 강아지. 빈 칸을 골라 다리로 걸어 다니다(걷기 동작) 잠깐 쉰다(서 있기 동작). 누르면 폴짝 뛰고 하트와 이름이 뜬다.
 * 자리는 화면마다 따로 정한다 (서버로 맞추지 않는다). 모델은 방을 그린 뒤에 받는다.
 */
function PetDog({ layout, name, onTap }: { layout: RoomLayout; name: string; onTap?: () => void }) {
  const [inst, setInst] = useState<ReturnType<typeof petInstance> | null>(null);
  const [heart, setHeart] = useState<THREE.Texture | null>(null);
  const blocked = useMemo(() => blockedCells(layout.items), [layout.items]);
  const group = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);
  const tag = useMemo(() => tagTexture(name, tokens.color.accent, false), [name]);
  const state = useRef({
    pos: { x: W / 2 + 1, z: D - 1.2 } as Point, path: null as Point[] | null, rest: 1.5, facing: 0, rot: 0, petAt: -10, petted: false,
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

  useFrame(({ clock }, rawDt) => {
    const g = group.current;
    if (!g || !inst) return;
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    const t = clock.elapsedTime;
    if (s.petted) {
      s.petted = false;
      s.petAt = t;
    }
    // 가구가 옮겨 와 갇히면 빈 칸으로 비킨다
    if (blocked[Math.floor(s.pos.z) * W + Math.floor(s.pos.x)]) {
      s.pos = startSpot(blocked);
      s.path = null;
    }
    let moving = false;
    if (s.path?.length) {
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
    s.rot += Math.atan2(Math.sin(s.facing - s.rot), Math.cos(s.facing - s.rot)) * (1 - Math.exp(-dt * 8));
    // 다리로 걷고 쉴 때는 서 있기 동작 (뼈대 없는 예전 모델이면 깡총깡총). 누르면 한 번 크게 뛴다
    inst.update(dt, moving ? PET_SPEED : 0);
    const petted = t - s.petAt;
    const jump = petted < 0.5 ? Math.sin((petted / 0.5) * Math.PI) * 0.25 : 0;
    const hop = !inst.animated && moving ? Math.abs(Math.sin(t * 11)) * 0.06 : 0;
    g.position.set(s.pos.x, hop + jump, s.pos.z);
    g.rotation.y = s.rot;
    const b = bubble.current;
    if (b) {
      b.visible = petted < 2.4;
      b.position.set(s.pos.x, PET_HEIGHT + 0.35 + jump + Math.sin(t * 5) * 0.02, s.pos.z);
    }
  });

  if (!inst) return null;
  return (
    <>
      <group
        ref={group}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          state.current.petted = true;
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

function SceneContent(props: RoomSceneProps) {
  const { assets, layout, district, avatar, mode, selectedId = null, onSelect, onMove, onAction, playing = false, photoUrl, presence } = props;
  const framing: RoomFraming = mode === 'edit' ? 'overview' : (props.framing ?? 'inside');
  const time = useMemo(timeOfDay, []);
  const walkTo = useRef<Point | null>(null);
  const focus = useRef<Point>({ x: W / 2, z: D - 1.5 });
  const firstPerson = framing === 'inside';
  const view = useRef<FirstPersonView>({ yaw: Math.PI, pitch: deg(roomConfig.firstPersonPitchDeg), enter: 0, door: 0, looking: false });
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
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

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
      />
      {presence && <RemoteAvatars presence={presence} assets={assets} emotes={emotes} />}
      {mode !== 'edit' && <PetDog layout={layout} name={props.petName || petDef('dog')!.name} onTap={props.onPetTap} />}
      {mode === 'edit' && <DragController drag={drag} items={itemsRef} onMove={onMoveRef} />}
      <FirstFrame onFrame={props.onReady} />
    </>
  );
}

export default function RoomScene(props: RoomSceneProps) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: roomConfig.fovDeg, position: [W / 2, 8, D + 8], near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ touchAction: 'none' }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
