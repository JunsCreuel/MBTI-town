import { describe, expect, it } from 'vitest';
import { SPREAD_ROLES, TAROT_DECK, TAROT_SPREAD_SIZE, drawTarot, tarotReading, validPicks } from './tarot';
import { tarotCards } from '../../scripts/lib/tarot-cards';

/** 정해진 순서로 0~1 값을 내는 난수 */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('타로 덱', () => {
  it('메이저 아르카나 22장: 번호가 자리와 같고 키가 겹치지 않는다', () => {
    expect(TAROT_DECK).toHaveLength(22);
    TAROT_DECK.forEach((c, i) => expect(c.id).toBe(i));
    expect(new Set(TAROT_DECK.map((c) => c.key)).size).toBe(22);
    expect(TAROT_SPREAD_SIZE).toBe(22);
  });

  it('카드마다 바로·거꾸로 뜻이 모두 있다 (키워드 셋, 전하는 말, 한마디, 연애·일·재물)', () => {
    for (const c of TAROT_DECK) {
      for (const face of [c.up, c.rev]) {
        expect(face.keywords).toHaveLength(3);
        for (const t of [face.line, face.advice, face.love, face.work, face.money]) expect(t.trim().length).toBeGreaterThan(8);
      }
    }
  });

  it('카드마다 그림이 있고 뒷면도 있다', () => {
    const cards = tarotCards();
    expect(cards.map((c) => c.id)).toEqual([...TAROT_DECK.map((c) => c.key), 'back']);
    for (const c of cards) expect(c.svg).toMatch(/^<svg [^>]*viewBox="0 0 120 180"/);
  });
});

describe('타로 뽑기와 풀이', () => {
  it('고른 자리만큼 서로 다른 카드를 뽑는다', () => {
    for (let k = 0; k < 50; k++) {
      const d = drawTarot('three', [0, 7, 21], 0.35);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.id)).size).toBe(3);
      d.forEach((x) => expect(x.id).toBeGreaterThanOrEqual(0));
    }
    expect(drawTarot('one', [4], 0.35)).toHaveLength(1);
  });

  it('섞지 않으면(난수 0.999…) 고른 자리의 카드, 거꾸로 확률을 따른다', () => {
    // 피셔-예이츠에서 j = i 이면 순서가 그대로다
    const d = drawTarot('three', [2, 5, 9], 0.35, seq(0.9999));
    expect(d.map((x) => x.id)).toEqual([2, 5, 9]);
    expect(d.every((x) => !x.reversed)).toBe(true);
    expect(drawTarot('one', [0], 0.35, seq(0.9999, 0.9999, 0.1))[0]).toBeDefined();
  });

  it('고른 자리 검사: 장수, 범위, 겹침', () => {
    expect(validPicks('one', [3])).toBe(true);
    expect(validPicks('three', [0, 1, 21])).toBe(true);
    for (const bad of [[], [1, 1, 2], [0, 1], [0, 1, 22], [-1, 2, 3], [0.5, 1, 2], 'x', null]) expect(validPicks('three', bad)).toBe(false);
    expect(validPicks('one', [1, 2])).toBe(false);
  });

  it('한 장 점: 카드 이름, 전하는 말, 한마디, 연애·일·재물', () => {
    const r = tarotReading('one', 'general', [{ id: 19, reversed: false }], '11월 4일 수요일');
    expect(r).toMatchObject({ spread: 'one', topic: 'general', title: '태양', summary: TAROT_DECK[19].up.line, advice: TAROT_DECK[19].up.advice });
    expect(r.cards[0]).toMatchObject({ role: 'today', key: 'sun', reversed: false });
    expect(r.sections.map((x) => x.text)).toEqual([TAROT_DECK[19].up.love, TAROT_DECK[19].up.work, TAROT_DECK[19].up.money]);
    expect(tarotReading('one', 'general', [{ id: 16, reversed: true }], '').title).toBe('탑 (거꾸로)');
  });

  it('세 장 점: 과거·현재·미래 순서, 주제에 맞는 말, 바로 선 수에 따라 흐름', () => {
    const drawn = [{ id: 0, reversed: false }, { id: 6, reversed: true }, { id: 21, reversed: false }];
    const r = tarotReading('three', 'love', drawn, '');
    expect(r.cards.map((c) => c.role)).toEqual(SPREAD_ROLES.three);
    expect(r.cards.map((c) => c.text)).toEqual([TAROT_DECK[0].up.love, TAROT_DECK[6].rev.love, TAROT_DECK[21].up.love]);
    expect(r.title).toBe('연애 · 과거·현재·미래');
    expect(r.summary).toContain('대체로 순한 흐름');
    expect(r.summary).toContain("과거 '새 출발' → 현재 '엇갈림' → 미래 '완성'");
    expect(r.advice).toContain(TAROT_DECK[6].rev.advice);
    expect(tarotReading('three', 'general', drawn, '').cards[0].text).toBe(TAROT_DECK[0].up.line);
    expect(tarotReading('three', 'money', drawn.map((d) => ({ ...d, reversed: true })), '').summary).toContain('쉬어 가라는 신호');
  });
});
