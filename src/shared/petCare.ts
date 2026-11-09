// 강아지 키우기: 친밀도와 재주 (PROJECT_GUIDE.md 6장 방). 서버(점수)와 화면(단계·재주)이 같은 규칙을 쓴다.
import { petCareConfig } from '../config/game';

export type PetCareAction = 'feed' | 'pet' | 'walk';
export const PET_CARE_ACTIONS: readonly PetCareAction[] = ['feed', 'pet', 'walk'];

/** 재주: 친밀도 단계에서 배운다. pose = 강아지 동작 이름 */
export const TRICKS = [
  { id: 'sit', name: '앉아', level: 2, pose: 'sit' },
  { id: 'paw', name: '손', level: 3, pose: 'paw' },
  { id: 'lie', name: '빵야!', level: 4, pose: 'lie' },
] as const;
export type TrickId = (typeof TRICKS)[number]['id'];
export const isTrickId = (v: unknown): v is TrickId => TRICKS.some((t) => t.id === v);

/** 단계 이름 (1~5) */
export const PET_LEVEL_NAMES = ['처음 만난 사이', '친해지는 중', '단짝', '가족', '영원한 짝꿍'] as const;

export interface PetCareState {
  affection: number;
  level: number;
  /** 다음 단계까지 (마지막 단계면 null) */
  next: number | null;
  /** 이번 단계 시작 친밀도 */
  floor: number;
  fedToday: boolean;
  walkedToday: boolean;
  petsToday: number;
  /** 5단계: 목걸이를 단다 */
  collar: boolean;
}

export function petLevel(affection: number): number {
  let lv = 1;
  petCareConfig.levels.forEach((need, i) => {
    if (affection >= need) lv = i + 1;
  });
  return lv;
}

export function petCareState(row: { affection: number; fed_day: string | null; walked_day: string | null; pet_day: string | null; pets_today: number } | null, today: string): PetCareState {
  const affection = row?.affection ?? 0;
  const level = petLevel(affection);
  const levels = petCareConfig.levels;
  return {
    affection,
    level,
    floor: levels[level - 1],
    next: level < levels.length ? levels[level] : null,
    fedToday: row?.fed_day === today,
    walkedToday: row?.walked_day === today,
    petsToday: row?.pet_day === today ? row.pets_today : 0,
    collar: level >= levels.length,
  };
}

/** 이 행동으로 오를 친밀도 (오늘 이미 다 했으면 0) */
export function careGain(action: PetCareAction, s: PetCareState): number {
  if (action === 'feed') return s.fedToday ? 0 : petCareConfig.feed;
  if (action === 'walk') return s.walkedToday ? 0 : petCareConfig.walk;
  return s.petsToday >= petCareConfig.petsPerDay ? 0 : petCareConfig.pet;
}

export function trickUnlocked(id: TrickId, level: number): boolean {
  return level >= TRICKS.find((t) => t.id === id)!.level;
}
