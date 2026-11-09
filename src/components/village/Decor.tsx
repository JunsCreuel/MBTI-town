'use client';

// 땅에 흩뿌리는 작은 장식: 풀·꽃·버섯·작은 돌(지나갈 수 있다), 호수의 연잎.
// 맵에는 넣지 않고 칸 위치로 정해지는 난수로 늘 같은 자리에 놓는다. 지역마다 그 지역 식물을 쓴다.
import { quality } from '@/lib/quality';
import { useMemo } from 'react';
import { DISTRICTS } from '@/shared/districts';
import { FLORA, floraOf, hash01, LILIES, pickWeighted, PLAZA_FLOWERS } from '@/shared/flora';
import { WATER_LEVEL, type PropPlacement, type TownMap } from '@/shared/townMap';
import { useTown } from './context';
import { InstancedProps, buildGroup } from './Props';

/** 풀·작은 장식을 놓을 칸 비율, 꽃 비율, 연잎 비율 */
const GROUND_RATE = 0.34;
const FLOWER_RATE = 0.1;
const LILY_RATE = 0.28;
/**
 * 풀밭 칸이 이보다 많으면(넓은 본섬) 풀·꽃 비율을 그만큼 줄여 전체 개수를 묶어 둔다.
 * 장식은 화면 밖에서도 그려지므로 섬이 넓어진 만큼 늘리면 휴대폰이 느려진다.
 */
const DECOR_TILE_BUDGET = 5000;

const isOpenGrass = (map: TownMap, i: number) => (map.terrain[map.ground[i]] ?? 'grass').startsWith('grass') && !map.blocked[i];

function scatter(map: TownMap): PropPlacement[] {
  const out: PropPlacement[] = [];
  let grassTiles = 0;
  for (let i = 0; i < map.width * map.height; i++) if (isOpenGrass(map, i)) grassTiles++;
  const thin = Math.min(1, DECOR_TILE_BUDGET / Math.max(1, grassTiles));
  const at = (key: string, x: number, z: number, r: number): PropPlacement => ({ key, x, z, yaw: r * Math.PI * 2 });
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const i = z * map.width + x;
      const terrain = map.terrain[map.ground[i]] ?? 'grass';
      const r = (k: number) => hash01(x, z, k);
      // 섬 안의 물(호수 못)에는 연잎
      if (terrain === 'water') {
        if (map.districtGrid[i] >= 0 && r(1) < LILY_RATE) {
          // 연잎은 수면에 띄운다
          out.push({ ...at(pickWeighted(LILIES, r(2)), x + 0.2 + r(3) * 0.6, z + 0.2 + r(4) * 0.6, r(5)), y: WATER_LEVEL + 0.1 });
        }
        continue;
      }
      if (!isOpenGrass(map, i)) continue;
      const d = map.districtGrid[i] >= 0 ? DISTRICTS[map.districtGrid[i]] : null;
      const flora = d ? floraOf(d) : null;
      if (r(6) < GROUND_RATE * thin) {
        const key = pickWeighted(flora ? flora.ground : FLORA.NF.ground.slice(0, 3), r(7));
        out.push(at(key, x + 0.15 + r(8) * 0.7, z + 0.15 + r(9) * 0.7, r(10)));
      }
      if (r(11) < FLOWER_RATE * thin) {
        // 꽃은 두세 송이씩 모여 핀다
        const key = pickWeighted(flora ? flora.flowers : PLAZA_FLOWERS, r(12));
        const count = 2 + Math.floor(r(13) * 2);
        for (let k = 0; k < count; k++) out.push(at(key, x + 0.15 + r(14 + k) * 0.7, z + 0.15 + r(18 + k) * 0.7, r(22 + k)));
      }
    }
  }
  return out;
}

export function Decor() {
  const { map, assets } = useTown();
  // 가벼운 모드: 풀·꽃·작은 덤불은 그림자를 드리우지 않는다 (수천 개라 그림자 그리기가 무겁다)
  const decorShadows = quality().decorShadows;
  const groups = useMemo(() => {
    const byKey = new Map<string, PropPlacement[]>();
    for (const p of scatter(map)) {
      if (!assets.props[p.key]) continue;
      const list = byKey.get(p.key);
      if (list) list.push(p);
      else byKey.set(p.key, [p]);
    }
    return [...byKey].map(([key, placements]) => buildGroup(key, placements, assets));
  }, [map, assets]);
  return (
    <>
      {groups.map((g) => (
        <InstancedProps key={g.key} group={g} castShadow={decorShadows} />
      ))}
    </>
  );
}
