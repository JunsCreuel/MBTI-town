// 16유형 마을 (PROJECT_GUIDE.md 3장). 사는 마을 = 내 MBTI 유형이다.
// 기질 그룹(분석가 NT·외교관 NF·관리자 SJ·탐험가 SP)이 섬의 한 사분면씩 모이고, 그룹이 풍경(식물·명소·열매·색)을 정한다.
import { MBTI_GROUPS, MBTI_TYPES, groupOf, isMbtiType, type MbtiGroup, type MbtiType } from '../design/mbti';

/** 마을 순서: 북쪽부터 시계 방향. 같은 기질 그룹 넷이 이어진다 (NT → NF → SJ → SP) */
export const DISTRICTS = MBTI_TYPES;
export type District = MbtiType;

/** 풍경 테마 = 기질 그룹 */
export type Theme = MbtiGroup;
export const THEMES: readonly Theme[] = ['NT', 'NF', 'SJ', 'SP'];

export interface ThemeMeta {
  id: Theme;
  /** 기질 이름 */
  name: string;
  /** 풍경 이름 (지도·안내에 쓴다) */
  place: string;
  /** 분위기 소개 */
  mood: string;
}

export const THEME: Record<Theme, ThemeMeta> = {
  NT: { id: 'NT', name: MBTI_GROUPS[0].name, place: '은빛 언덕', mood: '은빛 자작나무와 유리 공방' },
  NF: { id: 'NF', name: MBTI_GROUPS[1].name, place: '초록 숲', mood: '숲과 온실, 초록빛 건축' },
  SJ: { id: 'SJ', name: MBTI_GROUPS[2].name, place: '푸른 호숫가', mood: '호수와 부두, 푸른 지붕' },
  SP: { id: 'SP', name: MBTI_GROUPS[3].name, place: '노을 거리', mood: '노을과 단풍, 작은 공연장' },
};

export interface DistrictMeta {
  id: District;
  /** 마을 이름: "ENFP 마을" */
  name: string;
  /** 짧은 이름 (유형 코드) */
  short: string;
  theme: Theme;
}

export const DISTRICT: Record<District, DistrictMeta> = Object.fromEntries(
  DISTRICTS.map((d) => [d, { id: d, name: `${d} 마을`, short: d, theme: groupOf(d) }]),
) as Record<District, DistrictMeta>;

export const themeOf = (d: District): Theme => groupOf(d);

/** 기질 그룹을 대표하는 마을 (그룹 풍경 소품의 색, 낚시터·클럽처럼 마을이 아닌 곳의 풍경에 쓴다) */
export const THEME_DISTRICT: Record<Theme, District> = { NT: 'INTP', NF: 'INFP', SJ: 'ISFJ', SP: 'ISFP' };

/** 마을이 아직 없을 때(예전 주민, 손님 미리 보기) 방 풍경에 쓰는 마을 */
export const DEFAULT_DISTRICT: District = 'INFP';

export function isDistrict(v: unknown): v is District {
  return isMbtiType(v);
}

// ───────────────────────── 취향 선택지 ─────────────────────────
// 가입 때 고르는 취향 (방 꾸미기 추천에만 쓴다. 사는 마을과는 상관없다)

export interface TasteOption {
  id: string;
  label: string;
}

export const TASTE_COLORS: readonly TasteOption[] = [
  { id: 'mint', label: '민트' },
  { id: 'green', label: '초록' },
  { id: 'coral', label: '코랄' },
  { id: 'peach', label: '복숭아' },
  { id: 'cream', label: '크림' },
  { id: 'butter', label: '버터' },
  { id: 'silver', label: '은빛' },
  { id: 'white', label: '하양' },
  { id: 'sky', label: '하늘' },
  { id: 'lavender', label: '라벤더' },
];

export const TASTE_MOODS: readonly TasteOption[] = [
  { id: 'natural', label: '자연스러운' },
  { id: 'fresh', label: '산뜻한' },
  { id: 'lively', label: '활기찬' },
  { id: 'warm', label: '따뜻한' },
  { id: 'cozy', label: '아늑한' },
  { id: 'retro', label: '레트로' },
  { id: 'modern', label: '세련된' },
  { id: 'minimal', label: '미니멀' },
  { id: 'dreamy', label: '몽환적인' },
  { id: 'calm', label: '차분한' },
];

export const TASTE_MUSIC: readonly TasteOption[] = [
  { id: 'acoustic', label: '어쿠스틱' },
  { id: 'indie', label: '인디' },
  { id: 'band', label: '밴드' },
  { id: 'citypop', label: '시티팝' },
  { id: 'jazz', label: '재즈' },
  { id: 'folk', label: '포크' },
  { id: 'electronic', label: '일렉트로닉' },
  { id: 'classical', label: '클래식' },
  { id: 'lofi', label: '로파이' },
  { id: 'ambient', label: '앰비언트' },
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
