// 다섯 거주 지역(오행)과 첫 거주지 추천 규칙 (PROJECT_GUIDE.md 3장).
// 추천은 재미로 보는 출발점일 뿐이다. 누구나 원하는 지역을 고르고 언제든 이사할 수 있다.

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

/** 태어난 해 끝자리 → 천간 오행 (甲乙 목, 丙丁 화, 戊己 토, 庚辛 금, 壬癸 수) */
export function yearElement(year: number): District {
  const d = ((year % 10) + 10) % 10;
  if (d === 4 || d === 5) return 'wood';
  if (d === 6 || d === 7) return 'fire';
  if (d === 8 || d === 9) return 'earth';
  if (d === 0 || d === 1) return 'metal';
  return 'water';
}

export interface Recommendation {
  district: District;
  scores: Record<District, number>;
  /** 추천 이유 (화면에 짧게 보여 준다) */
  reasons: string[];
}

/** 첫 거주지 추천. 점수가 같으면 목 → 화 → 토 → 금 → 수, 아무것도 없으면 토(Hill). */
export function recommendDistrict(taste: Taste, birthDate?: string | null): Recommendation {
  const scores = Object.fromEntries(DISTRICTS.map((d) => [d, 0])) as Record<District, number>;
  const reasons: string[] = [];
  const add = (ids: string[], options: readonly TasteOption[], what: string) => {
    for (const id of ids) {
      const o = options.find((x) => x.id === id);
      if (!o) continue;
      scores[o.district]++;
      reasons.push(`${what} '${o.label}'`);
    }
  };
  add(taste.colors, TASTE_COLORS, '색');
  add(taste.moods, TASTE_MOODS, '분위기');
  add(taste.music, TASTE_MUSIC, '음악');
  const year = birthDate ? Number(birthDate.slice(0, 4)) : NaN;
  if (Number.isInteger(year) && year > 1900) {
    const e = yearElement(year);
    scores[e]++;
    reasons.push(`태어난 해의 기운 '${DISTRICT[e].element}'`);
  }
  const best = Math.max(...DISTRICTS.map((d) => scores[d]));
  const district = best === 0 ? 'earth' : DISTRICTS.find((d) => scores[d] === best)!;
  return { district, scores, reasons };
}
