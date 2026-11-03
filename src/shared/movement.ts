// 이동 계산. 클라이언트는 이걸로 움직이고, 서버는 같은 규칙으로 검사한다.
import { townConfig } from '../config/game';
import { isBlockedAt, type TownMap } from './townMap';

/** 캐릭터 발 둘레 여유 (월드 단위). 벽에 몸이 파묻히지 않게 한다. */
export const FOOT_RADIUS = 0.3;

/** 이동 방향 → 바라보는 각도 (라디안). 0이면 +Z(남쪽, 카메라 쪽)를 본다. */
export function yawFromVector(dx: number, dz: number, fallback = 0): number {
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return fallback;
  return Math.atan2(dx, dz);
}

/** 각도를 -π~π로 맞춘다 */
export function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** a에서 b로 가장 짧게 도는 쪽으로 t만큼 보간한다 */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * t;
}

/**
 * 축을 나눠 움직여서 벽을 따라 미끄러지게 한다.
 * 가는 방향 쪽만 발 여유를 검사하므로, 벽에 붙어 있어도 나란히 움직이거나 떨어질 수 있다.
 */
export function moveWithCollision(map: TownMap, x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  let nx = x;
  let nz = z;
  if (dx && !isBlockedAt(map, x + dx, z) && !isBlockedAt(map, x + dx + Math.sign(dx) * FOOT_RADIUS, z)) nx = x + dx;
  if (dz && !isBlockedAt(map, nx, z + dz) && !isBlockedAt(map, nx, z + dz + Math.sign(dz) * FOOT_RADIUS)) nz = z + dz;
  return { x: nx, z: nz };
}

/**
 * 서버 속도 검사는 "이동 예산"으로 한다. 시간이 지나면 걷는 속도만큼 예산이 차고, 움직인 거리만큼 줄어든다.
 * 지연으로 메시지가 몰려 와도 통과하고, 메시지를 잘게 쪼개 보내도 더 빨리 갈 수 없다.
 */
export const MOVE_BUDGET_MAX = townConfig.moveBurstTiles;

export function refillMoveBudget(budget: number, elapsedMs: number): number {
  const gain = (townConfig.walkSpeed * townConfig.speedTolerance * Math.max(0, elapsedMs)) / 1000;
  return Math.min(MOVE_BUDGET_MAX, budget + gain);
}

/** 서버 검사: 숫자가 올바르고, 막힌 칸이 아니고, 예산 안의 거리인지 */
export function isMoveAllowed(
  map: TownMap,
  from: { x: number; z: number },
  to: { x: number; z: number },
  budget: number,
): boolean {
  if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) return false;
  if (isBlockedAt(map, to.x, to.z)) return false;
  return Math.hypot(to.x - from.x, to.z - from.z) <= budget + 0.05;
}
