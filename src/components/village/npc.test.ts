import { describe, expect, it } from 'vitest';
import { sajuConfig } from '@/config/game';
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

  it('새 기능(사주상담소·타로·클럽·코인·가방)을 안내하고, 복채는 설정 값으로 말한다', () => {
    const ids = NPC_TOPICS.map((t) => t.id);
    for (const id of ['saju', 'club', 'coins', 'bag', 'contest', 'elements']) expect(ids).toContain(id);
    const saju = NPC_TOPICS.find((t) => t.id === 'saju')!.lines(false).join(' ');
    expect(saju).toContain(`${sajuConfig.tarotFee.one}코인`);
    expect(saju).toContain(`${sajuConfig.fee.month}코인`);
    expect(saju).toContain('타로');
    // 집이 없는 손님에게는 집부터 지으라고 한다
    expect(NPC_TOPICS.find((t) => t.id === 'saju')!.lines(true).at(-1)).toContain('나도 집 짓기');
    expect(NPC_GREETING.join(' ')).toContain('사주상담소');
  });
});
