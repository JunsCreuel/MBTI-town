import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { playConfig } from '../config/game';
import { FISH, GOLDEN_WHALE_ID, rollCatch, rollFish } from './play';

describe('물고기 도감', () => {
  it('45종 (원래 14 + 새로 30 + 황금 고래), id가 겹치지 않고 모두 아이콘이 있다', () => {
    expect(FISH).toHaveLength(45);
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../../public/assets/manifest.json'), 'utf8')) as Record<string, unknown>;
    for (const f of FISH) expect(manifest[`item.fish.${f.id}`], f.id).toBeTruthy();
    const by = (r: string) => FISH.filter((f) => f.rarity === r).length;
    expect({ common: by('common'), rare: by('rare'), legend: by('legend'), mythic: by('mythic'), junk: by('junk') }).toEqual({
      common: 17,
      rare: 17,
      legend: 8,
      mythic: 1,
      junk: 2,
    });
  });

  it('황금 고래는 던질 때마다 따로 0.001%로만 걸린다', () => {
    expect(playConfig.goldenWhaleChance).toBe(0.00001);
    expect(rollCatch(0.9, 0.5, 0.5, 0)?.fish.id).toBe(GOLDEN_WHALE_ID);
    expect(rollCatch(0.9, 0.5, 0.5, playConfig.goldenWhaleChance * 0.99)?.fish.id).toBe(GOLDEN_WHALE_ID);
    expect(rollCatch(0.9, 0.5, 0.5, playConfig.goldenWhaleChance)?.fish.id).not.toBe(GOLDEN_WHALE_ID);
    // 꽝이 나올 난수여도 황금 고래가 먼저
    expect(rollCatch(0, 0.5, 0.5, 0)?.fish.id).toBe(GOLDEN_WHALE_ID);
    // 무게 뽑기로는 절대 안 나온다 (끝값 포함)
    for (let i = 0; i <= 1000; i++) expect(rollFish(Math.min(i / 1000, 0.999999999), 0.5).fish.id).not.toBe(GOLDEN_WHALE_ID);
  });

  it('꽝이 아니면 무게대로 뽑고, 크기는 범위 안', () => {
    expect(rollCatch(playConfig.fishMissRate / 2, 0.5, 0.5)).toBeNull();
    for (let i = 0; i < 200; i++) {
      const r = rollCatch(0.9, i / 200, (i * 7) % 200 / 200)!;
      const [lo, hi] = r.fish.size;
      expect(r.size).toBeGreaterThanOrEqual(lo);
      expect(r.size).toBeLessThanOrEqual(hi);
    }
  });
});
