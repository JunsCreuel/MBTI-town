'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cameraConfig, plazaConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { groundHeightAt } from '@/shared/plazaMap';
import { LocalPlayer, RemotePlayer } from './Characters';
import { PlazaContext, usePlaza, type PlazaContextValue } from './context';
import { now } from './session';
import { Terrain } from './Terrain';

const S = tokens.scene;
/** 저가폰을 고려해 휴대폰에서는 그림자 해상도를 낮춘다 */
const isSmallScreen = () => typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;

/** 누르면 오늘의 토론으로 가는 소품 */
const DEBATE_BOARD_KEY = 'prop.plaza.board';

/** 이보다 키가 큰 소품은 카메라와 내 캐릭터 사이에 오면 반투명해진다 */
const FADE_MIN_HEIGHT = 1.4;
const FADE_OPACITY = 0.3;

/** 소품 모델을 맵에 적힌 자리와 방향으로 세운다 */
function Props() {
  const { map, assets, input } = usePlaza();
  const router = useRouter();
  const objects = useMemo(
    () =>
      map.props.flatMap((p) => {
        const src = assets.props[p.key];
        if (!src) return [];
        const o = src.clone();
        o.position.set(p.x, groundHeightAt(map, p.x, p.z), p.z);
        o.rotation.y = p.yaw;
        const box = new THREE.Box3().setFromObject(o);
        const tall = box.max.y - box.min.y > FADE_MIN_HEIGHT;
        const materials: THREE.Material[] = [];
        o.traverse((c) => {
          const mesh = c as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (tall) {
            // 가릴 때 이 소품만 투명하게 하려고 재질을 따로 갖는다
            mesh.material = (mesh.material as THREE.Material).clone();
            materials.push(mesh.material);
          }
        });
        return [{ o, key: p.key, materials, halfWidth: (box.max.x - box.min.x) / 2, opacity: 1 }];
      }),
    [map, assets],
  );

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    for (const it of objects) {
      if (!it.materials.length) continue;
      const dz = it.o.position.z - input.self.z;
      const blocking = dz > 0.4 && dz < 8 && Math.abs(it.o.position.x - input.self.x) < it.halfWidth + 0.6;
      const next = it.opacity + ((blocking ? FADE_OPACITY : 1) - it.opacity) * k;
      if (Math.abs(next - it.opacity) < 1e-3) continue;
      it.opacity = next;
      for (const m of it.materials) {
        m.opacity = next;
        m.transparent = next < 0.99;
        m.depthWrite = next >= 0.99;
      }
    }
  });

  return (
    <>
      {objects.map((it, i) =>
        it.key === DEBATE_BOARD_KEY ? (
          <primitive
            key={i}
            object={it.o}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              // 게시판 뒤 바닥으로 걸어가지 않게 막는다
              e.stopPropagation();
              if (e.delta <= 10) router.push('/debate');
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          />
        ) : (
          <primitive key={i} object={it.o} />
        ),
      )}
    </>
  );
}

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
  useFrame(({ camera }) => mesh.current?.position.copy(camera.position));
  return (
    <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[150, 32, 16]} />
    </mesh>
  );
}

/** 몽실몽실한 구름이 천천히 흘러간다 */
function Clouds() {
  const { map } = usePlaza();
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
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
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
      <meshLambertMaterial color={S.cloud} emissive={S.cloud} emissiveIntensity={0.55} fog={false} />
    </instancedMesh>
  );
}

/** 해는 내 캐릭터를 따라다니며 주변에만 그림자를 만든다 */
function Lights() {
  const { input } = usePlaza();
  const sun = useRef<THREE.DirectionalLight>(null);
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
  });
  return (
    <>
      <hemisphereLight args={[S.hemiSky, S.hemiGround, 1.55]} />
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

/** 내 캐릭터를 따라가는 카메라. 휠과 두 손가락으로 거리를 바꾼다. */
function CameraRig() {
  const { input } = usePlaza();
  const { camera, gl, size } = useThree();
  const distance = useRef<number>(size.width < size.height ? cameraConfig.portraitDistance : cameraConfig.distance);
  const target = useRef(new THREE.Vector3(input.self.x, 0, input.self.z));
  const goal = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let distStart = distance.current;
    const clamp = (d: number) => THREE.MathUtils.clamp(d, cameraConfig.minDistance, cameraConfig.maxDistance);
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance.current = clamp(distance.current * Math.exp(e.deltaY * 0.0012));
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        pinchState.active = true;
        pinchStart = spread();
        distStart = distance.current;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0) distance.current = clamp((distStart * pinchStart) / spread());
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinchState.active && pointers.size === 0) {
        pinchState.active = false;
        pinchState.endedAt = now();
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
  }, [gl]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    target.current.lerp(goal.set(input.self.x, 0, input.self.z), k);
    const d = distance.current;
    const zoom = (d - cameraConfig.minDistance) / (cameraConfig.maxDistance - cameraConfig.minDistance);
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(cameraConfig.pitchNearDeg, cameraConfig.pitchFarDeg, zoom));
    camera.position.set(
      target.current.x,
      target.current.y + 0.8 + Math.sin(pitch) * d,
      target.current.z + Math.cos(pitch) * d,
    );
    camera.lookAt(target.current.x, target.current.y + 0.8, target.current.z);
  });
  return null;
}

/** 바닥을 누른 자리에 잠깐 보이는 동그라미 */
function TapMarker() {
  const { input, map } = usePlaza();
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

/** 나와 다른 사람들. 다른 사람은 가까운 순으로 상한까지만 그린다. */
function Players() {
  const { session, selfId, input } = usePlaza();
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
      .filter((id) => id !== selfId)
      .map((id) => {
        const pl = session.player(id);
        return { id, d: pl ? Math.hypot(pl.x - input.self.x, pl.z - input.self.z) : Infinity };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, plazaConfig.maxVisiblePlayers)
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
  const { input } = usePlaza();
  useEffect(() => {
    const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    const down = (e: KeyboardEvent) => {
      if (!MOVE_KEYS.includes(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
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
  const { input } = usePlaza();
  function onClick(e: ThreeEvent<MouseEvent>) {
    // 끌거나 두 손가락으로 확대한 직후의 클릭은 무시한다
    if (e.delta > 10 || pinchState.recent()) return;
    input.tapTarget = { x: e.point.x, z: e.point.z };
    input.marker = { x: e.point.x, z: e.point.z, at: now() };
  }
  return <Terrain onGroundClick={onClick} />;
}

function FirstFrame({ onFrame }: { onFrame: () => void }) {
  useFrame(onFrame);
  return null;
}

export default function PlazaScene({ value, onFirstFrame }: { value: PlazaContextValue; onFirstFrame: () => void }) {
  const firstFrame = useRef(false);
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: cameraConfig.fov, near: 0.3, far: 400 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <PlazaContext.Provider value={value}>
        <fog attach="fog" args={[S.fog, 30, 90]} />
        <Sky />
        <Clouds />
        <Lights />
        <Ground />
        <Props />
        <Players />
        <TapMarker />
        <CameraRig />
        <KeyboardInput />
        <FirstFrame
          onFrame={() => {
            if (!firstFrame.current) {
              firstFrame.current = true;
              onFirstFrame();
            }
          }}
        />
      </PlazaContext.Provider>
    </Canvas>
  );
}
