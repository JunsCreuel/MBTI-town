// 미니홈피 규칙을 실제 Postgres(PGlite, 메모리)로 확인한다. 공개 범위·차단은 서버 규칙이라 여기서 꼼꼼히 본다.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { coinConfig, contestConfig, debateConfig, marketConfig, playConfig, recordConfig, townConfig } from '@/config/game';
import type { Announcement } from '@/shared/announce';
import { DISTRICTS, type District } from '@/shared/districts';
import { refundFor } from '@/shared/market';
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
  // district는 테스트 편의: 그 유형을 MBTI로 고른다 (사는 마을 = MBTI)
  const { district, ...rest } = extra as { district?: District };
  return service.completeOnboarding(v, {
    taste: { colors: ['sky'], moods: ['calm'], music: ['lofi'] },
    mbti: district ?? 'ISFJ',
    avatar: { color: 'sky', accessory: 'cap' },
    starter: 'cozy',
    bgm: 'bgm.lake',
    displayName: name,
    bio: '안녕하세요',
    ...rest,
  });
}

/** MBTI를 바꿔 다른 마을로 이사 (테스트 편의: 바꾸기 대기 시간은 지운다) */
async function moveTo(v: Viewer, d: District, more: Record<string, unknown> = {}) {
  await sql.query(`update public.profiles set mbti_changed_at = null where id = $1`, [v.id]);
  const moved = await service.changeMbti(v, d);
  return Object.keys(more).length ? service.updateProfile(v, more) : moved;
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
    await expectError(onboard(a, '하나', { mbti: 'XXXX' }), 'bad_request');
    await expectError(onboard(a, '하나', { mbti: undefined }), 'bad_request');

    // 사는 마을 = 고른 MBTI 유형 마을
    const pa = await onboard(a, '하나', { mbti: 'ISFJ' });
    expect(pa).toMatchObject({ onboarded: true, district: 'ISFJ', displayName: '하나', mbti: 'ISFJ', roomVisibility: 'public', mbtiChangeableAt: null });
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

  it('마을 둘러보기: 공개·발견 켠 방만, 유형 마을별로', async () => {
    await moveTo(c, 'INFP');
    expect((await service.explore(null, 'INFP')).rooms.map((r) => r.handle)).toEqual([hc]);
    await service.updateProfile(c, { discoverable: false });
    expect((await service.explore(null, 'INFP')).rooms).toEqual([]);
    const all = await service.explore(null, null);
    expect(all.counts.ISFJ).toBe(2);
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

  it('가입하면 고른 MBTI 마을의 빈 집터 가운데 가장 작은 번호에 집이 선다', async () => {
    p = await user();
    q = await user();
    r = await user();
    expect((await onboard(p, '파랑', { district: 'ESTP' })).houseLot).toBe(0);
    expect((await onboard(q, '큐', { district: 'ESTP' })).houseLot).toBe(1);
    expect((await onboard(r, '알', { district: 'INTJ' })).houseLot).toBe(0);
  });

  it('MBTI를 바꾸면 새 마을 집터로 이사하고, 비운 집터는 다음 사람이 쓴다', async () => {
    // MBTI를 바꾸면 그 마을 빈 집터로 이사한다
    expect((await moveTo(p, 'INTJ')).houseLot).toBe(1);
    // 같은 MBTI로 다시 저장해도 집터는 그대로
    expect((await moveTo(p, 'INTJ', { bio: '이사 왔어요' })).houseLot).toBe(1);
    // 마을을 따로 고를 수는 없다 (MBTI로 정해진다)
    await expectError(service.updateProfile(p, { district: 'ISFJ' }), 'bad_request');
    const s = await user();
    expect((await onboard(s, '에스', { district: 'ESTP' })).houseLot).toBe(0);
  });

  it('1동(본섬) 집터가 다 차면 2동이 열리고, 2동이 다 차면 3동이 열린다', async () => {
    const first = await Promise.all(Array.from({ length: townConfig.lotsPerDistrict }, () => user()));
    for (const [i, v] of first.entries()) await onboard(v, `주민${i}`, { district: 'ESTJ' });
    const late = await user();
    const mine = await onboard(late, '늦은 주민', { district: 'ESTJ' });
    expect(mine).toMatchObject({ district: 'ESTJ', houseHood: 2, houseLot: 0 });
    // 2동을 채우면 다음 사람은 3동 0번
    const second = await Promise.all(Array.from({ length: townConfig.hoodLots - 1 }, () => user()));
    for (const [i, v] of second.entries()) await onboard(v, `이웃${i}`, { district: 'ESTJ' });
    const third = await onboard(await user(), '셋째 동네', { district: 'ESTJ' });
    expect(third).toMatchObject({ houseHood: 3, houseLot: 0 });
    // 1동에 빈 집터가 생기면 다음 사람은 1동으로 (작은 동네부터 채운다)
    await moveTo(first[2], 'INFP');
    const next = await onboard(await user(), '빈자리', { district: 'ESTJ' });
    expect(next).toMatchObject({ houseHood: 1, houseLot: 2 });
    // 같은 동네·같은 집터에 두 집이 서지 않는다
    const [{ n }] = await sql.query<{ n: number }>(
      `select count(*)::int as n from (select district, house_hood, house_lot from public.profiles where house_lot is not null group by 1, 2, 3 having count(*) > 1) d`,
    );
    expect(Number(n)).toBe(0);
    // 마을 집 목록에도 동네 번호가 붙는다
    const houses = (await service.town(null)).houses.filter((h) => h.district === 'ESTJ');
    expect(new Set(houses.map((h) => h.hood))).toEqual(new Set([1, 2, 3]));
    expect(houses.filter((h) => h.hood === 2)).toHaveLength(townConfig.hoodLots);
  });

  it('예전에 집 없이 들어온 주민은 다음 접속 때 빈 집터를 받는다', async () => {
    const v = await user();
    await onboard(v, '집 없던 주민', { district: 'INTJ' });
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
      service.town(v).then((t) => Object.fromEntries(t.houses.filter((h) => h.district !== 'ESTJ' && h.hood === 1).map((h) => [`${h.district}.${h.lot}`, h.name])));

    // 손님: 발견을 끈 큐의 집은 이름이 없다
    expect(await named(null)).toMatchObject({ 'INTJ.1': '파랑', 'ESTP.1': null });
    // 친구가 되면 큐의 집 이름이 보인다
    await service.requestFriend(p, hq);
    await service.acceptFriend(q, hp);
    const forP = await service.town(p);
    expect(forP.houses.find((h) => h.district === 'ESTP' && h.lot === 1)).toMatchObject({ name: '큐', friend: true, handle: hq });
    expect(forP.houses.find((h) => h.district === 'INTJ' && h.lot === 1)).toMatchObject({ name: '파랑', mine: true });
    // 차단하면 서로 이름이 지워지고, 마을에서 숨길 사람 번호가 내려간다
    await service.block(q, hp);
    const afterBlock = await service.town(p);
    expect(afterBlock.houses.find((h) => h.district === 'ESTP' && h.lot === 1)).toMatchObject({ name: null, handle: null, friend: false });
    expect(afterBlock.hidden).toHaveLength(1);
    const tq = await service.townTicket(q);
    expect(afterBlock.hidden).toEqual([tq.pass.pid]);
  });

  it('펫은 계정에 저장되고 입장 토큰에 담긴다 (모습은 그대로, 모르는 펫은 받지 않는다)', async () => {
    const v = await user();
    await onboard(v, '산책이', { district: 'ENFP' });
    const before = (await service.me(v)).profile.avatar;
    expect(before.pet).toBe('');
    expect((await service.townTicket(v)).pass.pet).toBeUndefined();
    const saved = await service.updateProfile(v, { pet: 'dog' });
    expect(saved.avatar).toEqual({ ...before, pet: 'dog' });
    const t = await service.townTicket(v);
    expect(t.pass.pet).toBe('dog');
    expect(verifyTownPass(t.token)?.pet).toBe('dog');
    // 옷장에서 모습을 바꿔도(펫을 같이 보내는 옷장 화면) 펫은 남는다
    await service.updateProfile(v, { avatar: { ...saved.avatar, color: 'navy' } });
    expect((await service.me(v)).profile.avatar).toMatchObject({ color: 'navy', pet: 'dog' });
    await expectError(service.updateProfile(v, { pet: 'dragon' }), 'bad_request');
    await service.updateProfile(v, { pet: '' });
    expect((await service.townTicket(v)).pass.pet).toBeUndefined();
  });

  it('펫 이름: 금지어를 거르고 계정에 저장되며, 모습을 바꿔도 남고 비우면 종류 이름으로 돌아간다', async () => {
    const v = await user();
    await onboard(v, '이름짓기', { district: 'ISFP', avatar: { body: 'female', color: 'sky', accessory: 'none', petNames: { dog: '몰래 지은 이름' } } });
    // 가입 때 보낸 펫 이름은 받지 않는다 (금지어 검사를 거치지 않으므로)
    expect((await service.me(v)).profile.avatar.petNames).toEqual({});
    const named = await service.updateProfile(v, { petNames: { dog: '  몽이 ' } });
    expect(named.avatar).toMatchObject({ body: 'female', color: 'sky', petNames: { dog: '몽이' } });
    expect((await service.townTicket(v)).pass.petNames).toEqual({ dog: '몽이' });
    await expectError(service.updateProfile(v, { petNames: { dog: '멍청이' } }), 'rejected');
    await expectError(service.updateProfile(v, { petNames: { dog: '열한글자가넘는긴이름이에요' } }), 'bad_request');
    await expectError(service.updateProfile(v, { petNames: { dragon: '용용' } }), 'bad_request');
    // 옷장에서 모습을 바꿀 때 보낸 펫 이름은 무시한다 (이름은 petNames로만)
    await service.updateProfile(v, { avatar: { ...named.avatar, color: 'navy', petNames: { dog: '바보' } } });
    expect((await service.me(v)).profile.avatar).toMatchObject({ color: 'navy', petNames: { dog: '몽이' } });
    await service.updateProfile(v, { petNames: { dog: '' } });
    expect((await service.me(v)).profile.avatar.petNames).toEqual({});
  });

  it('피부색·머리 색은 언제든 바꾸고 입장 토큰에 담기지만, 남자·여자는 가입 뒤에 바꿀 수 없다', async () => {
    const v = await user();
    await onboard(v, '머리바꿈', { district: 'INFJ', avatar: { body: 'female', color: 'sky', skin: 'tan', hair: 'pink', accessory: 'none' } });
    const first = (await service.me(v)).profile.avatar;
    expect(first).toMatchObject({ body: 'female', skin: 'tan', hair: 'pink' });
    expect((await service.townTicket(v)).pass).toMatchObject({ body: 'female', skin: 'tan', hair: 'pink' });
    // 몸을 바꿔 보내도 그대로, 피부색·머리 색은 바뀐다. 모르는 값은 원래 색으로
    const next = await service.updateProfile(v, { avatar: { ...first, body: 'male', skin: 'deep', hair: 'silver' } });
    expect(next.avatar).toMatchObject({ body: 'female', skin: 'deep', hair: 'silver' });
    expect(verifyTownPass((await service.townTicket(v)).token)).toMatchObject({ body: 'female', skin: 'deep', hair: 'silver' });
    expect((await service.updateProfile(v, { avatar: { ...next.avatar, skin: 'green', hair: 42 } })).avatar).toMatchObject({ skin: 'natural', hair: 'natural' });
    // 성별을 따로 바꾸려 해도 안 된다 (가입할 때 정했다)
    expect(next.avatar.bodyFixed).toBe(true);
    await expectError(service.updateProfile(v, { body: 'male' }), 'bad_request');
    expect((await service.me(v)).profile.avatar.body).toBe('female');
  });

  it('성별을 정하지 않은 예전 계정은 한 번만 정할 수 있다 (옷장 저장으로는 안 바뀐다)', async () => {
    const v = await user();
    await onboard(v, '예전주민', { district: 'ESFJ' });
    // 여자 캐릭터가 생기기 전 가입: 성별 표시 없이 남자로 저장돼 있다
    await sql.query(`update public.profiles set avatar = $2 where id = $1`, [v.id, JSON.stringify({ body: 'male', color: 'mint', accessory: 'none' })]);
    const before = (await service.me(v)).profile.avatar;
    expect(before.bodyFixed).toBeUndefined();
    // 옷장 저장(성별 없이)은 성별을 바꾸지도, 정하지도 않는다
    const dressed = await service.updateProfile(v, { avatar: { ...before, body: 'female', hair: 'black' } });
    expect(dressed.avatar).toMatchObject({ body: 'male', hair: 'black' });
    expect(dressed.avatar.bodyFixed).toBeUndefined();
    await expectError(service.updateProfile(v, { body: 'robot' }), 'bad_request');
    const fixed = await service.updateProfile(v, { avatar: { ...dressed.avatar, skin: 'tan' }, body: 'female' });
    expect(fixed.avatar).toMatchObject({ body: 'female', skin: 'tan', hair: 'black', bodyFixed: true });
    expect((await service.townTicket(v)).pass.body).toBe('female');
    await expectError(service.updateProfile(v, { body: 'male' }), 'bad_request');
  });

  it('입장 토큰: 가입한 사람은 이름·집터를, 아니면 손님으로 담는다', async () => {
    const tp = await service.townTicket(p);
    expect(tp.guest).toBe(false);
    expect(verifyTownPass(tp.token)).toMatchObject({ name: '파랑', district: 'INTJ', hood: 1, lot: 1, color: 'sky', acc: 'cap' });
    // 이름표 둘째 줄: MBTI (= 사는 마을)
    expect(tp.pass.mbti).toBe('INTJ');
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

  it('집 안 입장 토큰: 방을 볼 수 있는 사람만 받고, 주인과 손님이 같은 집 번호를 받는다', async () => {
    const hp = (await service.me(p)).profile.handle;
    const own = await service.houseTicket(p, hp);
    expect(own.house).toBe(own.pass.pid);
    expect(verifyTownPass(own.token)?.house).toBe(own.house);
    const guest = await service.houseTicket(null, hp);
    expect(guest).toMatchObject({ house: own.house, guest: true });
    // 마을 토큰에는 집 번호가 없다
    expect(verifyTownPass((await service.townTicket(p)).token)?.house).toBeUndefined();
    // 차단 관계면 집을 찾을 수 없다
    await expectError(service.houseTicket(q, hp), 'not_found');
    // 나만 보기면 주인만 들어간다
    await service.updateProfile(p, { roomVisibility: 'private' });
    await expectError(service.houseTicket(null, hp), 'forbidden');
    expect((await service.houseTicket(p, hp)).house).toBe(own.house);
    await service.updateProfile(p, { roomVisibility: 'public' });
  });
});

describe('사는 마을 = MBTI', () => {
  it('가입 때 고른 MBTI는 한 번 바로 고칠 수 있고, 그 뒤로는 일주일에 한 번 바꾸며 그때마다 이사한다', async () => {
    const v = await user();
    const joined = await onboard(v, '처음', { mbti: 'INFP' });
    expect(joined).toMatchObject({ mbti: 'INFP', district: 'INFP', mbtiChangeableAt: null });
    // 처음 한 번은 바로 (테스트 결과가 마음에 안 들 때)
    const moved = await service.changeMbti(v, 'ENFP');
    expect(moved).toMatchObject({ mbti: 'ENFP', district: 'ENFP', houseHood: 1 });
    expect(moved.mbtiChangeableAt).not.toBeNull();
    await expectError(service.changeMbti(v, 'ISTJ'), 'conflict');
    // 같은 MBTI는 괜찮다
    await service.changeMbti(v, 'ENFP');
    await expectError(service.changeMbti(v, 'XXXX'), 'bad_request');
    // 일주일 뒤에는 다시 바꾼다
    const later = new SceneService(new SceneStore(sql), () => new Date(now.getTime() + (debateConfig.mbtiChangeCooldownDays + 1) * 86_400_000));
    expect(await later.changeMbti(v, 'ISTJ')).toMatchObject({ mbti: 'ISTJ', district: 'ISTJ' });
    await expectError(service.changeMbti(null, 'ISTJ'), 'login_required');
  });

  it('예전 주민: MBTI가 있으면 다음 접속 때 그 마을에 집이 서고, 없으면 MBTI를 정할 때까지 손님처럼 들어온다', async () => {
    // 마이그레이션 뒤 모습: 집터가 비고, MBTI가 있으면 사는 마을 = MBTI
    const withMbti = await user();
    await onboard(withMbti, '예전 주민', { mbti: 'ESFJ' });
    await sql.query(`update public.profiles set district = null, house_lot = null where id = $1`, [withMbti.id]);
    const me = (await service.me(withMbti)).profile;
    expect(me).toMatchObject({ district: 'ESFJ', houseHood: 1 });
    expect(me.houseLot).not.toBeNull();

    const noMbti = await user();
    await onboard(noMbti, 'MBTI 없던 주민', { mbti: 'ESFP' });
    await sql.query(`update public.profiles set district = null, house_lot = null, mbti = null where id = $1`, [noMbti.id]);
    expect((await service.townTicket(noMbti)).guest).toBe(true);
    expect((await service.me(noMbti)).profile).toMatchObject({ onboarded: true, mbti: null, district: null, houseLot: null });
    // 정하면 바로 그 마을로 (처음 정한 것은 대기 시간을 세지 않는다)
    expect(await service.changeMbti(noMbti, 'ESFP')).toMatchObject({ mbti: 'ESFP', district: 'ESFP', mbtiChangeableAt: null });
    expect((await service.townTicket(noMbti)).pass).toMatchObject({ district: 'ESFP', mbti: 'ESFP' });
  });
});

describe('놀거리: 열매·운세 열매·낚시', () => {
  it('열매 나무는 하루 한 번, 운세 나무는 그날 같은 운세', async () => {
    const v = await user();
    await onboard(v, '열매꾼');
    const first = await service.pickTree(v, 'fruit.INFP.0');
    expect(first).toMatchObject({ already: false, fruit: { id: 'apple', name: '사과' }, added: playConfig.fruitsPerTree, count: playConfig.fruitsPerTree });
    const again = await service.pickTree(v, 'fruit.INFP.0');
    expect(again).toMatchObject({ already: true, added: 0, count: playConfig.fruitsPerTree });
    // 다른 나무는 또 딸 수 있다
    expect((await service.pickTree(v, 'fruit.ISFJ.0')).fruit.name).toBe('포도');
    const luck = await service.pickTree(v, 'fortune');
    expect(luck.fortune?.line.length).toBeGreaterThan(5);
    expect((await service.pickTree(v, 'fortune')).fortune).toEqual(luck.fortune);
    await expectError(service.pickTree(v, 'fruit.moon.0'), 'bad_request');
    await expectError(service.pickTree(v, `fruit.INFP.${playConfig.fruitTreesPerDistrict}`), 'bad_request');
    await expectError(service.pickTree(null, 'fortune'), 'login_required');
    const state = await service.playState(v);
    expect(state.pickedTrees.sort()).toEqual(['fortune', 'fruit.INFP.0', 'fruit.ISFJ.0']);
    expect(state.fruits).toMatchObject({ apple: playConfig.fruitsPerTree, fortune: 1 });
  });

  it('낚시: 가끔은 꽝, 잡은 것은 도감에 쌓이고, 넉넉한 하루 상한을 넘으면 쉰다', async () => {
    const v = await user();
    await onboard(v, '낚시꾼');
    let total = 0;
    let misses = 0;
    for (let i = 0; i < playConfig.fishPerDay; i++) {
      const r = await service.castLine(v);
      expect(r.left).toBe(playConfig.fishPerDay - i - 1);
      if (r.fish) total++;
      else {
        misses++;
        expect(r).toMatchObject({ size: 0, count: 0 });
      }
    }
    // 300번이면 꽝이 한 번도 없을 수는 없다 (확률 0.22)
    expect(misses).toBeGreaterThan(0);
    await expectError(service.castLine(v), 'conflict');
    const state = await service.playState(v);
    expect(state.fishLeft).toBe(0);
    expect(Object.values(state.fish).reduce((a, b) => a + b, 0)).toBe(total);
  }, 60_000);

  it('황금 고래를 낚으면 낚은 사람 이름으로 서버 전체에 공지한다', async () => {
    const heard: Announcement[] = [];
    const loud = new SceneService(new SceneStore(sql), () => now, async (a) => (heard.push(a), true));
    const v = await user();
    await onboard(v, '고래잡이');
    // 난수가 모두 0이면 황금 고래 (던질 때마다 0.001%)
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const r = await loud.castLine(v);
      expect(r).toMatchObject({ fish: { id: 'golden_whale', rarity: 'mythic' }, count: 1, announced: true });
      expect(r.size).toBeGreaterThanOrEqual(800);
    } finally {
      spy.mockRestore();
    }
    expect(heard).toEqual([{ kind: 'golden_whale', name: '고래잡이' }]);
    expect((await loud.playState(v)).fish).toMatchObject({ golden_whale: 1 });
    // 실시간 서버에 못 보내도 낚시는 된다
    const quiet = new SceneService(new SceneStore(sql), () => now, async () => {
      throw new Error('실시간 서버가 잠들었어요');
    });
    const spy2 = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      expect(await quiet.castLine(v)).toMatchObject({ fish: { id: 'golden_whale' }, count: 2, announced: false });
    } finally {
      spy2.mockRestore();
    }
  });
});

describe('주민증', () => {
  it('가입하면 가입한 날과 취미가 담기고, 취미는 MY에서 고친다 (거친 말은 안 된다)', async () => {
    const v = await user();
    const me = await onboard(v, '주민증', { hobby: '  필름 카메라  ' });
    expect(me.hobby).toBe('필름 카메라');
    expect(me.joinedAt).toBe('2026-11-02');
    expect((await service.updateProfile(v, { hobby: '뜨개질' })).hobby).toBe('뜨개질');
    await expectError(service.updateProfile(v, { hobby: '가'.repeat(31) }), 'bad_request');
    await expectError(service.updateProfile(v, { hobby: 'https://spam.example' }), 'rejected');
    expect((await service.updateProfile(v, { hobby: '' })).hobby).toBe('');
  });
});

describe('운영자', () => {
  let admin: Viewer, owner: Viewer, other: Viewer;
  let ho: string;

  it('운영자가 아니면 운영 화면을 볼 수 없다', async () => {
    admin = await user();
    owner = await user();
    other = await user();
    await onboard(admin, '운영자');
    ho = (await onboard(owner, '비밀방')).handle;
    await onboard(other, '이웃');
    // 운영자가 아니면 운영 기능이 없는 것처럼 보인다
    await expectError(service.adminOverview(other), 'not_found');
    await expectError(service.adminReports(null), 'not_found');
    await expectError(service.adminUsers(other, ''), 'not_found');
    expect(await service.isAdminViewer(other)).toBe(false);
    expect((await service.me(admin)).profile.admin).toBe(false);
    await sql.query(`insert into public.admins (user_id) values ($1)`, [admin.id]);
    expect((await service.me(admin)).profile.admin).toBe(true);
    expect(await service.isAdminViewer(admin)).toBe(true);
  });

  it('운영자는 나만 보기 방과 기록, 차단 관계와 상관없이 본다 (방문 기록은 남기지 않는다)', async () => {
    await service.createRecord(owner, { kind: 'memo', body: '나만 보는 메모' });
    await service.updateProfile(owner, { roomVisibility: 'private' });
    expect((await service.roomView(other, ho)).room).toBeNull();
    const seen = await service.roomView(admin, ho);
    expect(seen.room).not.toBeNull();
    expect(seen.records.map((r) => r.body)).toContain('나만 보는 메모');
    await service.block(owner, (await service.me(admin)).profile.handle);
    expect((await service.roomView(admin, ho)).room).not.toBeNull();
    await expect(service.houseTicket(admin, ho)).resolves.toBeTruthy();
    expect((await service.roomView(owner, ho)).visitors ?? []).toHaveLength(0);
    await service.unblock(owner, (await service.me(admin)).profile.handle);
    await service.updateProfile(owner, { roomVisibility: 'public' });
  });

  it('신고를 보고, 신고된 방명록을 지우거나 문제없음으로 닫는다', async () => {
    // 앞 테스트가 남긴 신고가 있으니 늘어난 수만 본다
    const base = (await service.adminOverview(admin)).open_reports;
    await service.writeGuestbook(other, ho, { body: '신고될 글이에요' });
    const g = (await service.roomView(owner, ho)).guestbook.find((x) => x.body === '신고될 글이에요')!;
    await service.report(owner, { kind: 'guestbook', targetId: g.id, reason: '불편해요' });
    await service.report(owner, { kind: 'user', targetId: (await service.me(other)).profile.handle });
    const reports = await service.adminReports(admin);
    const rg = reports.find((r) => r.preview === '신고될 글이에요')!;
    expect(rg).toMatchObject({ preview: '신고될 글이에요', roomHandle: ho, resolved: null, reason: '불편해요' });
    expect((await service.adminOverview(admin)).open_reports).toBe(base + 2);
    await expectError(service.adminResolveReport(other, rg.id, 'remove'), 'not_found');
    await service.adminResolveReport(admin, rg.id, 'remove');
    expect((await service.roomView(owner, ho)).guestbook.some((x) => x.id === g.id)).toBe(false);
    const ru = (await service.adminReports(admin)).find((r) => r.kind === 'user' && r.preview === '이웃' && !r.resolved)!;
    await expectError(service.adminResolveReport(admin, ru.id, 'remove'), 'bad_request');
    await service.adminResolveReport(admin, ru.id, 'dismiss');
    expect((await service.adminOverview(admin)).open_reports).toBe(base);
    expect((await service.adminReports(admin)).find((r) => r.id === rg.id)?.resolved).toBe('removed');
  });

  it('운영자는 아무 방명록이나 지울 수 있다', async () => {
    await service.writeGuestbook(other, ho, { body: '지워질 글' });
    const g = (await service.roomView(admin, ho)).guestbook.find((x) => x.body === '지워질 글')!;
    expect(g.canDelete).toBe(true);
    await service.deleteGuestbook(admin, g.id);
    expect((await service.roomView(owner, ho)).guestbook.some((x) => x.id === g.id)).toBe(false);
  });

  it('주민을 찾고 계정을 지운다 (운영자 계정은 못 지운다)', async () => {
    const found = await service.adminUsers(admin, '비밀');
    expect(found.map((u) => u.displayName)).toEqual(['비밀방']);
    expect((await service.adminUsers(admin, '')).length).toBeGreaterThanOrEqual(3);
    expect((await service.adminUsers(admin, '%')).length).toBe(0);
    await expectError(service.adminDeleteUser(admin, admin.id), 'forbidden');
    await expectError(service.adminDeleteUser(other, found[0].id), 'not_found');
    await service.adminDeleteUser(admin, found[0].id);
    await expectError(service.roomView(admin, ho), 'not_found');
  });

  it('운영자는 주민마다 코인을 보고, 주거나 뺀다 (0 밑으로는 안 내려간다)', async () => {
    const u = (await service.adminUsers(admin, '이웃')).find((x) => x.id === other.id)!;
    expect(u).toMatchObject({ coins: 0 });
    await expectError(service.adminAdjustWallet(other, u.id, { coins: 100 }), 'not_found');
    await expectError(service.adminAdjustWallet(admin, u.id, {}), 'bad_request');
    await expectError(service.adminAdjustWallet(admin, u.id, { coins: 1.5 }), 'bad_request');
    await expectError(service.adminAdjustWallet(admin, u.id, { coins: 2_000_000 }), 'bad_request');
    await expectError(service.adminAdjustWallet(admin, '00000000-0000-0000-0000-000000000000', { coins: 10 }), 'not_found');
    await expectError(service.adminAdjustWallet(admin, 'nope', { coins: 10 }), 'not_found');
    expect(await service.adminAdjustWallet(admin, u.id, { coins: 1500 })).toEqual({ coins: 1500 });
    expect(await service.adminAdjustWallet(admin, u.id, { coins: -500 })).toEqual({ coins: 1000 });
    expect(await service.adminAdjustWallet(admin, u.id, { coins: -99_999 })).toEqual({ coins: 0 });
    expect((await service.playState(other)).coins).toBe(0);
    expect((await service.adminUsers(admin, '이웃')).find((x) => x.id === other.id)).toMatchObject({ coins: 0 });
  });

  it('운영자 공지: 운영자만, 내용이 있어야 하고, 실시간 서버에 못 보내면 알려 준다', async () => {
    const heard: Announcement[] = [];
    const loud = new SceneService(new SceneStore(sql), () => now, async (a) => (heard.push(a), true));
    await expectError(loud.adminNotice(other, '몰래 공지'), 'not_found');
    await expectError(loud.adminNotice(null, '몰래 공지'), 'not_found');
    await expectError(loud.adminNotice(admin, '   '), 'bad_request');
    expect(await loud.adminNotice(admin, '  오늘 밤   광장에서 만나요! ')).toEqual({ sent: true });
    expect(heard).toEqual([{ kind: 'notice', text: '오늘 밤 광장에서 만나요!' }]);
    // 기본 service는 실시간 서버가 없다 (보내지 못함)
    await expectError(service.adminNotice(admin, '안녕하세요'), 'conflict');
  });
});

describe('코인과 상가', () => {
  const setCoins = (v: Viewer, n: number) => sql.query(`update public.profiles set coins = $2 where id = $1`, [v.id, n]);

  it('열매·낚시로 코인을 모은다 (같은 나무를 또 따면 0)', async () => {
    const v = await user();
    await onboard(v, '코인꾼');
    expect((await service.playState(v)).coins).toBe(0);
    expect((await service.pickTree(v, 'fruit.ESTJ.0')).earned).toBe(coinConfig.fruit * playConfig.fruitsPerTree);
    expect((await service.pickTree(v, 'fruit.ESTJ.0')).earned).toBe(0);
    expect((await service.pickTree(v, 'fortune')).earned).toBe(coinConfig.fortune);
    let fromFish = 0;
    for (let i = 0; i < 20; i++) {
      const r = await service.castLine(v);
      expect(r.earned).toBe(r.fish ? coinConfig.fish[r.fish.rarity] : 0);
      fromFish += r.earned;
    }
    expect((await service.playState(v)).coins).toBe(coinConfig.fruit * playConfig.fruitsPerTree + coinConfig.fortune + fromFish);
  });

  it('빈 점포를 코인으로 사고, 한 사람에 한 칸, 코인이 모자라면 못 산다', async () => {
    const a = await user();
    const b = await user();
    await onboard(a, '사장님');
    await onboard(b, '이웃사장');
    await expectError(service.buyShop(null, { slot: 0, name: '가게' }), 'login_required');
    await setCoins(a, marketConfig.price - 1);
    await expectError(service.buyShop(a, { slot: 0, name: '가게' }), 'conflict');
    expect((await service.playState(a)).coins).toBe(marketConfig.price - 1);
    await setCoins(a, marketConfig.price + 100);
    await expectError(service.buyShop(a, { slot: marketConfig.shops, name: '가게' }), 'bad_request');
    await expectError(service.buyShop(a, { slot: 0, name: '' }), 'bad_request');
    await expectError(service.buyShop(a, { slot: 0, name: '가게', color: 'neon' }), 'bad_request');
    await expectError(service.buyShop(a, { slot: 0, name: 'http://x.kr' }), 'rejected');
    const view = await service.buyShop(a, { slot: 3, name: '  붕어빵   가게 ', intro: '따끈따끈', color: 'coral' });
    expect(view).toMatchObject({ myShop: 3, coins: 100, price: marketConfig.price });
    expect(view.shops).toEqual([{ slot: 3, name: '붕어빵 가게', intro: '따끈따끈', color: 'coral', owner: { displayName: '사장님', handle: expect.any(String) }, mine: true }]);
    // 한 사람에 한 칸
    await setCoins(a, marketConfig.price);
    await expectError(service.buyShop(a, { slot: 4, name: '두 번째' }), 'conflict');
    // 남의 점포는 못 산다
    await setCoins(b, marketConfig.price);
    await expectError(service.buyShop(b, { slot: 3, name: '뺏기' }), 'conflict');
    expect((await service.playState(b)).coins).toBe(marketConfig.price);
    // 손님도 볼 수 있다 (코인 없음)
    const guest = await service.marketView(null);
    expect(guest).toMatchObject({ coins: null, myShop: null, admin: false });
    expect(guest.shops.find((s) => s.slot === 3)).toMatchObject({ name: '붕어빵 가게', mine: false });
  });

  it('내 점포 이름·색 바꾸기, 내놓으면 절반을 돌려받는다', async () => {
    const a = await user();
    const b = await user();
    await onboard(a, '주인');
    await onboard(b, '구경꾼');
    await setCoins(a, marketConfig.price);
    await service.buyShop(a, { slot: 7, name: '꽃집' });
    await expectError(service.updateShop(b, { name: '내꺼' }), 'not_found');
    const v = await service.updateShop(a, { name: '꽃과 차', intro: '향긋해요', color: 'lavender' });
    expect(v.shops.find((s) => s.slot === 7)).toMatchObject({ name: '꽃과 차', intro: '향긋해요', color: 'lavender', mine: true });
    await expectError(service.releaseShop(b, 7), 'forbidden');
    await expectError(service.releaseShop(a, 8), 'not_found');
    const after = await service.releaseShop(a, '7');
    expect(after).toMatchObject({ myShop: null, coins: refundFor() });
    expect(after.shops.some((s) => s.slot === 7)).toBe(false);
  });

  it('운영자는 남의 점포를 비울 수 있고, 주인은 절반을 돌려받는다', async () => {
    const admin = await user();
    const owner = await user();
    await onboard(admin, '관리');
    await onboard(owner, '문제가게');
    await sql.query(`insert into public.admins (user_id) values ($1)`, [admin.id]);
    await setCoins(owner, marketConfig.price);
    await service.buyShop(owner, { slot: 12, name: '이상한 이름' });
    expect((await service.marketView(admin)).admin).toBe(true);
    await service.releaseShop(admin, 12);
    expect((await service.marketView(owner)).myShop).toBeNull();
    expect((await service.playState(owner)).coins).toBe(refundFor());
  });
});

describe('MBTI 마을 대항전', () => {
  const kst = (s: string) => new Date(`${s}+09:00`);
  /** 테스트마다 다른 주를 쓴다 (다른 테스트의 점수와 섞이지 않게) */
  const at = (iso: string, heard: Announcement[] = []) =>
    new SceneService(new SceneStore(sql), () => kst(iso), async (a) => (heard.push(a), true));

  it('놀이로 내 마을 점수가 쌓인다: 열매·출석·낚시·상가 (나무마다 하루 한 번, 출석은 하루 한 번)', async () => {
    const s = at('2027-01-05T10:00:00');
    const v = await user();
    await onboard(v, '대항전열매', { district: 'ESTP' });
    const pick = await s.pickTree(v, 'fruit.INFP.0');
    expect(pick.contest).toBe(contestConfig.points.fruit);
    expect((await s.pickTree(v, 'fruit.INFP.0')).contest).toBe(0);
    expect((await s.pickTree(v, 'fortune')).contest).toBe(contestConfig.points.fortune);
    await s.townTicket(v);
    await s.townTicket(v);
    // 잡은 물고기는 희귀도만큼 (꽝·잡동사니는 0)
    let caught = 0;
    for (let i = 0; i < 30 && caught < 3; i++) {
      const r = await s.castLine(v);
      if (r.fish) {
        caught++;
        expect(r.contest).toBeLessThanOrEqual(contestConfig.points.fish[r.fish.rarity]);
      }
    }
    const view = await s.contestView(v);
    expect(view.me?.district).toBe('ESTP');
    expect(view.me?.today.fruit).toBe(contestConfig.points.fruit + contestConfig.points.fortune);
    expect(view.me?.today.checkin).toBe(contestConfig.points.checkin);
    const fire = view.standings.districts.find((d) => d.district === 'ESTP')!;
    expect(fire.people).toBe(1);
    expect(fire.score).toBe(view.me!.week);
    expect(view.standings.week).toBe('2027-01-04');
    // 손님은 순위만 본다
    expect((await s.contestView(null)).me).toBeNull();
  });

  it('종류마다 하루 상한까지만 쌓이고, 다음 날에는 다시 쌓인다', async () => {
    const v = await user();
    await onboard(v, '대항전상한', { district: 'ESTJ' });
    const store = new SceneStore(sql);
    const day1 = kst('2027-02-02T10:00:00');
    let added = 0;
    for (let i = 0; i < 12; i++) added += await store.addContestPoints(v.id, 'ESTJ', 'fish', 3, day1);
    expect(added).toBe(contestConfig.dailyCap.fish);
    expect(await store.addContestPoints(v.id, 'ESTJ', 'fish', 3, day1)).toBe(0);
    expect(await store.addContestPoints(v.id, 'ESTJ', 'fish', 3, kst('2027-02-03T10:00:00'))).toBe(3);
    // 마을이 없거나 0점이면 쌓지 않는다
    expect(await store.addContestPoints(v.id, null, 'fish', 3, day1)).toBe(0);
    expect(await store.addContestPoints(v.id, 'ESTJ', 'fish', 0, day1)).toBe(0);
    const s = await store.contestStandings(day1);
    expect(s.districts.find((d) => d.district === 'ESTJ')).toMatchObject({ score: contestConfig.dailyCap.fish + 3, people: 1 });
  });

  it('일요일 21시 뒤 처음 한 번만 지난주 결과를 정하고 우승 마을을 발표한다 (늦으면 조용히 정한다)', async () => {
    const store = new SceneStore(sql);
    const a = await user();
    const b = await user();
    await onboard(a, '대항전숲', { district: 'INFP' });
    await onboard(b, '대항전호수', { district: 'ISFJ' });
    await store.addContestPoints(a.id, 'INFP', 'fish', 20, kst('2027-03-03T10:00:00'));
    await store.addContestPoints(b.id, 'ISFJ', 'fish', 5, kst('2027-03-04T10:00:00'));
    // 발표 전에는 정하지 않는다 (지난주는 비어 있어 우승 없이 정해진다)
    const heard: Announcement[] = [];
    const before = at('2027-03-07T20:30:00', heard);
    expect((await before.contestBoard()).standings.districts[0]).toMatchObject({ district: 'INFP', score: 20 });
    const quiet = await before.settleContest();
    expect(quiet?.winner).toBeNull();
    expect(heard).toEqual([]);
    // 21시 뒤: 숲 우승을 한 번만 발표한다
    const after = at('2027-03-07T21:10:00', heard);
    expect(await after.settleContest()).toEqual({ week: '2027-03-01', winner: 'INFP', announced: true });
    expect(heard).toEqual([{ kind: 'contest', district: 'INFP' }]);
    expect(await at('2027-03-07T21:20:00', heard).settleContest()).toBeNull();
    expect(heard).toHaveLength(1);
    // 정해 둔 결과는 그 뒤에 점수가 바뀌어도 그대로
    await store.addContestPoints(b.id, 'ISFJ', 'fish', 30, kst('2027-03-05T10:00:00'));
    const board = await at('2027-03-08T09:00:00').contestBoard();
    expect(board.last).toMatchObject({ week: '2027-03-01', winner: 'INFP' });
    expect(board.standings.week).toBe('2027-03-08');
    // 오래 아무도 오지 않다가 늦게 정해지면 발표하지 않는다
    await store.addContestPoints(a.id, 'INFP', 'fish', 10, kst('2027-03-10T10:00:00'));
    const late = await at('2027-03-16T12:00:00', heard).settleContest();
    expect(late).toMatchObject({ week: '2027-03-08', winner: 'INFP', announced: false });
    expect(heard).toHaveLength(1);
  });
});

describe('클럽 유튜브 신청 제한 (운영자)', () => {
  it('운영자만 켜고 끄고, 영상·채널을 막고 푼다. 막은 것은 신청 확인에 쓰인다', async () => {
    const admin = await user();
    const other = await user();
    await onboard(admin, '유튜브운영자');
    await onboard(other, '유튜브주민');
    await sql.query(`insert into public.admins (user_id) values ($1) on conflict do nothing`, [admin.id]);
    const resolve = async (id: string) => ({ title: `제목 ${id}`, channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', channelTitle: '채널 이름' });
    await expectError(service.adminYoutube(other), 'not_found');
    await expectError(service.adminYoutubeUpdate(other, { on: false }, resolve), 'not_found');
    expect(await service.adminYoutube(admin)).toEqual({ on: true, blocks: [] });
    expect((await service.adminYoutubeUpdate(admin, { on: false }, resolve)).on).toBe(false);
    expect(await service.youtubeLimits().on()).toBe(false);
    await service.adminYoutubeUpdate(admin, { on: true }, resolve);
    // 영상 링크로 영상 막기, 같은 영상의 채널 막기, 채널 주소로 바로 막기
    await service.adminYoutubeUpdate(admin, { block: { url: 'https://youtu.be/dQw4w9WgXcQ', scope: 'video' } }, resolve);
    await service.adminYoutubeUpdate(admin, { block: { url: 'https://youtu.be/9bZkp7q19f0', scope: 'channel' } }, resolve);
    const v = await service.adminYoutubeUpdate(admin, { block: { url: 'https://www.youtube.com/channel/UCbbbbbbbbbbbbbbbbbbbbbb', scope: 'video' } }, resolve);
    expect(v.blocks.map((b) => [b.kind, b.id, b.label]).sort()).toEqual(
      [['channel', 'UCaaaaaaaaaaaaaaaaaaaaaa', '채널 이름'], ['channel', 'UCbbbbbbbbbbbbbbbbbbbbbb', 'UCbbbbbbbbbbbbbbbbbbbbbb'], ['video', 'dQw4w9WgXcQ', '제목 dQw4w9WgXcQ']].sort(),
    );
    const limits = service.youtubeLimits();
    expect(await limits.blocked('dQw4w9WgXcQ', null)).toBe('video');
    expect(await limits.blocked('xxxxxxxxxxx', 'UCaaaaaaaaaaaaaaaaaaaaaa')).toBe('channel');
    expect(await limits.blocked('xxxxxxxxxxx', 'UCzzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
    await expectError(service.adminYoutubeUpdate(admin, { block: { url: '아무 글', scope: 'video' } }, resolve), 'bad_request');
    const after = await service.adminYoutubeUpdate(admin, { unblock: { kind: 'video', id: 'dQw4w9WgXcQ' } }, resolve);
    expect(after.blocks.some((b) => b.kind === 'video')).toBe(false);
    expect(await limits.blocked('dQw4w9WgXcQ', null)).toBeNull();
  });

  it('운영자 마을 토큰에는 운영자 표시가, 주민 토큰에는 없다', async () => {
    const admin = await user();
    const other = await user();
    await onboard(admin, '토큰운영자');
    await onboard(other, '토큰주민');
    await sql.query(`insert into public.admins (user_id) values ($1) on conflict do nothing`, [admin.id]);
    expect(verifyTownPass((await service.townTicket(admin)).token)?.admin).toBe(true);
    expect(verifyTownPass((await service.townTicket(other)).token)?.admin).toBeUndefined();
  });
});


describe('가입 도움 (운영자)', () => {
  async function account(email: string, confirmed: boolean): Promise<Viewer> {
    const id = randomUUID();
    await sql.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [id, email, confirmed ? now : null]);
    return { id };
  }

  it('메일 인증 전 계정을 찾아 인증 처리하고, 주민 등록 전 계정만 지운다', async () => {
    const admin = await user();
    await sql.query(`insert into public.admins (user_id) values ($1) on conflict do nothing`, [admin.id]);
    const stuck = await account('Stuck.Person@naver.com', false);
    const joined = await account('joined-only@example.com', true);
    const resident = await account('resident-help@example.com', true);
    await onboard(resident, '가입도움주민');

    // 운영자가 아니면 없는 것처럼
    await expectError(service.adminSignups(stuck, ''), 'not_found');
    await expectError(service.adminConfirmSignup(stuck, stuck.id), 'not_found');

    const all = await service.adminSignups(admin, '');
    expect(all.pending).toBeGreaterThanOrEqual(1);
    const found = await service.adminSignups(admin, 'stuck.person');
    expect(found.accounts.map((a) => [a.email, a.state])).toEqual([['Stuck.Person@naver.com', 'pending']]);
    expect((await service.adminSignups(admin, 'resident-help')).accounts[0]).toMatchObject({ state: 'resident', displayName: '가입도움주민' });
    expect((await service.adminSignups(admin, 'joined-only')).accounts[0].state).toBe('joined');
    // %·_는 글자 그대로 찾는다
    expect((await service.adminSignups(admin, '%')).accounts).toEqual([]);

    const done = await service.adminConfirmSignup(admin, stuck.id);
    expect(done.state).toBe('joined');
    expect(done.confirmedAt).toBe(now.toISOString());
    // 이미 인증한 계정은 그대로
    expect((await service.adminConfirmSignup(admin, stuck.id)).confirmedAt).toBe(now.toISOString());
    await expectError(service.adminConfirmSignup(admin, randomUUID()), 'not_found');

    await expectError(service.adminDeleteSignup(admin, resident.id), 'forbidden');
    await expectError(service.adminDeleteSignup(admin, admin.id), 'not_found'); // 이메일 없는 계정은 가입 도움 대상이 아니다
    await service.adminDeleteSignup(admin, joined.id);
    expect((await service.adminSignups(admin, 'joined-only')).accounts).toEqual([]);
  });

  it('막힌 가입·로그인을 모으고, 같은 주소·오류는 한 줄로 합친다', async () => {
    const admin = await user();
    await sql.query(`insert into public.admins (user_id) values ($1) on conflict do nothing`, [admin.id]);
    await service.adminClearSignupFailures(admin);
    await service.reportSignupFailure({ email: ' Blocked@Naver.com ', code: 'email_address_not_authorized', step: 'signup' });
    await service.reportSignupFailure({ email: 'blocked@naver.com', code: 'email_address_not_authorized', step: 'signup' });
    await service.reportSignupFailure({ email: 'other@example.com', code: 'email_not_confirmed', step: 'login' });
    // 이상한 값은 버리거나 다듬는다
    await service.reportSignupFailure({ email: '이메일 아님', code: 'x' });
    await service.reportSignupFailure({ email: 'odd@example.com', code: '<script>', step: 'hack' });
    const { failures } = await service.adminSignups(admin, '');
    expect(failures.map((f) => [f.email, f.code, f.step, f.count])).toEqual([
      ['odd@example.com', 'unknown', 'signup', 1],
      ['other@example.com', 'email_not_confirmed', 'login', 1],
      ['blocked@naver.com', 'email_address_not_authorized', 'signup', 2],
    ]);
    for (let i = 0; i < 50; i++) await service.reportSignupFailure({ email: `many${i}@example.com`, code: 'over_email_send_rate_limit' });
    expect((await service.adminSignups(admin, '')).failures).toHaveLength(40);
    await expectError(service.adminClearSignupFailures({ id: randomUUID() }), 'not_found');
    await service.adminClearSignupFailures(admin);
    expect((await service.adminSignups(admin, '')).failures).toEqual([]);
  });
});

describe('오래된 기록 정리 (매일 예약 작업)', () => {
  it('지난 열매·낚시 하루 기록, 오래된 방문, 3주 지난 대항전 점수만 지운다', async () => {
    const v = await user();
    const other = await user();
    await onboard(v, '정리주민', { district: 'INTP' });
    await onboard(other, '정리손님', { district: 'INTP' });
    // now = 2026-11-02 (테스트 시계)
    await sql.query(`insert into public.daily_picks (user_id, day, spot) values ($1, '2026-10-20', 'tree:old'), ($1, '2026-11-02', 'tree:new')`, [v.id]);
    await sql.query(`insert into public.visits (owner_id, visitor_id, visited_on) values ($1, $2, '2026-09-01'), ($1, $2, '2026-11-01')`, [v.id, other.id]);
    await sql.query(
      `insert into public.contest_points (week, day, user_id, district, kind, points) values ('2026-10-05', '2026-10-06', $1, 'INTP', 'fish', 3), ('2026-10-26', '2026-10-27', $1, 'INTP', 'fish', 3)`,
      [v.id],
    );
    const done = await service.cleanup();
    expect(done.dailyPicks).toBeGreaterThanOrEqual(1);
    expect((await sql.query(`select spot from public.daily_picks where user_id = $1`, [v.id])).map((r) => r.spot)).toEqual(['tree:new']);
    expect((await sql.query(`select to_char(visited_on, 'YYYY-MM-DD') as d from public.visits where owner_id = $1`, [v.id])).map((r) => r.d)).toEqual(['2026-11-01']);
    expect((await sql.query(`select to_char(week, 'YYYY-MM-DD') as w from public.contest_points where user_id = $1`, [v.id])).map((r) => r.w)).toEqual(['2026-10-26']);
  });
});

describe('회원 탈퇴', () => {
  it('확인 글자가 있어야 하고, 계정과 딸린 것이 모두 지워진다. 운영자는 먼저 빼야 한다', async () => {
    const v = await user();
    await onboard(v, '떠나는주민', { district: 'ISTP' });
    await service.createRecord(v, { kind: 'diary', body: '마지막 일기', visibility: 'private' }).catch(() => null);
    await expectError(service.deleteMyAccount(v, '네'), 'bad_request');
    await expectError(service.deleteMyAccount(null, '탈퇴'), 'login_required');
    await service.deleteMyAccount(v, '탈퇴');
    expect(await sql.query(`select 1 from public.profiles where id = $1`, [v.id])).toEqual([]);
    expect(await sql.query(`select 1 from auth.users where id = $1`, [v.id])).toEqual([]);
    expect(await sql.query(`select 1 from public.records where owner_id = $1`, [v.id])).toEqual([]);

    const admin = await user();
    await onboard(admin, '운영탈퇴', { district: 'ISTP' });
    await sql.query(`insert into public.admins (user_id) values ($1)`, [admin.id]);
    await expectError(service.deleteMyAccount(admin, '탈퇴'), 'forbidden');
  });

  it('가입은 한 번만: 다시 부르면 막는다 (MBTI 대기 시간 건너뛰기·방 덮어쓰기 막기)', async () => {
    const v = await user();
    await onboard(v, '두번가입', { district: 'ESFP' });
    await expectError(onboard(v, '두번가입', { district: 'INTJ' }), 'conflict');
    expect((await service.me(v)).profile.mbti).toBe('ESFP');
  });

  it('이름·프로필 문구의 거친 말은 거르고, 운영자처럼 보이는 주소는 쓸 수 없다', async () => {
    const v = await user();
    await onboard(v, '착한이름', { district: 'ENTP' });
    await expectError(service.updateProfile(v, { displayName: '멍청이' }), 'rejected');
    await expectError(service.updateProfile(v, { bio: '연락은 open.kakao.com/abc' }), 'rejected');
    await expectError(service.updateProfile(v, { handle: 'admin' }), 'bad_request');
    await expectError(service.updateProfile(v, { handle: 'official_kr' }), 'bad_request');
    expect((await service.updateProfile(v, { handle: 'adminkim' })).handle).toBe('adminkim');
  });
});

describe('쓰기 상한', () => {
  it('사진은 하루 상한까지만, 신고는 처리 전 같은 대상 한 번만', async () => {
    const v = await user();
    const other = await user();
    await onboard(v, '사진많이', { district: 'ISFP' });
    await onboard(other, '신고대상', { district: 'ISFP' });
    for (let i = 0; i < recordConfig.photosPerDay; i++) await service.uploadPhoto(v, PNG);
    await expectError(service.uploadPhoto(v, PNG), 'limit');
    const handle = (await service.me(other)).profile.handle!;
    await service.report(v, { kind: 'user', targetId: handle, reason: '도배' });
    await service.report(v, { kind: 'user', targetId: handle, reason: '또 도배' });
    expect(await sql.query(`select 1 from public.reports where reporter = $1 and target_id = $2`, [v.id, other.id])).toHaveLength(1);
  });
});
