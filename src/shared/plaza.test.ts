import { describe, expect, it } from 'vitest';
import { findPath, hasLineOfSight } from './pathfinding';
import { MOVE_BUDGET_MAX, isMoveAllowed, lerpAngle, moveWithCollision, refillMoveBudget, yawFromVector } from './movement';
import { groundHeightAt, isBlockedAt, isBlockedTile, randomSpawnPoint } from './plazaMap';
import { loadPlazaMapForTest } from './testMap';

const map = loadPlazaMapForTest();
const THREE_DEG = (d: number) => (d * Math.PI) / 180;

describe('광장 맵', () => {
  it('레이어를 읽는다', () => {
    expect(map.width).toBe(32);
    expect(map.height).toBe(24);
    expect(map.tileset.key).toBe('tile.plaza');
    expect(map.props.some((p) => p.key === 'prop.plaza.fountain')).toBe(true);
    // 테두리는 막혀 있다
    expect(isBlockedTile(map, 0, 5)).toBe(true);
    expect(isBlockedTile(map, -1, 5)).toBe(true);
    // 분수 자리는 막혀 있다
    expect(isBlockedTile(map, 16, 12)).toBe(true);
  });

  it('스폰 지점은 항상 걸을 수 있는 칸이다', () => {
    for (let i = 0; i < 200; i++) {
      const p = randomSpawnPoint(map);
      expect(isBlockedAt(map, p.x, p.z)).toBe(false);
    }
  });
});

describe('길찾기', () => {
  it('분수를 돌아서 게시판 앞까지 간다', () => {
    const start = { x: 16.5, z: 18.5 };
    const goal = { x: 16.5, z: 7.5 };
    const path = findPath(map, start, goal)!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(goal);
    let from = start;
    for (const p of path) {
      expect(isBlockedAt(map, p.x, p.z)).toBe(false);
      expect(hasLineOfSight(map, from, p, 0)).toBe(true);
      from = p;
    }
  });

  it('막힌 칸을 누르면 가장 가까운 빈 칸으로 간다', () => {
    const path = findPath(map, { x: 16.5, z: 18.5 }, { x: 16.5, z: 13.2 })!;
    const end = path.at(-1)!;
    expect(isBlockedAt(map, end.x, end.z)).toBe(false);
    expect(Math.abs(end.z - 14.5)).toBeLessThanOrEqual(1.5);
  });
});

describe('이동', () => {
  it('벽을 따라 미끄러진다', () => {
    // 왼쪽 산울타리(x=0)에 붙은 상태에서 왼쪽 위로 가면 위로만 움직인다
    const p = moveWithCollision(map, 1.35, 10.5, -0.2, -0.2);
    expect(p.x).toBe(1.35);
    expect(p.z).toBeCloseTo(10.3);
  });

  it('너무 멀리 뛰면 서버가 거부한다', () => {
    const from = { x: 16.5, z: 18.5 };
    expect(isMoveAllowed(map, from, { x: 16.5, z: 18.1 }, 0.5)).toBe(true);
    expect(isMoveAllowed(map, from, { x: 16.5, z: 10.5 }, MOVE_BUDGET_MAX)).toBe(false);
    expect(isMoveAllowed(map, from, { x: 16.5, z: 12.5 }, 99)).toBe(false); // 분수 안
    expect(isMoveAllowed(map, from, { x: NaN, z: 18 }, 1)).toBe(false);
  });

  it('이동 예산은 걷는 속도만큼 차고 상한이 있다', () => {
    expect(refillMoveBudget(0, 100)).toBeGreaterThan(0.3);
    expect(refillMoveBudget(0, 100)).toBeLessThan(0.7);
    expect(refillMoveBudget(0, 60_000)).toBe(MOVE_BUDGET_MAX);
    expect(refillMoveBudget(0.2, -50)).toBe(0.2);
  });

  it('이동 방향을 바라보는 각도로 바꾼다', () => {
    expect(yawFromVector(0, 1)).toBeCloseTo(0);
    expect(yawFromVector(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(yawFromVector(0, -1))).toBeCloseTo(Math.PI);
    expect(yawFromVector(0, 0, 1.2)).toBe(1.2);
    // -170도에서 170도로는 20도만 돈다
    const a = THREE_DEG(-170);
    const b = THREE_DEG(170);
    expect(Math.abs(lerpAngle(a, b, 1) - a)).toBeCloseTo(THREE_DEG(20));
  });
});

describe('입체 타일', () => {
  it('타일셋 terrain·height 속성을 읽는다', () => {
    expect(Object.values(map.terrain)).toContain('stone');
    expect(Object.values(map.tileHeights)).toContain(0.75);
    expect(groundHeightAt(map, 16.5, 17.5)).toBe(0.05); // 돌바닥
    expect(groundHeightAt(map, 3.5, 12.5)).toBe(0); // 길
  });

  it('소품 방향을 읽는다', () => {
    const benches = map.props.filter((p) => p.key === 'prop.plaza.bench');
    expect(benches.map((b) => Math.round(Math.abs(b.yaw) * 100) / 100).sort()).toEqual([0, 0, 3.14, 3.14]);
  });
});
