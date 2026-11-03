// 미니홈피 규칙을 실제 Postgres(PGlite, 메모리)로 확인한다. 공개 범위·차단은 서버 규칙이라 여기서 꼼꼼히 본다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { townConfig } from '@/config/game';
import { verifyTownPass } from '@/shared/townToken';
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

describe('마을 집터', () => {
  let p: Viewer, q: Viewer, r: Viewer;

  it('가입하면 고른 지역의 빈 집터 가운데 가장 작은 번호에 집이 선다', async () => {
    p = await user();
    q = await user();
    r = await user();
    expect((await onboard(p, '파랑', { district: 'fire' })).houseLot).toBe(0);
    expect((await onboard(q, '큐', { district: 'fire' })).houseLot).toBe(1);
    expect((await onboard(r, '알', { district: 'metal' })).houseLot).toBe(0);
  });

  it('이사하면 새 지역 집터로 옮기고, 비운 집터는 다음 사람이 쓴다', async () => {
    expect((await service.updateProfile(p, { district: 'metal' })).houseLot).toBe(1);
    // 같은 지역으로 다시 저장해도 집터는 그대로
    expect((await service.updateProfile(p, { district: 'metal', bio: '이사 왔어요' })).houseLot).toBe(1);
    const s = await user();
    expect((await onboard(s, '에스', { district: 'fire' })).houseLot).toBe(0);
  });

  it('1동(본섬) 집터가 다 차면 2동이 열리고, 2동이 다 차면 3동이 열린다', async () => {
    const first = await Promise.all(Array.from({ length: townConfig.lotsPerDistrict }, () => user()));
    for (const [i, v] of first.entries()) await onboard(v, `주민${i}`, { district: 'earth' });
    const late = await user();
    const mine = await onboard(late, '늦은 주민', { district: 'earth' });
    expect(mine).toMatchObject({ district: 'earth', houseHood: 2, houseLot: 0 });
    // 2동을 채우면 다음 사람은 3동 0번
    const second = await Promise.all(Array.from({ length: townConfig.hoodLots - 1 }, () => user()));
    for (const [i, v] of second.entries()) await onboard(v, `이웃${i}`, { district: 'earth' });
    const third = await onboard(await user(), '셋째 동네', { district: 'earth' });
    expect(third).toMatchObject({ houseHood: 3, houseLot: 0 });
    // 1동에 빈 집터가 생기면 다음 사람은 1동으로 (작은 동네부터 채운다)
    await service.updateProfile(first[4], { district: 'wood' });
    const next = await onboard(await user(), '빈자리', { district: 'earth' });
    expect(next).toMatchObject({ houseHood: 1, houseLot: 4 });
    // 같은 동네·같은 집터에 두 집이 서지 않는다
    const [{ n }] = await sql.query<{ n: number }>(
      `select count(*)::int as n from (select district, house_hood, house_lot from public.profiles where house_lot is not null group by 1, 2, 3 having count(*) > 1) d`,
    );
    expect(Number(n)).toBe(0);
    // 마을 집 목록에도 동네 번호가 붙는다
    const houses = (await service.town(null)).houses.filter((h) => h.district === 'earth');
    expect(new Set(houses.map((h) => h.hood))).toEqual(new Set([1, 2, 3]));
    expect(houses.filter((h) => h.hood === 2)).toHaveLength(townConfig.hoodLots);
  });

  it('예전에 집 없이 들어온 주민은 다음 접속 때 빈 집터를 받는다', async () => {
    const v = await user();
    await onboard(v, '집 없던 주민', { district: 'metal' });
    await sql.query(`update public.profiles set house_lot = null where id = $1`, [v.id]);
    const ticket = await service.townTicket(v);
    expect(ticket.pass.lot).toBeGreaterThanOrEqual(0);
    expect((await service.me(v)).profile.houseLot).toBe(ticket.pass.lot);
  });

  it('마을 집 이름표: 내 집·친구 집·공개 방만 이름이 붙고, 차단하면 이름이 지워진다', async () => {
    const hp = (await service.me(p)).profile.handle;
    const hq = (await service.me(q)).profile.handle;
    await service.updateProfile(q, { discoverable: false });
    const named = (v: Viewer | null) =>
      service.town(v).then((t) => Object.fromEntries(t.houses.filter((h) => h.district !== 'earth' && h.hood === 1).map((h) => [`${h.district}.${h.lot}`, h.name])));

    // 손님: 발견을 끈 큐의 집은 이름이 없다
    expect(await named(null)).toMatchObject({ 'metal.1': '파랑', 'fire.1': null });
    // 친구가 되면 큐의 집 이름이 보인다
    await service.requestFriend(p, hq);
    await service.acceptFriend(q, hp);
    const forP = await service.town(p);
    expect(forP.houses.find((h) => h.district === 'fire' && h.lot === 1)).toMatchObject({ name: '큐', friend: true, handle: hq });
    expect(forP.houses.find((h) => h.district === 'metal' && h.lot === 1)).toMatchObject({ name: '파랑', mine: true });
    // 차단하면 서로 이름이 지워지고, 마을에서 숨길 사람 번호가 내려간다
    await service.block(q, hp);
    const afterBlock = await service.town(p);
    expect(afterBlock.houses.find((h) => h.district === 'fire' && h.lot === 1)).toMatchObject({ name: null, handle: null, friend: false });
    expect(afterBlock.hidden).toHaveLength(1);
    const tq = await service.townTicket(q);
    expect(afterBlock.hidden).toEqual([tq.pass.pid]);
  });

  it('입장 토큰: 가입한 사람은 이름·집터를, 아니면 손님으로 담는다', async () => {
    const tp = await service.townTicket(p);
    expect(tp.guest).toBe(false);
    expect(verifyTownPass(tp.token)).toMatchObject({ name: '파랑', district: 'metal', hood: 1, lot: 1, color: 'sky', acc: 'cap' });
    expect(tp.pass.handle).not.toBe('');
    // 발견을 끈 사람은 방 주소를 담지 않는다
    expect((await service.townTicket(q)).pass.handle).toBe('');
    const guest = await service.townTicket(null);
    expect(guest.guest).toBe(true);
    expect(guest.pass).toMatchObject({ name: '손님', district: '', hood: 1, lot: -1 });
    expect(guest.pass.pid).not.toBe((await service.townTicket(null)).pass.pid);
    const fresh = await user();
    expect((await service.townTicket(fresh)).guest).toBe(true);
  });
});
