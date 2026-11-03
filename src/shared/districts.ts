// 다섯 거주 지역(오행) (PROJECT_GUIDE.md 3장).
// 거주 지역은 사주의 일간 오행으로 자동으로 정해진다 (src/server/saju.ts). 취향은 지역을 정하는 데 쓰지 않는다.

export const DISTRICTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
export type District = (typeof DISTRICTS)[number];

export interface DistrictMeta {
  id: District;
  /** 오행 */
  element: string;
  /** 거주 지역 이름 (가칭) */
  name: string;
  /** 한국어 짧은 이름 */
  short: string;
  /** 분위기 소개 */
  mood: string;
}

export const DISTRICT: Record<District, DistrictMeta> = {
  wood: { id: 'wood', element: '목(木)', name: 'Forest District', short: '숲', mood: '숲과 온실, 초록빛 건축' },
  fire: { id: 'fire', element: '화(火)', name: 'Sunset District', short: '노을', mood: '노을과 조명, 붉은 지붕, 작은 공연장' },
  earth: { id: 'earth', element: '토(土)', name: 'Hill District', short: '언덕', mood: '언덕과 돌길, 크림색 주택, 작은 상점' },
  metal: { id: 'metal', element: '금(金)', name: 'Silver District', short: '은빛', mood: '금속 공방과 유리, 모던 건축' },
  water: { id: 'water', element: '수(水)', name: 'Lake District', short: '호수', mood: '호수와 안개, 달빛, 푸른 건축' },
};

export function isDistrict(v: unknown): v is District {
  return typeof v === 'string' && (DISTRICTS as readonly string[]).includes(v);
}

// ───────────────────────── 취향 선택지 ─────────────────────────
// 선택지 하나는 지역 하나에 1점을 준다.

export interface TasteOption {
  id: string;
  label: string;
  district: District;
}

export const TASTE_COLORS: readonly TasteOption[] = [
  { id: 'mint', label: '민트', district: 'wood' },
  { id: 'green', label: '초록', district: 'wood' },
  { id: 'coral', label: '코랄', district: 'fire' },
  { id: 'peach', label: '복숭아', district: 'fire' },
  { id: 'cream', label: '크림', district: 'earth' },
  { id: 'butter', label: '버터', district: 'earth' },
  { id: 'silver', label: '은빛', district: 'metal' },
  { id: 'white', label: '하양', district: 'metal' },
  { id: 'sky', label: '하늘', district: 'water' },
  { id: 'lavender', label: '라벤더', district: 'water' },
];

export const TASTE_MOODS: readonly TasteOption[] = [
  { id: 'natural', label: '자연스러운', district: 'wood' },
  { id: 'fresh', label: '산뜻한', district: 'wood' },
  { id: 'lively', label: '활기찬', district: 'fire' },
  { id: 'warm', label: '따뜻한', district: 'fire' },
  { id: 'cozy', label: '아늑한', district: 'earth' },
  { id: 'retro', label: '레트로', district: 'earth' },
  { id: 'modern', label: '세련된', district: 'metal' },
  { id: 'minimal', label: '미니멀', district: 'metal' },
  { id: 'dreamy', label: '몽환적인', district: 'water' },
  { id: 'calm', label: '차분한', district: 'water' },
];

export const TASTE_MUSIC: readonly TasteOption[] = [
  { id: 'acoustic', label: '어쿠스틱', district: 'wood' },
  { id: 'indie', label: '인디', district: 'wood' },
  { id: 'band', label: '밴드', district: 'fire' },
  { id: 'citypop', label: '시티팝', district: 'fire' },
  { id: 'jazz', label: '재즈', district: 'earth' },
  { id: 'folk', label: '포크', district: 'earth' },
  { id: 'electronic', label: '일렉트로닉', district: 'metal' },
  { id: 'classical', label: '클래식', district: 'metal' },
  { id: 'lofi', label: '로파이', district: 'water' },
  { id: 'ambient', label: '앰비언트', district: 'water' },
];

export interface Taste {
  colors: string[];
  moods: string[];
  music: string[];
}

export const EMPTY_TASTE: Taste = { colors: [], moods: [], music: [] };

/** 알 수 없는 값은 버리고, 같은 값은 한 번만 남긴다 */
export function cleanTaste(v: unknown): Taste {
  const pick = (list: unknown, options: readonly TasteOption[]) =>
    Array.isArray(list) ? [...new Set(list.filter((x): x is string => options.some((o) => o.id === x)))].slice(0, options.length) : [];
  const t = (v ?? {}) as Partial<Record<keyof Taste, unknown>>;
  return { colors: pick(t.colors, TASTE_COLORS), moods: pick(t.moods, TASTE_MOODS), music: pick(t.music, TASTE_MUSIC) };
}
