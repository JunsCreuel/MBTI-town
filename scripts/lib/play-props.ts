// 놀거리 소품 임시 3D 모델: 열매 나무, 운세 나무, 광장 비콘(낚시터·클럽), 클럽 무대 소품.
// 원점 = 바닥 가운데, 정면 = +Z. 1 = 한 칸. 잎은 'foliage'(바람에 흔들림), 빛나는 곳은 'glow'(밤에 켜짐).
import * as THREE from 'three';
import { part, type Part } from './models';

type Vec3 = [number, number, number];
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

const C = {
  trunk: '#9B6B45',
  leaf: '#6FBF64',
  leafLight: '#8AD07A',
  pinkLeaf: '#F2B6C6',
  pinkLight: '#F8CFDA',
  gold: '#F2C14E',
  ribbon: '#E2483D',
  stone: '#E3D6C3',
  wood: '#B98556',
  dark: '#2F2A3A',
  metal: '#5A6270',
  glowWarm: '#FFE7A8',
};

/** 열매 나무: 둥근 수관에 열매가 주렁주렁 (열매 색은 지역마다) */
export function fruitTreeParts(fruit: string): Part[] {
  const blobs: [Vec3, number, string][] = [
    [[0, 1.85, 0], 0.85, C.leaf],
    [[0.52, 1.65, 0.22], 0.62, C.leafLight],
    [[-0.55, 1.68, 0.08], 0.64, C.leaf],
    [[0.08, 1.62, 0.55], 0.6, C.leafLight],
    [[-0.15, 1.6, -0.52], 0.62, C.leaf],
  ];
  // 수관 겉에 열매 9개 (앞쪽에 많이 보이게)
  const fruits: Vec3[] = [
    [0.35, 1.45, 0.78], [-0.4, 1.5, 0.7], [0.75, 1.75, 0.35], [-0.82, 1.82, 0.25], [0.05, 2.25, 0.62],
    [0.62, 2.15, -0.25], [-0.55, 2.2, -0.35], [0.25, 1.35, -0.75], [-0.12, 1.95, 0.9],
  ];
  return [
    part(cyl(0.14, 0.24, 1.4, 10), C.trunk, { pos: [0, 0.7, 0] }),
    ...blobs.map(([p, r, c]) => part(sphere(r, 12, 9), c, { pos: p, scale: [1, 0.9, 1], mat: 'foliage' })),
    ...fruits.map((p) => part(sphere(0.13, 12, 9), fruit, { pos: p })),
    ...fruits.map((p) => part(cyl(0.012, 0.012, 0.08, 5), C.trunk, { pos: [p[0], p[1] + 0.14, p[2]] })),
  ];
}

/** 운세 나무: 분홍 꽃나무에 황금 열매(밤에 은은히 빛남)와 붉은 소원 리본, 둘레 돌 화단 */
export function fortuneTreeParts(): Part[] {
  const blobs: [Vec3, number, string][] = [
    [[0, 2.3, 0], 1.05, C.pinkLeaf],
    [[0.7, 2.05, 0.3], 0.75, C.pinkLight],
    [[-0.72, 2.1, 0.12], 0.78, C.pinkLeaf],
    [[0.12, 2.0, 0.72], 0.72, C.pinkLight],
    [[-0.2, 1.98, -0.68], 0.74, C.pinkLeaf],
    [[0.2, 2.95, -0.1], 0.62, C.pinkLight],
  ];
  const fruits: Vec3[] = [[0.45, 1.75, 0.95], [-0.55, 1.85, 0.85], [0.95, 2.15, 0.35], [-1.0, 2.2, 0.2], [0.1, 2.75, 0.85], [0.75, 2.6, -0.4], [-0.7, 2.65, -0.45]];
  const ribbons: Vec3[] = [[0.6, 1.5, 0.7], [-0.7, 1.55, 0.55], [0.15, 1.45, -0.85], [-0.2, 1.5, 0.92]];
  return [
    // 둥근 돌 화단
    part(cyl(1.05, 1.1, 0.22, 24), C.stone, { pos: [0, 0.11, 0] }),
    part(cyl(0.9, 0.9, 0.04, 24), '#8FCB78', { pos: [0, 0.23, 0] }),
    part(cyl(0.2, 0.32, 1.9, 12), C.trunk, { pos: [0, 1.15, 0] }),
    ...blobs.map(([p, r, c]) => part(sphere(r, 14, 10), c, { pos: p, scale: [1, 0.9, 1], mat: 'foliage' })),
    ...fruits.map((p) => part(sphere(0.16, 14, 10), C.gold, { pos: p, mat: 'glow' })),
    ...ribbons.map((p, i) => part(box(0.05, 0.38, 0.02), C.ribbon, { pos: p, rot: [0, i * 40, 8], mat: 'cloth' })),
  ];
}

/**
 * 광장 비콘: 돌 받침 위 빛나는 수정 기둥과 둥근 간판. 누르거나 가까이 가면 그곳(낚시터·클럽)으로 간다.
 * 수정·간판 테두리 색이 장소마다 다르다.
 */
export function beaconParts(color: string, sign: 'fish' | 'club'): Part[] {
  const parts: Part[] = [
    part(cyl(0.55, 0.65, 0.25, 8), C.stone, { pos: [0, 0.125, 0] }),
    part(cyl(0.42, 0.5, 0.18, 8), '#D6C7B2', { pos: [0, 0.34, 0] }),
    // 수정 기둥 (밤에 빛남)
    part(new THREE.OctahedronGeometry(0.34, 0), color, { pos: [0, 1.15, 0], scale: [0.8, 2.1, 0.8], mat: 'glow' }),
    part(new THREE.TorusGeometry(0.5, 0.04, 6, 24), C.gold, { pos: [0, 1.15, 0], rot: [90, 0, 0] }),
    // 간판 기둥과 둥근 간판
    part(cyl(0.04, 0.04, 1.3, 6), C.wood, { pos: [0.75, 0.65, 0.1] }),
    part(cyl(0.32, 0.32, 0.06, 20), '#FFFCF3', { pos: [0.75, 1.42, 0.12], rot: [90, 0, 0] }),
    part(new THREE.TorusGeometry(0.32, 0.03, 6, 24), color, { pos: [0.75, 1.42, 0.12] }),
  ];
  if (sign === 'fish') {
    // 물고기 그림
    parts.push(
      part(sphere(0.16, 12, 8), color, { pos: [0.72, 1.42, 0.17], scale: [1, 0.55, 0.3] }),
      part(new THREE.ConeGeometry(0.09, 0.14, 3), color, { pos: [0.92, 1.42, 0.17], rot: [0, 0, 90] }),
    );
  } else {
    // 음표 그림
    parts.push(
      part(sphere(0.07, 10, 8), color, { pos: [0.68, 1.33, 0.17], scale: [1.2, 0.85, 0.4] }),
      part(box(0.03, 0.26, 0.03), color, { pos: [0.75, 1.46, 0.17] }),
      part(box(0.14, 0.04, 0.03), color, { pos: [0.81, 1.57, 0.17], rot: [0, 0, -18] }),
    );
  }
  return parts;
}

/** 클럽 DJ 부스: 짙은 테이블, 턴테이블 둘, 빛나는 앞판 */
export function djBoothParts(): Part[] {
  return [
    part(box(2.2, 0.95, 0.9), C.dark, { pos: [0, 0.475, 0] }),
    part(box(2.1, 0.5, 0.04), '#FF7AD9', { pos: [0, 0.5, 0.47], mat: 'neonPink' }),
    ...[-0.55, 0.55].map((x) => part(cyl(0.28, 0.28, 0.05, 24), '#1C1A22', { pos: [x, 0.98, 0] })),
    ...[-0.55, 0.55].map((x) => part(cyl(0.06, 0.06, 0.06, 12), C.gold, { pos: [x, 1.02, 0] })),
    part(box(0.4, 0.06, 0.3), C.metal, { pos: [0, 0.98, 0] }),
  ];
}

/** 클럽 스피커: 큰 상자에 둥근 울림판 둘 */
export function speakerParts(): Part[] {
  return [
    part(box(0.9, 1.7, 0.75), '#26232C', { pos: [0, 0.85, 0] }),
    part(cyl(0.3, 0.3, 0.05, 24), '#3B3746', { pos: [0, 1.15, 0.38], rot: [90, 0, 0] }),
    part(cyl(0.17, 0.17, 0.06, 20), '#57E3FF', { pos: [0, 1.15, 0.4], rot: [90, 0, 0], mat: 'neonCyan' }),
    part(cyl(0.2, 0.2, 0.05, 20), '#3B3746', { pos: [0, 0.5, 0.38], rot: [90, 0, 0] }),
  ];
}

// ───────────────────────── 실내 클럽 ─────────────────────────
// 네온 띠는 화면(ClubFx)이 벽 자리를 읽어 음악에 맞춰 그린다. 모델은 어두운 벽과 가구만.

const CLUB = {
  wall: '#2E2840',
  panel: '#3A3150',
  base: '#1C1826',
  cap: '#433A5C',
  door: '#4A2E3E',
  velvet: '#5B2E6B',
  velvetDark: '#46224F',
  counter: '#33263B',
  top: '#C9A36A',
};

/** 클럽 벽 한 칸 (폭 2, 높이 3): 흡음 판 둘, 아래 걸레받이, 위 마감. 정면(+Z)이 홀 안쪽 */
export function clubWallParts(): Part[] {
  return [
    part(box(2, 3, 0.4), CLUB.wall, { pos: [0, 1.5, 0] }),
    part(box(2.02, 0.22, 0.46), CLUB.base, { pos: [0, 0.11, 0] }),
    part(box(2.02, 0.12, 0.5), CLUB.cap, { pos: [0, 2.96, 0] }),
    ...[-0.5, 0.5].map((x) => part(box(0.86, 1.5, 0.06), CLUB.panel, { pos: [x, 1.45, 0.22] })),
  ];
}

/** 클럽 출입문 (폭 2): 문틀, 두 짝 문, 손잡이, 위에 빛나는 출구 표시 */
export function clubDoorParts(): Part[] {
  return [
    part(box(2, 3, 0.4), CLUB.wall, { pos: [0, 1.5, 0] }),
    part(box(1.6, 2.3, 0.08), CLUB.base, { pos: [0, 1.15, 0.2] }),
    ...[-0.39, 0.39].map((x) => part(box(0.74, 2.18, 0.06), CLUB.door, { pos: [x, 1.1, 0.25] })),
    ...[-0.1, 0.1].map((x) => part(box(0.04, 0.4, 0.05), C.gold, { pos: [x, 1.1, 0.3] })),
    part(box(0.7, 0.24, 0.08), '#5BE38C', { pos: [0, 2.62, 0.24], mat: 'neonGreen' }),
    part(box(2.02, 0.12, 0.5), CLUB.cap, { pos: [0, 2.96, 0] }),
  ];
}

/** 바 (폭 4, 깊이 2): 앞 카운터와 의자 셋, 뒤 선반의 병들 (몇 병은 빛난다). 정면(+Z)이 손님 쪽 */
export function clubBarParts(): Part[] {
  const bottles = ['#7CC36A', '#F2C14E', '#E2483D', '#57E3FF', '#C77DFF', '#F4A08C', '#9ED6C9'];
  return [
    // 카운터
    part(box(3.8, 1.0, 0.7), CLUB.counter, { pos: [0, 0.5, 0.25] }),
    part(box(3.96, 0.08, 0.86), CLUB.top, { pos: [0, 1.04, 0.25] }),
    // 뒤 선반 두 단
    part(box(3.6, 1.9, 0.3), CLUB.base, { pos: [0, 0.95, -0.75] }),
    ...[0.95, 1.45].map((y) => part(box(3.5, 0.05, 0.34), CLUB.top, { pos: [0, y, -0.6] })),
    ...[0.95, 1.45].flatMap((y, row) =>
      bottles.map((c, i) => part(cyl(0.06, 0.07, 0.3, 8), c, { pos: [-1.5 + i * 0.5 + row * 0.2, y + 0.18, -0.58], mat: (i + row) % 3 === 0 ? 'glow' : 'glass' })),
    ),
    // 의자 셋
    ...[-1.2, 0, 1.2].flatMap((x) => [
      part(cyl(0.04, 0.05, 0.7, 8), C.metal, { pos: [x, 0.35, 0.95] }),
      part(cyl(0.22, 0.2, 0.1, 16), CLUB.velvet, { pos: [x, 0.74, 0.95] }),
    ]),
  ];
}

/** 소파 (폭 2.4): 벨벳 방석, 등받이, 팔걸이. 정면(+Z)이 앉는 쪽 */
export function clubSofaParts(): Part[] {
  return [
    part(box(2.4, 0.42, 0.9), CLUB.velvetDark, { pos: [0, 0.21, 0] }),
    part(box(2.2, 0.14, 0.72), CLUB.velvet, { pos: [0, 0.49, 0.06] }),
    part(box(2.4, 0.66, 0.24), CLUB.velvet, { pos: [0, 0.75, -0.33] }),
    ...[-1.1, 1.1].map((x) => part(box(0.22, 0.6, 0.9), CLUB.velvetDark, { pos: [x, 0.42, 0] })),
  ];
}
