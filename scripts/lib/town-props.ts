// 마을 밖 소품 임시 3D 모델 (PROJECT_GUIDE.md 16장). 원점 = 바닥 가운데, 정면 = +Z. 1 = 한 칸.
// 'outfit' 재질 부분(흰색)은 화면에서 색을 입힌다 (집 지붕 = 지역 색).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { part, type MaterialSpec, type Part } from './models';

type Vec3 = [number, number, number];
const sphere = (r: number, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
// ───────────────────────── 중앙광장 소품 ─────────────────────────

const W = {
  stone: '#EADFCF',
  stoneDark: '#D6C7B2',
  water: '#8ED2F2',
  waterLight: '#CDEFFF',
  wood: '#B98556',
  woodDark: '#8E623D',
  paper: '#FFFCF3',
  ink: '#C9BBA6',
  roof: '#C2655A',
  leaf: '#7CC46A',
  leafLight: '#93D47B',
  leafDark: '#64AE57',
  trunk: '#9B6B45',
  metal: '#3D4A45',
  glow: '#FFE7A8',
  gold: '#F2C14E',
};

const cyl = (rt: number, rb: number, h: number, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

export function fountainParts(): Part[] {
  return [
    part(cyl(1.42, 1.5, 0.42, 48), W.stone, { pos: [0, 0.21, 0] }),
    part(cyl(1.5, 1.5, 0.06, 48), W.stoneDark, { pos: [0, 0.03, 0] }),
    part(cyl(1.26, 1.26, 0.05, 48), W.water, { pos: [0, 0.36, 0], mat: 'water' }),
    part(cyl(0.16, 0.22, 0.95, 20), W.stone, { pos: [0, 0.8, 0] }),
    part(cyl(0.56, 0.34, 0.18, 32), W.stone, { pos: [0, 1.26, 0] }),
    part(cyl(0.48, 0.48, 0.04, 32), W.water, { pos: [0, 1.34, 0], mat: 'water' }),
    part(sphere(0.1, 16, 12), W.waterLight, { pos: [0, 1.5, 0], scale: [1, 2.2, 1], mat: 'water' }),
  ];
}

export function benchParts(): Part[] {
  const parts: Part[] = [];
  for (const x of [-0.7, 0.7]) {
    parts.push(part(box(0.08, 0.42, 0.08), W.woodDark, { pos: [x, 0.21, 0.12] }));
    parts.push(part(box(0.08, 0.82, 0.08), W.woodDark, { pos: [x, 0.41, -0.16] }));
  }
  for (const z of [-0.1, 0.04, 0.18]) parts.push(part(box(1.7, 0.05, 0.12), W.wood, { pos: [0, 0.44, z] }));
  for (const y of [0.62, 0.76]) parts.push(part(box(1.7, 0.1, 0.04), W.wood, { pos: [0, y, -0.18], rot: [-8, 0, 0] }));
  return parts;
}

export function boardParts(): Part[] {
  const parts: Part[] = [
    part(box(0.12, 1.9, 0.12), W.woodDark, { pos: [-1.05, 0.95, 0] }),
    part(box(0.12, 1.9, 0.12), W.woodDark, { pos: [1.05, 0.95, 0] }),
    part(box(2.0, 1.05, 0.1), W.wood, { pos: [0, 1.2, 0] }),
    part(box(1.8, 0.88, 0.02), W.paper, { pos: [0, 1.2, 0.06] }),
    part(box(1.25, 0.12, 0.62), W.roof, { pos: [-0.5, 1.92, 0], rot: [0, 0, 18] }),
    part(box(1.25, 0.12, 0.62), W.roof, { pos: [0.5, 1.92, 0], rot: [0, 0, -18] }),
  ];
  for (const [y, w] of [[1.45, 1.3], [1.28, 1.5], [1.11, 1.1], [0.94, 1.4]] as const) {
    parts.push(part(box(w, 0.05, 0.01), W.ink, { pos: [-(1.5 - w) / 2, y, 0.075] }));
  }
  return parts;
}

export function flagParts(clothColor: string): Part[] {
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, -0.28, 0, 0, -0.56, 0], 3));
  cloth.setIndex([0, 1, 2]);
  cloth.computeVertexNormals();
  return [
    part(cyl(0.18, 0.22, 0.12, 20), W.stoneDark, { pos: [0, 0.06, 0] }),
    part(cyl(0.035, 0.04, 2.6, 12), W.metal, { pos: [0, 1.3, 0] }),
    part(sphere(0.07, 12, 10), W.gold, { pos: [0, 2.64, 0] }),
    part(cloth, clothColor, { pos: [0.04, 2.5, 0], mat: 'cloth' }),
  ];
}

export function treeParts(): Part[] {
  const blobs: [Vec3, number, string][] = [
    [[0, 2.0, 0], 0.95, W.leaf],
    [[0.6, 1.75, 0.25], 0.7, W.leafLight],
    [[-0.62, 1.8, 0.1], 0.72, W.leaf],
    [[0.1, 1.72, 0.62], 0.66, W.leafLight],
    [[-0.2, 1.68, -0.6], 0.7, W.leafDark],
    [[0.25, 2.55, -0.1], 0.6, W.leafLight],
  ];
  return [
    part(cyl(0.16, 0.26, 1.5, 10), W.trunk, { pos: [0, 0.75, 0] }),
    // 마을 전체에 많이 심으므로 면 수를 줄인다
    ...blobs.map(([p, r, c]) => part(sphere(r, 11, 8), c, { pos: p, scale: [1, 0.9, 1] })),
  ];
}

// ───────────────────────── 주민의 집 ─────────────────────────

const TINT = '#FFFFFF';

/** 주민의 집: 크림색 벽 + 지역 색 지붕(outfit). 바닥 2.4×2.2, 정면(+Z)에 문. */
export function houseParts(): Part[] {
  const roofSlope = 32;
  const roof = (side: 1 | -1) =>
    part(box(1.62, 0.16, 2.7), TINT, {
      pos: [side * 0.66, 2.02, 0],
      rot: [0, 0, -side * roofSlope],
      mat: 'outfit',
    });
  const gable = new THREE.BufferGeometry();
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-1.2, 0, 0, 1.2, 0, 0, 0, 0.78, 0], 3));
  gable.setIndex([0, 1, 2]);
  gable.computeVertexNormals();
  return [
    part(box(2.5, 0.16, 2.3), W.stoneDark, { pos: [0, 0.08, 0] }),
    part(box(2.3, 1.5, 2.1), W.paper, { pos: [0, 0.9, 0] }),
    part(gable, W.paper, { pos: [0, 1.65, 1.05] }),
    part(gable, W.paper, { pos: [0, 1.65, -1.05], rot: [0, 180, 0] }),
    roof(1),
    roof(-1),
    part(box(0.62, 0.98, 0.08), W.woodDark, { pos: [0, 0.65, 1.07] }),
    part(sphere(0.04, 8, 6), W.gold, { pos: [0.2, 0.66, 1.12] }),
    part(box(0.5, 0.46, 0.06), W.waterLight, { pos: [-0.75, 1.0, 1.06] }),
    part(box(0.5, 0.46, 0.06), W.waterLight, { pos: [0.75, 1.0, 1.06] }),
    part(box(0.58, 0.08, 0.1), W.wood, { pos: [-0.75, 0.74, 1.1] }),
    part(box(0.58, 0.08, 0.1), W.wood, { pos: [0.75, 0.74, 1.1] }),
    part(box(0.3, 0.7, 0.3), W.stoneDark, { pos: [0.62, 2.25, -0.45] }),
  ];
}

export function lampParts(): Part[] {
  return [
    part(cyl(0.14, 0.18, 0.14, 16), W.metal, { pos: [0, 0.07, 0] }),
    part(cyl(0.045, 0.05, 2.1, 12), W.metal, { pos: [0, 1.15, 0] }),
    part(cyl(0.2, 0.14, 0.32, 6), W.glow, { pos: [0, 2.3, 0], mat: 'glow' }),
    part(new THREE.ConeGeometry(0.27, 0.2, 6), W.metal, { pos: [0, 2.55, 0] }),
  ];
}

export const PROP_MATERIALS: Record<string, MaterialSpec> = {
  glass: { roughness: 0.2, metallic: 0.05 },
  base: { roughness: 0.85 },
  water: { roughness: 0.15, metallic: 0.05 },
  cloth: { roughness: 0.9, doubleSided: true },
  glow: { roughness: 0.6, emissive: [1, 0.86, 0.55] },
  outfit: { roughness: 0.75, doubleSided: true },
};

// ───────────────────────── 빈 집터와 지역 명소 ─────────────────────────

const rbox = (w: number, h: number, d: number, r = 0.04) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

/** 빈 집터: 낮은 울타리와 '입주 대기' 팻말 (집과 같은 자리를 차지한다) */
export function lotParts(): Part[] {
  const parts: Part[] = [part(box(2.3, 0.04, 2.1), '#B7D99A', { pos: [0, 0.02, 0] })];
  for (const [x, z, w, d] of [[0, -1.05, 2.4, 0.06], [0, 1.05, 2.4, 0.06], [-1.15, 0, 0.06, 2.1], [1.15, 0, 0.06, 2.1]] as const) {
    parts.push(part(box(w, 0.06, d), W.paper, { pos: [x, 0.3, z] }));
    parts.push(part(box(w, 0.06, d), W.paper, { pos: [x, 0.16, z] }));
  }
  for (const x of [-1.15, -0.4, 0.4, 1.15]) for (const z of [-1.05, 1.05]) parts.push(part(box(0.08, 0.42, 0.08), W.paper, { pos: [x, 0.21, z] }));
  parts.push(part(box(0.06, 0.7, 0.06), W.woodDark, { pos: [0.6, 0.35, 0.9] }));
  parts.push(part(box(0.5, 0.3, 0.04), W.wood, { pos: [0.6, 0.7, 0.92] }));
  parts.push(part(sphere(0.18, 10, 8), W.leafLight, { pos: [-0.5, 0.15, -0.3] }));
  return parts;
}

/** 숲(목): 유리 온실 */
export function greenhouseParts(): Part[] {
  const parts: Part[] = [
    part(box(3.2, 0.12, 2.4), W.stoneDark, { pos: [0, 0.06, 0] }),
    part(box(3.0, 1.5, 2.2), '#DFF5EC', { pos: [0, 0.87, 0], mat: 'glass' }),
    part(box(1.8, 0.1, 2.3), '#CDEFE3', { pos: [-0.72, 1.92, 0], rot: [0, 0, 32], mat: 'glass' }),
    part(box(1.8, 0.1, 2.3), '#CDEFE3', { pos: [0.72, 1.92, 0], rot: [0, 0, -32], mat: 'glass' }),
  ];
  for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) parts.push(part(box(0.06, 1.55, 0.06), W.paper, { pos: [x, 0.9, 1.1] }), part(box(0.06, 1.55, 0.06), W.paper, { pos: [x, 0.9, -1.1] }));
  for (const [x, z] of [[-0.9, 0.3], [0, -0.4], [0.9, 0.4]]) parts.push(part(sphere(0.32, 12, 10), W.leaf, { pos: [x, 0.5, z] }));
  return parts;
}

/** 노을(화): 작은 공연 무대와 조명 */
export function stageParts(): Part[] {
  return [
    part(rbox(3.2, 0.36, 2.0, 0.06), W.wood, { pos: [0, 0.18, 0] }),
    part(box(3.2, 0.06, 0.12), W.woodDark, { pos: [0, 0.38, 0.95] }),
    part(box(0.12, 2.2, 0.12), W.metal, { pos: [-1.5, 1.1, -0.9] }),
    part(box(0.12, 2.2, 0.12), W.metal, { pos: [1.5, 1.1, -0.9] }),
    part(box(3.2, 0.12, 0.12), W.metal, { pos: [0, 2.2, -0.9] }),
    part(box(3.0, 1.7, 0.05), '#F08A6C', { pos: [0, 1.25, -0.95], mat: 'outfit' }),
    ...[-1, 0, 1].map((k) => part(sphere(0.1, 10, 8), W.glow, { pos: [k * 0.9, 2.1, -0.75], mat: 'glow' })),
    part(cyl(0.05, 0.05, 1.1, 8), W.metal, { pos: [0.4, 0.92, 0.2] }),
    part(sphere(0.08, 10, 8), W.metal, { pos: [0.4, 1.5, 0.2] }),
  ];
}

/** 언덕(토): 작은 상점 가판 */
export function shopParts(): Part[] {
  return [
    part(rbox(2.4, 0.9, 1.0, 0.05), W.wood, { pos: [0, 0.45, 0.3] }),
    part(box(2.4, 0.06, 1.1), W.woodDark, { pos: [0, 0.93, 0.3] }),
    ...[-0.8, -0.3, 0.2, 0.7].map((x, k) => part(sphere(0.16, 10, 8), ['#F59C8C', '#FFE6A1', '#A7E0CF', '#FFC9B3'][k], { pos: [x, 1.08, 0.35] })),
    part(box(0.08, 2.1, 0.08), W.woodDark, { pos: [-1.15, 1.05, -0.2] }),
    part(box(0.08, 2.1, 0.08), W.woodDark, { pos: [1.15, 1.05, -0.2] }),
    part(box(2.6, 0.08, 1.5), '#E2C08A', { pos: [0, 2.05, 0.3], rot: [-12, 0, 0], mat: 'outfit' }),
    part(box(1.2, 0.36, 0.05), W.paper, { pos: [0, 1.75, -0.18] }),
  ];
}

/** 은빛(금): 금속 공방 (유리창과 굴뚝) */
export function workshopParts(): Part[] {
  return [
    part(rbox(3.0, 1.8, 2.2, 0.05), '#C9D0D9', { pos: [0, 0.9, 0] }),
    part(box(3.1, 0.12, 2.3), '#8E9AAB', { pos: [0, 1.86, 0] }),
    part(box(1.1, 0.8, 0.06), '#DCEBFA', { pos: [-0.7, 1.05, 1.11], mat: 'glass' }),
    part(box(0.7, 1.2, 0.06), '#7D8796', { pos: [0.8, 0.6, 1.11] }),
    part(cyl(0.18, 0.18, 1.0, 12), '#8E9AAB', { pos: [1.0, 2.4, -0.6] }),
    part(cyl(0.6, 0.6, 0.08, 6), '#AEB9C7', { pos: [-0.9, 2.0, -0.5], rot: [90, 0, 0], mat: 'outfit' }),
  ];
}

/** 호수(수): 나무 부두와 작은 배 */
export function pierParts(): Part[] {
  const parts: Part[] = [];
  for (let k = 0; k < 6; k++) parts.push(part(box(1.2, 0.08, 0.34), k % 2 ? W.wood : W.woodDark, { pos: [0, 0.22, -1.0 + k * 0.4] }));
  for (const x of [-0.55, 0.55]) for (const z of [-1.1, 1.1]) parts.push(part(cyl(0.06, 0.06, 0.5, 8), W.woodDark, { pos: [x, 0.1, z] }));
  parts.push(part(rbox(0.7, 0.24, 1.5, 0.1), '#6F9BDB', { pos: [1.3, 0.05, 0.6], mat: 'outfit' }));
  parts.push(part(sphere(0.1, 10, 8), W.glow, { pos: [-0.5, 0.75, 1.05], mat: 'glow' }));
  parts.push(part(cyl(0.03, 0.03, 0.5, 6), W.metal, { pos: [-0.5, 0.48, 1.05] }));
  return parts;
}
