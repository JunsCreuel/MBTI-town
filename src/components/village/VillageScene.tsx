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
import { currentHour, day, dayLookAt, indoorLook } from './daylight';
import { clubPulse, isIndoor, mod } from './club';
import { drunkLevel, swayAllowed } from './drunk';
import { Ambient } from './Ambient';
import { normalDistance, saveCamera } from './camera';
import { pointerState } from './pointer';
import { now } from './session';
import { Terrain } from './Terrain';
import { BeaconSigns } from './BeaconSigns';
import { GuideNpc } from './GuideNpc';
import { ClubNpcs } from './ClubNpcs';
import { ClubScreen } from './ClubScreen';
import { MarketStalls } from './Market';
import { SajuNpc } from './SajuNpc';

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
  // 처음부터 지도로 여는 화면(둘러보기)은 날아오지 않고 바로 지도에서 시작한다
  const blend = useRef(input.view === 'map' ? 1 : 0);
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
      // 지도에서는 휠을 막지 않는다 (둘러보기 화면이 위아래로 넘어가게)
      if (input.view !== 'walk') return;
      e.preventDefault();
      cam.distance = clamp(cam.distance * Math.exp(e.deltaY * 0.0012));
      // 휠은 바로 따라간다 (부드럽게 하면 굴린 만큼 늦게 움직여 답답하다)
      distNow.current = cam.distance;
      cam.onChange?.();
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, rotating: false };
        pointerState.down(e.clientX, e.clientY);
      }
      if (pointers.size === 2) {
        drag = null;
        pointerState.pinching = true;
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
      if (!drag || drag.id !== e.pointerId) return;
      pointerState.move(e.clientX, e.clientY);
      if (input.view !== 'walk') return;
      // 바닥 누르기(걷기)와 헷갈리지 않게, 옆으로 조금 끈 뒤부터 돌린다
      if (!drag.rotating && Math.abs(e.clientX - drag.x0) > 12 && Math.abs(e.clientX - drag.x0) > Math.abs(e.clientY - drag.y0)) {
        drag.rotating = true;
        drag.x = e.clientX;
      }
      if (drag.rotating) {
        // 세상을 잡고 끄는 느낌: 오른쪽으로 끌면 풍경이 오른쪽으로 돈다. 목표만 바꾸고 카메라가 부드럽게 따라간다.
        const turn = THREE.MathUtils.degToRad((e.clientX - drag.x) * cameraConfig.dragRotateDegPerPx);
        cam.yaw -= turn;
        drag.x = e.clientX;
        pointerState.rotated = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (drag?.id === e.pointerId) {
        pointerState.up();
        if (drag.rotating) {
          saveCamera(cam);
          cam.onChange?.();
        }
        drag = null;
      }
      if (pointerState.pinching && pointers.size === 0) {
        pointerState.pinching = false;
        pointerState.pinchEndedAt = now();
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
    // 취했으면(클럽 바에서 세 잔부터) 화면이 천천히 출렁이고 기울어진다
    const tipsy = swayAllowed() ? drunkLevel() * (1 - e) : 0;
    const tt = now();
    if (tipsy > 0) {
      camera.position.x += Math.sin(tt * 0.55) * 0.45 * tipsy;
      camera.position.y += Math.sin(tt * 0.9) * 0.18 * tipsy;
    }
    camera.lookAt(v.look);
    if (tipsy > 0) camera.rotateZ((Math.sin(tt * 0.8) * 0.045 + Math.sin(tt * 2.1) * 0.014) * tipsy);
  });
  return null;
}

/** 전체 지도에서는 안개를 걷는다 (걸을 때는 먼 곳을 안개로 덮어 가볍게 보인다) */
function FogRig() {
  const { input, map } = useTown();
  const indoor = useMemo(() => isIndoor(map), [map]);
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const f = scene.fog as THREE.Fog | null;
    if (!f) return;
    const b = input.mapBlend;
    f.color.copy(day.look.fog);
    // 실내는 홀이 다 보이게 멀리서부터 어두워진다
    f.near = (indoor ? 26 : 30) + b * 900;
    f.far = (indoor ? 64 : 90) + b * 1800;
  });
  return null;
}

/** 바깥은 하늘·구름·나비, 실내(클럽)는 어둠 */
function Outdoors() {
  const { map } = useTown();
  if (isIndoor(map)) return <color attach="background" args={[S.clubVoid]} />;
  return (
    <>
      <Sky />
      <Clouds />
      <Ambient />
    </>
  );
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
  const { input, session } = useTown();
  useEffect(() => {
    const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    /** 스페이스바 점프: 다른 사람에게도 보인다 (서버가 몸짓 간격을 지키므로 화면도 같은 간격으로) */
    let lastJump = 0;
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || input.view !== 'walk') return;
      if (e.code === 'Space') {
        // 글을 쓰거나 버튼에 초점이 있을 때는 원래 동작 (띄어쓰기·누르기)
        const el = e.target as HTMLElement | null;
        if (el?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
        e.preventDefault();
        const t = Date.now();
        if (e.repeat || t - lastJump < townConfig.emoteCooldownMs) return;
        lastJump = t;
        session.sendAction('jump');
        return;
      }
      if (!MOVE_KEYS.includes(e.code)) return;
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
  }, [input, session]);
  return null;
}

function Ground() {
  const { input } = useTown();
  function onClick(e: ThreeEvent<MouseEvent>) {
    // 끌거나 두 손가락으로 확대한 직후의 클릭, 전체 지도에서의 클릭은 무시한다
    // 꾹 누르거나 끌었으면(카메라 돌리기) 걷지 않는다
    if (!pointerState.tapped() || input.view !== 'walk') return;
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
  const { map } = useTown();
  const indoor = useMemo(() => isIndoor(map), [map]);
  const state = useRef({ at: -100, mats: null as { m: THREE.MeshStandardMaterial; kind: 'glass' | 'glow'; base: number }[] | null });
  const glow = useMemo(() => new THREE.Color(S.windowGlow), []);
  // 맵이 바뀌면(클럽 ↔ 바깥) 빛을 바로 다시 정하고 재질도 다시 모은다
  useEffect(() => {
    state.current.at = -100;
    state.current.mats = null;
  }, [map]);
  useFrame(() => {
    const st = state.current;
    const t = now();
    if (t - st.at < 4) return;
    st.at = t;
    day.hour = currentHour();
    day.look = indoor ? indoorLook() : dayLookAt(day.hour);
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

/**
 * 실내 클럽 조명 (클럽 맵에만 있다). 지금 흐르는 곡의 박자(BPM)에 맞춰 움직인다 (음악을 꺼도 같은 박자).
 * - 가운데 무대 바닥 칸이 박자마다 색을 바꾼다
 * - 천장 조명 넷이 무대로 색 빛줄기를 흔든다
 * - 미러볼이 돌며 바닥에 빛 조각을 뿌린다
 * - 벽 위·아래에 네온 띠가 흐른다
 * - 색 조명 둘이 무대를 비춘다
 */
const CLUB_COLORS = S.clubNeon;
/** 곡 정보가 없을 때 조명이 넘어가는 빠르기 (초당 박자) */
const IDLE_BPS = 2.1;
const CEILING = 5;
function ClubFx() {
  const { map, input } = useTown();
  const isClub = useMemo(() => map.props.some((p) => p.key === 'prop.club.booth'), [map]);
  const tiles = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const spots = useRef<THREE.InstancedMesh>(null);
  const neon = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const c = map.width / 2;
  const cz = map.height / 2;
  const floorY = useMemo(() => groundHeightAt(map, c, cz), [map, c, cz]);
  const cells = useMemo(() => {
    const out: { x: number; z: number; k: number }[] = [];
    for (let z = -4; z < 4; z++) for (let x = -4; x < 4; x++) {
      if (Math.hypot(x + 0.5, z + 0.5) <= 4.4) out.push({ x: c + x + 0.5, z: cz + z + 0.5, k: (x * 7 + z * 13 + 100) % 5 });
    }
    return out;
  }, [c, cz]);
  // 벽 네온 띠: 벽마다 위·아래 두 줄 (벽 정면 = 홀 안쪽)
  const strips = useMemo(
    () =>
      map.props
        .filter((p) => p.key === 'prop.club.wall' || p.key === 'prop.club.door')
        .flatMap((p, i) =>
          [2.78, 0.3].map((y, row) => ({
            wx: p.x,
            wz: p.z,
            x: p.x + Math.sin(p.yaw) * 0.25,
            z: p.z + Math.cos(p.yaw) * 0.25,
            y: groundHeightAt(map, p.x, p.z) + y,
            yaw: p.yaw,
            k: i + row * 2,
          })),
        ),
    [map],
  );
  const fixtures = useMemo(() => [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6]].map(([x, z]) => new THREE.Vector3(c + x, CEILING, cz + z)), [c, cz]);
  const SPOTS = 18;
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const off = useMemo(() => new THREE.Color(S.clubTileOff), []);
  // 빛줄기: 꼭짓점이 천장 조명에 있고 아래로 넓어진다 (꼭짓점을 축으로 흔든다)
  const beamGeo = useMemo(() => new THREE.ConeGeometry(1.05, 5.4, 18, 1, true).translate(0, -2.7, 0), []);
  useEffect(() => () => beamGeo.dispose(), [beamGeo]);
  useEffect(() => {
    const m = tiles.current;
    if (m) {
      cells.forEach((cell, i) => {
        o.position.set(cell.x, groundHeightAt(map, cell.x, cell.z) + 0.035, cell.z);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.set(0.92, 0.92, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    shown.current = new Int8Array(strips.length).fill(-1);
  }, [cells, strips, map, o]);
  /** 네온 띠가 보이는지 (-1 = 아직 안 정함). 흐려진(카메라 쪽) 벽의 띠는 허공에 떠 보이므로 숨긴다 */
  const shown = useRef(new Int8Array(0));
  const pulse = useRef({ level: 0 });
  useFrame((_, dt) => {
    if (!isClub) return;
    const t = now();
    // 박자: 지금 흐르는 곡에 맞춘다 (곡 정보가 없으면 정해진 빠르기)
    const beat = clubPulse();
    const step = beat ? beat.step : Math.floor(t * IDLE_BPS);
    const target = beat ? 0.2 + 0.8 * beat.level : 0.35 + 0.35 * Math.max(0, Math.cos(((t * IDLE_BPS) % 1) * Math.PI));
    const p = pulse.current;
    p.level += (target - p.level) * (1 - Math.exp(-Math.min(dt, 0.1) * 14));
    const glow = 0.55 + 0.6 * p.level;

    const m = tiles.current;
    if (m) {
      cells.forEach((cell, i) => {
        const on = mod(cell.k + step, 5);
        // 박자마다 두세 칸 건너 하나씩 밝힌다
        if (on < 2) m.setColorAt(i, col.set(CLUB_COLORS[mod(cell.k + step, CLUB_COLORS.length)]).multiplyScalar(glow));
        else m.setColorAt(i, off);
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    const g = beams.current;
    if (g) {
      g.children.forEach((b, i) => {
        // 바깥쪽 조명은 무대 가운데를 향해 기울어진 채 흔든다
        const f = fixtures[i];
        const toward = Math.atan2(c - f.x, cz - f.z);
        b.rotation.set(Math.cos(t * 0.8 + i * 2.1) * 0.45 + 0.35 * Math.cos(toward), 0, -Math.sin(t * 0.95 + i * 1.6) * 0.45 - 0.35 * Math.sin(toward));
        const mat = (b as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.color.set(CLUB_COLORS[mod(i + Math.floor(step / 4), CLUB_COLORS.length)]);
        mat.opacity = 0.08 + 0.12 * p.level;
      });
    }
    if (ball.current) ball.current.rotation.y = t * 0.8;
    const sp = spots.current;
    if (sp) {
      for (let i = 0; i < SPOTS; i++) {
        const r = 1.5 + (i % 6) * 1.25;
        const a = t * 0.55 + i * 2.39;
        const x = c + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r * 0.85;
        o.position.set(x, groundHeightAt(map, x, z) + 0.05, z);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.setScalar(0.8 + 0.5 * p.level);
        o.updateMatrix();
        sp.setMatrixAt(i, o.matrix);
      }
      sp.instanceMatrix.needsUpdate = true;
    }
    const n = neon.current;
    if (n) {
      // 벽과 같은 기준(Props의 blocks)으로 카메라 쪽 벽인지 본다
      const yaw = input.camera.yawNow;
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      let moved = false;
      strips.forEach((st, i) => {
        const vis = input.view !== 'walk' || (st.wx - input.self.x) * sy + (st.wz - input.self.z) * cy <= 0.4 ? 1 : 0;
        if (shown.current[i] === vis) return;
        shown.current[i] = vis;
        o.position.set(st.x, st.y, st.z);
        o.rotation.set(0, st.yaw, 0);
        o.scale.setScalar(vis);
        o.updateMatrix();
        n.setMatrixAt(i, o.matrix);
        moved = true;
      });
      if (moved) n.instanceMatrix.needsUpdate = true;
      // 네온은 천천히 색이 흘러가고, 박자에 맞춰 밝아진다
      const flow = Math.floor(t * 1.2);
      strips.forEach((st, i) => n.setColorAt(i, col.set(CLUB_COLORS[(st.k + flow) % CLUB_COLORS.length]).multiplyScalar(0.5 + 0.5 * glow)));
      if (n.instanceColor) n.instanceColor.needsUpdate = true;
    }
    lights.current.forEach((l, i) => {
      if (!l) return;
      l.color.set(CLUB_COLORS[mod(step + i * 2, CLUB_COLORS.length)]);
      l.intensity = 10 + 30 * p.level;
    });
  });
  if (!isClub) return null;
  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, cells.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group ref={beams}>
        {fixtures.map((f, i) => (
          <mesh key={i} position={f} geometry={beamGeo}>
            <meshBasicMaterial color={CLUB_COLORS[i]} transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* 천장 조명 몸체 */}
      {fixtures.map((f, i) => (
        <mesh key={i} position={[f.x, f.y + 0.12, f.z]}>
          <cylinderGeometry args={[0.2, 0.26, 0.32, 12]} />
          <meshStandardMaterial color={S.clubTileOff} roughness={0.6} />
        </mesh>
      ))}
      {/* 미러볼과 줄 */}
      <mesh ref={ball} position={[c, CEILING - 0.6, cz]}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color={S.clubBall} metalness={0.4} roughness={0.25} flatShading emissive={S.clubBall} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[c, CEILING + 0.6, cz]}>
        <cylinderGeometry args={[0.015, 0.015, 1.8, 4]} />
        <meshBasicMaterial color={S.clubTileOff} />
      </mesh>
      <instancedMesh ref={spots} args={[undefined, undefined, SPOTS]} frustumCulled={false}>
        <circleGeometry args={[0.16, 10]} />
        <meshBasicMaterial color={S.clubBall} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={neon} args={[undefined, undefined, strips.length]} frustumCulled={false}>
        <boxGeometry args={[1.96, 0.07, 0.05]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {[-1, 1].map((sx, i) => (
        <pointLight key={sx} ref={(el) => void (lights.current[i] = el)} position={[c + sx * 2.6, floorY + 3.2, cz]} distance={16} decay={1.6} intensity={12} />
      ))}
    </>
  );
}

/** 열매 따기 연출: 나무 위에서 열매 몇 알이 톡톡 떨어져 굴렀다가 사라진다 */
const DROP_SECONDS = 1.6;
const DROPS_PER_PICK = 3;
function FruitDrops() {
  const { input, map } = useTown();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const max = 12 * DROPS_PER_PICK;
  const o = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = now();
    input.drops = input.drops.filter((d) => t - d.at < DROP_SECONDS);
    let n = 0;
    for (const d of input.drops) {
      for (let k = 0; k < DROPS_PER_PICK && n < max; k++) {
        const u = (t - d.at) / DROP_SECONDS;
        // 나무 둘레로 흩어지며 떨어지고 한 번 튀어 오른다
        const ang = k * 2.1 + d.at;
        const spread = 0.45 + k * 0.18;
        const x = d.x + Math.cos(ang) * spread * Math.min(1, u * 2);
        const z = d.z + Math.sin(ang) * spread * Math.min(1, u * 2) + 0.4;
        const ground = groundHeightAt(map, x, z);
        const fall = Math.max(0, 1 - u * 2.2);
        const bounce = u > 0.45 ? Math.abs(Math.sin((u - 0.45) * 9)) * 0.25 * (1 - u) : 0;
        o.position.set(x, ground + 0.12 + fall * fall * 1.6 + bounce, z);
        o.scale.setScalar(u > 0.85 ? (1 - u) / 0.15 : 1);
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n, color.set(d.color));
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, max]} frustumCulled={false} castShadow>
      <sphereGeometry args={[0.13, 12, 9]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  );
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
        <Outdoors />
        <Lights />
        <FogRig />
        <Ground />
        <Props />
        <Decor />
        <WindClock />
        <DayCycle />
        <Houses />
        <DistrictOverlay />
        <MapLabelSync />
        <Players />
        <TapMarker />
        <CameraRig />
        <KeyboardInput />
        <AdaptiveResolution />
        <FruitDrops />
        <ClubFx />
        <ClubScreen />
        <BeaconSigns />
        <GuideNpc />
        <ClubNpcs />
        <MarketStalls />
        <SajuNpc />
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

/**
 * 둘러보기(EXPLORE)의 마을 지도: 걷는 사람 없이 위에서 내려다본 본섬. 마을에서 전체 지도를 켰을 때와 같은 화면이다.
 * value.input.view = 'map'으로 넘기면 처음부터 지도로 보인다. 이름표(HTML)는 부르는 쪽이 value.input.labels에 건다.
 */
export function MapScene({ value, onFirstFrame }: { value: TownContextValue; onFirstFrame: () => void }) {
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
        <Outdoors />
        <Lights />
        <FogRig />
        <Ground />
        <Props />
        <Decor />
        <WindClock />
        <DayCycle />
        <Houses />
        <DistrictOverlay self={false} />
        <MapLabelSync />
        <CameraRig />
        <AdaptiveResolution />
        <BeaconSigns />
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
