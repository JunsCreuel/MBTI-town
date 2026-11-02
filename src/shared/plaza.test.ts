import { describe, expect, it } from 'vitest';
import { findPath, hasLineOfSight } from './pathfinding';
import { MOVE_BUDGET_MAX, isMoveAllowed, lerpAngle, moveWithCollision, refillMoveBudget, yawFromVector } from './movement';
import { MBTI_TYPES } from '../design/mbti';
import { groundHeightAt, isBlockedAt, isBlockedTile, randomSpawnPoint, spawnName } from './plazaMap';
import { loadPlazaMapForTest } from './testMap';

const map = loadPlazaMapForTest();
const THREE_DEG = (d: number) => (d * Math.PI) / 180;

describe('마을 맵', () => {
  it('레이어를 읽는다', () => {
    expect(map.width).toBe(96);
    expect(map.height).toBe(96);
    expect(map.tileset.key).toBe('tile.town');
    expect(map.props.some((p) => p.key === 'prop.plaza.fountain')).toBe(true);
    // 바다와 맵 바깥은 막혀 있다
    expect(isBlockedTile(map, 0, 5)).toBe(true);
    expect(isBlockedTile(map, -1, 5)).toBe(true);
    // 분수 자리는 막혀 있다
    expect(isBlockedTile(map, 48, 48)).toBe(true);
  });

  it('광장 둘레에 16개 유형 마을이 있고, 마을마다 집 3채·깃발·표지판이 있다', () => {
    expect(Object.keys(map.villages).sort()).toEqual([...MBTI_TYPES].sort());
    for (const t of MBTI_TYPES) {
      const own = map.props.filter((p) => p.village === t);
      expect(own.filter((p) => p.key === 'prop.village.house')).toHaveLength(3);
      expect(own.filter((p) => p.key === 'prop.village.flag')).toHaveLength(1);
      expect(own.filter((p) => p.key === 'prop.village.sign')).toHaveLength(1);
      const c = map.villages[t]!;
      expect(map.land[Math.floor(c.z) * map.width + Math.floor(c.x)]).toBe(1);
    }
    // 광장은 누구의 땅도 아니다
    expect(map.land[48 * map.width + 48]).toBe(0);
    expect(map.land.reduce((a, b) => a + b, 0)).toBeGreaterThan(4000);
  });

  it('스폰 지점은 항상 걸을 수 있는 칸이다', () => {
    for (const name of ['spawn', ...MBTI_TYPES.map((t) => spawnName(t))]) {
      expect(map.spawns[name]).toBeDefined();
      for (let i = 0; i < 40; i++) {
        const p = randomSpawnPoint(map, Math.random, name);
        expect(isBlockedAt(map, p.x, p.z)).toBe(false);
      }
    }
  });
});

describe('길찾기', () => {
  it('분수를 돌아서 게시판 앞까지 간다', () => {
    const start = { x: 48.5, z: 54.5 };
    const goal = { x: 48.5, z: 43.5 };
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
    const path = findPath(map, { x: 48.5, z: 54.5 }, { x: 48.5, z: 49.2 })!;
    const end = path.at(-1)!;
    expect(isBlockedAt(map, end.x, end.z)).toBe(false);
    expect(Math.abs(end.z - 50.5)).toBeLessThanOrEqual(1.5);
  });
});

describe('이동', () => {
  it('벽을 따라 미끄러진다', () => {
    // 분수(x=47~49) 동쪽에 붙은 상태에서 왼쪽 위로 가면 위로만 움직인다
    const p = moveWithCollision(map, 50.35, 48.5, -0.2, -0.2);
    expect(p.x).toBe(50.35);
    expect(p.z).toBeCloseTo(48.3);
  });

  it('너무 멀리 뛰면 서버가 거부한다', () => {
    const from = { x: 48.5, z: 54.5 };
    expect(isMoveAllowed(map, from, { x: 48.5, z: 54.1 }, 0.5)).toBe(true);
    expect(isMoveAllowed(map, from, { x: 48.5, z: 46.5 }, MOVE_BUDGET_MAX)).toBe(false);
    expect(isMoveAllowed(map, from, { x: 48.5, z: 48.5 }, 99)).toBe(false); // 분수 안
    expect(isMoveAllowed(map, from, { x: NaN, z: 54 }, 1)).toBe(false);
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
    expect(groundHeightAt(map, 48.5, 53.5)).toBe(0.05); // 돌바닥
    expect(groundHeightAt(map, 48.5, 58.5)).toBe(0); // 길
  });

  it('소품 방향을 읽는다', () => {
    const benches = map.props.filter((p) => p.key === 'prop.plaza.bench');
    expect(benches.map((b) => Math.round(Math.abs(b.yaw) * 100) / 100).sort()).toEqual([0, 0, 3.14, 3.14]);
  });
});
