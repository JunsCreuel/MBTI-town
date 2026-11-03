// 마을에 들어설 자리. 실시간 서버와 화면이 같은 규칙을 쓴다.
// 화면은 실시간 서버를 기다리지 않고 이 규칙으로 먼저 내 캐릭터를 세운 뒤, 서버에 그 자리(start)를 알려 준다.
import type { Hood, TownPlace } from './protocol';
import type { TownPass } from './townToken';
import { gateSpawnName, isBlockedAt, lotDoor, randomSpawnPoint, spawnName, type TownMap } from './townMap';

/**
 * 그곳에 들어설 자리.
 * - 내 집이 이 방(본섬 또는 그 동네)에 있으면 문 앞
 * - 본섬에서 내 집이 다른 동네에 있으면 내 지역 동네 길 아치 앞, 집이 없으면 내 지역 입구, 손님은 중앙광장
 * - 동네(2동·3동…)에서는 그 밖에는 모두 입구(아치 앞)
 */
export function placePoint(
  map: TownMap,
  pass: Pick<TownPass, 'district' | 'hood' | 'lot'>,
  place: TownPlace,
  here: Hood | null,
  rand = Math.random,
): { x: number; z: number } {
  if (place === 'home') {
    const home = pass.district && pass.hood === (here?.hood ?? 1) ? map.lots[pass.district].find((l) => l.index === pass.lot) : undefined;
    if (home) {
      const door = lotDoor(home);
      return { x: door.x + (rand() - 0.5) * 0.4, z: door.z + (rand() - 0.5) * 0.4 };
    }
    if (here || !pass.district) return randomSpawnPoint(map, rand, spawnName('plaza'));
    return randomSpawnPoint(map, rand, pass.lot >= 0 ? gateSpawnName(pass.district) : spawnName(pass.district));
  }
  if (here) return randomSpawnPoint(map, rand, spawnName('plaza'));
  return randomSpawnPoint(map, rand, place.startsWith('gate.') ? place : spawnName(place as Parameters<typeof spawnName>[0]));
}

/** 화면이 알려 준 시작 자리를 쓸 수 있는지: 맵 안의 걸을 수 있는 자리 */
export function isStartPoint(map: TownMap, p: unknown): p is { x: number; z: number } {
  const q = p as { x?: unknown; z?: unknown } | null;
  if (typeof q !== 'object' || q === null || typeof q.x !== 'number' || typeof q.z !== 'number') return false;
  if (!Number.isFinite(q.x) || !Number.isFinite(q.z)) return false;
  if (q.x <= 0 || q.z <= 0 || q.x >= map.width || q.z >= map.height) return false;
  return !isBlockedAt(map, q.x, q.z);
}
