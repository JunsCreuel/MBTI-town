'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { townConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import { TINT_MATERIAL } from '@/shared/character';
import { groundHeightAt, type Lot, type PropPlacement } from '@/shared/townMap';
import { GATE_KEY, HOUSE_KEY, LOT_KEY, tagTexture, type TownAssets } from './assets';
import { lotKey, useTown } from './context';
import { FOLIAGE_MATERIAL, injectWind, softFoliage, withWind } from './wind';

// 맵의 소품과 주민의 집을 세운다. 같은 소품(나무·집)이 수백 개라 종류마다 인스턴싱으로 한 번에 그린다.
// 지역 소품과 집 지붕의 outfit 재질은 그 지역 색으로 칠한다.

/** 누르면 오늘의 토론으로 가는 소품 */
const DEBATE_BOARD_KEY = 'prop.plaza.board';
/** 누를 수 있는 소품: 오늘의 토론 게시판, 동네 길 아치 */
const CLICKABLE = new Set([DEBATE_BOARD_KEY, GATE_KEY]);
/** 이보다 키가 큰 소품은 카메라와 내 캐릭터 사이에 오면 흐려진다 */
const FADE_MIN_HEIGHT = 1.4;
const FADE_OPACITY = 0.3;

/** 한 번에 흐려질 수 있는 소품 수 (내 캐릭터 앞을 가리는 것만 흐려지므로 몇 개 안 된다) */
const MAX_FADING = 24;

/** 인스턴스마다 투명도를 따로 주는 반투명 재질 */
function fadingMaterial(src: THREE.Material): THREE.Material {
  const m = src.clone();
  m.transparent = true;
  m.depthWrite = false;
  const foliage = src.name === FOLIAGE_MATERIAL;
  m.onBeforeCompile = (shader) => {
    if (foliage) injectWind(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= vInstanceOpacity;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => (foliage ? 'fading-instance-wind' : 'fading-instance');
  return m;
}

interface PropGroup {
  key: string;
  placements: PropPlacement[];
  parts: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4; tint: boolean }[];
  tall: boolean;
  halfWidth: number;
}

/** 카메라(남쪽)와 내 캐릭터 사이를 가리는지 */
function blocks(p: { x: number; z: number }, self: { x: number; z: number }, halfWidth: number) {
  const dz = p.z - self.z;
  return dz > 0.4 && dz < 8 && Math.abs(p.x - self.x) < halfWidth + 0.6;
}

const WHITE = new THREE.Color('#FFFFFF');
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * 같은 소품을 한 번에 그린다. 내 캐릭터를 가리는 소품은 불투명 묶음에서 빼서
 * 반투명 묶음(최대 MAX_FADING개)으로 옮겨 그린다. 다시 다 보이면 불투명 묶음으로 돌아간다.
 */
export function InstancedProps({ group, onPick }: { group: PropGroup; onPick?: (index: number) => void }) {
  const { map, input } = useTown();
  const solidRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const fadeRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  // 인스턴스별 놓일 자리와 색 (불투명·반투명 묶음이 같이 쓴다)
  const instances = useMemo(() => {
    const placement = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    return group.placements.map((p) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
      placement.compose(pos.set(p.x, p.y ?? groundHeightAt(map, p.x, p.z), p.z), q, one);
      return {
        matrices: group.parts.map((part) => new THREE.Matrix4().multiplyMatrices(placement, part.local)),
        color: p.district ? new THREE.Color(tokens.district[p.district]) : WHITE,
      };
    });
  }, [group, map]);

  const state = useMemo(
    () => ({ opacity: new Float32Array(group.placements.length).fill(1), fadeSlot: new Int16Array(group.placements.length).fill(-1) }),
    [group],
  );

  const fades = useMemo(
    () =>
      group.tall
        ? group.parts.map((p) => {
            const geometry = p.geometry.clone();
            const attr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FADING).fill(1), 1);
            attr.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute('instanceOpacity', attr);
            return { geometry, material: fadingMaterial(p.material), attr };
          })
        : [],
    [group],
  );

  useEffect(
    () => () => {
      for (const f of fades) {
        f.geometry.dispose();
        f.material.dispose();
      }
    },
    [fades],
  );

  useLayoutEffect(() => {
    group.parts.forEach((part, k) => {
      const mesh = solidRefs.current[k];
      if (!mesh) return;
      instances.forEach((it, i) => {
        mesh.setMatrixAt(i, it.matrices[k]);
        if (part.tint) mesh.setColorAt(i, it.color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    state.opacity.fill(1);
    state.fadeSlot.fill(-1);
    for (const m of fadeRefs.current) if (m) m.count = 0;
  }, [group, instances, state]);

  useFrame((_, dt) => {
    if (!group.tall) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    const walking = input.view === 'walk';
    const { opacity, fadeSlot } = state;
    let changed = false;
    group.placements.forEach((p, i) => {
      const target = walking && blocks(p, input.self, group.halfWidth) ? FADE_OPACITY : 1;
      const cur = opacity[i];
      if (cur === target) return;
      opacity[i] = Math.abs(target - cur) < 0.01 ? target : cur + (target - cur) * k;
      changed = true;
    });
    if (!changed) return;

    // 흐린 소품은 불투명 묶음에서 숨기고 반투명 묶음에 모은다
    let n = 0;
    group.placements.forEach((_, i) => {
      const fading = opacity[i] < 1 && n < MAX_FADING;
      const wasFading = fadeSlot[i] >= 0;
      if (fading !== wasFading) {
        group.parts.forEach((__, kk) => {
          const solid = solidRefs.current[kk];
          if (!solid) return;
          solid.setMatrixAt(i, fading ? HIDDEN : instances[i].matrices[kk]);
          solid.instanceMatrix.needsUpdate = true;
        });
      }
      if (fading) {
        const slot = n++;
        fadeSlot[i] = slot;
        group.parts.forEach((part, kk) => {
          const mesh = fadeRefs.current[kk];
          if (!mesh) return;
          mesh.setMatrixAt(slot, instances[i].matrices[kk]);
          if (part.tint) mesh.setColorAt(slot, instances[i].color);
          fades[kk].attr.setX(slot, opacity[i]);
        });
      } else {
        fadeSlot[i] = -1;
      }
    });
    group.parts.forEach((_, kk) => {
      const mesh = fadeRefs.current[kk];
      if (!mesh) return;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      fades[kk].attr.needsUpdate = true;
    });
  });

  const pick = onPick
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          // 집 뒤 바닥으로 걸어가지 않게 막는다
          e.stopPropagation();
          if (e.delta <= 10 && input.view === 'walk' && e.instanceId !== undefined) onPick(e.instanceId);
        },
        onPointerOver: () => (document.body.style.cursor = 'pointer'),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : {};

  return (
    <>
      {group.parts.map((p, k) => (
        <instancedMesh
          key={`s${k}`}
          ref={(el) => {
            solidRefs.current[k] = el;
          }}
          args={[p.geometry, p.material, group.placements.length]}
          castShadow
          receiveShadow
          {...pick}
        />
      ))}
      {fades.map((f, k) => (
        <instancedMesh
          key={`f${k}`}
          ref={(el) => {
            fadeRefs.current[k] = el;
            if (el) el.count = 0;
          }}
          args={[f.geometry, f.material, MAX_FADING]}
          frustumCulled={false}
          castShadow
          renderOrder={5}
        />
      ))}
    </>
  );
}

/** 누를 수 있는 소품 하나 (게시판 → 오늘의 토론, 동네 길 아치 → 동네 고르기) */
function ClickableProp({ placement }: { placement: PropPlacement }) {
  const { map, assets, input, onGate } = useTown();
  const router = useRouter();
  const item = useMemo(() => {
    const o = assets.props[placement.key].clone();
    o.position.set(placement.x, groundHeightAt(map, placement.x, placement.z), placement.z);
    o.rotation.y = placement.yaw;
    const box = new THREE.Box3().setFromObject(o);
    const materials: THREE.Material[] = [];
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      // 지역 색 현판 (아치)
      if (mat.name === TINT_MATERIAL && placement.district) mat.color.set(tokens.district[placement.district]);
      mesh.material = mat;
      materials.push(mat);
    });
    return { o, materials, halfWidth: (box.max.x - box.min.x) / 2, tall: box.max.y - box.min.y > FADE_MIN_HEIGHT, opacity: 1 };
  }, [assets, map, placement]);

  useFrame((_, dt) => {
    if (!item.tall) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    const target = input.view === 'walk' && blocks(item.o.position, input.self, item.halfWidth) ? FADE_OPACITY : 1;
    const next = item.opacity + (target - item.opacity) * k;
    if (Math.abs(next - item.opacity) < 1e-3) return;
    item.opacity = next;
    for (const m of item.materials) {
      m.opacity = next;
      m.transparent = next < 0.99;
      m.depthWrite = next >= 0.99;
    }
  });

  return (
    <primitive
      object={item.o}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // 소품 뒤 바닥으로 걸어가지 않게 막는다
        e.stopPropagation();
        if (e.delta > 10 || input.view !== 'walk') return;
        if (placement.key === GATE_KEY) onGate(placement);
        else router.push('/debate');
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    />
  );
}

/** 소품 모델을 인스턴싱용 조각으로 나눈다 (잎 재질은 바람에 흔들린다) */
export function buildGroup(key: string, placements: PropPlacement[], assets: TownAssets): PropGroup {
  const root = assets.props[key];
  root.updateMatrixWorld(true);
  const parts: PropGroup['parts'] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.Material;
    parts.push({
      geometry: softFoliage(mesh.geometry, material),
      material: withWind(material),
      local: mesh.matrixWorld.clone(),
      tint: material.name === TINT_MATERIAL,
    });
  });
  const box = new THREE.Box3().setFromObject(root);
  return { key, placements, parts, tall: box.max.y - box.min.y > FADE_MIN_HEIGHT, halfWidth: (box.max.x - box.min.x) / 2 };
}

export function Props() {
  const { map, assets } = useTown();
  const { groups, boards } = useMemo(() => {
    const byKey = new Map<string, PropPlacement[]>();
    const boards: PropPlacement[] = [];
    for (const p of map.props) {
      if (!assets.props[p.key]) continue;
      if (CLICKABLE.has(p.key)) boards.push(p);
      else byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
    }
    return { groups: [...byKey].map(([key, placements]) => buildGroup(key, placements, assets)), boards };
  }, [map, assets]);

  return (
    <>
      {groups.map((g) => (
        <InstancedProps key={g.key} group={g} />
      ))}
      {boards.map((b, i) => (
        <ClickableProp key={i} placement={b} />
      ))}
    </>
  );
}

/** 집 이름표 높이: 지붕 위에 붙여서, 뒤에 선 집이 아니라 이 집 것으로 보이게 한다 */
const HOUSE_TAG_Y = 2.25;
/** 이름표를 집 정면(문 쪽) 지붕으로 당기는 거리 */
const HOUSE_TAG_FORWARD = 0.35;

/**
 * 집터마다 집(주민이 있으면) 또는 울타리만 친 빈 집터를 세운다.
 * 집을 누르면 그 집 문 앞으로 걸어가고 집 카드가 열린다.
 */
export function Houses() {
  const { map, assets, houses, onHouse } = useTown();
  const { groups, lotsByGroup } = useMemo(() => {
    const all = Object.values(map.lots).flat();
    const built = all.filter((l) => houses.has(lotKey(l)));
    const empty = all.filter((l) => !houses.has(lotKey(l)));
    const toPlacement = (key: string) => (l: Lot): PropPlacement => ({ key, x: l.x, z: l.z, yaw: l.yaw, district: l.district });
    return {
      groups: [buildGroup(HOUSE_KEY, built.map(toPlacement(HOUSE_KEY)), assets), buildGroup(LOT_KEY, empty.map(toPlacement(LOT_KEY)), assets)],
      lotsByGroup: [built, empty],
    };
  }, [map, assets, houses]);

  return (
    <>
      {groups.map((g, i) =>
        g.placements.length ? <InstancedProps key={`${g.key}:${g.placements.length}`} group={g} onPick={(k) => onHouse(lotsByGroup[i][k])} /> : null,
      )}
      <HouseTags />
    </>
  );
}

/** 이름이 붙은 집 위에 이름표를 띄운다. 가까운 집만 보인다. */
function HouseTags() {
  const { map, houses, input } = useTown();
  const tags = useMemo(
    () =>
      Object.values(map.lots)
        .flat()
        .flatMap((l) => {
          const h = houses.get(lotKey(l));
          if (!h || (!h.name && !h.mine)) return [];
          const tag = tagTexture(h.mine ? '내 집' : `${h.name}의 집`, h.friend ? tokens.color.accent : tokens.district[l.district], h.mine);
          const x = l.x + Math.sin(l.yaw) * HOUSE_TAG_FORWARD;
          const z = l.z + Math.cos(l.yaw) * HOUSE_TAG_FORWARD;
          return [{ lot: l, tag, pos: [x, groundHeightAt(map, l.x, l.z) + HOUSE_TAG_Y, z] as const, mine: h.mine }];
        }),
    [map, houses],
  );
  const refs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(() => {
    const walking = input.view === 'walk';
    tags.forEach((t, i) => {
      const s = refs.current[i];
      if (!s) return;
      const d = Math.hypot(t.lot.x - input.self.x, t.lot.z - input.self.z);
      // 내 집 이름표는 조금 더 멀리서도 보인다
      s.visible = walking && d < townConfig.nameplateDistance * (t.mine ? 1.6 : 1);
    });
  });

  return (
    <>
      {tags.map((t, i) => (
        <sprite
          key={lotKey(t.lot)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={t.pos}
          scale={[0.34 * t.tag.aspect, 0.34, 1]}
          renderOrder={900}
          visible={false}
        >
          <spriteMaterial map={t.tag.texture} depthTest={false} depthWrite={false} transparent />
        </sprite>
      ))}
    </>
  );
}
