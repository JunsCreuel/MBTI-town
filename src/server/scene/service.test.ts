// 미니홈피 규칙을 실제 Postgres(PGlite, 메모리)로 확인한다. 공개 범위·차단은 서버 규칙이라 여기서 꼼꼼히 본다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgliteSql, createPostgresSql, type Sql } from '../db';
import { SceneError, SceneService, type Viewer } from './service';
import { SceneStore } from './store';

let sql: Sql;
let service: SceneService;
const now = new Date('2026-11-02T12:00:00Z');

// 아주 작은 진짜 PNG (1×1)
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

async function user(): Promise<Viewer> {
  const id = randomUUID();
  await sql.query(`insert into auth.users (id) values ($1)`, [id]);
  return { id };
}

async function onboard(v: Viewer, name: string, extra: Record<string, unknown> = {}) {
  return service.completeOnboarding(v, {
    taste: { colors: ['sky'], moods: ['calm'], music: ['lofi'] },
    district: 'water',
    avatar: { color: 'sky', accessory: 'cap' },
    starter: 'cozy',
    bgm: 'bgm.lake',
    displayName: name,
    bio: '안녕하세요',
    ...extra,
  });
}

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof SceneError && e.code === code);
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  sql = url ? await createPostgresSql(url) : await createPgliteSql();
  service = new SceneService(new SceneStore(sql), () => now);
}, 60_000);

afterAll(async () => {
  await sql.close();
});

describe('미니홈피', () => {
  let a: Viewer, b: Viewer, c: Viewer;
  let ha: string, hb: string, hc: string;

  it('첫 가입 7단계를 저장하면 나의 방이 생긴다', async () => {
    a = await user();
    b = await user();
    c = await user();
    expect((await service.me(a)).profile.onboarded).toBe(false);
    await expectError(service.saveRoom(a, { layout: {} }), 'onboarding_required');
    await expectError(onboard(a, ''), 'bad_request');
    await expectError(onboard(a, '하나', { district: 'moon' }), 'bad_request');
    await expectError(onboard(a, '하나', { birthDate: '2026-13-01' }), 'bad_request');

    const pa = await onboard(a, '하나', { mbti: 'ENFP', birthDate: '1998-04-02' });
    expect(pa).toMatchObject({ onboarded: true, district: 'water', displayName: '하나', mbti: 'ENFP', birthDate: '1998-04-02', roomVisibility: 'public' });
    expect(pa.handle).toMatch(/^[a-z0-9_]{3,20}$/);
    const me = await service.me(a);
    expect(me.room?.bgm).toBe('bgm.lake');
    expect(me.room?.layout.items.some((i) => i.key === 'furn.turntable')).toBe(true);
    ha = pa.handle;
    hb = (await onboard(b, '두리')).handle;
    hc = (await onboard(c, '세찌')).handle;
    expect(new Set([ha, hb, hc]).size).toBe(3);
  });

  it('주소(핸들)는 겹치지 않게 바꾼다', async () => {
    await expectError(service.updateProfile(a, { handle: hb }), 'conflict');
    await expectError(service.updateProfile(a, { handle: 'A!' }), 'bad_request');
    ha = (await service.updateProfile(a, { handle: 'hana_room' })).handle;
    expect(ha).toBe('hana_room');
  });

  it('방 배치는 저장할 때 다시 검사한다', async () => {
    const { room } = await service.me(a);
    const layout = room!.layout;
    await expectError(service.saveRoom(a, { layout: { ...layout, items: [...layout.items, { ...layout.items[0] }] } }), 'bad_request');
    await expectError(service.saveRoom(a, { layout, bgm: 'bgm.nope' }), 'bad_request');
    const moved = { ...layout, wallpaper: 'night', items: layout.items.filter((i) => i.key !== 'furn.plant') };
    const saved = await service.saveRoom(a, { layout: moved, bgm: 'bgm.rain' });
    expect(saved.bgm).toBe('bgm.rain');
    expect((await service.me(a)).room?.layout.wallpaper).toBe('night');
  });

  it('기록은 공개 범위대로 보인다 (기본 나만 보기)', async () => {
    await service.createRecord(a, { kind: 'emotion', emotion: 'calm', body: '조용한 하루' });
    await service.createRecord(a, { kind: 'daily', body: '친구에게만', visibility: 'friends' });
    await service.createRecord(a, { kind: 'daily', body: '모두에게', visibility: 'public' });
    await service.createRecord(a, { kind: 'memo', body: '비밀 메모', visibility: 'public' });
    expect(await service.myRecords(a)).toHaveLength(4);
    const asStranger = await service.roomView(c, ha);
    expect(asStranger.records.map((r) => r.body)).toEqual(['모두에게']);
    const asGuest = await service.roomView(null, ha);
    expect(asGuest.records.map((r) => r.body)).toEqual(['모두에게']);
    expect(asGuest.canWriteGuestbook).toBe(false);
  });

  it('친구 신청 → 수락하면 친구 공개 기록이 보인다', async () => {
    expect(await service.requestFriend(b, ha)).toBe('sent');
    expect((await service.roomView(b, ha)).friend).toBe('sent');
    expect((await service.roomView(a, hb)).friend).toBe('received');
    expect((await service.friends(a)).received.map((f) => f.handle)).toEqual([hb]);
    await service.acceptFriend(a, hb);
    expect((await service.friends(a)).friends.map((f) => f.handle)).toEqual([hb]);
    const asFriend = await service.roomView(b, ha);
    expect(asFriend.relation).toBe('friend');
    expect(asFriend.records.map((r) => r.body).sort()).toEqual(['모두에게', '친구에게만']);
    // 서로 신청하면 바로 친구
    expect(await service.requestFriend(c, hb)).toBe('sent');
    expect(await service.requestFriend(b, hc)).toBe('friends');
  });

  it('방 공개 범위: 친구만이면 친구가 아닌 사람은 방을 못 본다', async () => {
    await service.updateProfile(a, { roomVisibility: 'friends' });
    const stranger = await service.roomView(c, ha);
    expect(stranger.room).toBeNull();
    expect(stranger.records).toEqual([]);
    expect(stranger.canWriteGuestbook).toBe(false);
    expect((await service.roomView(b, ha)).room).not.toBeNull();
    await expectError(service.writeGuestbook(c, ha, { body: '안녕' }), 'forbidden');
    await service.updateProfile(a, { roomVisibility: 'private' });
    expect((await service.roomView(b, ha)).room).toBeNull();
    await service.updateProfile(a, { roomVisibility: 'public' });
  });

  it('방명록: 쓰고, 금지어는 막고, 주인과 쓴 사람만 지운다', async () => {
    await service.writeGuestbook(b, ha, { body: '방 너무 예뻐요!' });
    await service.writeGuestbook(b, ha, { body: '친구만 보는 글', visibility: 'friends' });
    await expectError(service.writeGuestbook(c, ha, { body: '멍 청 한 방' }), 'rejected');
    await expectError(service.writeGuestbook(a, ha, { body: '내 방' }), 'bad_request');
    const strangerView = await service.roomView(c, ha);
    expect(strangerView.guestbook.map((g) => g.body)).toEqual(['방 너무 예뻐요!']);
    expect(strangerView.guestbook[0].canDelete).toBe(false);
    const ownerView = await service.roomView(a, ha);
    expect(ownerView.guestbook).toHaveLength(2);
    expect(ownerView.guestbook.every((g) => g.canDelete)).toBe(true);
    await expectError(service.deleteGuestbook(c, ownerView.guestbook[0].id), 'not_found');
    await service.deleteGuestbook(a, ownerView.guestbook[0].id);
    expect((await service.roomView(a, ha)).guestbook).toHaveLength(1);
  });

  it('방문 기록은 방 주인만 보고, 끌 수 있다', async () => {
    const own = await service.roomView(a, ha);
    expect(own.visitors?.map((v) => v.handle).sort()).toEqual([hb, hc].sort());
    expect((await service.roomView(b, ha)).visitors).toBeNull();
    await service.updateProfile(b, { showVisits: false });
    await service.roomView(a, hb);
    expect((await service.roomView(b, hb)).visitors).toEqual([]);
  });

  it('사진: 형식을 확인하고, 볼 수 있는 사람에게만 준다', async () => {
    await expectError(service.uploadPhoto(a, new TextEncoder().encode('not an image')), 'bad_request');
    const { id } = await service.uploadPhoto(a, PNG, { width: 1, height: 1 });
    // 아무 데도 안 붙인 사진은 주인만 본다
    expect((await service.photo(a, id)).mime).toBe('image/png');
    await expectError(service.photo(b, id), 'not_found');
    // 친구 공개 기록에 붙이면 친구는 보고, 모르는 사람은 못 본다
    await service.createRecord(a, { kind: 'daily', body: '', photoId: id, visibility: 'friends' });
    expect((await service.photo(b, id)).bytes.length).toBe(PNG.length);
    await expectError(service.photo(c, id), 'not_found');
    // 액자에 걸면 방을 볼 수 있는 사람은 본다
    const { room } = await service.me(a);
    const layout = { ...room!.layout, items: room!.layout.items.map((i) => (i.key === 'furn.frame' ? { ...i, photoId: id } : i)) };
    await service.saveRoom(a, { layout });
    expect((await service.photo(c, id)).mime).toBe('image/png');
    expect((await service.photo(null, id)).mime).toBe('image/png');
    // 남의 사진은 내 액자에 못 건다
    const { room: roomB } = await service.me(b);
    const stolen = { ...roomB!.layout, items: roomB!.layout.items.map((i) => (i.key === 'furn.frame' ? { ...i, photoId: id } : i)) };
    await expectError(service.saveRoom(b, { layout: stolen }), 'forbidden');
  });

  it('차단하면 서로 방을 못 보고, 친구도 끊긴다', async () => {
    await service.block(a, hb);
    await expectError(service.roomView(b, ha), 'not_found');
    await expectError(service.roomView(a, hb), 'not_found');
    await expectError(service.writeGuestbook(b, ha, { body: '다시 안녕' }), 'not_found');
    expect((await service.friends(a)).friends).toEqual([]);
    expect((await service.roomView(a, ha)).guestbook.map((g) => g.body)).toEqual([]); // 차단한 사람의 글은 안 보인다
    expect((await service.explore(b, null)).rooms.map((r) => r.handle)).not.toContain(ha);
    expect((await service.blocked(a)).map((x) => x.handle)).toEqual([hb]);
    await service.unblock(a, hb);
    expect((await service.roomView(b, ha)).relation).toBe('other');
  });

  it('신고를 남긴다', async () => {
    await service.report(c, { kind: 'user', targetId: ha, reason: '테스트' });
    await expectError(service.report(c, { kind: 'record', targetId: 'x' }), 'bad_request');
    const [{ n }] = await sql.query<{ n: number }>(`select count(*)::int as n from public.reports`);
    expect(Number(n)).toBe(1);
  });

  it('마을 둘러보기: 공개·발견 켠 방만, 지역별로', async () => {
    await service.updateProfile(c, { district: 'wood' });
    expect((await service.explore(null, 'wood')).rooms.map((r) => r.handle)).toEqual([hc]);
    await service.updateProfile(c, { discoverable: false });
    expect((await service.explore(null, 'wood')).rooms).toEqual([]);
    const all = await service.explore(null, null);
    expect(all.counts.water).toBe(2);
    expect(all.newcomers.length).toBeGreaterThan(0);
  });

  it('기록 내보내기와 전체 삭제 (액자 사진도 내린다)', async () => {
    const data = await service.exportData(a);
    expect((data.records as unknown[]).length).toBe(5);
    expect((data.photos as unknown[]).length).toBe(1);
    await service.deleteArchive(a);
    expect(await service.myRecords(a)).toEqual([]);
    expect((await service.me(a)).room?.layout.items.some((i) => i.photoId)).toBe(false);
  });
});
