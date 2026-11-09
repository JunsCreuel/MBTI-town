import { describe, expect, it } from 'vitest';
import { petCareConfig } from '../config/game';
import { careGain, petCareState, petLevel, trickUnlocked } from './petCare';

describe('강아지 키우기', () => {
  it('친밀도로 단계가 오르고 마지막 단계에 목걸이', () => {
    expect(petLevel(0)).toBe(1);
    expect(petLevel(petCareConfig.levels[1])).toBe(2);
    expect(petLevel(10_000)).toBe(5);
    expect(petCareState({ affection: 10_000, fed_day: null, walked_day: null, pet_day: null, pets_today: 0 }, '2026-11-09').collar).toBe(true);
  });

  it('하루에 한 번 밥·산책, 쓰다듬기는 정한 횟수까지', () => {
    const today = '2026-11-09';
    const fresh = petCareState(null, today);
    expect(careGain('feed', fresh)).toBe(petCareConfig.feed);
    const fed = petCareState({ affection: 10, fed_day: today, walked_day: today, pet_day: today, pets_today: petCareConfig.petsPerDay }, today);
    expect(careGain('feed', fed)).toBe(0);
    expect(careGain('walk', fed)).toBe(0);
    expect(careGain('pet', fed)).toBe(0);
    // 어제 기록은 오늘 다시 셀 수 있다
    const yesterday = petCareState({ affection: 10, fed_day: '2026-11-08', walked_day: null, pet_day: '2026-11-08', pets_today: 5 }, today);
    expect(yesterday.fedToday).toBe(false);
    expect(yesterday.petsToday).toBe(0);
  });

  it('재주는 단계에 맞춰 배운다', () => {
    expect(trickUnlocked('sit', 1)).toBe(false);
    expect(trickUnlocked('sit', 2)).toBe(true);
    expect(trickUnlocked('lie', 3)).toBe(false);
    expect(trickUnlocked('lie', 4)).toBe(true);
  });
});
