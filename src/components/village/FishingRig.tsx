'use client';

// 낚시 연출 (캐릭터마다 하나): 낚싯대 끝에서 찌로 이어지는 낚싯줄, 물 위에 뜬 찌, 물보라와 물결,
// 낚아 올린 물고기가 물에서 튀어 올라 머리 위에 잠깐 들린다.
// 내 캐릭터는 낚시 판의 단계(던짐·입질·잡음)를 따르고, 다른 사람은 던지고 기다리는 모습만 보인다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { tokens } from '@/design/tokens';
import { CHARACTER_HEIGHT, ROD_TIP } from '@/shared/character';
import { WATER_LEVEL } from '@/shared/townMap';
import type { FishingState } from './context';
import { now } from './session';

const S = tokens.scene;
/** fish 클립에서 팔을 앞으로 휘둘러 찌가 날아가기 시작하는 때 (초) */
const RELEASE = 0.58;
/** 찌가 날아가는 시간 (초) */
const FLIGHT = 0.55;
const SEG = 18;
const DROPS = 36;
const RINGS = 5;
/** 잡은 물고기가 튀어 올라 머리 위에 들려 있는 시간 (초) */
const SHOW_FISH = 2.6;

export interface FishingActor {
  x: number;
  y: number;
  z: number;
  clip: string;
  fish?: FishingState | null;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  born: number;
}

/** 아이템 아이콘(SVG)을 캔버스에 그려 텍스처로 */
const fishTextures = new Map<string, Promise<THREE.Texture>>();
function fishTexture(id: string): Promise<THREE.Texture> {
  let p = fishTextures.get(id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        c.getContext('2d')!.drawImage(img, 0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        resolve(t);
      };
      img.onerror = reject;
      img.src = assetUrl(`item.fish.${id}`);
    });
    fishTextures.set(id, p);
  }
  return p;
}

export function FishingRig({ actor, rod }: { actor: RefObject<FishingActor | null>; rod: THREE.Object3D }) {
  const bobber = useRef<THREE.Group>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const sprite = useRef<THREE.Sprite>(null);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    const m = new THREE.LineBasicMaterial({ color: S.fishingLine, transparent: true, opacity: 0.9 });
    const l = new THREE.Line(g, m);
    l.frustumCulled = false;
    l.visible = false;
    return l;
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  const st = useRef({
    castAt: -1,
    landed: false,
    bursts: 0,
    caught: false,
    drops: [] as Drop[],
    rings: [] as { x: number; z: number; born: number; size: number }[],
    texFor: '',
  });
  const v = useMemo(() => ({ tip: new THREE.Vector3(), b: new THREE.Vector3(), t: new THREE.Vector3(), p: new THREE.Vector3(), o: new THREE.Object3D() }), []);

  function splash(x: number, z: number, n: number, power: number) {
    const s = st.current;
    const t = now();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.8) * power;
      s.drops.push({ x, y: WATER_LEVEL + 0.03, z, vx: Math.cos(a) * sp, vy: (1.6 + Math.random() * 1.4) * power, vz: Math.sin(a) * sp, born: t });
    }
    if (s.drops.length > DROPS) s.drops.splice(0, s.drops.length - DROPS);
    s.rings.push({ x, z, born: t, size: 0.5 + power * 0.35 });
    if (s.rings.length > RINGS) s.rings.shift();
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = actor.current;
    const f = a?.fish;
    const s = st.current;
    const t = now();
    const active = !!a && !!f && a.clip === 'fish';
    const bob = bobber.current!;
    const spr = sprite.current!;

    if (active && f) {
      // 새로 던지면 처음부터
      if (f.castAt !== s.castAt) {
        Object.assign(s, { castAt: f.castAt, landed: false, bursts: 0, caught: false });
        spr.visible = false;
      }
      const ct = t - f.castAt;
      rod.updateWorldMatrix(true, false);
      v.tip.set(...ROD_TIP);
      rod.localToWorld(v.tip);
      v.t.set(f.tx, WATER_LEVEL + 0.03, f.tz);

      // 찌 자리
      let flying = false;
      if (ct < RELEASE) v.b.copy(v.tip).y -= 0.3;
      else if (ct < RELEASE + FLIGHT) {
        const u = (ct - RELEASE) / FLIGHT;
        v.b.lerpVectors(v.tip, v.t, u);
        v.b.y += 1.3 * 4 * u * (1 - u);
        flying = true;
      } else {
        if (!s.landed) {
          s.landed = true;
          splash(f.tx, f.tz, 6, 0.7);
        }
        v.b.copy(v.t);
        v.b.y += Math.sin(t * 3) * 0.015;
        if (f.biteAt && !f.caughtAt) {
          // 입질: 찌가 쏙쏙 잠기고 물이 파파팍 튄다
          const bt = t - f.biteAt;
          v.b.y -= 0.08 + 0.1 * Math.abs(Math.sin(bt * 15));
          while (s.bursts < 3 && bt >= s.bursts * 0.22) {
            splash(f.tx + (Math.random() - 0.5) * 0.2, f.tz + (Math.random() - 0.5) * 0.2, 8, 1);
            s.bursts++;
          }
        }
        if (f.caughtAt) {
          const kt = t - f.caughtAt;
          if (!s.caught) {
            s.caught = true;
            splash(f.tx, f.tz, 16, 1.5);
            if (f.fishId && s.texFor !== f.fishId) {
              s.texFor = f.fishId;
              const want = f.fishId;
              fishTexture(want)
                .then((tex) => {
                  if (st.current.texFor !== want || !sprite.current) return;
                  sprite.current.material.map = tex;
                  sprite.current.material.needsUpdate = true;
                })
                .catch(() => {});
            }
          }
          // 찌는 낚싯대 쪽으로 홱 올라온다
          const u = Math.min(1, kt / 0.35);
          v.b.lerpVectors(v.t, v.p.copy(v.tip).setY(v.tip.y - 0.3), u);
          // 물고기: 물에서 튀어 올라 머리 위로, 잠깐 들고 있다가 사라진다
          if (kt < SHOW_FISH && spr.material.map) {
            spr.visible = true;
            v.p.set(a!.x, a!.y + CHARACTER_HEIGHT + 0.95, a!.z);
            if (kt < 0.7) {
              const w = kt / 0.7;
              spr.position.lerpVectors(v.t, v.p, w);
              spr.position.y += 1.4 * 4 * w * (1 - w);
              spr.material.rotation = (1 - w) * 6;
            } else {
              spr.position.copy(v.p);
              spr.position.y += Math.sin((kt - 0.7) * 6) * 0.04;
              spr.material.rotation = Math.sin((kt - 0.7) * 5) * 0.12;
            }
            const fade = kt > SHOW_FISH - 0.3 ? (SHOW_FISH - kt) / 0.3 : 1;
            spr.material.opacity = fade;
            spr.scale.setScalar(0.75 * Math.min(1, 0.4 + kt * 2));
          } else spr.visible = false;
        }
      }
      bob.visible = true;
      bob.position.copy(v.b);

      // 낚싯줄: 끝 → 찌. 날아갈 때는 곧고, 물에 뜨면 살짝 처진다
      const pos = line.geometry.attributes.position as THREE.BufferAttribute;
      const dist = v.tip.distanceTo(v.b);
      const sag = flying ? 0.05 : Math.min(0.6, dist * 0.12);
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG;
        v.p.lerpVectors(v.tip, v.b, u);
        v.p.y -= sag * 4 * u * (1 - u);
        pos.setXYZ(i, v.p.x, v.p.y + 0.07 * (i === SEG ? 1 : 0), v.p.z);
      }
      pos.needsUpdate = true;
      line.visible = true;
    } else {
      bob.visible = false;
      line.visible = false;
      spr.visible = false;
      s.castAt = -1;
    }

    // 물방울: 튀어 올랐다 떨어지며 사라진다
    const m = drops.current!;
    s.drops = s.drops.filter((d) => d.y >= WATER_LEVEL - 0.05 && t - d.born < 1.4);
    s.drops.forEach((d, i) => {
      d.vy -= 9 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      v.o.position.set(d.x, d.y, d.z);
      v.o.scale.setScalar(Math.max(0.3, 1 - (t - d.born) / 1.4));
      v.o.updateMatrix();
      m.setMatrixAt(i, v.o.matrix);
    });
    m.count = s.drops.length;
    m.instanceMatrix.needsUpdate = true;
    // 물결: 퍼지며 옅어진다
    rings.current.forEach((r, i) => {
      if (!r) return;
      const ring = s.rings[i];
      const age = ring ? t - ring.born : 99;
      if (!ring || age > 1.1) {
        r.visible = false;
        return;
      }
      r.visible = true;
      r.position.set(ring.x, WATER_LEVEL + 0.02, ring.z);
      r.scale.setScalar(ring.size * (0.3 + age * 1.3));
      (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - age / 1.1);
    });
  });

  return (
    <>
      <primitive object={line} />
      <group ref={bobber} visible={false}>
        <mesh position-y={0.03}>
          <sphereGeometry args={[0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={S.bobberTop} roughness={0.4} />
        </mesh>
        <mesh position-y={0.03} rotation-x={Math.PI}>
          <sphereGeometry args={[0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={S.bobberBottom} roughness={0.4} />
        </mesh>
        <mesh position-y={0.14}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 5]} />
          <meshStandardMaterial color={S.bobberTop} />
        </mesh>
      </group>
      <instancedMesh ref={drops} args={[undefined, undefined, DROPS]} frustumCulled={false}>
        <sphereGeometry args={[0.04, 6, 5]} />
        <meshBasicMaterial color={S.splash} transparent opacity={0.9} />
      </instancedMesh>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh key={i} ref={(el) => void (rings.current[i] = el)} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.42, 0.5, 28]} />
          <meshBasicMaterial color={S.splash} transparent depthWrite={false} />
        </mesh>
      ))}
      <sprite ref={sprite} visible={false} renderOrder={999}>
        <spriteMaterial transparent depthWrite={false} />
      </sprite>
    </>
  );
}
