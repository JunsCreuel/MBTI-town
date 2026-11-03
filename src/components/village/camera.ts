// 마을 카메라 시점: 회전(Q/E·버튼·끌기), 시점 바꾸기(V·버튼), 정면 보기(R).
// 장면(CameraRig)과 화면 버튼(VillageClient)이 input.camera를 함께 쓴다.
import { cameraConfig } from '@/config/game';
import type { TownCamera } from './context';

const STORAGE_KEY = 'scene:village-camera';
const TAU = Math.PI * 2;

export type CameraView = (typeof cameraConfig.views)[number];

/** 화면 방향에 맞는 '기본' 시점 거리 (세로 화면은 좌우가 좁아 조금 더 멀리서 본다) */
export function normalDistance(width: number, height: number): number {
  return width < height ? cameraConfig.portraitDistance : cameraConfig.distance;
}

function viewDistance(view: CameraView, width: number, height: number): number {
  return view.distance || normalDistance(width, height);
}

/** 처음 카메라 값: 이 기기에서 마지막으로 쓴 방향과 거리 (없으면 정면·기본) */
export function initialCamera(): TownCamera {
  const cam: TownCamera = { yaw: 0, yawNow: 0, distance: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { yaw?: unknown; distance?: unknown } | null;
    if (typeof saved?.yaw === 'number' && Number.isFinite(saved.yaw)) cam.yaw = cam.yawNow = saved.yaw % TAU;
    if (typeof saved?.distance === 'number' && saved.distance >= cameraConfig.minDistance && saved.distance <= cameraConfig.maxDistance) {
      cam.distance = saved.distance;
    }
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 창 등)는 기본값
  }
  return cam;
}

export function saveCamera(cam: TownCamera): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ yaw: cam.yaw % TAU, distance: cam.distance }));
  } catch {
    // 저장하지 못해도 이번 접속에서는 그대로 쓴다
  }
}

/** 지금 거리에 가장 가까운 시점 */
export function currentView(cam: TownCamera, width: number, height: number): CameraView {
  const d = cam.distance || normalDistance(width, height);
  let best: CameraView = cameraConfig.views[0];
  for (const v of cameraConfig.views) {
    if (Math.abs(viewDistance(v, width, height) - d) < Math.abs(viewDistance(best, width, height) - d)) best = v;
  }
  return best;
}

/** 다음 시점으로 (기본 → 가까이 → 멀리 → 기본…) */
export function cycleView(cam: TownCamera, width: number, height: number): CameraView {
  const views = cameraConfig.views;
  const next = views[(views.indexOf(currentView(cam, width, height)) + 1) % views.length];
  cam.distance = viewDistance(next, width, height);
  saveCamera(cam);
  return next;
}

/**
 * 한 칸(rotateStepDeg) 돌린다. dir -1 = 시계 반대 방향 ⟲ (Q, 화면을 오른쪽으로 끈 것과 같다), 1 = 시계 방향 ⟳ (E).
 * 끌어서 칸 사이에 있으면 그 방향의 다음 칸에 맞춘다.
 */
export function rotateCamera(cam: TownCamera, dir: -1 | 1): void {
  const step = (cameraConfig.rotateStepDeg * Math.PI) / 180;
  const n = cam.yaw / step;
  const r = Math.round(n);
  cam.yaw = (Math.abs(n - r) < 1e-3 ? r + dir : dir > 0 ? Math.ceil(n) : Math.floor(n)) * step;
  saveCamera(cam);
}

/** 정면(남쪽에서 북쪽을 보는 처음 방향)으로. 가까운 쪽으로 돈다. */
export function resetCamera(cam: TownCamera): void {
  cam.yaw = Math.round(cam.yaw / TAU) * TAU;
  saveCamera(cam);
}

/** 정면이 아닌지 (정면 버튼을 보여 줄지) */
export function isTurned(cam: TownCamera): boolean {
  const r = ((cam.yaw % TAU) + TAU) % TAU;
  return Math.min(r, TAU - r) > 1e-3;
}
