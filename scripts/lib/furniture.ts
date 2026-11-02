// 방 소품 임시 3D 모델 (PROJECT_GUIDE.md 16장). 둥글고 부드러운 파스텔 톤.
// 원점 = 바닥 소품은 바닥 가운데, 벽 소품은 벽면 가운데. 정면 = +Z. 1 = 바닥 한 칸.
// 재질 이름: base(정점 색), glow(빛나는 부분), view(창밖 풍경을 입힐 자리), photo(사진을 입힐 자리)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { part, type MaterialSpec, type Part } from './models';

const P = {
  cream: '#FFF6EA',
  creamDark: '#F1E4CF',
  wood: '#DDB78F',
  woodDark: '#B48558',
  mint: '#A7E0CF',
  mintDeep: '#63C2A8',
  sky: '#B4DBF6',
  skyDeep: '#78B8E6',
  peach: '#FFC9B3',
  butter: '#FFE6A1',
  lilac: '#D9CBF3',
  white: '#FFFFFF',
  ink: '#3D4250',
  metal: '#C9D0D9',
  leaf: '#86CB8F',
  leafDark: '#5FAE6E',
  pot: '#EAA884',
  black: '#33353F',
  coral: '#F59C8C',
  gold: '#F2C66B',
};

const rbox = (w: number, h: number, d: number, r = 0.04, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 24) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sphere = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const plane = (w: number, h: number) => new THREE.PlaneGeometry(w, h);

export const FURNITURE_MATERIALS: Record<string, MaterialSpec> = {
  base: { roughness: 0.82 },
  glow: { roughness: 0.6, emissive: [1, 0.9, 0.68] },
  view: { roughness: 1, emissive: [0.75, 0.86, 1] },
  photo: { roughness: 0.7 },
};

/** 나무 다리 네 개 */
function legs(w: number, d: number, h: number, color: string, r = 0.03): Part[] {
  const out: Part[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(part(cyl(r, r * 0.85, h, 10), color, { pos: [sx * (w / 2 - r * 2), h / 2, sz * (d / 2 - r * 2)] }));
  }
  return out;
}

function turntable(): Part[] {
  return [
    part(rbox(0.82, 0.62, 0.62, 0.06), P.wood, { pos: [0, 0.31, 0] }),
    part(box(0.7, 0.01, 0.01), P.woodDark, { pos: [0, 0.36, 0.312] }),
    part(sphere(0.025), P.gold, { pos: [0, 0.2, 0.32] }),
    part(rbox(0.74, 0.09, 0.56, 0.03), P.cream, { pos: [0, 0.665, 0] }),
    part(cyl(0.21, 0.21, 0.025, 36), P.black, { pos: [-0.08, 0.72, 0] }),
    part(cyl(0.07, 0.07, 0.03, 24), P.coral, { pos: [-0.08, 0.725, 0] }),
    part(cyl(0.012, 0.012, 0.05, 8), P.metal, { pos: [-0.08, 0.74, 0] }),
    part(cyl(0.035, 0.035, 0.05, 12), P.metal, { pos: [0.25, 0.73, -0.15] }),
    part(box(0.03, 0.02, 0.3), P.metal, { pos: [0.2, 0.765, 0.0], rot: [0, -20, 0] }),
    // 옆에 기대 둔 음반 두 장
    part(box(0.3, 0.3, 0.015), P.mint, { pos: [0.22, 0.17, 0.33], rot: [-8, 0, 0] }),
    part(box(0.3, 0.3, 0.015), P.lilac, { pos: [0.18, 0.16, 0.35], rot: [-12, 0, 0] }),
  ];
}

function desk(): Part[] {
  return [
    part(rbox(1.86, 0.06, 0.82, 0.025), P.wood, { pos: [0, 0.74, 0] }),
    ...legs(1.86, 0.82, 0.72, P.woodDark, 0.035).slice(0, 2),
    part(rbox(0.52, 0.66, 0.76, 0.03), P.cream, { pos: [0.6, 0.38, 0] }),
    part(box(0.42, 0.01, 0.01), P.creamDark, { pos: [0.6, 0.5, 0.385] }),
    part(sphere(0.022), P.gold, { pos: [0.6, 0.6, 0.39] }),
    part(sphere(0.022), P.gold, { pos: [0.6, 0.3, 0.39] }),
    // 펼친 일기장과 연필, 컵
    part(box(0.26, 0.015, 0.34), P.white, { pos: [-0.28, 0.78, 0.05], rot: [0, 0, 4] }),
    part(box(0.26, 0.015, 0.34), P.white, { pos: [-0.02, 0.78, 0.05], rot: [0, 0, -4] }),
    part(box(0.5, 0.01, 0.35), P.peach, { pos: [-0.15, 0.772, 0.05] }),
    part(cyl(0.008, 0.008, 0.2, 6), P.butter, { pos: [0.1, 0.79, 0.2], rot: [0, 30, 90] }),
    part(cyl(0.05, 0.045, 0.1, 16), P.sky, { pos: [-0.75, 0.82, -0.15] }),
  ];
}

function mailbox(): Part[] {
  return [
    part(cyl(0.045, 0.05, 0.8, 12), P.white, { pos: [0, 0.4, 0] }),
    part(cyl(0.14, 0.16, 0.04, 16), P.creamDark, { pos: [0, 0.02, 0] }),
    part(rbox(0.46, 0.32, 0.32, 0.12), P.mint, { pos: [0, 0.95, 0] }),
    part(box(0.2, 0.025, 0.01), P.ink, { pos: [0, 1.0, 0.162] }),
    part(box(0.03, 0.2, 0.03), P.coral, { pos: [0.245, 1.05, 0] }),
    part(box(0.12, 0.07, 0.02), P.coral, { pos: [0.29, 1.12, 0] }),
  ];
}

function wardrobe(): Part[] {
  return [
    part(rbox(0.9, 1.84, 0.56, 0.05), P.cream, { pos: [0, 0.96, 0] }),
    part(box(0.008, 1.66, 0.01), P.creamDark, { pos: [0, 0.98, 0.282] }),
    part(sphere(0.025), P.gold, { pos: [-0.06, 1.0, 0.29] }),
    part(sphere(0.025), P.gold, { pos: [0.06, 1.0, 0.29] }),
    part(rbox(0.96, 0.06, 0.6, 0.02), P.wood, { pos: [0, 1.9, 0] }),
    ...legs(0.84, 0.5, 0.06, P.woodDark, 0.03),
  ];
}

function bookshelf(): Part[] {
  const parts: Part[] = [
    part(box(0.9, 1.8, 0.04), P.wood, { pos: [0, 0.9, -0.18] }),
    part(box(0.04, 1.8, 0.4), P.wood, { pos: [-0.43, 0.9, 0] }),
    part(box(0.04, 1.8, 0.4), P.wood, { pos: [0.43, 0.9, 0] }),
  ];
  const colors = [P.coral, P.sky, P.butter, P.mintDeep, P.lilac, P.peach, P.skyDeep];
  [0.03, 0.62, 1.2, 1.78].forEach((y, i) => {
    parts.push(part(box(0.86, 0.04, 0.4), P.wood, { pos: [0, y, 0] }));
    if (i === 3) return;
    let x = -0.38;
    for (let k = 0; k < 6 && x < 0.3; k++) {
      const w = 0.07 + ((k * 7 + i * 3) % 4) * 0.015;
      const h = 0.34 + ((k * 5 + i) % 3) * 0.06;
      parts.push(part(box(w, h, 0.28), colors[(k + i * 2) % colors.length], { pos: [x + w / 2, y + 0.02 + h / 2, 0.02] }));
      x += w + 0.012;
    }
    parts.push(part(sphere(0.07), P.leaf, { pos: [0.3, y + 0.1, 0.02] }));
  });
  return parts;
}

function sofa(): Part[] {
  return [
    part(rbox(1.84, 0.3, 0.82, 0.08, 1), P.mint, { pos: [0, 0.27, 0] }),
    part(rbox(0.86, 0.14, 0.62, 0.06, 1), P.mint, { pos: [-0.44, 0.48, 0.08] }),
    part(rbox(0.86, 0.14, 0.62, 0.06, 1), P.mint, { pos: [0.44, 0.48, 0.08] }),
    part(rbox(1.84, 0.5, 0.2, 0.08, 1), P.mintDeep, { pos: [0, 0.62, -0.31] }),
    part(rbox(0.18, 0.42, 0.82, 0.08, 1), P.mintDeep, { pos: [-0.83, 0.42, 0] }),
    part(rbox(0.18, 0.42, 0.82, 0.08, 1), P.mintDeep, { pos: [0.83, 0.42, 0] }),
    part(rbox(0.36, 0.3, 0.1, 0.06, 1), P.butter, { pos: [-0.55, 0.66, -0.17], rot: [-12, 10, 0] }),
    ...legs(1.7, 0.7, 0.12, P.woodDark, 0.03),
  ];
}

function bed(): Part[] {
  return [
    part(rbox(0.94, 0.28, 1.92, 0.05), P.wood, { pos: [0, 0.2, 0] }),
    part(rbox(0.86, 0.18, 1.82, 0.08), P.white, { pos: [0, 0.42, 0.02] }),
    part(rbox(0.9, 0.08, 1.18, 0.05), P.sky, { pos: [0, 0.5, 0.36] }),
    part(rbox(0.9, 0.1, 0.12, 0.04), P.skyDeep, { pos: [0, 0.5, -0.2] }),
    part(rbox(0.6, 0.14, 0.32, 0.07), P.white, { pos: [0, 0.58, -0.68] }),
    part(rbox(0.94, 0.8, 0.08, 0.04), P.wood, { pos: [0, 0.55, -0.93] }),
  ];
}

function chair(): Part[] {
  return [
    part(rbox(0.5, 0.06, 0.5, 0.025), P.wood, { pos: [0, 0.45, 0] }),
    part(rbox(0.44, 0.05, 0.44, 0.02), P.peach, { pos: [0, 0.5, 0.01] }),
    ...legs(0.46, 0.46, 0.43, P.woodDark, 0.025),
    part(rbox(0.5, 0.4, 0.05, 0.025), P.wood, { pos: [0, 0.72, -0.23] }),
  ];
}

function table(): Part[] {
  return [
    part(cyl(0.38, 0.38, 0.05, 36), P.cream, { pos: [0, 0.5, 0] }),
    part(cyl(0.04, 0.05, 0.47, 12), P.wood, { pos: [0, 0.24, 0] }),
    part(cyl(0.2, 0.22, 0.03, 24), P.wood, { pos: [0, 0.015, 0] }),
    part(cyl(0.06, 0.05, 0.12, 16), P.lilac, { pos: [0.1, 0.585, 0.05] }),
    part(sphere(0.05), P.butter, { pos: [0.1, 0.68, 0.05] }),
    part(cyl(0.05, 0.045, 0.08, 16), P.white, { pos: [-0.12, 0.565, -0.06] }),
  ];
}

function plant(): Part[] {
  return [
    part(cyl(0.22, 0.17, 0.34, 20), P.pot, { pos: [0, 0.17, 0] }),
    part(cyl(0.2, 0.2, 0.02, 20), '#8A6248', { pos: [0, 0.33, 0] }),
    part(sphere(0.2), P.leaf, { pos: [0, 0.62, 0], scale: [1, 1.2, 1] }),
    part(sphere(0.16), P.leafDark, { pos: [0.14, 0.5, 0.06] }),
    part(sphere(0.15), P.leaf, { pos: [-0.13, 0.52, -0.04] }),
    part(sphere(0.13), P.leafDark, { pos: [0.02, 0.86, -0.04] }),
  ];
}

function lamp(): Part[] {
  return [
    part(cyl(0.18, 0.2, 0.04, 20), P.metal, { pos: [0, 0.02, 0] }),
    part(cyl(0.022, 0.022, 1.42, 10), P.metal, { pos: [0, 0.73, 0] }),
    part(cyl(0.2, 0.28, 0.3, 24, ), P.butter, { pos: [0, 1.5, 0], mat: 'glow' }),
    part(sphere(0.07), P.white, { pos: [0, 1.4, 0], mat: 'glow' }),
  ];
}

function rug(): Part[] {
  return [
    part(cyl(0.94, 0.94, 0.02, 48), P.lilac, { pos: [0, 0.01, 0] }),
    part(cyl(0.74, 0.74, 0.022, 48), P.cream, { pos: [0, 0.011, 0] }),
    part(cyl(0.6, 0.6, 0.024, 48), P.lilac, { pos: [0, 0.012, 0] }),
  ];
}

function windowParts(): Part[] {
  return [
    part(plane(1.5, 1.04), P.white, { pos: [0, 0, 0.02], mat: 'view' }),
    part(box(1.66, 0.08, 0.08), P.white, { pos: [0, 0.56, 0.04] }),
    part(box(1.66, 0.08, 0.08), P.white, { pos: [0, -0.56, 0.04] }),
    part(box(0.08, 1.2, 0.08), P.white, { pos: [-0.79, 0, 0.04] }),
    part(box(0.08, 1.2, 0.08), P.white, { pos: [0.79, 0, 0.04] }),
    part(box(0.04, 1.04, 0.05), P.white, { pos: [0, 0, 0.04] }),
    part(box(1.5, 0.04, 0.05), P.white, { pos: [0, 0.05, 0.04] }),
    part(rbox(1.84, 0.06, 0.2, 0.02), P.cream, { pos: [0, -0.62, 0.1] }),
    // 커튼
    part(rbox(0.26, 1.3, 0.05, 0.02), P.sky, { pos: [-0.92, 0.02, 0.1] }),
    part(rbox(0.26, 1.3, 0.05, 0.02), P.sky, { pos: [0.92, 0.02, 0.1] }),
    part(rbox(2.1, 0.06, 0.06, 0.02), P.wood, { pos: [0, 0.72, 0.12] }),
    part(sphere(0.1), P.leaf, { pos: [0.55, -0.48, 0.14] }),
    part(cyl(0.07, 0.06, 0.1, 12), P.pot, { pos: [0.55, -0.55, 0.14] }),
  ];
}

function frame(): Part[] {
  return [
    part(rbox(0.62, 0.78, 0.05, 0.02), P.wood, { pos: [0, 0, 0.025] }),
    part(box(0.54, 0.7, 0.01), P.white, { pos: [0, 0, 0.052] }),
    part(plane(0.44, 0.58), P.white, { pos: [0, 0, 0.059], mat: 'photo' }),
  ];
}

function clock(): Part[] {
  const parts: Part[] = [
    part(cyl(0.26, 0.26, 0.06, 36), P.mintDeep, { pos: [0, 0, 0.03], rot: [90, 0, 0] }),
    part(cyl(0.22, 0.22, 0.02, 36), P.white, { pos: [0, 0, 0.061], rot: [90, 0, 0] }),
    part(box(0.02, 0.13, 0.01), P.ink, { pos: [0, 0.055, 0.075] }),
    part(box(0.1, 0.02, 0.01), P.ink, { pos: [0.04, 0, 0.075] }),
    part(sphere(0.018), P.coral, { pos: [0, 0, 0.078] }),
  ];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    parts.push(part(box(0.012, 0.03, 0.005), P.ink, { pos: [Math.sin(a) * 0.18, Math.cos(a) * 0.18, 0.072], rot: [0, 0, (-a * 180) / Math.PI] }));
  }
  return parts;
}

function shelf(): Part[] {
  return [
    part(rbox(0.86, 0.05, 0.24, 0.015), P.wood, { pos: [0, 0, 0.12] }),
    part(box(0.04, 0.14, 0.18), P.woodDark, { pos: [-0.32, -0.08, 0.09] }),
    part(box(0.04, 0.14, 0.18), P.woodDark, { pos: [0.32, -0.08, 0.09] }),
    part(box(0.08, 0.24, 0.16), P.coral, { pos: [-0.3, 0.145, 0.12] }),
    part(box(0.07, 0.2, 0.16), P.sky, { pos: [-0.21, 0.125, 0.12] }),
    part(box(0.07, 0.22, 0.16), P.butter, { pos: [-0.13, 0.135, 0.12], rot: [0, 0, -10] }),
    part(cyl(0.06, 0.05, 0.08, 12), P.pot, { pos: [0.15, 0.065, 0.12] }),
    part(sphere(0.08), P.leaf, { pos: [0.15, 0.16, 0.12] }),
    part(cyl(0.035, 0.035, 0.12, 12), P.white, { pos: [0.3, 0.085, 0.12] }),
    part(sphere(0.022), P.butter, { pos: [0.3, 0.16, 0.12], mat: 'glow' }),
  ];
}

/** 소품 키 → 모델 부품 */
export const FURNITURE_PARTS: Record<string, () => Part[]> = {
  'furn.turntable': turntable,
  'furn.desk': desk,
  'furn.mailbox': mailbox,
  'furn.wardrobe': wardrobe,
  'furn.bookshelf': bookshelf,
  'furn.sofa': sofa,
  'furn.bed': bed,
  'furn.chair': chair,
  'furn.table': table,
  'furn.plant': plant,
  'furn.lamp': lamp,
  'furn.rug': rug,
  'furn.window': windowParts,
  'furn.frame': frame,
  'furn.clock': clock,
  'furn.shelf': shelf,
};
