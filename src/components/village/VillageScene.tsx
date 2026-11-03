'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cameraConfig, townConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { groundHeightAt } from '@/shared/townMap';
import { LocalPlayer, RemotePlayer } from './Characters';
import { TownContext, useTown, type TownContextValue } from './context';
import { DistrictOverlay, MapLabelSync } from './MapView';
import { Houses, Props } from './Props';
import { Decor } from './Decor';
import { windUniforms } from './wind';
import { currentHour, day, dayLookAt } from './daylight';
import { Ambient } from './Ambient';
import { normalDistance, saveCamera } from './camera';
import { now } from './session';
import { Terrain } from './Terrain';

const S = tokens.scene;
/** 저가폰을 고려해 휴대폰에서는 그림자 해상도를 낮춘다 */
const isSmallScreen = () => typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;

/** 위는 파랗고 지평선은 옅은 하늘 */
function Sky() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(S.skyTop) }, horizon: { value: new THREE.Color(S.skyHorizon) } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55);
            gl_FragColor = vec4(mix(horizon, top, t), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    material.uniforms.top.value.copy(day.look.skyTop);
    material.uniforms.horizon.value.copy(day.look.skyHorizon);
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[150, 32, 16]} />
    </mesh>
  );
}

/** 몽실몽실한 구름이 천천히 흘러간다 */
function Clouds() {
  const { map, input } = useTown();
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(
    () =>
      mergeGeometries(
        [
          [0, 0, 0, 1],
          [1.1, -0.15, 0.2, 0.75],
          [-1.1, -0.2, -0.1, 0.7],
          [0.5, 0.35, -0.2, 0.7],
          [-0.45, 0.25, 0.3, 0.62],
        ].map(([x, y, z, r]) => new THREE.SphereGeometry(r, 14, 10).scale(1, 0.72, 1).translate(x, y, z)),
      ),
    [],
  );
  const clouds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: (((i * 37) % 100) - 50) * 1.6,
        y: 20 + ((i * 13) % 9),
        z: map.height / 2 - 30 - ((i * 23) % 40) + (i % 3) * 18,
        s: 2.6 + ((i * 7) % 5) * 0.6,
        speed: 0.25 + (i % 4) * 0.08,
      })),
    [map],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  const cloudMat = useRef<THREE.MeshLambertMaterial>(null);
  const cloudDay = useMemo(() => new THREE.Color(S.cloud), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    // 전체 지도에서는 구름이 섬을 가리지 않게 숨긴다
    m.visible = input.mapBlend < 0.25;
    // 밤에는 구름이 하늘빛을 띤다
    const cm = cloudMat.current;
    if (cm) {
      cm.color.copy(cloudDay).lerp(day.look.skyHorizon, day.look.night * 0.7);
      cm.emissiveIntensity = 0.55 * (1 - day.look.night * 0.75);
    }
    if (!m.visible) return;
    const t = now();
    const span = 180;
    clouds.forEach((c, i) => {
      const x = ((((c.x + t * c.speed) % span) + span * 1.5) % span) - span / 2 + map.width / 2;
      o.position.set(x, c.y, c.z);
      o.scale.set(c.s * 1.6, c.s, c.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, clouds.length]} frustumCulled={false}>
      <meshLambertMaterial ref={cloudMat} color={S.cloud} emissive={S.cloud} emissiveIntensity={0.55} fog={false} />
    </instancedMesh>
  );
}

/** 해는 내 캐릭터를 따라다니며 주변에만 그림자를 만든다 */
function Lights() {
  const { input } = useTown();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const mapSize = isSmallScreen() ? 1024 : 2048;
  useEffect(() => {
    const cam = sun.current!.shadow.camera;
    cam.left = -15;
    cam.right = 15;
    cam.top = 15;
    cam.bottom = -15;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
  }, []);
  useFrame(() => {
    const l = sun.current!;
    l.target.position.set(input.self.x, 0, input.self.z);
    l.position.set(input.self.x - 8, 18, input.self.z + 10);
    l.target.updateMatrixWorld();
    const look = day.look;
    l.color.copy(look.sun);
    l.intensity = look.sunIntensity;
    const h = hemi.current!;
    h.color.copy(look.hemiSky);
    h.groundColor.copy(look.hemiGround);
    h.intensity = look.hemiIntensity;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[S.hemiSky, S.hemiGround, 1.55]} />
      <directionalLight
        ref={sun}
        color={S.sun}
        intensity={2.3}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
    </>
  );
}

/** 두 손가락 확대 상태. 확대 직후의 손가락 떼기가 이동 탭으로 잡히지 않게 한다. */
const pinchState = {
  active: false,
  endedAt: 0,
  recent() {
    return this.active || now() - this.endedAt < 0.3;
  },
};

/**
 * 내 캐릭터를 따라가는 카메라. 휠과 두 손가락으로 거리를, 한 손가락(마우스)으로 옆으로 끌면 방향을 바꾼다.
 * 시점 버튼·회전 버튼(VillageClient)은 input.camera의 목표값만 바꾼다. 전체 지도에서는 섬 전체를 위에서 본다.
 */
function CameraRig() {
  const { input, map } = useTown();
  const { camera, gl, size } = useThree();
  const cam = input.camera;
  if (!cam.distance) cam.distance = normalDistance(size.width, size.height);
  /** 지금 거리 (목표 거리로 부드럽게 다가간다) */
  const distNow = useRef(cam.distance);
  const target = useRef(new THREE.Vector3(input.self.x, 0, input.self.z));
  /** 내 캐릭터 자리를 처음 알았을 때 카메라를 바로 옮긴다 (맵 구석에서 날아오지 않게) */
  const placed = useRef(false);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const blend = useRef(0);
  const v = useMemo(
    () => ({ walkPos: new THREE.Vector3(), walkLook: new THREE.Vector3(), mapPos: new THREE.Vector3(), look: new THREE.Vector3() }),
    [],
  );
  const center = useMemo(() => new THREE.Vector3(map.width / 2, 0, map.height / 2), [map]);

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let distStart = cam.distance;
    /** 한 손가락 끌기: 시작점과 지난 위치 */
    let drag: { id: number; x0: number; y0: number; x: number; rotating: boolean } | null = null;
    const clamp = (d: number) => THREE.MathUtils.clamp(d, cameraConfig.minDistance, cameraConfig.maxDistance);
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (input.view !== 'walk') return;
      cam.distance = clamp(cam.distance * Math.exp(e.deltaY * 0.0012));
      // 휠은 바로 따라간다 (부드럽게 하면 굴린 만큼 늦게 움직여 답답하다)
      distNow.current = cam.distance;
      cam.onChange?.();
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, rotating: false };
      if (pointers.size === 2) {
        drag = null;
        pinchState.active = true;
        pinchStart = spread();
        distStart = cam.distance;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0 && input.view === 'walk') {
        cam.distance = clamp((distStart * pinchStart) / spread());
        distNow.current = cam.distance;
        cam.onChange?.();
        return;
      }
      if (!drag || drag.id !== e.pointerId || input.view !== 'walk') return;
      // 바닥 누르기(걷기)와 헷갈리지 않게, 옆으로 조금 끈 뒤부터 돌린다
      if (!drag.rotating && Math.abs(e.clientX - drag.x0) > 12 && Math.abs(e.clientX - drag.x0) > Math.abs(e.clientY - drag.y0)) {
        drag.rotating = true;
        drag.x = e.clientX;
      }
      if (drag.rotating) {
        // 세상을 잡고 끄는 느낌: 오른쪽으로 끌면 풍경이 오른쪽으로 돈다
        const turn = THREE.MathUtils.degToRad((e.clientX - drag.x) * cameraConfig.dragRotateDegPerPx);
        cam.yaw -= turn;
        cam.yawNow -= turn;
        drag.x = e.clientX;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (drag?.id === e.pointerId) {
        if (drag.rotating) {
          saveCamera(cam);
          cam.onChange?.();
        }
        drag = null;
      }
      if (pinchState.active && pointers.size === 0) {
        pinchState.active = false;
        pinchState.endedAt = now();
        saveCamera(cam);
      }
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
  }, [gl, input, cam]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-dt * 6);
    goal.set(input.self.x, 0, input.self.z);
    if (!placed.current && input.self.ready) {
      target.current.copy(goal);
      placed.current = true;
    }
    target.current.lerp(goal, k);
    // 시점·방향 버튼으로 바꾼 목표로 부드럽게 옮긴다
    const ease = 1 - Math.exp(-dt * 7);
    cam.yawNow += (cam.yaw - cam.yawNow) * ease;
    if (Math.abs(cam.yaw - cam.yawNow) < 1e-4) cam.yawNow = cam.yaw;
    distNow.current += (cam.distance - distNow.current) * ease;
    const d = distNow.current;
    const zoom = (d - cameraConfig.minDistance) / (cameraConfig.maxDistance - cameraConfig.minDistance);
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(cameraConfig.pitchNearDeg, cameraConfig.pitchFarDeg, zoom));
    const flat = Math.cos(pitch) * d;
    v.walkPos.set(
      target.current.x + Math.sin(cam.yawNow) * flat,
      target.current.y + 0.8 + Math.sin(pitch) * d,
      target.current.z + Math.cos(cam.yawNow) * flat,
    );
    v.walkLook.set(target.current.x, target.current.y + 0.8, target.current.z);

    // 걷기 ↔ 전체 지도 사이를 부드럽게 오간다 (지도는 항상 북쪽이 위)
    const goalBlend = input.view === 'map' ? 1 : 0;
    blend.current += (goalBlend - blend.current) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(goalBlend - blend.current) < 0.002) blend.current = goalBlend;
    input.mapBlend = blend.current;
    const e = THREE.MathUtils.smootherstep(blend.current, 0, 1);
    if (e > 0) {
      const pc = camera as THREE.PerspectiveCamera;
      const vfov = THREE.MathUtils.degToRad(pc.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * pc.aspect);
      // 섬 전체(반지름)가 화면에 들어오는 거리
      const fit = ((map.width / 2) / Math.tan(Math.min(vfov, hfov) / 2)) * 1.06;
      const mp = THREE.MathUtils.degToRad(cameraConfig.mapPitchDeg);
      v.mapPos.set(center.x, Math.sin(mp) * fit, center.z + Math.cos(mp) * fit);
      camera.position.lerpVectors(v.walkPos, v.mapPos, e);
      v.look.lerpVectors(v.walkLook, center, e);
    } else {
      camera.position.copy(v.walkPos);
      v.look.copy(v.walkLook);
    }
    camera.lookAt(v.look);
  });
  return null;
}

/** 전체 지도에서는 안개를 걷는다 (걸을 때는 먼 곳을 안개로 덮어 가볍게 보인다) */
function FogRig() {
  const { input } = useTown();
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const f = scene.fog as THREE.Fog | null;
    if (!f) return;
    const b = input.mapBlend;
    f.color.copy(day.look.fog);
    f.near = 30 + b * 900;
    f.far = 90 + b * 1800;
  });
  return null;
}

/** 바닥을 누른 자리에 잠깐 보이는 동그라미 */
function TapMarker() {
  const { input, map } = useTown();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: tokens.color.accent, transparent: true, depthWrite: false }),
    [],
  );
  useFrame(() => {
    const m = mesh.current!;
    const age = now() - input.marker.at;
    m.visible = age < 0.6;
    if (!m.visible) return;
    m.position.set(input.marker.x, groundHeightAt(map, input.marker.x, input.marker.z) + 0.05, input.marker.z);
    m.scale.setScalar(0.6 + age);
    material.opacity = 0.8 * (1 - age / 0.6);
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} material={material} visible={false}>
      <ringGeometry args={[0.28, 0.36, 28]} />
    </mesh>
  );
}

/** 나와 다른 사람들. 다른 사람은 가까운 순으로 상한까지만 그린다. 차단 관계인 사람은 그리지 않는다. */
function Players() {
  const { session, selfId, input, hidden } = useTown();
  const { playerIds } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [visible, setVisible] = useState<string[]>([]);
  const picked = useRef({ at: -1, ids: [] as readonly string[], visible: [] as string[] });

  useFrame(() => {
    // 가까운 사람 목록은 0.5초마다, 또는 접속자가 바뀌면 다시 고른다
    const p = picked.current;
    const t = now();
    if (t - p.at < 0.5 && p.ids === playerIds) return;
    p.at = t;
    p.ids = playerIds;
    const next = playerIds
      .filter((id) => id !== selfId && !hidden.has(session.player(id)?.pid ?? ''))
      .map((id) => {
        const pl = session.player(id);
        return { id, d: pl ? Math.hypot(pl.x - input.self.x, pl.z - input.self.z) : Infinity };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, townConfig.maxVisiblePlayers)
      .map((o) => o.id)
      .sort();
    if (next.join() !== p.visible.join()) {
      p.visible = next;
      setVisible(next);
    }
  });

  return (
    <>
      <LocalPlayer />
      {visible.map((id) => (
        <RemotePlayer key={id} id={id} />
      ))}
    </>
  );
}

function KeyboardInput() {
  const { input } = useTown();
  useEffect(() => {
    const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    const down = (e: KeyboardEvent) => {
      if (!MOVE_KEYS.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey || input.view !== 'walk') return;
      e.preventDefault();
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => input.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [input]);
  return null;
}

function Ground() {
  const { input } = useTown();
  function onClick(e: ThreeEvent<MouseEvent>) {
    // 끌거나 두 손가락으로 확대한 직후의 클릭, 전체 지도에서의 클릭은 무시한다
    if (e.delta > 10 || pinchState.recent() || input.view !== 'walk') return;
    input.tapTarget = { x: e.point.x, z: e.point.z };
    input.marker = { x: e.point.x, z: e.point.z, at: now() };
  }
  return <Terrain onGroundClick={onClick} />;
}

/**
 * 하루의 빛: 몇 초마다 한국 시각으로 하늘·빛을 다시 정하고, 밤이면 창문(glass)과 등(glow)을 켠다.
 * 장면의 재질은 처음 한 번 모아 둔다 (같은 모델은 재질을 함께 쓴다).
 */
function DayCycle() {
  const scene = useThree((st) => st.scene);
  const state = useRef({ at: -100, mats: null as { m: THREE.MeshStandardMaterial; kind: 'glass' | 'glow'; base: number }[] | null });
  const glow = useMemo(() => new THREE.Color(S.windowGlow), []);
  useFrame(() => {
    const st = state.current;
    const t = now();
    if (t - st.at < 4) return;
    st.at = t;
    day.hour = currentHour();
    day.look = dayLookAt(day.hour);
    if (!st.mats) {
      const found = new Map<THREE.Material, { m: THREE.MeshStandardMaterial; kind: 'glass' | 'glow'; base: number }>();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
          if (!m || !('emissive' in m) || found.has(m)) continue;
          if (m.name === 'glass' || m.name === 'glow') found.set(m, { m, kind: m.name, base: m.emissiveIntensity });
        }
      });
      st.mats = [...found.values()];
    }
    const n = day.look.night;
    for (const { m, kind, base } of st.mats) {
      if (kind === 'glass') {
        m.emissive.copy(glow);
        m.emissiveIntensity = n * 0.9;
      } else {
        m.emissiveIntensity = base * (0.6 + n * 1.6);
      }
    }
  });
  return null;
}

/** 바람 시계: 잎·풀이 흔들리는 박자 */
function WindClock() {
  useFrame(() => {
    windUniforms.uWindTime.value = now();
  });
  return null;
}

/**
 * 휴대폰에서 프레임이 밀리면(끊겨 보이면) 해상도를 한 단계씩 낮춘다. 다시 올리지는 않는다 (오르내리며 깜빡이지 않게).
 * 처음 몇 초는 셰이더 준비로 느리므로 세지 않는다.
 */
function AdaptiveResolution() {
  const setDpr = useThree((st) => st.setDpr);
  const viewport = useThree((st) => st.viewport);
  const state = useRef({ frames: 0, time: 0, skip: 3, dpr: 0 });
  useFrame((_, dt) => {
    const st = state.current;
    if (!st.dpr) st.dpr = viewport.dpr;
    if (document.hidden || dt > 1) return;
    if (st.skip > 0) {
      st.skip -= dt;
      return;
    }
    st.frames++;
    st.time += dt;
    if (st.time < 2) return;
    const fps = st.frames / st.time;
    st.frames = 0;
    st.time = 0;
    if (fps < townConfig.minFps && st.dpr > 1) {
      st.dpr = Math.max(1, Math.round((st.dpr - 0.25) * 100) / 100);
      setDpr(st.dpr);
      // 바뀐 해상도가 자리 잡을 때까지 잠깐 쉰다
      st.skip = 1;
    }
  });
  return null;
}

function FirstFrame({ onFrame }: { onFrame: () => void }) {
  useFrame(onFrame);
  return null;
}

export default function VillageScene({ value, onFirstFrame }: { value: TownContextValue; onFirstFrame: () => void }) {
  const firstFrame = useRef(false);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: cameraConfig.fov, near: 0.3, far: 1600 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <TownContext.Provider value={value}>
        <fog attach="fog" args={[S.fog, 30, 90]} />
        <Sky />
        <Clouds />
        <Lights />
        <FogRig />
        <Ground />
        <Props />
        <Decor />
        <WindClock />
        <DayCycle />
        <Ambient />
        <Houses />
        <DistrictOverlay />
        <MapLabelSync />
        <Players />
        <TapMarker />
        <CameraRig />
        <KeyboardInput />
        <AdaptiveResolution />
        <FirstFrame
          onFrame={() => {
            if (!firstFrame.current) {
              firstFrame.current = true;
              onFirstFrame();
            }
          }}
        />
      </TownContext.Provider>
    </Canvas>
  );
}
