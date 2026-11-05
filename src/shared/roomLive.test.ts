// 방 실시간: 방 꾸미기 알림 검사, 방 강아지 알림 검사, 쓰다듬기 반응 순서
import { describe, expect, it } from 'vitest';
import { PET_REACTION, PET_REACTION_SEC, petReactionPose } from './pets';
import { isDogMessage, parseFurniMessage } from './protocol';
import { cleanPlacedItem } from './room';

describe('쓰다듬기 반응', () => {
  it('앉고 → 눕고 → 좋아하고, 끝나면 null', () => {
    expect(PET_REACTION.map((p) => p.pose)).toEqual(['sit', 'lie', 'happy']);
    expect(petReactionPose(-1)).toBeNull();
    expect(petReactionPose(Number.NaN)).toBeNull();
    expect(petReactionPose(0)).toBe('sit');
    expect(petReactionPose(PET_REACTION[0].sec + 0.01)).toBe('lie');
    expect(petReactionPose(PET_REACTION_SEC - 0.01)).toBe('happy');
    expect(petReactionPose(PET_REACTION_SEC)).toBeNull();
  });
});

describe('방 꾸미기 알림', () => {
  const bed = { id: 'bed1', key: 'furn.bed', x: 1, z: 1, rot: 0 };

  it('있는 가구·방 안 자리만 받고, 필요한 칸만 남긴다', () => {
    expect(cleanPlacedItem({ ...bed, extra: 'x' })).toEqual(bed);
    expect(cleanPlacedItem({ ...bed, key: 'furn.spaceship' })).toBeNull();
    expect(cleanPlacedItem({ ...bed, x: 99 })).toBeNull();
    expect(cleanPlacedItem({ ...bed, x: 1.5 })).toBeNull();
    expect(cleanPlacedItem({ ...bed, id: '<script>' })).toBeNull();
    expect(cleanPlacedItem({ id: 'w1', key: 'furn.window', x: 1, z: 0, rot: 0, wall: 'left' })).toEqual({ id: 'w1', key: 'furn.window', x: 1, z: 0, rot: 0, wall: 'left' });
    expect(cleanPlacedItem({ id: 'w1', key: 'furn.window', x: 1, z: 0, rot: 0, wall: 'ceiling' })).toBeNull();
  });

  it('모양이 맞는 알림만 받는다', () => {
    expect(parseFurniMessage({ op: 'carry', item: bed })).toEqual({ op: 'carry', item: bed });
    expect(parseFurniMessage({ op: 'move', item: { ...bed, x: -1 } })).toBeNull();
    expect(parseFurniMessage({ op: 'remove', id: 'bed1' })).toEqual({ op: 'remove', id: 'bed1' });
    expect(parseFurniMessage({ op: 'remove', id: '' })).toBeNull();
    expect(parseFurniMessage({ op: 'reset', junk: 1 })).toEqual({ op: 'reset' });
    expect(parseFurniMessage({ op: 'explode' })).toBeNull();
    expect(parseFurniMessage(null)).toBeNull();
  });
});

describe('방 강아지 알림', () => {
  it('자리·방향·자세 모양을 본다', () => {
    expect(isDogMessage({ x: 1, z: 2, rot: 0, moving: false, pose: null })).toBe(true);
    expect(isDogMessage({ x: 1, z: 2, rot: 0, moving: true, pose: 'lie' })).toBe(true);
    expect(isDogMessage({ x: 1, z: 2, rot: 0, moving: true, pose: 'fly' })).toBe(false);
    expect(isDogMessage({ x: Number.POSITIVE_INFINITY, z: 2, rot: 0, moving: true, pose: null })).toBe(false);
    expect(isDogMessage({ x: 1, z: 2, rot: 0, moving: 'yes', pose: null })).toBe(false);
  });
});

describe('쓰다듬기 동작 길이', () => {
  it('강아지가 반응하는 동안 곁에 쪼그려 앉아 있다', async () => {
    const { townConfig } = await import('../config/game');
    expect(townConfig.petActionMs / 1000).toBeGreaterThanOrEqual(PET_REACTION_SEC);
  });
});
