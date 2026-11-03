'use client';

// 나의 방 3D 장면 (PROJECT_GUIDE.md 6장). 마을의 내 집 문으로 들어온 집 안.
// 보기: 원근 카메라가 방 앞쪽 위에서 캐릭터를 따라가며 비스듬히 내려다본다 (앞 벽은 없고, 벽 너머는 어둡다).
//       바닥을 누르면 캐릭터가 걸어가고, 기능 소품을 누르면 onAction.
// 꾸미기: 방 전체가 보이게 더 높이서 본다. 소품을 눌러 고르고, 끌어서 칸에 맞춰 옮긴다 (놓을 수 있는 자리로만).
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { roomConfig } from '@/config/game';
import { shiftLightness } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import type { Avatar } from '@/shared/avatar';
import { CHARACTER_CLIPS, HEAD_SOCKET, TINT_MATERIAL, type ClipName } from '@/shared/character';
import type { District } from '@/shared/districts';
import {
  blockedCells, canPlace, findRoomPath, footprintSize, furnitureDef, itemCenter,
  type FurnitureAction, type PlacedItem, type Point, type RoomLayout,
} from '@/shared/room';
import type { RoomAssets } from './assets';
import { floorTexture, wallTexture } from './textures';

const W = roomConfig.width;
const D = roomConfig.depth;
const H = roomConfig.wallHeight;
const R = tokens.room;
const WALL_T = 0.14;
const deg = THREE.MathUtils.degToRad;

export type RoomMode = 'view' | 'edit';
/** inside: 캐릭터를 따라 방 안을 본다 / overview: 방 전체를 본다 (꾸미기, 가입 미리보기) */
export type RoomFraming = 'inside' | 'overview';
type TimeOfDay = 'day' | 'evening' | 'night';

export interface RoomSceneProps {
  assets: RoomAssets;
  layout: RoomLayout;
  district: District;
  avatar: Avatar;
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
  photoUrl?: (id: string) => string;
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

/**
 * 화면 크기와 HUD에 맞춘 카메라 자리: 내려다보는 각도와, 방 상자 전체가 HUD 사이에 들어오는 거리.
 * 화면 중심은 HUD 사이 가운데로 옮겨 둔다 (setViewOffset).
 */
function frameFor(framing: RoomFraming, width: number, height: number, availH: number) {
  const tanV = Math.tan(deg(roomConfig.fovDeg) / 2);
  const tanH = tanV * (width / height);
  // HUD 사이에서 위아래로 보이는 범위
  const tanAvail = tanV * (availH / height);
  const portrait = width < availH;
  const pitch = deg(framing === 'overview' ? roomConfig.overviewPitchDeg : portrait ? roomConfig.portraitPitchDeg : roomConfig.pitchDeg);
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
  return { pitch, dist, center, tanH, tanAvail };
}

/**
 * 처음에는 방 전체가 HUD 사이에 들어오게 본다. 보기에서는 휠·두 손가락으로 다가갈 수 있고,
 * 다가가면 캐릭터(focus)를 따라가되 벽 밖이 너무 보이지 않게 붙잡아 둔다.
 * 들어설 때는 조금 멀고 높은 곳에서 방 안으로 다가온다 (방에 들어서는 느낌).
 */
function CameraRig({
  framing, insetTop = 0, insetBottom = 0, focus,
}: {
  framing: RoomFraming;
  insetTop?: number;
  insetBottom?: number;
  focus: React.RefObject<Point>;
}) {
  const { camera, size, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const availH = Math.max(160, size.height - insetTop - insetBottom);
  const frame = useMemo(() => frameFor(framing, size.width, size.height, availH), [framing, size.width, size.height, availH]);
  // 움직임 줄이기를 켠 사람에게는 다가오는 연출을 하지 않는다
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const now = useRef({ look: new THREE.Vector3(W / 2, 0.6, D / 2), goal: new THREE.Vector3(), dist: 0, pitch: 0, enter: reduced ? 1 : 0 });
  /** 다가간 정도 (1 = 방 전체, minZoom = 가장 가까이) */
  const zoom = useRef(1);

  // 화면 중심을 HUD 사이 가운데로 (아래 HUD가 크면 방을 위로 올린다)
  useEffect(() => {
    cam.fov = roomConfig.fovDeg;
    cam.near = 0.1;
    cam.far = 200;
    cam.setViewOffset(size.width, size.height, 0, (insetBottom - insetTop) / 2, size.width, size.height);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
    };
  }, [cam, size.width, size.height, insetTop, insetBottom]);

  // 휠·두 손가락으로 다가가기 (꾸미기와 미리보기에서는 방 전체를 본다)
  useEffect(() => {
    if (framing !== 'inside') {
      zoom.current = 1;
      return;
    }
    const el = gl.domElement;
    const clampZoom = (z: number) => clamp(z, roomConfig.minZoom, 1);
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let zoomStart = 1;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = clampZoom(zoom.current * Math.exp(e.deltaY * 0.0012));
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        pinch = spread();
        zoomStart = zoom.current;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch > 0) zoom.current = clampZoom((zoomStart * pinch) / spread());
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [framing, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = now.current;
    const z = framing === 'inside' ? zoom.current : 1;
    const dist = frame.dist * z;
    // 다가간 만큼 캐릭터를 따라간다 (0 = 방 가운데, 1 = 캐릭터)
    const follow = (1 - z) / (1 - roomConfig.minZoom);
    const f = focus.current;
    const halfW = dist * frame.tanH;
    const tx = halfW * 2 >= W + 0.6 ? W / 2 : clamp(f.x, halfW - 0.3, W - halfW + 0.3);
    const tz = THREE.MathUtils.lerp(frame.center.z, f.z, 0.7 * follow);
    const ty = THREE.MathUtils.lerp(frame.center.y, 0.7, follow);
    const first = st.dist === 0;
    const k = first ? 1 : 1 - Math.exp(-dt * 5);
    st.look.lerp(st.goal.set(THREE.MathUtils.lerp(W / 2, tx, follow), ty, tz), k);
    st.dist = first ? dist : st.dist + (dist - st.dist) * k;
    st.pitch = first ? frame.pitch : st.pitch + (frame.pitch - st.pitch) * k;
    // 들어설 때: 조금 멀고 높은 곳에서 다가온다
    st.enter = Math.min(1, st.enter + dt / roomConfig.enterSec);
    const away = Math.pow(1 - st.enter, 3);
    const d = st.dist * (1 + 0.4 * away);
    const pitch = st.pitch + deg(12) * away;
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
  photoUrl?: (id: string) => string;
  onPick: (item: PlacedItem, e: ThreeEvent<PointerEvent>) => void;
  onAction?: (action: FurnitureAction, item: PlacedItem) => void;
}

function Item({ item, assets, district, time, mode, selected, playing, photoUrl, onPick, onAction }: ItemProps) {
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
        const tint = time === 'night' && district !== 'water' ? R.night : time === 'evening' && district !== 'water' ? R.evening : '#FFFFFF';
        mesh.material = new THREE.MeshBasicMaterial({ map: assets.views[district], color: tint });
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

function RoomAvatar({
  assets, avatar, layout, walkTo, focus,
}: {
  assets: RoomAssets;
  avatar: Avatar;
  layout: RoomLayout;
  walkTo: React.RefObject<Point | null>;
  /** 카메라가 따라갈 캐릭터 자리 */
  focus: React.RefObject<Point>;
}) {
  const color = tokens.avatar[avatar.color];
  const { model, mixer, actions } = useMemo(() => {
    const model = SkeletonUtils.clone(assets.avatar.scene);
    const tint = (root: THREE.Object3D, c: string) =>
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.name === TINT_MATERIAL) {
          mesh.material = mat.clone();
          (mesh.material as THREE.MeshStandardMaterial).color.set(c);
        }
      });
    tint(model, color);
    const acc = assets.accessories[avatar.accessory];
    if (acc) {
      const a = acc.clone();
      tint(a, shiftLightness(color, -0.18));
      model.getObjectByName(HEAD_SOCKET)?.add(a);
    }
    model.scale.setScalar(AVATAR_SCALE);
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      CHARACTER_CLIPS.map((name) => [name, mixer.clipAction(assets.avatar.animations.find((c) => c.name === name)!)]),
    ) as Record<ClipName, THREE.AnimationAction>;
    actions.idle.play();
    return { model, mixer, actions };
  }, [assets, avatar.accessory, color]);

  const blocked = useMemo(() => blockedCells(layout.items), [layout.items]);
  const state = useRef({ pos: startSpot(blocked), rot: 0, facing: 0, path: null as Point[] | null, clip: 'idle' as ClipName });

  useEffect(() => () => {
    mixer.stopAllAction();
  }, [mixer]);

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
    let walking = false;
    if (s.path?.length) {
      const next = s.path[0];
      const dx = next.x - s.pos.x;
      const dz = next.z - s.pos.z;
      const dist = Math.hypot(dx, dz);
      const step = roomConfig.walkSpeed * dt;
      if (dist <= step) {
        s.pos = { ...next };
        s.path.shift();
      } else {
        s.pos = { x: s.pos.x + (dx / dist) * step, z: s.pos.z + (dz / dist) * step };
      }
      if (dist > 1e-4) s.facing = Math.atan2(dx, dz);
      walking = true;
    }
    s.rot += Math.atan2(Math.sin(s.facing - s.rot), Math.cos(s.facing - s.rot)) * (1 - Math.exp(-dt * TURN_RATE));
    const clip: ClipName = walking ? 'walk' : 'idle';
    if (clip !== s.clip) {
      const next = actions[clip].reset().play();
      actions[s.clip].crossFadeTo(next, 0.18, false);
      s.clip = clip;
    }
    mixer.update(dt);
    model.position.set(s.pos.x, 0, s.pos.z);
    model.rotation.y = s.rot;
    focus.current = s.pos;
  });

  return <primitive object={model} />;
}

// ───────────────────────── 장면 ─────────────────────────

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

function SceneContent(props: RoomSceneProps) {
  const { assets, layout, district, avatar, mode, selectedId = null, onSelect, onMove, onAction, playing = false, photoUrl } = props;
  const framing: RoomFraming = mode === 'edit' ? 'overview' : (props.framing ?? 'inside');
  const time = useMemo(timeOfDay, []);
  const walkTo = useRef<Point | null>(null);
  const focus = useRef<Point>({ x: W / 2, z: D - 1.5 });
  const drag = useRef<{ id: string; pointerId: number } | null>(null);
  const itemsRef = useRef(layout.items);
  itemsRef.current = layout.items;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  return (
    <>
      <CameraRig framing={framing} insetTop={props.insetTop} insetBottom={props.insetBottom} focus={focus} />
      <Lights time={time} />
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
          photoUrl={photoUrl}
          onAction={onAction}
          onPick={(it, e) => {
            onSelect?.(it.id);
            drag.current = { id: it.id, pointerId: e.pointerId };
          }}
        />
      ))}
      <RoomAvatar assets={assets} avatar={avatar} layout={layout} walkTo={walkTo} focus={focus} />
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
