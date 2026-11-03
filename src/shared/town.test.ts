import { describe, expect, it } from 'vitest';
import { townConfig } from '../config/game';
import { findPath, hasLineOfSight } from './pathfinding';
import { MOVE_BUDGET_MAX, isMoveAllowed, lerpAngle, moveWithCollision, refillMoveBudget, yawFromVector } from './movement';
import { DISTRICTS } from './districts';
import { FLORA } from './flora';
import {
  districtAt, gateSpawnName, groundHeightAt, isBlockedAt, isBlockedTile, lotDoor, randomSpawnPoint, spawnName, withDistrict,
  type TownMap,
} from './townMap';
import { loadHoodMapForTest, loadTownMapForTest } from './testMap';
import { parseRoomPlace } from './protocol';
import { guestPid, signTownPass, townPid, verifyTownPass, type TownPass } from './townToken';

const map = loadTownMapForTest();
const THREE_DEG = (d: number) => (d * Math.PI) / 180;
const C = map.width / 2;
const plaza = randomSpawnPoint(map, () => 0.5);

/** 경로의 모든 점이 걸을 수 있고 점 사이가 막히지 않았는지 */
function walkable(start: { x: number; z: number }, path: { x: number; z: number }[], m: TownMap = map) {
  let from = start;
  for (const p of path) {
    if (isBlockedAt(m, p.x, p.z) || !hasLineOfSight(m, from, p, 0)) return false;
    from = p;
  }
  return true;
}

describe('마을 맵', () => {
  it('레이어를 읽는다', () => {
    expect(map.width).toBe(88);
    expect(map.height).toBe(88);
    expect(map.tileset.key).toBe('tile.town');
    expect(map.props.some((p) => p.key === 'prop.plaza.fountain')).toBe(true);
    // 바다와 맵 바깥은 막혀 있다
    expect(isBlockedTile(map, 0, 5)).toBe(true);
    expect(isBlockedTile(map, -1, 5)).toBe(true);
    // 분수 자리는 막혀 있다
    expect(isBlockedTile(map, C, C)).toBe(true);
  });

  it('중앙광장을 다섯 지역이 둘러싸고, 지역마다 명소가 하나씩 있다', () => {
    expect(districtAt(map, C + 0.5, C + 0.5)).toBeNull();
    for (const d of DISTRICTS) {
      const own = map.props.filter((p) => p.district === d && p.key.startsWith('prop.district.'));
      expect(own).toHaveLength(1);
      expect(districtAt(map, own[0].x, own[0].z)).toBe(d);
      // 지역 나무는 그 지역 땅에, 그 지역 식물로 심겨 있다
      const trees = map.props.filter((p) => p.district === d && p.key.startsWith('prop.nature.tree'));
      expect(trees.length).toBeGreaterThan(30);
      const kinds = new Set(FLORA[d].trees.map(([k]) => k));
      for (const t of trees) {
        expect(districtAt(map, t.x, t.z)).toBe(d);
        expect(kinds.has(t.key)).toBe(true);
      }
    }
  });

  it('지역마다 집터가 정해진 수만큼 있고, 집 문 앞은 광장에서 걸어갈 수 있다', () => {
    for (const d of DISTRICTS) {
      const lots = map.lots[d];
      expect(lots.map((l) => l.index)).toEqual([...Array(townConfig.lotsPerDistrict).keys()]);
      for (const lot of lots) {
        expect(districtAt(map, lot.x, lot.z)).toBe(d);
        // 집터는 막혀 있고 문 앞은 비어 있다
        expect(isBlockedAt(map, lot.x, lot.z)).toBe(true);
        const door = lotDoor(lot);
        expect(isBlockedAt(map, door.x, door.z)).toBe(false);
      }
    }
    // 지역마다 가장 먼 집 하나는 실제 경로까지 확인한다
    for (const d of DISTRICTS) {
      const door = lotDoor(map.lots[d].at(-1)!);
      const path = findPath(map, plaza, door)!;
      expect(path).not.toBeNull();
      expect(walkable(plaza, path)).toBe(true);
    }
  });

  it('스폰 지점은 항상 걸을 수 있는 칸이다', () => {
    for (const name of [spawnName('plaza'), ...DISTRICTS.map((d) => spawnName(d))]) {
      expect(map.spawns[name]).toBeDefined();
      for (let i = 0; i < 40; i++) {
        const p = randomSpawnPoint(map, Math.random, name);
        expect(isBlockedAt(map, p.x, p.z)).toBe(false);
      }
    }
    for (const d of DISTRICTS) {
      const r = map.spawns[spawnName(d)];
      expect(districtAt(map, r.x + r.w / 2, r.z + r.h / 2)).toBe(d);
    }
  });
});

describe('새 동네 (2동·3동…)', () => {
  const template = loadHoodMapForTest();
  const GATE = 'prop.hood.gate';

  it('본섬 지역마다 큰길 끝에 동네 길 아치가 있고, 광장에서 걸어갈 수 있다', () => {
    for (const d of DISTRICTS) {
      const gates = map.props.filter((p) => p.key === GATE && p.district === d);
      expect(gates).toHaveLength(1);
      const r = map.spawns[gateSpawnName(d)];
      expect(r).toBeDefined();
      const p = randomSpawnPoint(map, () => 0.5, gateSpawnName(d));
      expect(walkable(plaza, findPath(map, plaza, p)!)).toBe(true);
      expect(Math.hypot(p.x - gates[0].x, p.z - gates[0].z)).toBeLessThan(4);
    }
  });

  it('동네 틀 맵에 지역을 입히면 땅·집터·지역 소품이 그 지역 것이 된다', () => {
    expect(template.hoodLots).toHaveLength(townConfig.hoodLots);
    expect(template.hoodLots.map((l) => l.index)).toEqual([...Array(townConfig.hoodLots).keys()]);
    const hood = withDistrict(template, 'fire');
    expect(hood.lots.fire).toHaveLength(townConfig.hoodLots);
    expect(hood.lots.wood).toEqual([]);
    expect(districtAt(hood, hood.width / 2 + 0.5, hood.height / 2 + 6.5)).toBe('fire');
    expect(hood.props.filter((p) => p.key === GATE).map((p) => p.district)).toEqual(['fire']);
    // 자리표시 나무·덤불이 그 지역 식물로 바뀐다
    const fireKinds = new Set([...FLORA.fire.trees, ...FLORA.fire.bushes, ...FLORA.fire.rocks].map(([k]) => k));
    const plants = hood.props.filter((p) => p.district && p.key.startsWith('prop.nature.'));
    expect(plants.length).toBeGreaterThan(20);
    for (const p of plants) expect(fireKinds.has(p.key)).toBe(true);
    // 틀 맵은 그대로다
    expect(template.lots.fire).toEqual([]);
  });

  it('동네 집 문 앞은 모두 입구에서 걸어갈 수 있다', () => {
    const hood = withDistrict(template, 'water');
    const start = randomSpawnPoint(hood, () => 0.5);
    for (const lot of hood.lots.water) {
      expect(isBlockedAt(hood, lot.x, lot.z)).toBe(true);
      const door = lotDoor(lot);
      expect(isBlockedAt(hood, door.x, door.z)).toBe(false);
      const path = findPath(hood, start, door);
      expect(path && walkable(start, path, hood)).toBe(true);
    }
  });

  it('방 이름: 본섬은 town, 동네는 "지역.번호"(2부터)', () => {
    expect(parseRoomPlace(undefined)).toBeNull();
    expect(parseRoomPlace('town')).toBeNull();
    expect(parseRoomPlace('water.2')).toEqual({ district: 'water', hood: 2 });
    for (const bad of ['water.1', 'moon.2', 'water.x', 'water.100', 'water', 3]) expect(parseRoomPlace(bad)).toBeUndefined();
  });
});

describe('길찾기', () => {
  it('분수를 돌아서 반대편까지 간다', () => {
    const start = { x: C + 0.5, z: C + 6.5 };
    const goal = { x: C + 0.5, z: C - 4.5 };
    const path = findPath(map, start, goal)!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(goal);
    expect(walkable(start, path)).toBe(true);
  });

  it('막힌 칸을 누르면 가장 가까운 빈 칸으로 간다', () => {
    const path = findPath(map, { x: C + 0.5, z: C + 6.5 }, { x: C + 0.5, z: C + 0.5 })!;
    const end = path.at(-1)!;
    expect(isBlockedAt(map, end.x, end.z)).toBe(false);
    expect(Math.hypot(end.x - (C + 0.5), end.z - (C + 0.5))).toBeLessThanOrEqual(2.6);
  });
});

describe('이동', () => {
  it('벽을 따라 미끄러진다', () => {
    // 분수(C-1~C+1칸) 동쪽에 붙은 상태에서 왼쪽 위로 가면 위로만 움직인다
    const p = moveWithCollision(map, C + 2.35, C + 0.5, -0.2, -0.2);
    expect(p.x).toBe(C + 2.35);
    expect(p.z).toBeCloseTo(C + 0.3);
  });

  it('너무 멀리 뛰면 서버가 거부한다', () => {
    const from = { x: C + 0.5, z: C + 6.5 };
    expect(isMoveAllowed(map, from, { x: C + 0.5, z: C + 6.1 }, 0.5)).toBe(true);
    expect(isMoveAllowed(map, from, { x: C + 0.5, z: C - 1.5 }, MOVE_BUDGET_MAX)).toBe(false);
    expect(isMoveAllowed(map, from, { x: C + 0.5, z: C + 0.5 }, 99)).toBe(false); // 분수 안
    expect(isMoveAllowed(map, from, { x: NaN, z: C }, 1)).toBe(false);
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
    expect(groundHeightAt(map, C + 0.5, C + 3.5)).toBeCloseTo(0.05, 3); // 돌바닥
    // 광장 둘레 순환로는 땅보다 살짝 낮다 (주변 칸과 섞여 매끈하게 이어진다)
    const ring = { x: C + 0.5, z: C - 12.5 };
    expect(map.terrain[map.ground[Math.floor(ring.z) * map.width + Math.floor(ring.x)]]).toBe('path');
    const h = groundHeightAt(map, ring.x, ring.z);
    expect(h).toBeLessThan(0.001);
    expect(h).toBeGreaterThan(-0.03);
    // 바다 밑은 수면보다 낮고, 모래사장에서 바다로 갈수록 땅이 내려간다 (이어진 높이)
    expect(map.terrain[map.ground[1 * map.width + 1]]).toBe('water');
    expect(groundHeightAt(map, 1.5, 1.5)).toBeLessThan(-0.3);
    expect(groundHeightAt(map, C + 0.5, 1.5)).toBeLessThan(groundHeightAt(map, C + 0.5, 6.5));
    expect(Math.abs(groundHeightAt(map, 10.2, 40.5) - groundHeightAt(map, 10.3, 40.5))).toBeLessThan(0.05);
  });

  it('소품 방향을 읽는다: 광장 벤치는 모두 분수를 본다', () => {
    const benches = map.props.filter((p) => p.key === 'prop.plaza.bench');
    expect(benches.length).toBeGreaterThanOrEqual(4);
    for (const b of benches) {
      const to = { x: C - b.x, z: C - b.z };
      const len = Math.hypot(to.x, to.z);
      expect((Math.sin(b.yaw) * to.x + Math.cos(b.yaw) * to.z) / len).toBeGreaterThan(0.9);
    }
  });
});

describe('입장 토큰', () => {
  const pass: TownPass = { pid: townPid('user-1'), name: '하루', handle: 'haru', district: 'water', hood: 2, lot: 3, color: 'sky', acc: 'cap', exp: 2_000_000_000 };

  it('서명한 토큰을 그대로 읽는다', () => {
    expect(verifyTownPass(signTownPass(pass), 1_000)).toEqual(pass);
  });

  it('내용을 바꾸거나 만료된 토큰은 받지 않는다', () => {
    const token = signTownPass(pass);
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...pass, name: '운영자' })).toString('base64url');
    expect(verifyTownPass(`${forged}.${mac}`, 1_000)).toBeNull();
    expect(verifyTownPass(`${body}.${mac}x`, 1_000)).toBeNull();
    expect(verifyTownPass(token, pass.exp + 1)).toBeNull();
    expect(verifyTownPass(undefined)).toBeNull();
    expect(verifyTownPass('a.b.c')).toBeNull();
  });

  it('이상한 값은 안전한 기본값으로 바꾼다', () => {
    const odd = signTownPass({ ...pass, district: 'moon' as never, hood: 0, lot: -5, color: 'gold' as never, acc: 'crown' as never });
    expect(verifyTownPass(odd, 1_000)).toMatchObject({ district: '', hood: 1, lot: -1, color: 'mint', acc: 'none' });
  });

  it('사람 번호는 계정마다 같고, 계정 id를 드러내지 않는다', () => {
    expect(townPid('user-1')).toBe(pass.pid);
    expect(townPid('user-2')).not.toBe(pass.pid);
    expect(pass.pid).not.toContain('user');
    expect(guestPid()).not.toBe(guestPid());
  });
});
