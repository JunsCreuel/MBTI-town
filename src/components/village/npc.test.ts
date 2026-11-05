import { describe, expect, it } from 'vitest';
import { contestConfig } from '@/config/game';
import { NPC_GREETING, NPC_TOPICS } from './npc';

describe('몬냥이 안내', () => {
  it('주제마다 할 말이 있고, 값이 비거나 이상하게 들어간 말이 없다', () => {
    expect(new Set(NPC_TOPICS.map((t) => t.id)).size).toBe(NPC_TOPICS.length);
    for (const t of NPC_TOPICS) {
      for (const guest of [true, false]) {
        const lines = t.lines(guest);
        expect(lines.length).toBeGreaterThan(0);
        for (const l of lines) expect(l).not.toMatch(/undefined|NaN|\$\{/);
      }
    }
  });

  it('MBTI 마을·토론·대항전·놀거리를 안내하고, 사주 이야기는 하지 않는다', () => {
    const ids = NPC_TOPICS.map((t) => t.id);
    for (const id of ['town', 'debate', 'contest', 'club', 'coins', 'bag']) expect(ids).toContain(id);
    const all = [...NPC_GREETING, ...NPC_TOPICS.flatMap((t) => [...t.lines(true), ...t.lines(false)])].join(' ');
    expect(all).not.toMatch(/사주|오행|타로|일주/);
    expect(NPC_TOPICS.find((t) => t.id === 'contest')!.lines(false).join(' ')).toContain(`${contestConfig.points.debateWin}점`);
    // 집이 없는 손님에게는 집부터 지으라고 한다
    expect(NPC_TOPICS.find((t) => t.id === 'debate')!.lines(true).at(-1)).toContain('나도 집 짓기');
    expect(NPC_GREETING.join(' ')).toContain('MBTI');
  });
});
