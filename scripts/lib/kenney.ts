// Kenney Nature Kit 2.1 (CC0, https://opengameart.org/content/nature-kit) 에서 마을에 쓰는 모델 목록.
// 원본은 청록 잎·주황 흙 색이라, 재질 이름별로 우리 파스텔 색으로 다시 칠하고 우리 세계 크기(1 = 한 칸 = 1m)로 키운다.
// 잎 재질은 이름을 'foliage'로 바꾼다 (화면이 바람에 흔들리게 한다).

/** 재질 이름 → 색 (sRGB). 없는 이름은 원래 색을 쓴다. */
export const KENNEY_PALETTE: Record<string, string> = {
  leafsGreen: '#7CC36E',
  leafsDark: '#5E9F67',
  leafsFall: '#F2A35E',
  grass: '#86C57A',
  dirt: '#BC9670',
  woodBark: '#9B6B45',
  woodBarkDark: '#7D573C',
  woodBirch: '#EFE7DA',
  woodInner: '#E8CFA6',
  wood: '#C99A6B',
  woodDark: '#9A7350',
  stone: '#D9DDE2',
  colorRed: '#EE8B8B',
  colorYellow: '#F7D372',
  colorPurple: '#C7B3F2',
  colorWhite: '#FFFFFF',
  _defaultMat: '#F4F1EA',
};

/** 잎으로 보고 바람에 흔들리게 할 재질 */
export const FOLIAGE_MATERIALS = new Set(['leafsGreen', 'leafsDark', 'leafsFall', 'grass']);

export interface KenneyModel {
  /** manifest 키 끝 (prop.nature.<key>) */
  key: string;
  /** 원본 파일 이름 (.glb 없이) */
  src: string;
  scale: number;
  /** 이 모델만 다르게 칠할 재질 색 */
  colors?: Record<string, string>;
}

const tree = (key: string, src: string, scale = 2, colors?: Record<string, string>): KenneyModel => ({ key, src, scale, colors });

export const KENNEY_MODELS: KenneyModel[] = [
  // 나무: 숲(넓은 잎), 노을(단풍·벚꽃), 언덕(올리브), 은빛(소나무·은빛 자작), 호수(짙은 잎), 바닷가(야자)
  tree('tree_round', 'tree_default'),
  tree('tree_oak', 'tree_oak', 2.2),
  tree('tree_fat', 'tree_fat', 2.2),
  tree('tree_detailed', 'tree_detailed', 2.1),
  tree('tree_tall', 'tree_tall', 2),
  tree('tree_small', 'tree_small', 1.9),
  tree('tree_fall', 'tree_default_fall'),
  tree('tree_fall_oak', 'tree_oak_fall', 2.2),
  tree('tree_blossom', 'tree_default', 2, { leafsGreen: '#F6B8C8' }),
  tree('tree_blossom_oak', 'tree_oak', 2.2, { leafsGreen: '#F8C6D3' }),
  tree('tree_olive', 'tree_plateau', 2.2, { leafsGreen: '#A9C46A' }),
  tree('tree_olive_fat', 'tree_fat', 2.1, { leafsGreen: '#B5C86F' }),
  tree('tree_pine_round', 'tree_pineRoundA', 2.1),
  tree('tree_pine_round_b', 'tree_pineRoundC', 2.1),
  tree('tree_pine_tall', 'tree_pineTallA', 2.2),
  tree('tree_pine_tall_b', 'tree_pineTallB', 2.2),
  tree('tree_silver', 'tree_thin_fall', 2, { leafsFall: '#B9D6C4' }),
  tree('tree_silver_tall', 'tree_tall_fall', 2, { leafsFall: '#C4DCCB' }),
  tree('tree_dark', 'tree_default_dark', 2.1),
  tree('tree_dark_tall', 'tree_tall_dark', 2.1),
  tree('tree_palm', 'tree_palm', 2.1),
  tree('tree_palm_bend', 'tree_palmBend', 2.1),
  // 덤불·풀·꽃·버섯 (작은 것은 화면이 흩뿌린다)
  tree('bush', 'plant_bush', 2.4),
  tree('bush_large', 'plant_bushLarge', 2.6),
  tree('bush_detailed', 'plant_bushDetailed', 2.4),
  tree('bush_small', 'plant_bushSmall', 2.2),
  tree('fern', 'plant_flatTall', 2.2),
  tree('grass', 'grass', 1.7),
  tree('grass_large', 'grass_large', 1.7),
  tree('grass_leafs', 'grass_leafs', 1.8),
  tree('grass_reed', 'grass_leafsLarge', 2.2),
  tree('flower_red', 'flower_redA', 1.8),
  tree('flower_red_b', 'flower_redB', 1.8),
  tree('flower_pink', 'flower_redC', 1.8, { colorRed: '#F7A9C4' }),
  tree('flower_yellow', 'flower_yellowA', 1.8),
  tree('flower_yellow_b', 'flower_yellowB', 1.8),
  tree('flower_purple', 'flower_purpleA', 1.8),
  tree('flower_purple_b', 'flower_purpleC', 1.8),
  tree('mushroom_red', 'mushroom_redGroup', 1.8),
  tree('mushroom_tan', 'mushroom_tanGroup', 1.8),
  // 돌·그루터기·통나무
  tree('rock_small', 'rock_smallA', 2),
  tree('rock_small_b', 'rock_smallC', 2),
  tree('rock_flat', 'rock_smallFlatA', 2.2),
  tree('rock_large', 'rock_largeA', 1.8),
  tree('rock_large_b', 'rock_largeC', 1.8),
  tree('stone_tall', 'stone_tallA', 1.5),
  tree('stone_tall_b', 'stone_tallB', 1.4),
  tree('stump', 'stump_round', 2.2),
  tree('stump_old', 'stump_old', 2.2),
  tree('log', 'log', 2.2),
  tree('log_stack', 'log_stack', 2),
  // 물가·밭·마당
  tree('lily', 'lily_large', 2.6),
  tree('lily_small', 'lily_small', 2.6),
  tree('pumpkin', 'crop_pumpkin', 1.7),
  tree('wheat', 'crops_wheatStageB', 1.7),
  tree('corn', 'crops_cornStageC', 1.7),
  tree('pot', 'pot_large', 1.6),
  tree('sign', 'sign', 2.2),
];

/** camelCase → snake_case 파일 이름 */
export const fileFor = (m: KenneyModel) => `props/nature/nature_${m.key}.glb`;
export const keyFor = (m: KenneyModel) => `prop.nature.${m.key}`;
