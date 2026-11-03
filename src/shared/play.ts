// 마을 놀거리: 열매 따기·운세 열매·낚시 (PROJECT_GUIDE.md 3장).
// 하루 횟수와 결과는 서버가 정한다 (화면은 보여 주기만 한다). 재미로 보는 운세다.
import { playConfig } from '../config/game';
import { DISTRICTS, isDistrict, type District } from './districts';

// ───────────────────────── 열매 ─────────────────────────

/** 지역마다 나무에 열리는 열매 (manifest 아이콘 없이 색으로 그린다) */
export const FRUITS: Record<District, { id: string; name: string; color: string }> = {
  wood: { id: 'apple', name: '사과', color: '#7CC36A' },
  fire: { id: 'peach', name: '복숭아', color: '#F4A08C' },
  earth: { id: 'persimmon', name: '감', color: '#F09A3A' },
  metal: { id: 'pear', name: '배', color: '#E9D98A' },
  water: { id: 'grape', name: '포도', color: '#7C6BC4' },
};
export const FORTUNE_FRUIT = { id: 'fortune', name: '운세 열매', color: '#F2C14E' };

/** 열매 이름 (도감) */
export function fruitName(id: string): string {
  if (id === FORTUNE_FRUIT.id) return FORTUNE_FRUIT.name;
  return Object.values(FRUITS).find((f) => f.id === id)?.name ?? id;
}

/**
 * 나무 자리 이름: 열매 나무 "fruit.wood.0", 운세 나무 "fortune".
 * 맵의 열매 나무(prop.fruit.<지역>)는 지역마다 놓인 순서대로 번호를 붙인다.
 */
export type TreeSpot = { kind: 'fruit'; district: District; index: number } | { kind: 'fortune' };

export function parseTreeSpot(v: unknown): TreeSpot | null {
  if (v === 'fortune') return { kind: 'fortune' };
  if (typeof v !== 'string') return null;
  const m = /^fruit\.([a-z]+)\.(\d{1,2})$/.exec(v);
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
  rarity: 'common' | 'rare' | 'legend' | 'junk';
}

export const FISH: readonly FishDef[] = [
  { id: 'crucian', name: '붕어', weight: 22, size: [12, 30], color: '#9FA77A', rarity: 'common' },
  { id: 'minnow', name: '피라미', weight: 20, size: [6, 14], color: '#BFD3DA', rarity: 'common' },
  { id: 'killifish', name: '송사리', weight: 18, size: [2, 5], color: '#D7E3E8', rarity: 'common' },
  { id: 'carp', name: '잉어', weight: 12, size: [30, 80], color: '#C9965B', rarity: 'common' },
  { id: 'catfish', name: '메기', weight: 8, size: [30, 90], color: '#6D6A5E', rarity: 'common' },
  { id: 'sweetfish', name: '은어', weight: 6, size: [12, 25], color: '#C7D2D9', rarity: 'rare' },
  { id: 'mandarinfish', name: '쏘가리', weight: 4, size: [20, 50], color: '#C9A35C', rarity: 'rare' },
  { id: 'trout', name: '무지개송어', weight: 4, size: [25, 60], color: '#E89A9A', rarity: 'rare' },
  { id: 'eel', name: '뱀장어', weight: 3, size: [40, 100], color: '#5E6B52', rarity: 'rare' },
  { id: 'goldfish', name: '금붕어', weight: 2, size: [5, 15], color: '#F2A23A', rarity: 'rare' },
  { id: 'golden_carp', name: '황금 잉어', weight: 0.6, size: [60, 120], color: '#F2C14E', rarity: 'legend' },
  { id: 'dragon_fish', name: '용궁 물고기', weight: 0.3, size: [80, 150], color: '#5BC0C8', rarity: 'legend' },
  { id: 'boot', name: '낡은 장화', weight: 5, size: [0, 0], color: '#6B5A4A', rarity: 'junk' },
  { id: 'bottle', name: '편지 든 병', weight: 2, size: [0, 0], color: '#9ED6C9', rarity: 'junk' },
];

export const fishDef = (id: string) => FISH.find((f) => f.id === id);

/** 무게대로 하나 뽑고 크기를 정한다 (r1, r2: 0~1 난수) */
export function rollFish(r1: number, r2: number): { fish: FishDef; size: number } {
  const total = FISH.reduce((s, f) => s + f.weight, 0);
  let x = r1 * total;
  let fish = FISH[FISH.length - 1];
  for (const f of FISH) {
    x -= f.weight;
    if (x < 0) {
      fish = f;
      break;
    }
  }
  const [lo, hi] = fish.size;
  return { fish, size: hi ? Math.round(lo + (hi - lo) * r2) : 0 };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const ALL_FRUIT_IDS = [...DISTRICTS.map((d) => FRUITS[d].id), FORTUNE_FRUIT.id];
