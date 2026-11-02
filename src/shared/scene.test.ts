import { describe, expect, it } from 'vitest';
import { roomConfig } from '@/config/game';
import { cleanAvatar } from './avatar';
import { cleanTaste, recommendDistrict, yearElement } from './districts';
import { canView, validateRecord, visibleLevels } from './records';
import {
  FURNITURE, STARTER_ROOMS, blockedCells, canPlace, findFreeSpot, findRoomPath, footprint, starterLayout, validateLayout,
  type PlacedItem,
} from './room';

describe('거주지 추천', () => {
  it('고른 취향이 많은 지역을 추천한다', () => {
    const r = recommendDistrict(cleanTaste({ colors: ['sky', 'lavender'], moods: ['cozy'], music: ['lofi'] }));
    expect(r.district).toBe('water');
    expect(r.scores.water).toBe(3);
    expect(r.reasons).toContain("색 '하늘'");
  });

  it('태어난 해의 천간 오행에 1점을 더한다 (甲乙 목 … 壬癸 수)', () => {
    expect(yearElement(1994)).toBe('wood');
    expect(yearElement(1996)).toBe('fire');
    expect(yearElement(1998)).toBe('earth');
    expect(yearElement(2000)).toBe('metal');
    expect(yearElement(2002)).toBe('water');
    const r = recommendDistrict(cleanTaste({ colors: ['coral'] }), '2001-05-03');
    // 화 1점, 금 1점 → 같으면 목·화·토·금·수 순서
    expect(r.district).toBe('fire');
    expect(r.scores.metal).toBe(1);
  });

  it('아무것도 고르지 않으면 언덕(토)', () => {
    expect(recommendDistrict(cleanTaste({})).district).toBe('earth');
  });

  it('모르는 값은 버린다', () => {
    expect(cleanTaste({ colors: ['sky', 'sky', 'nope'], moods: 'x', music: [1] })).toEqual({ colors: ['sky'], moods: [], music: [] });
    expect(cleanAvatar({ color: 'gold', accessory: 'cap' })).toEqual({ color: 'mint', accessory: 'cap' });
  });
});

describe('방 배치', () => {
  it('기본 방 세트는 모두 규칙에 맞고, 기능 소품을 하나씩 갖는다', () => {
    for (const s of STARTER_ROOMS) {
      const r = validateLayout(starterLayout(s.id));
      expect(r.ok, `${s.id}: ${r.ok ? '' : r.error}`).toBe(true);
      for (const key of ['furn.turntable', 'furn.desk', 'furn.mailbox', 'furn.wardrobe']) {
        expect(s.layout.items.filter((i) => i.key === key)).toHaveLength(1);
      }
      // 캐릭터가 서 있을 방 가운데로 갈 수 있다
      expect(findRoomPath(blockedCells(s.layout.items), { x: 3.5, z: 4.5 }, { x: 2.5, z: 2.5 })).not.toBeNull();
    }
  });

  it('겹치거나 방 밖이면 둘 수 없다 (러그는 다른 소품 밑에 깔 수 있다)', () => {
    const items: PlacedItem[] = [{ id: 'a', key: 'furn.sofa', x: 0, z: 0, rot: 0 }];
    expect(canPlace(items, { id: 'b', key: 'furn.chair', x: 1, z: 0, rot: 0 })).toBe(false);
    expect(canPlace(items, { id: 'b', key: 'furn.chair', x: 2, z: 0, rot: 0 })).toBe(true);
    expect(canPlace(items, { id: 'b', key: 'furn.rug', x: 0, z: 0, rot: 0 })).toBe(true);
    expect(canPlace(items, { id: 'b', key: 'furn.sofa', x: roomConfig.width - 1, z: 3, rot: 0 })).toBe(false);
    // 돌리면 가로세로가 바뀐다
    expect(canPlace(items, { id: 'b', key: 'furn.sofa', x: roomConfig.width - 1, z: 3, rot: 1 })).toBe(true);
    expect(footprint({ id: 'b', key: 'furn.sofa', x: 5, z: 3, rot: 1 })).toEqual([[5, 3], [5, 4]]);
    // 벽 소품은 같은 벽에서 겹치지 않는다
    const wall: PlacedItem[] = [{ id: 'w', key: 'furn.window', x: 1, z: 0, rot: 0, wall: 'back' }];
    expect(canPlace(wall, { id: 'f', key: 'furn.frame', x: 2, z: 0, rot: 0, wall: 'back' })).toBe(false);
    expect(canPlace(wall, { id: 'f', key: 'furn.frame', x: 2, z: 0, rot: 0, wall: 'left' })).toBe(true);
    expect(canPlace(wall, { id: 'f', key: 'furn.frame', x: 6, z: 0, rot: 0, wall: 'left' })).toBe(false);
  });

  it('저장할 때 다시 검사한다', () => {
    const base = starterLayout('cozy');
    expect(validateLayout({ ...base, wallpaper: 'gold' })).toMatchObject({ ok: false });
    expect(validateLayout({ ...base, items: [...base.items, { id: 'x', key: 'furn.unknown', x: 0, z: 0, rot: 0 }] })).toMatchObject({ ok: false });
    expect(validateLayout({ ...base, items: [...base.items, { id: 'tt2', key: 'furn.turntable', x: 4, z: 4, rot: 0 }] })).toMatchObject({
      ok: false,
      error: '턴테이블은(는) 하나만 둘 수 있어요.',
    });
    expect(validateLayout({ ...base, items: [...base.items, { ...base.items[0] }] })).toMatchObject({ ok: false });
    const many = Array.from({ length: roomConfig.maxItems + 1 }, (_, i) => ({ id: `r${i}`, key: 'furn.rug', x: 0, z: 0, rot: 0 }));
    expect(validateLayout({ ...base, items: many })).toMatchObject({ ok: false });
    // 액자 사진 id는 uuid만 남긴다
    const framed = validateLayout({ ...base, items: base.items.map((i) => (i.key === 'furn.frame' ? { ...i, photoId: 'not-a-uuid' } : i)) });
    expect(framed.ok && framed.layout.items.find((i) => i.key === 'furn.frame')?.photoId).toBeFalsy();
  });

  it('빈 자리를 찾아 새 소품을 둔다', () => {
    const items = starterLayout('music').items;
    for (const def of FURNITURE.filter((d) => !d.unique)) {
      const spot = findFreeSpot(items, def.key, 'new');
      expect(spot, def.key).not.toBeNull();
      expect(canPlace(items, spot!)).toBe(true);
    }
  });

  it('가구를 돌아서 걸어간다', () => {
    const items: PlacedItem[] = [{ id: 'a', key: 'furn.sofa', x: 1, z: 2, rot: 0 }, { id: 'b', key: 'furn.sofa', x: 3, z: 2, rot: 0 }];
    const path = findRoomPath(blockedCells(items), { x: 2.5, z: 4.5 }, { x: 2.5, z: 0.5 })!;
    expect(path.at(-1)).toEqual({ x: 2.5, z: 0.5 });
    const blocked = blockedCells(items);
    for (const p of path) expect(blocked[Math.floor(p.z) * roomConfig.width + Math.floor(p.x)]).toBe(0);
  });
});

describe('기록과 공개 범위', () => {
  it('공개 범위대로 보인다', () => {
    expect(canView('private', 'friend')).toBe(false);
    expect(canView('friends', 'friend')).toBe(true);
    expect(canView('friends', 'other')).toBe(false);
    expect(canView('public', 'other')).toBe(true);
    expect(canView('private', 'self')).toBe(true);
    expect(visibleLevels('other')).toEqual(['public']);
  });

  it('기본은 나만 보기, 메모는 늘 나만 보기', () => {
    expect(validateRecord({ kind: 'daily', body: '오늘은 맑음' })).toMatchObject({ ok: true, record: { visibility: 'private' } });
    expect(validateRecord({ kind: 'memo', body: '비밀', visibility: 'public' })).toMatchObject({ ok: true, record: { visibility: 'private' } });
    expect(validateRecord({ kind: 'emotion', body: '그냥' })).toMatchObject({ ok: false });
    expect(validateRecord({ kind: 'emotion', emotion: 'calm', body: '', visibility: 'friends' })).toMatchObject({
      ok: true,
      record: { emotion: 'calm', visibility: 'friends' },
    });
    expect(validateRecord({ kind: 'daily', body: '' })).toMatchObject({ ok: false });
    expect(validateRecord({ kind: 'daily', body: '', photoId: '00000000-0000-4000-8000-000000000000' })).toMatchObject({ ok: true });
  });
});
