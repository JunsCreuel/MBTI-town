// 마을 놀거리: 열매 따기·운세 열매·낚시 (PROJECT_GUIDE.md 3장).
// 하루 횟수와 결과는 서버가 정한다 (화면은 보여 주기만 한다). 재미로 보는 운세다.
import { playConfig } from '../config/game';
import { THEMES, isDistrict, themeOf, type District, type Theme } from './districts';

// ───────────────────────── 열매 ─────────────────────────

/** 지역마다 나무에 열리는 열매 (manifest 아이콘 없이 색으로 그린다) */
export interface FruitDef {
  id: string;
  name: string;
  color: string;
  /** 가방에서 보여 주는 한 줄 */
  desc: string;
}

/** 기질 그룹(풍경)마다 마을 나무에 열리는 열매 */
export const FRUITS: Record<Theme, FruitDef> = {
  NT: { id: 'pear', name: '배', color: '#E9D98A', desc: '은빛 언덕(분석가) 마을 나무에 열려요. 시원하고 물이 많아요.' },
  NF: { id: 'apple', name: '사과', color: '#7CC36A', desc: '초록 숲(외교관) 마을 나무에 열려요. 아삭하고 새콤해요.' },
  SJ: { id: 'grape', name: '포도', color: '#7C6BC4', desc: '푸른 호숫가(관리자) 마을 나무에 열려요. 송이송이 알이 꽉 찼어요.' },
  SP: { id: 'peach', name: '복숭아', color: '#F4A08C', desc: '노을 거리(탐험가) 마을 나무에 열려요. 말랑하고 달콤해요.' },
};
/** 이 마을 나무의 열매 */
export const fruitOf = (d: District): FruitDef => FRUITS[themeOf(d)];
/** 열매 나무 모델 (manifest 키) */
export const fruitTreeKey = (t: Theme) => `prop.fruit.${t.toLowerCase()}`;
/** 예전에 열리던 열매 (가방에 남아 있으면 이름만 보여 준다) */
const OLD_FRUIT_NAMES: Record<string, string> = { persimmon: '감' };
export const FORTUNE_FRUIT: FruitDef = { id: 'fortune', name: '운세 열매', color: '#F2C14E', desc: '광장 운세 나무에 하루 한 번 열려요. 그날의 운세가 적혀 있어요.' };

/** 열매 이름 (도감) */
export function fruitName(id: string): string {
  if (id === FORTUNE_FRUIT.id) return FORTUNE_FRUIT.name;
  return Object.values(FRUITS).find((f) => f.id === id)?.name ?? OLD_FRUIT_NAMES[id] ?? id;
}

/**
 * 나무 자리 이름: 열매 나무 "fruit.ENFP.0", 운세 나무 "fortune".
 * 맵의 열매 나무(prop.fruit.<기질>, district 속성 = 마을)는 마을마다 놓인 순서대로 번호를 붙인다.
 */
export type TreeSpot = { kind: 'fruit'; district: District; index: number } | { kind: 'fortune' };

export function parseTreeSpot(v: unknown): TreeSpot | null {
  if (v === 'fortune') return { kind: 'fortune' };
  if (typeof v !== 'string') return null;
  const m = /^fruit\.([A-Z]{4})\.(\d{1,2})$/.exec(v);
  if (!m || !isDistrict(m[1])) return null;
  const index = Number(m[2]);
  return index < playConfig.fruitTreesPerDistrict ? { kind: 'fruit', district: m[1], index } : null;
}

export const treeSpotId = (s: TreeSpot) => (s.kind === 'fortune' ? 'fortune' : `fruit.${s.district}.${s.index}`);

// ───────────────────────── 운세 열매 ─────────────────────────

export interface FortuneFruit {
  grade: '대길' | '길' | '소길' | '반짝' | '쉼표';
  line: string;
}

/** 운세 열매에 적힌 말. 무섭거나 단정하는 말은 쓰지 않는다 */
export const FORTUNE_LINES: readonly FortuneFruit[] = [
  { grade: '대길', line: '오늘 하는 말마다 술술 풀려요. 미뤄 둔 연락을 해 봐요.' },
  { grade: '대길', line: '뜻밖의 선물 같은 하루! 작은 행운이 두 번 찾아와요.' },
  { grade: '대길', line: '웃음이 많은 날. 오늘 만난 사람과 사진 한 장 남겨요.' },
  { grade: '길', line: '맛있는 걸 먹으면 기운이 두 배가 되는 날이에요.' },
  { grade: '길', line: '산책길에서 좋은 생각이 떠올라요. 마을 한 바퀴 어때요?' },
  { grade: '길', line: '친구에게 먼저 인사하면 반가운 소식이 돌아와요.' },
  { grade: '길', line: '정리하면 찾던 게 나오는 날. 방을 한 번 둘러봐요.' },
  { grade: '길', line: '좋아하는 노래가 우연히 들려오는 날이에요.' },
  { grade: '소길', line: '천천히 가도 괜찮은 날. 쉬엄쉬엄 해도 다 돼요.' },
  { grade: '소길', line: '오늘의 작은 친절이 내일 크게 돌아와요.' },
  { grade: '소길', line: '모르는 걸 물어보면 좋은 답을 얻는 날이에요.' },
  { grade: '소길', line: '평소에 안 가던 길로 가 보면 재미있는 걸 발견해요.' },
  { grade: '반짝', line: '갑자기 떠오른 아이디어를 놓치지 말고 적어 두세요!' },
  { grade: '반짝', line: '오늘은 새로 시작하기 좋은 날. 작은 것 하나만 해 봐요.' },
  { grade: '반짝', line: '눈에 띄는 색 옷을 입으면 기분이 좋아지는 날이에요.' },
  { grade: '쉼표', line: '오늘은 쉬어 가는 날. 따뜻한 차 한 잔이면 충분해요.' },
  { grade: '쉼표', line: '서두르지 않아도 돼요. 일찍 자면 내일이 반짝여요.' },
  { grade: '쉼표', line: '혼자만의 시간이 보약인 날. 좋아하는 음악을 틀어요.' },
];

/** 하루에 한 번: 같은 사람·같은 날이면 같은 운세 (다시 따도 바뀌지 않는다) */
export function fortuneFor(seed: string): FortuneFruit {
  return FORTUNE_LINES[hash(seed) % FORTUNE_LINES.length];
}

// ───────────────────────── 낚시 ─────────────────────────

export interface FishDef {
  id: string;
  name: string;
  /** 뽑힐 비율 (클수록 흔하다) */
  weight: number;
  /** 크기 범위 (cm). 0이면 크기가 없는 것 (장화 등) */
  size: [number, number];
  /** 몸 색 (낚은 장면에 그린다) */
  color: string;
  /** mythic = 황금 고래 하나뿐 (무게로 뽑지 않고 따로 아주 낮은 확률로 걸린다) */
  rarity: 'common' | 'rare' | 'legend' | 'mythic' | 'junk';
  /** 도감에 보여 주는 한 줄 */
  desc: string;
}

export const FISH: readonly FishDef[] = [
  { id: 'crucian', name: '붕어', weight: 22, size: [12, 30], color: '#9FA77A', rarity: 'common', desc: '연못 어디서나 만나는 친구. 낚시의 시작이에요.' },
  { id: 'minnow', name: '피라미', weight: 20, size: [6, 14], color: '#BFD3DA', rarity: 'common', desc: '반짝이며 떼 지어 다녀요. 몸에 줄무늬가 있어요.' },
  { id: 'killifish', name: '송사리', weight: 18, size: [2, 5], color: '#D7E3E8', rarity: 'common', desc: '아주 작은 물고기. 손가락만 해요.' },
  { id: 'carp', name: '잉어', weight: 12, size: [30, 80], color: '#C9965B', rarity: 'common', desc: '수염이 멋진 연못의 터줏대감이에요.' },
  { id: 'catfish', name: '메기', weight: 8, size: [30, 90], color: '#6D6A5E', rarity: 'common', desc: '긴 수염으로 바닥을 더듬어요. 밤을 좋아해요.' },
  { id: 'sweetfish', name: '은어', weight: 6, size: [12, 25], color: '#C7D2D9', rarity: 'rare', desc: '맑은 물에만 살아요. 은은한 향이 나요.' },
  { id: 'mandarinfish', name: '쏘가리', weight: 4, size: [20, 50], color: '#C9A35C', rarity: 'rare', desc: '점박이 무늬가 멋진 물고기예요.' },
  { id: 'trout', name: '무지개송어', weight: 4, size: [25, 60], color: '#E89A9A', rarity: 'rare', desc: '몸에 분홍빛 무지개 띠가 있어요.' },
  { id: 'eel', name: '뱀장어', weight: 3, size: [40, 100], color: '#5E6B52', rarity: 'rare', desc: '구불구불 길쭉해요. 미끄러워서 잡기 어려워요.' },
  { id: 'goldfish', name: '금붕어', weight: 2, size: [5, 15], color: '#F2A23A', rarity: 'rare', desc: '누가 연못에 놓아준 걸까요? 꼬리가 하늘하늘해요.' },
  { id: 'golden_carp', name: '황금 잉어', weight: 0.6, size: [60, 120], color: '#F2C14E', rarity: 'legend', desc: '전설의 황금 잉어! 잡으면 좋은 일이 생긴대요.' },
  { id: 'dragon_fish', name: '용궁 물고기', weight: 0.3, size: [80, 150], color: '#5BC0C8', rarity: 'legend', desc: '용궁에서 왔다는 전설의 물고기예요.' },
  { id: 'boot', name: '낡은 장화', weight: 5, size: [0, 0], color: '#6B5A4A', rarity: 'junk', desc: '누가 연못에 장화를 버렸을까요…' },
  { id: 'bottle', name: '편지 든 병', weight: 2, size: [0, 0], color: '#9ED6C9', rarity: 'junk', desc: '병 안에 누군가의 편지가 들어 있어요.' },
  // ── 더 늘어난 물고기 30종 (흔해요 12 · 드물어요 12 · 전설 6) ──
  { id: 'loach', name: '미꾸라지', weight: 7, size: [8, 20], color: '#8A7A5A', rarity: 'common', desc: '진흙 속을 꼬물꼬물. 비 오는 날이면 신이 나요.' },
  { id: 'smelt', name: '빙어', weight: 7, size: [6, 15], color: '#CFE0E6', rarity: 'common', desc: '몸이 투명해서 속이 살짝 비쳐요. 추운 날 많이 나와요.' },
  { id: 'bitterling', name: '납자루', weight: 6, size: [4, 10], color: '#B8A9C9', rarity: 'common', desc: '조개 속에 알을 낳는 신기한 물고기예요.' },
  { id: 'gudgeon', name: '모래무지', weight: 6, size: [10, 25], color: '#CDB88F', rarity: 'common', desc: '모래 속에 쏙 숨는 걸 좋아해요.' },
  { id: 'dark_chub', name: '갈겨니', weight: 6, size: [10, 20], color: '#9DB0A0', rarity: 'common', desc: '눈이 크고 옆구리에 진한 줄이 있어요.' },
  { id: 'chinese_minnow', name: '버들치', weight: 7, size: [6, 15], color: '#A8A07A', rarity: 'common', desc: '맑은 개울의 단골손님. 버들잎처럼 생겼어요.' },
  { id: 'aucha_perch', name: '꺽지', weight: 4, size: [10, 30], color: '#7A8566', rarity: 'common', desc: '바위 틈에 숨어 사는 우리나라 토박이 물고기예요.' },
  { id: 'bluegill', name: '블루길', weight: 6, size: [8, 25], color: '#7E9CBA', rarity: 'common', desc: '동글납작한 몸에 파란 귀 무늬가 있어요.' },
  { id: 'bass', name: '배스', weight: 5, size: [25, 60], color: '#8AA466', rarity: 'common', desc: '입이 아주 커요. 힘이 세서 손맛이 좋아요.' },
  { id: 'bagrid', name: '동자개', weight: 5, size: [12, 30], color: '#D2B04C', rarity: 'common', desc: '잡으면 빠각빠각 소리를 내요. 수염이 귀여워요.' },
  { id: 'snakehead', name: '가물치', weight: 3, size: [40, 90], color: '#6B6852', rarity: 'common', desc: '길쭉하고 힘이 센 연못의 골목대장이에요.' },
  { id: 'guppy', name: '구피', weight: 5, size: [2, 5], color: '#7FC8D9', rarity: 'common', desc: '누가 놓아준 걸까요? 꼬리가 알록달록해요.' },
  { id: 'splendid_dace', name: '쉬리', weight: 2, size: [8, 15], color: '#D9C27A', rarity: 'rare', desc: '우리나라에만 사는 물고기. 몸에 고운 줄무늬가 있어요.' },
  { id: 'redfin_culter', name: '강준치', weight: 2, size: [30, 70], color: '#C9CFD4', rarity: 'rare', desc: '은빛으로 길쭉해요. 입이 하늘을 보고 있어요.' },
  { id: 'lenok', name: '열목어', weight: 1.5, size: [30, 70], color: '#B98A6A', rarity: 'rare', desc: '차가운 물에만 사는 귀한 물고기예요.' },
  { id: 'masu', name: '산천어', weight: 2, size: [20, 40], color: '#A6B4B8', rarity: 'rare', desc: '깊은 산 맑은 계곡에서 왔어요. 몸에 둥근 무늬가 있어요.' },
  { id: 'salmon', name: '연어', weight: 1.5, size: [50, 90], color: '#E58F72', rarity: 'rare', desc: '먼 바다를 돌아 고향 연못으로 돌아왔어요.' },
  { id: 'golden_mandarin', name: '황쏘가리', weight: 1, size: [20, 50], color: '#E8B940', rarity: 'rare', desc: '온몸이 노란 아주 귀한 쏘가리예요.' },
  { id: 'paradise_fish', name: '버들붕어', weight: 1.5, size: [4, 8], color: '#C96A5A', rarity: 'rare', desc: '지느러미가 하늘하늘. 거품으로 집을 지어요.' },
  { id: 'rose_bitterling', name: '각시붕어', weight: 2, size: [3, 6], color: '#E3A0B5', rarity: 'rare', desc: '봄이 되면 몸이 분홍빛으로 물들어요.' },
  { id: 'koi', name: '비단잉어', weight: 1.5, size: [30, 80], color: '#F6F1E8', rarity: 'rare', desc: '빨강·하양 무늬가 비단처럼 고와요.' },
  { id: 'betta', name: '베타', weight: 1, size: [5, 7], color: '#4A63C9', rarity: 'rare', desc: '부채 같은 지느러미를 활짝 펴고 뽐내요.' },
  { id: 'piranha', name: '피라냐', weight: 0.8, size: [15, 35], color: '#8E9AA6', rarity: 'rare', desc: '이빨이 뾰족하고 배가 빨개요. 손가락 조심!' },
  { id: 'arowana', name: '아로와나', weight: 0.6, size: [50, 100], color: '#D9C08A', rarity: 'rare', desc: '용을 닮은 물고기. 턱에 수염이 두 가닥 있어요.' },
  { id: 'sturgeon', name: '철갑상어', weight: 0.3, size: [100, 250], color: '#7C8A94', rarity: 'legend', desc: '공룡 시대부터 살아온 살아 있는 화석이에요.' },
  { id: 'moon_killifish', name: '달빛 송사리', weight: 0.3, size: [3, 6], color: '#CFE3FF', rarity: 'legend', desc: '보름달이 뜬 밤에만 보인다는 빛나는 송사리예요.' },
  { id: 'sakura_trout', name: '벚꽃 송어', weight: 0.25, size: [30, 60], color: '#F7B8C8', rarity: 'legend', desc: '몸에 벚꽃 무늬가 피어 있어요. 봄을 부르는 물고기예요.' },
  { id: 'rainbow_goldfish', name: '무지개 금붕어', weight: 0.2, size: [8, 20], color: '#F28C5A', rarity: 'legend', desc: '비늘이 일곱 빛깔로 반짝여요.' },
  { id: 'crystal_catfish', name: '수정 메기', weight: 0.2, size: [40, 100], color: '#BDE7F0', rarity: 'legend', desc: '몸이 수정처럼 맑아요. 소원을 하나 들어준대요.' },
  { id: 'fire_carp', name: '불꽃 잉어', weight: 0.2, size: [60, 120], color: '#E85A3A', rarity: 'legend', desc: '꼬리에서 불꽃이 일렁이는 전설의 잉어예요.' },
  // ── 황금 고래: 던질 때마다 따로 0.001% (무게 0이라 아래 무게 뽑기에는 안 나온다). 낚으면 서버 전체에 공지 ──
  { id: 'golden_whale', name: '황금 고래', weight: 0, size: [800, 1500], color: '#F2C14E', rarity: 'mythic', desc: '10만 번에 한 번 걸린다는 꿈의 고래. 낚으면 마을 모두에게 소식이 퍼져요!' },
];

export const GOLDEN_WHALE_ID = 'golden_whale';

export const fishDef = (id: string) => FISH.find((f) => f.id === id);

/**
 * 던진 결과. 먼저 황금 고래(던질 때마다 playConfig.goldenWhaleChance)를 보고,
 * 아니면 가끔은 아무것도 안 걸린다(꽝, null). 그것도 아니면 무게대로 하나 뽑는다.
 * r0, r1, r2, rWhale: 0~1 난수
 */
export function rollCatch(r0: number, r1: number, r2: number, rWhale = 1): { fish: FishDef; size: number } | null {
  if (rWhale < playConfig.goldenWhaleChance) return sized(fishDef(GOLDEN_WHALE_ID)!, r2);
  if (r0 < playConfig.fishMissRate) return null;
  return rollFish(r1, r2);
}

/** 무게로 뽑는 것들 (황금 고래는 빠진다) */
const POOL = FISH.filter((f) => f.weight > 0);
const POOL_TOTAL = POOL.reduce((s, f) => s + f.weight, 0);

/** 무게대로 하나 뽑고 크기를 정한다 (r1, r2: 0~1 난수) */
export function rollFish(r1: number, r2: number): { fish: FishDef; size: number } {
  let x = r1 * POOL_TOTAL;
  let fish = POOL[POOL.length - 1];
  for (const f of POOL) {
    x -= f.weight;
    if (x < 0) {
      fish = f;
      break;
    }
  }
  return sized(fish, r2);
}

function sized(fish: FishDef, r: number): { fish: FishDef; size: number } {
  const [lo, hi] = fish.size;
  return { fish, size: hi ? Math.round(lo + (hi - lo) * r) : 0 };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const ALL_FRUITS: FruitDef[] = [...THEMES.map((t) => FRUITS[t]), FORTUNE_FRUIT];
export const ALL_FRUIT_IDS = ALL_FRUITS.map((f) => f.id);
