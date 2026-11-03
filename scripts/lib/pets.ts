// 일주 동물 펫 임시 모델 12종 (띠 동물). 몸은 TINT_MATERIAL(outfit)이라 화면에서 천간 오행 색을 입힌다.
// 원점 = 발 가운데, 정면 = +Z, 키 약 0.45~0.6 (캐릭터 키 1.32의 절반 아래).
import * as THREE from 'three';
import { TINT_MATERIAL } from '../../src/shared/character';
import type { PetAnimal } from '../../src/shared/pet';
import { part, type Part } from './models';

type Vec3 = [number, number, number];
const T = TINT_MATERIAL;
const C = { eye: '#2A2130', light: '#FFFFFF', pink: '#F7A3AE', cream: '#FFF1D6', horn: '#F3E6C4', dark: '#4A3B33', red: '#E2483D', beak: '#F4B63C' };

const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 12);
const cyl = (r1: number, r2: number, h: number) => new THREE.CylinderGeometry(r1, r2, h, 14);

/** 눈 두 개 (반짝임 포함) */
function eyes(y: number, z: number, x = 0.065, r = 0.028): Part[] {
  return [1, -1].flatMap((s) => [
    part(sphere(r, 10, 8), C.eye, { pos: [x * s, y, z] }),
    part(sphere(r * 0.38, 8, 6), C.light, { pos: [x * s - 0.008 * s, y + 0.012, z + r * 0.8] }),
  ]);
}

/** 네발 동물 기본: 몸통·머리·다리 네 개 */
function quadruped(o: { body?: Vec3; head?: number; headPos?: Vec3; leg?: number; legH?: number } = {}): Part[] {
  const body = o.body ?? [0.2, 0.16, 0.24];
  const legH = o.legH ?? 0.1;
  const head = o.head ?? 0.15;
  const hp = o.headPos ?? [0, legH + body[1] * 1.6, body[2] * 0.85];
  const parts: Part[] = [
    part(sphere(1, 18, 12), '#fff', { pos: [0, legH + body[1], 0], scale: body, mat: T }),
    part(sphere(head, 18, 14), '#fff', { pos: hp, mat: T }),
    ...eyes(hp[1] + head * 0.15, hp[2] + head * 0.86, head * 0.42, head * 0.17),
  ];
  for (const [x, z] of [[0.11, 0.12], [-0.11, 0.12], [0.11, -0.12], [-0.11, -0.12]]) {
    parts.push(part(capsule(o.leg ?? 0.045, legH), '#fff', { pos: [x * (body[0] / 0.2), legH / 2 + 0.03, z * (body[2] / 0.24)], mat: T }));
  }
  return parts;
}

function head(parts: Part[]): Vec3 {
  // 두 번째 부품이 머리 (quadruped 규약)
  const box = new THREE.Box3().setFromBufferAttribute(parts[1].geo.getAttribute('position') as THREE.BufferAttribute);
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, c.y, c.z];
}

export function petParts(animal: PetAnimal): Part[] {
  switch (animal) {
    case 'rat': {
      const p = quadruped({ body: [0.17, 0.13, 0.2], head: 0.13, legH: 0.05, leg: 0.035 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        ...[1, -1].map((s) => part(sphere(0.07), C.pink, { pos: [hx + 0.1 * s, hy + 0.12, hz - 0.02], scale: [1, 1, 0.35] })),
        part(sphere(0.022), C.pink, { pos: [hx, hy - 0.01, hz + 0.13] }),
        part(cyl(0.012, 0.006, 0.34), C.pink, { pos: [0, 0.12, -0.3], rot: [-60, 0, 0] }),
      ];
    }
    case 'ox': {
      const p = quadruped({ body: [0.24, 0.18, 0.28], head: 0.16, legH: 0.11, leg: 0.055 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        part(sphere(0.1), C.cream, { pos: [hx, hy - 0.06, hz + 0.11], scale: [1.1, 0.7, 0.8] }),
        ...[1, -1].map((s) => part(cone(0.03, 0.12), C.horn, { pos: [hx + 0.12 * s, hy + 0.13, hz - 0.02], rot: [0, 0, -35 * s] })),
        ...[1, -1].map((s) => part(sphere(0.045), '#fff', { pos: [hx + 0.17 * s, hy + 0.04, hz - 0.03], scale: [1.4, 0.6, 0.6], mat: T })),
      ];
    }
    case 'tiger': {
      const p = quadruped({ body: [0.21, 0.16, 0.26], head: 0.16, legH: 0.1, leg: 0.05 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        ...[1, -1].map((s) => part(sphere(0.05), '#fff', { pos: [hx + 0.11 * s, hy + 0.13, hz - 0.02], scale: [1, 1, 0.5], mat: T })),
        part(sphere(0.07), C.cream, { pos: [hx, hy - 0.05, hz + 0.11], scale: [1.2, 0.75, 0.7] }),
        // 줄무늬
        ...[-0.1, 0, 0.1].map((z) => part(new THREE.BoxGeometry(0.025, 0.05, 0.03), C.dark, { pos: [0, 0.4, z] })),
        part(cyl(0.025, 0.02, 0.3), '#fff', { pos: [0, 0.3, -0.32], rot: [-50, 0, 0], mat: T }),
      ];
    }
    case 'rabbit': {
      const p = quadruped({ body: [0.17, 0.16, 0.19], head: 0.15, legH: 0.06, leg: 0.04 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        ...[1, -1].map((s) => part(capsule(0.035, 0.2), '#fff', { pos: [hx + 0.06 * s, hy + 0.24, hz - 0.03], rot: [-8, 0, -10 * s], mat: T })),
        ...[1, -1].map((s) => part(capsule(0.018, 0.16), C.pink, { pos: [hx + 0.06 * s, hy + 0.24, hz - 0.005], rot: [-8, 0, -10 * s] })),
        part(sphere(0.06), C.light, { pos: [0, 0.22, -0.2] }),
        part(sphere(0.02), C.pink, { pos: [hx, hy - 0.02, hz + 0.14] }),
      ];
    }
    case 'dragon': {
      const p = quadruped({ body: [0.2, 0.17, 0.28], head: 0.16, legH: 0.09, leg: 0.05 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        ...[1, -1].map((s) => part(cone(0.025, 0.14), C.horn, { pos: [hx + 0.07 * s, hy + 0.16, hz - 0.05], rot: [-25, 0, -15 * s] })),
        part(sphere(0.09), '#fff', { pos: [hx, hy - 0.04, hz + 0.12], scale: [1, 0.7, 1], mat: T }),
        // 등 가시
        ...[0.14, 0.02, -0.1, -0.22].map((z, i) => part(cone(0.035, 0.09 - i * 0.012), C.horn, { pos: [0, 0.44 - i * 0.02, z] })),
        part(cone(0.07, 0.36), '#fff', { pos: [0, 0.22, -0.38], rot: [-75, 0, 0], mat: T }),
      ];
    }
    case 'snake': {
      // 몸을 똬리 틀고 머리를 든다 (다리 없음)
      const coils = [0.17, 0.13, 0.09].map((r, i) => part(new THREE.TorusGeometry(r, 0.055, 10, 24), '#fff', { pos: [0, 0.06 + i * 0.1, 0], rot: [90, 0, 0], mat: T }));
      return [
        ...coils,
        part(capsule(0.05, 0.14), '#fff', { pos: [0, 0.38, 0.05], rot: [20, 0, 0], mat: T }),
        part(sphere(0.085), '#fff', { pos: [0, 0.47, 0.1], scale: [1, 0.85, 1.2], mat: T }),
        ...eyes(0.5, 0.19, 0.045, 0.018),
        part(new THREE.BoxGeometry(0.012, 0.004, 0.07), C.red, { pos: [0, 0.45, 0.22] }),
      ];
    }
    case 'horse': {
      const p = quadruped({ body: [0.21, 0.17, 0.28], head: 0.14, legH: 0.18, leg: 0.045, headPos: [0, 0.6, 0.26] });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        part(capsule(0.07, 0.12), '#fff', { pos: [hx, hy - 0.04, hz + 0.1], rot: [70, 0, 0], mat: T }),
        part(new THREE.BoxGeometry(0.05, 0.22, 0.2), C.dark, { pos: [0, hy, hz - 0.14], rot: [-25, 0, 0] }),
        ...[1, -1].map((s) => part(cone(0.03, 0.08), '#fff', { pos: [hx + 0.06 * s, hy + 0.15, hz - 0.03], mat: T })),
        part(cyl(0.045, 0.02, 0.3), C.dark, { pos: [0, 0.36, -0.34], rot: [-35, 0, 0] }),
      ];
    }
    case 'sheep': {
      const p = quadruped({ body: [0.2, 0.17, 0.22], head: 0.12, legH: 0.08, leg: 0.035 });
      const [hx, hy, hz] = head(p);
      // 몽실몽실한 털 (몸 색), 얼굴은 크림색
      const wool: Part[] = [];
      for (const [x, y, z] of [[0.12, 0.3, 0.08], [-0.12, 0.3, 0.08], [0.12, 0.3, -0.1], [-0.12, 0.3, -0.1], [0, 0.4, 0], [0, 0.38, 0.14], [0, 0.36, -0.15]] as Vec3[]) {
        wool.push(part(sphere(0.1), '#fff', { pos: [x, y, z], mat: T }));
      }
      return [
        ...p,
        ...wool,
        part(sphere(0.105), C.cream, { pos: [hx, hy, hz + 0.02] }),
        ...eyes(hy + 0.02, hz + 0.115, 0.045, 0.02),
        ...[1, -1].map((s) => part(sphere(0.05), C.cream, { pos: [hx + 0.11 * s, hy + 0.02, hz - 0.02], scale: [1.3, 0.5, 0.7] })),
      ];
    }
    case 'monkey': {
      const p = quadruped({ body: [0.16, 0.18, 0.15], head: 0.15, legH: 0.09, leg: 0.04, headPos: [0, 0.5, 0.06] });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        part(sphere(0.11), C.cream, { pos: [hx, hy - 0.02, hz + 0.07], scale: [1.1, 0.9, 0.7] }),
        ...[1, -1].map((s) => part(sphere(0.055), C.cream, { pos: [hx + 0.15 * s, hy + 0.02, hz], scale: [0.5, 1, 1] })),
        part(new THREE.TorusGeometry(0.1, 0.02, 8, 18, Math.PI * 1.4), '#fff', { pos: [0, 0.22, -0.2], rot: [0, 90, 0], mat: T }),
      ];
    }
    case 'rooster': {
      return [
        part(sphere(1, 18, 12), '#fff', { pos: [0, 0.24, 0], scale: [0.15, 0.15, 0.18], mat: T }),
        part(sphere(0.1), '#fff', { pos: [0, 0.42, 0.1], mat: T }),
        ...eyes(0.45, 0.19, 0.045, 0.018),
        part(cone(0.03, 0.07), C.beak, { pos: [0, 0.41, 0.22], rot: [90, 0, 0] }),
        ...[0, 0.04, -0.04].map((z, i) => part(sphere(0.035 - i * 0.004), C.red, { pos: [0, 0.53 + (i ? -0.01 : 0), 0.1 + z] })),
        part(sphere(0.025), C.red, { pos: [0, 0.36, 0.2], scale: [0.7, 1.2, 0.7] }),
        ...[0, 1, 2].map((i) => part(sphere(0.07), '#fff', { pos: [0, 0.34 + i * 0.05, -0.18 - i * 0.02], scale: [0.35, 1.2, 0.8], rot: [-30 - i * 10, 0, 0], mat: T })),
        ...[1, -1].map((s) => part(cyl(0.012, 0.012, 0.12), C.beak, { pos: [0.05 * s, 0.06, 0] })),
      ];
    }
    case 'dog': {
      const p = quadruped({ body: [0.19, 0.15, 0.24], head: 0.15, legH: 0.09, leg: 0.045 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        part(sphere(0.075), C.cream, { pos: [hx, hy - 0.05, hz + 0.11], scale: [1.1, 0.8, 0.9] }),
        part(sphere(0.025), C.eye, { pos: [hx, hy - 0.02, hz + 0.18] }),
        ...[1, -1].map((s) => part(sphere(0.06), '#fff', { pos: [hx + 0.13 * s, hy + 0.02, hz - 0.02], scale: [0.5, 1.3, 0.8], rot: [0, 0, 20 * s], mat: T })),
        part(cyl(0.025, 0.02, 0.16), '#fff', { pos: [0, 0.35, -0.27], rot: [-30, 0, 0], mat: T }),
      ];
    }
    case 'pig': {
      const p = quadruped({ body: [0.21, 0.17, 0.24], head: 0.15, legH: 0.06, leg: 0.045 });
      const [hx, hy, hz] = head(p);
      return [
        ...p,
        part(cyl(0.055, 0.055, 0.05), C.pink, { pos: [hx, hy - 0.03, hz + 0.15], rot: [90, 0, 0] }),
        ...[1, -1].map((s) => part(sphere(0.012), C.dark, { pos: [hx + 0.02 * s, hy - 0.03, hz + 0.178] })),
        ...[1, -1].map((s) => part(cone(0.045, 0.07), '#fff', { pos: [hx + 0.09 * s, hy + 0.14, hz - 0.01], rot: [15, 0, -20 * s], mat: T })),
        part(new THREE.TorusGeometry(0.035, 0.012, 6, 14, Math.PI * 1.6), C.pink, { pos: [0, 0.26, -0.26], rot: [0, 90, 0] }),
      ];
    }
  }
}
