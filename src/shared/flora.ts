// 지역마다 자라는 식물과 돌 (마을 맵 생성기, 동네 틀 맵에 지역 입히기, 화면 장식이 함께 쓴다).
// 키는 manifest의 prop.nature.* (Kenney Nature Kit, CC0, 우리 색으로 다시 칠함).
import type { District } from './districts';

type Weighted = readonly (readonly [string, number])[];

export interface Flora {
  /** 길을 막는 나무 (맵에 들어간다) */
  trees: Weighted;
  /** 길을 막는 덤불 */
  bushes: Weighted;
  /** 길을 막는 큰 돌·그루터기 */
  rocks: Weighted;
  /** 화면이 흩뿌리는 꽃 (지나갈 수 있다) */
  flowers: Weighted;
  /** 화면이 흩뿌리는 풀·버섯·작은 돌 */
  ground: Weighted;
}

const n = (key: string) => `prop.nature.${key}`;
const w = (...items: [string, number][]): Weighted => items.map(([k, v]) => [n(k), v] as const);

export const FLORA: Record<District, Flora> = {
  // 숲: 넓은 잎 나무가 빽빽하고 버섯·고사리
  wood: {
    trees: w(['tree_round', 3], ['tree_oak', 3], ['tree_fat', 2], ['tree_detailed', 2], ['tree_tall', 2], ['tree_small', 1], ['tree_pine_round', 1]),
    bushes: w(['bush', 2], ['bush_large', 2], ['bush_detailed', 2], ['fern', 2]),
    rocks: w(['stump', 2], ['stump_old', 2], ['log', 2], ['rock_large', 1]),
    flowers: w(['flower_yellow', 2], ['flower_purple', 1], ['flower_red', 1]),
    ground: w(['grass', 3], ['grass_large', 2], ['grass_leafs', 2], ['mushroom_red', 1], ['mushroom_tan', 1]),
  },
  // 노을: 단풍과 벚꽃, 붉은·분홍 꽃
  fire: {
    trees: w(['tree_fall', 3], ['tree_fall_oak', 3], ['tree_blossom', 2], ['tree_blossom_oak', 2], ['tree_small', 1]),
    bushes: w(['bush', 2], ['bush_small', 2], ['bush_detailed', 1]),
    rocks: w(['rock_large_b', 1], ['stump', 1], ['log_stack', 1]),
    flowers: w(['flower_red', 2], ['flower_red_b', 2], ['flower_pink', 3], ['flower_yellow_b', 1]),
    ground: w(['grass', 3], ['grass_large', 2], ['rock_small', 1]),
  },
  // 언덕: 올리브 나무, 돌, 밭
  earth: {
    trees: w(['tree_olive', 3], ['tree_olive_fat', 2], ['tree_small', 2], ['tree_round', 1]),
    bushes: w(['bush_small', 2], ['bush', 1], ['bush_detailed', 1]),
    rocks: w(['rock_large', 2], ['rock_large_b', 2], ['log_stack', 1]),
    flowers: w(['flower_yellow', 3], ['flower_yellow_b', 2], ['flower_red', 1]),
    ground: w(['grass', 3], ['rock_small', 2], ['rock_flat', 1], ['pumpkin', 1], ['wheat', 1]),
  },
  // 은빛: 소나무와 은빛 자작, 큰 흰 돌
  metal: {
    trees: w(['tree_pine_round', 2], ['tree_pine_round_b', 2], ['tree_pine_tall', 2], ['tree_pine_tall_b', 2], ['tree_silver', 3], ['tree_silver_tall', 2]),
    bushes: w(['bush_small', 2], ['bush', 1]),
    rocks: w(['stone_tall', 2], ['stone_tall_b', 2], ['rock_large', 1]),
    flowers: w(['flower_purple', 3], ['flower_purple_b', 2], ['flower_yellow_b', 1]),
    ground: w(['grass', 2], ['rock_small_b', 2], ['rock_flat', 1]),
  },
  // 호수: 짙은 잎 나무, 갈대, 연잎
  water: {
    trees: w(['tree_dark', 3], ['tree_dark_tall', 3], ['tree_round', 1], ['tree_tall', 1]),
    bushes: w(['bush_large', 2], ['bush', 1], ['fern', 1]),
    rocks: w(['rock_large', 1], ['stump_old', 1]),
    flowers: w(['flower_purple', 2], ['flower_pink', 1], ['flower_yellow', 1]),
    ground: w(['grass', 2], ['grass_reed', 3], ['grass_large', 1]),
  },
};

/** 중앙광장과 바닷가 */
export const PLAZA_TREES: Weighted = w(['tree_blossom', 2], ['tree_round', 2], ['tree_oak', 1]);
export const BEACH_TREES: Weighted = w(['tree_palm', 2], ['tree_palm_bend', 1]);
export const PLAZA_FLOWERS: Weighted = w(['flower_pink', 2], ['flower_yellow', 2], ['flower_purple', 1], ['flower_red', 1]);
export const LILIES: Weighted = w(['lily', 2], ['lily_small', 2]);

/** 0~1 값으로 무게를 따라 하나 고른다 */
export function pickWeighted(list: Weighted, r: number): string {
  const total = list.reduce((a, [, v]) => a + v, 0);
  let t = r * total;
  for (const [k, v] of list) {
    if ((t -= v) < 0) return k;
  }
  return list[list.length - 1][0];
}

/** 위치로 정해지는 0~1 난수 (같은 자리는 늘 같은 값) */
export function hash01(x: number, z: number, seed = 0): number {
  const h = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** 모든 지역 식물 키 (화면이 미리 불러온다) */
export function allFloraKeys(): string[] {
  const keys = new Set<string>();
  for (const f of Object.values(FLORA)) for (const list of [f.trees, f.bushes, f.rocks, f.flowers, f.ground]) for (const [k] of list) keys.add(k);
  for (const list of [PLAZA_TREES, BEACH_TREES, PLAZA_FLOWERS, LILIES]) for (const [k] of list) keys.add(k);
  return [...keys];
}

/** 동네 틀 맵의 식물을 그 지역 식물로 바꾼다 (같은 자리는 늘 같은 종류) */
export function themedKey(d: District, key: string, x: number, z: number): string {
  const f = FLORA[d];
  const r = hash01(x, z, 7);
  if (key === TEMPLATE_TREE) return pickWeighted(f.trees, r);
  if (key === TEMPLATE_BUSH) return pickWeighted(f.bushes, r);
  if (key === TEMPLATE_ROCK) return pickWeighted(f.rocks, r);
  return key;
}

/** 동네 틀 맵에 심어 두는 자리표시 키 (지역을 입힐 때 바뀐다) */
export const TEMPLATE_TREE = n('tree_round');
export const TEMPLATE_BUSH = n('bush');
export const TEMPLATE_ROCK = n('rock_large');
