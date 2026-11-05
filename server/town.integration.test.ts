// 실제 서버를 띄우고 SDK 클라이언트로 접속해 마을 실시간 규칙을 확인한다.
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, type EmoteBroadcast, type JoinOptions, type MusicResult, type MusicState, type SnapMessage } from '../src/shared/protocol';
import { queueKey } from '../src/shared/clubMusic';
import { loadTownMapForTest } from '../src/shared/testMap';
import { gateSpawnName, lotDoor, spawnName, type TownMap } from '../src/shared/townMap';
import { announcementBody, type AnnounceBroadcast } from '../src/shared/announce';
import { guestPid, signAnnouncement, signTownPass, signYoutube, townPid, type TownPass } from '../src/shared/townToken';
import { createRealtimeServer } from './app';
import { getHoodMap, getSpotMap } from './assets';

const map = loadTownMapForTest();
const near = (p: { x: number; z: number }, q: { x: number; z: number } | undefined, r: number) =>
  !!q && Math.hypot(p.x - q.x, p.z - q.z) <= r;

const PORT = 25670 + Math.floor(Math.random() * 1000);
let server: ReturnType<typeof createRealtimeServer>;
const rooms: Room[] = [];

async function until(check: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('시간 초과');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const inSpawn = (p: { x: number; z: number }, name: string, m: TownMap = map) => {
  const { x, z, w, h } = m.spawns[name];
  return p.x >= x && p.x <= x + w && p.z >= z && p.z <= z + h;
};

function pass(over: Partial<TownPass> = {}): TownPass {
  return {
    pid: guestPid(), name: '손님', handle: '', district: '', hood: 1, lot: -1, body: 'male', color: 'mint', acc: 'none', skin: 'natural', hair: 'natural',
    exp: Math.floor(Date.now() / 1000) + 600, ...over,
  };
}

const connect = (options: Partial<JoinOptions>) => new Client(`http://localhost:${PORT}`).joinOrCreate('town', options);

async function join(p: TownPass, at?: JoinOptions['at'], place?: JoinOptions['place']): Promise<Room> {
  const room = await connect({ token: signTownPass(p), at, place });
  rooms.push(room);
  await until(() => room.state.players?.size !== undefined);
  return room;
}

beforeAll(async () => {
  process.env.TOWN_ROOM_CAPACITY = '2';
  server = createRealtimeServer('');
  await server.listen(PORT);
});

afterAll(async () => {
  await Promise.all(rooms.map((r) => r.leave().catch(() => {})));
  await server.gracefullyShutdown(false);
});

describe('마을 실시간 서버', () => {
  let a: Room;
  let b: Room;

  const haru = pass({ pid: townPid('user-haru'), name: '하루', handle: 'haru', district: 'ISFJ', lot: 3, color: 'sky', acc: 'cap' });

  it('같은 채널에 들어온 사람끼리 서로 보인다 (토큰에 적힌 이름·모습으로)', async () => {
    a = await join(haru);
    b = await join(pass({ name: '봄', district: 'INFP', lot: -1 }));
    expect(b.roomId).toBe(a.roomId);
    await until(() => a.state.players.size === 2 && b.state.players.size === 2);
    expect(a.state.channel).toBe(1);
    expect(b.state.players.get(a.sessionId)).toMatchObject({ pid: haru.pid, name: '하루', handle: 'haru', district: 'ISFJ', color: 'sky', acc: 'cap' });
  });

  it('들어오면 내 집 문 앞에서 시작하고, 집이 없으면 내 마을 입구에서 시작한다', () => {
    expect(near(a.state.players.get(a.sessionId), lotDoor(map.lots.ISFJ[3]), 0.5)).toBe(true);
    expect(inSpawn(b.state.players.get(b.sessionId), spawnName('INFP'))).toBe(true);
  });

  it('정원이 차면 다음 채널이 열린다. 손님은 중앙광장에서 시작한다', async () => {
    const c = await join(pass());
    expect(c.roomId).not.toBe(a.roomId);
    await until(() => c.state.channel === 2);
    expect(inSpawn(c.state.players.get(c.sessionId), 'spawn')).toBe(true);
  });

  it('토큰이 없거나, 바뀌었거나, 만료되면 들어오지 못한다', async () => {
    await expect(connect({})).rejects.toThrow();
    const [body, mac] = signTownPass(pass()).split('.');
    await expect(connect({ token: `${body}x.${mac}` })).rejects.toThrow();
    await expect(connect({ token: signTownPass(pass({ exp: Math.floor(Date.now() / 1000) - 1 })) })).rejects.toThrow();
  });

  it('정상 이동은 다른 사람에게 전달되고, 순간이동은 되돌린다', async () => {
    const me = a.state.players.get(a.sessionId);
    const target = { x: me.x, z: me.z - 0.3 };
    await new Promise((r) => setTimeout(r, 120));
    a.send(MSG.move, { ...target, rot: Math.PI, moving: true });
    await until(() => Math.abs(b.state.players.get(a.sessionId).z - target.z) < 1e-3);
    expect(b.state.players.get(a.sessionId).rot).toBeCloseTo(Math.PI, 3);

    const snapped = new Promise<SnapMessage>((resolve) => a.onMessage(MSG.snap, resolve));
    await new Promise((r) => setTimeout(r, 120));
    a.send(MSG.move, { x: 3.5, z: 3.5, rot: 0, moving: true });
    const snap = await snapped;
    expect(snap.z).toBeCloseTo(target.z, 3);
  });

  it('이모티콘은 다른 사람에게만 가고, 재사용 대기 중에는 무시한다', async () => {
    const got: EmoteBroadcast[] = [];
    const mine: EmoteBroadcast[] = [];
    b.onMessage(MSG.emote, (m: EmoteBroadcast) => got.push(m));
    a.onMessage(MSG.emote, (m: EmoteBroadcast) => mine.push(m));
    a.send(MSG.emote, { kind: 'heart' });
    a.send(MSG.emote, { kind: 'wow' });
    a.send(MSG.emote, { kind: 'not-an-emote' });
    await until(() => got.length >= 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(got).toEqual([{ id: a.sessionId, kind: 'heart' }]);
    expect(mine).toEqual([]);
  });

  it('지도에서 고른 곳으로 바로 가고, 재사용 대기 중에는 무시한다', async () => {
    const snaps: SnapMessage[] = [];
    b.onMessage(MSG.snap, (m: SnapMessage) => snaps.push(m));
    b.send(MSG.warp, { to: 'plaza' });
    b.send(MSG.warp, { to: 'ESTP' });
    await until(() => snaps.length >= 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(snaps).toHaveLength(1);
    const { x, z, w, h } = map.spawn;
    expect(snaps[0].x).toBeGreaterThanOrEqual(x);
    expect(snaps[0].x).toBeLessThanOrEqual(x + w);
    expect(snaps[0].z).toBeGreaterThanOrEqual(z);
    expect(snaps[0].z).toBeLessThanOrEqual(z + h);
    await until(() => near(a.state.players.get(b.sessionId), snaps[0], 1e-3));

    // 다른 마을로도 간다
    await new Promise((r) => setTimeout(r, 1600));
    b.send(MSG.warp, { to: 'ESTJ' });
    await until(() => snaps.length === 2);
    expect(inSpawn(snaps[1], spawnName('ESTJ'))).toBe(true);
    b.send(MSG.warp, { to: 'NOPE' });
    await new Promise((r) => setTimeout(r, 200));
    expect(snaps).toHaveLength(2);
  });

  it('내 집으로 가면 문 앞에 선다', async () => {
    const homeSnaps: SnapMessage[] = [];
    a.onMessage(MSG.snap, (m: SnapMessage) => homeSnaps.push(m));
    await new Promise((r) => setTimeout(r, 1600));
    a.send(MSG.warp, { to: 'plaza' });
    await until(() => homeSnaps.length === 1);
    await new Promise((r) => setTimeout(r, 1600));
    a.send(MSG.warp, { to: 'home' });
    await until(() => homeSnaps.length === 2);
    expect(near(homeSnaps[1], lotDoor(map.lots.ISFJ[3]), 0.5)).toBe(true);
  });

  it('나가면 목록에서 빠지고, 같은 사람이 또 들어오면 먼저 들어온 쪽이 나간다', async () => {
    await b.leave();
    await until(() => a.state.players.size === 1);
    let left = false;
    a.onLeave(() => {
      left = true;
    });
    const again = await new Client(`http://localhost:${PORT}`).joinById(a.roomId, { token: signTownPass(haru) });
    rooms.push(again);
    await until(() => left);
    await until(() => again.state.players.size === 1);
    expect(again.state.players.get(again.sessionId).pid).toBe(haru.pid);
  });
});

describe('새 동네 (2동·3동…)', () => {
  const hood = getHoodMap('ISFJ');
  const sea = pass({ name: '바다', district: 'ISFJ', hood: 2, lot: 5 });

  it('동네마다 방이 따로 열리고, 내 집이 있는 동네에서는 문 앞에서 시작한다', async () => {
    const mine = await join(sea, 'home', 'ISFJ.2');
    await until(() => mine.state.players.size === 1);
    expect(near(mine.state.players.get(mine.sessionId), lotDoor(hood.lots.ISFJ[5]), 0.5)).toBe(true);
    // 같은 동네에 들어온 사람은 같은 방, 다른 동네는 다른 방
    const visitor = await join(pass({ name: '손님2' }), 'home', 'ISFJ.2');
    expect(visitor.roomId).toBe(mine.roomId);
    expect(inSpawn(visitor.state.players.get(visitor.sessionId), 'spawn', hood)).toBe(true);
    const other = await join(pass(), 'home', 'ISFJ.3');
    expect(other.roomId).not.toBe(mine.roomId);
    expect(other.state.channel).toBe(1);
  });

  it('본섬에서 내 집이 다른 동네에 있으면 내 마을 동네 길 아치 앞에서 시작한다', async () => {
    const r = await join(sea);
    expect(inSpawn(r.state.players.get(r.sessionId), gateSpawnName('ISFJ'))).toBe(true);
  });

  it('화면이 먼저 세운 자리(start)가 걸을 수 있는 곳이면 그 자리에서 시작하고, 아니면 원래 규칙을 따른다', async () => {
    // 동네 쉼터 안의 걸을 수 있는 자리 하나
    const sp = hood.spawns.spawn;
    const start = { x: Math.floor(sp.x + sp.w / 2) + 0.5, z: Math.floor(sp.z + sp.h / 2) + 0.5 };
    const ok = await join(pass({ name: '먼저' }), 'home', 'ISFJ.4');
    const r1 = await connect({ token: signTownPass(pass({ name: '먼저2' })), place: 'ISFJ.4', start });
    rooms.push(r1);
    await until(() => !!r1.state.players?.get(r1.sessionId));
    expect(near(r1.state.players.get(r1.sessionId), start, 0.01)).toBe(true);
    // 바다 한가운데(맵 구석)나 맵 밖은 받지 않는다
    for (const bad of [{ x: 0.5, z: 0.5 }, { x: -3, z: 5 }, { x: Number.NaN, z: 1 }]) {
      const r = await connect({ token: signTownPass(pass()), place: 'ISFJ.5', start: bad });
      rooms.push(r);
      await until(() => !!r.state.players?.get(r.sessionId));
      expect(inSpawn(r.state.players.get(r.sessionId), 'spawn', hood)).toBe(true);
      await r.leave();
    }
    expect(ok.roomId).toBe(r1.roomId);
  });

  it('놀이터(낚시터·클럽)는 따로 방이 열리고 입구에서 시작한다', async () => {
    for (const spot of ['fishing', 'club'] as const) {
      const m = getSpotMap(spot);
      const r = await join(pass({ name: `${spot}꾼` }), 'home', spot);
      await until(() => !!r.state.players?.get(r.sessionId));
      expect(inSpawn(r.state.players.get(r.sessionId), 'spawn', m)).toBe(true);
      expect(r.roomId).not.toBe(rooms[0].roomId);
      // 같은 놀이터에 온 사람은 같은 방
      const r2 = await join(pass({ name: `${spot}친구` }), 'home', spot);
      expect(r2.roomId).toBe(r.roomId);
      await r2.leave();
      await r.leave();
    }
  });

  it('클럽 신청곡은 지금 곡 뒤 대기열에 차례로 쌓이고, 채널 모두가 같은 목록을 받는다', async () => {
    const pa = pass({ name: '신청자' });
    const a = await join(pa, 'home', 'club');
    const b = await join(pass({ name: '듣는이' }), 'home', 'club');
    expect(b.roomId).toBe(a.roomId);
    const got: MusicState[] = [];
    const results: MusicResult[] = [];
    b.onMessage(MSG.music, (m: MusicState) => got.push(m));
    a.onMessage(MSG.musicResult, (r: MusicResult) => results.push(r));
    b.onMessage(MSG.musicResult, (r: MusicResult) => results.push(r));
    a.send(MSG.musicRequest, { index: 2 });
    await until(() => got.length === 1 && results.length === 1);
    // 지금 곡(시계 순서)은 그대로, 신청곡은 대기열 첫 번째
    expect(got[0].by).toBe('');
    // 신청한 사람은 마을 사람 번호로 센다 (다시 접속해도 쉬는 시간·한 사람 몫이 이어진다)
    expect(got[0].queue).toEqual([{ index: 2, by: '신청자', who: pa.pid }]);
    expect(got[0].startedAt).toBeLessThanOrEqual(got[0].serverNow);
    expect(results[0]).toEqual({ ok: true, position: 1 });
    // 다른 사람이 신청하면 두 번째
    b.send(MSG.musicRequest, { index: 0 });
    await until(() => got.length === 2 && results.length === 2);
    expect(got[1].queue.map((q) => [q.index, q.by])).toEqual([[2, '신청자'], [0, '듣는이']]);
    expect(results[1]).toEqual({ ok: true, position: 2 });
    // 바로 또 신청하면 잠깐 쉬라고 한다 (목록은 그대로), 없는 곡은 받지 않는다
    a.send(MSG.musicRequest, { index: 1 });
    a.send(MSG.musicRequest, { index: 99 });
    await until(() => results.length === 3);
    expect(results[2]).toEqual({ ok: false, reason: 'cooldown' });
    expect(got.length).toBe(2);
    // 나중에 들어온 사람도 지금 흐름과 대기열을 받는다 (정원 2라 둘이 나간 뒤)
    await b.leave();
    const late: MusicState[] = [];
    const c = await new Client(`http://localhost:${PORT}`).joinOrCreate('town', { token: signTownPass(pass({ name: '늦게온이' })), place: 'club' });
    rooms.push(c);
    c.onMessage(MSG.music, (m: MusicState) => late.push(m));
    if (c.roomId === a.roomId) {
      await until(() => late.length === 1);
      expect(late[0].queue.map((q) => q.index)).toEqual([2, 0]);
    }
    await c.leave();
    await a.leave();
  });

  it('유튜브 신청곡은 웹 서버가 서명한 신청표만, 집이 있는 주민만 받는다', async () => {
    const guest = await join(pass({ name: '손님' }), 'home', 'club');
    const guestResults: MusicResult[] = [];
    guest.onMessage(MSG.musicResult, (r: MusicResult) => guestResults.push(r));
    const guestSong = { id: 'dQw4w9WgXcQ', title: '유튜브 곡', seconds: 200 };
    const guestExp = Date.now() + 60_000;
    guest.send(MSG.musicRequest, { youtube: { song: guestSong, exp: guestExp, sig: signYoutube(guestSong, guestExp) } });
    await until(() => guestResults.length === 1);
    expect(guestResults[0]).toEqual({ ok: false, reason: 'closed' });
    await guest.leave();
    const pa = pass({ name: '유튜버', pid: townPid('user-youtuber'), district: 'ENFP', lot: 3 });
    const a = await join(pa, 'home', 'club');
    const got: MusicState[] = [];
    const results: MusicResult[] = [];
    a.onMessage(MSG.music, (m: MusicState) => got.push(m));
    a.onMessage(MSG.musicResult, (r: MusicResult) => results.push(r));
    const song = { id: 'dQw4w9WgXcQ', title: '유튜브 곡', seconds: 200 };
    const exp = Date.now() + 60_000;
    // 서명이 틀리거나, 곡 정보를 바꾸거나, 기한이 지난 신청표는 받지 않는다
    a.send(MSG.musicRequest, { youtube: { song, exp, sig: 'forged' } });
    a.send(MSG.musicRequest, { youtube: { song: { ...song, seconds: 30 }, exp, sig: signYoutube(song, exp) } });
    a.send(MSG.musicRequest, { youtube: { song, exp: Date.now() - 1, sig: signYoutube(song, Date.now() - 1) } });
    await until(() => results.length === 3);
    expect(results).toEqual([{ ok: false, reason: 'closed' }, { ok: false, reason: 'closed' }, { ok: false, reason: 'closed' }]);
    expect(got.length).toBe(0);
    a.send(MSG.musicRequest, { youtube: { song, exp, sig: signYoutube(song, exp) } });
    await until(() => got.length === 1 && results.length === 4);
    expect(results[3]).toEqual({ ok: true, position: got[0].queue.length });
    expect(got[0].queue.at(-1)).toEqual({ index: -1, by: '유튜버', who: pa.pid, yt: song });
    await a.leave();
  });

  it('운영자만 지금 곡을 넘기고 신청곡을 뺄 수 있다 (운영자 표시는 서명된 토큰에만)', async () => {
    const admin = await join(pass({ name: '운영자', admin: true }), 'home', 'club');
    const user = await join(pass({ name: '주민' }), 'home', 'club');
    expect(user.roomId).toBe(admin.roomId);
    const got: MusicState[] = [];
    user.onMessage(MSG.music, (m: MusicState) => got.push(m));
    // 신청곡 둘 (사람마다 따로 세어서 바로 받는다. 시험 방 정원이 2명이라 둘이 한 곡씩)
    user.send(MSG.musicRequest, { index: 1 });
    await until(() => got.length === 1);
    admin.send(MSG.musicRequest, { index: 2 });
    await until(() => got.length === 2);
    const before = got[1];
    // 일반 주민의 명령은 무시한다
    user.send(MSG.musicAdmin, { action: 'skip' });
    user.send(MSG.musicAdmin, { action: 'remove', at: 0, key: queueKey(before.queue[0]) });
    await new Promise((r) => setTimeout(r, 300));
    expect(got).toHaveLength(2);
    // 운영자: 열쇠가 틀리면 빼지 않고, 맞으면 뺀다
    admin.send(MSG.musicAdmin, { action: 'remove', at: 0, key: 'nope' });
    admin.send(MSG.musicAdmin, { action: 'remove', at: before.queue.length - 1, key: queueKey(before.queue.at(-1)!) });
    await until(() => got.length === 3);
    expect(got[2].queue.map((q) => q.index)).toEqual(before.queue.slice(0, -1).map((q) => q.index));
    // 넘기기: 대기열 첫 곡이 지금 곡이 된다
    admin.send(MSG.musicAdmin, { action: 'skip' });
    await until(() => got.length === 4);
    expect(got[3]).toMatchObject({ index: before.queue[0].index, by: before.queue[0].by });
    expect(got[3].startedAt).toBeGreaterThanOrEqual(got[2].serverNow);
    await user.leave();
    await admin.leave();
  });

  it('없는 곳으로는 들어가지 못한다', async () => {
    for (const place of ['moon.2', 'ISFJ.1', 'ISFJ.0', 'ISFJ.100', 'ISFJ']) {
      await expect(connect({ token: signTownPass(pass()), place: place as JoinOptions['place'] })).rejects.toThrow();
    }
  });
});

describe('펫', () => {
  it('계정에 저장된 펫(토큰)과 함께 들어온다', async () => {
    const r = await connect({ token: signTownPass(pass({ pid: townPid('user-pet2'), name: '저장이', district: 'INFP', lot: 1, pet: 'dog' })), place: 'fishing' });
    rooms.push(r);
    await until(() => r.state.players?.get(r.sessionId) !== undefined);
    expect(r.state.players.get(r.sessionId).pet).toBe('dog');
  });

  it('피부색·머리 색은 입장 토큰대로 다른 사람에게 보인다', async () => {
    const a = await connect({ token: signTownPass(pass({ pid: townPid('user-look'), name: '분홍머리', district: 'INFJ', lot: 2, skin: 'deep', hair: 'pink' })), place: 'market' });
    rooms.push(a);
    const b = await connect({ token: signTownPass(pass({ name: '보는손님' })), place: 'market' });
    rooms.push(b);
    await until(() => !!b.state.players?.get(a.sessionId) && !!a.state.players?.get(b.sessionId));
    const seen = b.state.players.get(a.sessionId);
    expect([seen.skin, seen.hair]).toEqual(['deep', 'pink']);
    const guest = a.state.players.get(b.sessionId);
    expect([guest.skin, guest.hair]).toEqual(['natural', 'natural']);
  });

  it('집이 있는 주민은 펫을 데리고 들어오고 바꿀 수 있다. 손님과 모르는 펫은 받지 않는다', async () => {
    const owner = await connect({ token: signTownPass(pass({ pid: townPid('user-pet'), name: '산책이', district: 'ENFP', lot: 0 })), place: 'market', pet: 'dog' });
    rooms.push(owner);
    const visitor = await connect({ token: signTownPass(pass({ name: '손님펫' })), place: 'market', pet: 'dog' });
    rooms.push(visitor);
    expect(visitor.roomId).toBe(owner.roomId);
    await until(() => owner.state.players?.size === 2 && visitor.state.players?.size === 2);
    expect(visitor.state.players.get(owner.sessionId).pet).toBe('dog');
    expect(owner.state.players.get(visitor.sessionId).pet).toBe('');
    owner.send(MSG.pet, { pet: '' });
    await until(() => visitor.state.players.get(owner.sessionId).pet === '');
    owner.send(MSG.pet, { pet: 'dragon' });
    visitor.send(MSG.pet, { pet: 'dog' });
    owner.send(MSG.pet, { pet: 'dog' });
    await until(() => visitor.state.players.get(owner.sessionId).pet === 'dog');
    await new Promise((r) => setTimeout(r, 200));
    expect(owner.state.players.get(visitor.sessionId).pet).toBe('');
  });
});

describe('이동 예산', () => {
  it('메시지를 잘게 쪼개 보내도 걷는 속도보다 빨리 갈 수 없다', async () => {
    const room = await join(pass({ district: 'INTJ' }));
    const start = { ...room.state.players.get(room.sessionId) };
    let snaps = 0;
    room.onMessage(MSG.snap, () => snaps++);
    // 0.6초 동안 0.25씩 40번 = 10칸 (걷는 속도라면 2칸 남짓, 몰려 오는 것을 감안한 상한은 예산 3.5 + 0.6초 × 5.6)
    for (let i = 1; i <= 40; i++) {
      room.send(MSG.move, { x: start.x, z: start.z - 0.25 * i, rot: Math.PI, moving: true });
      await new Promise((r) => setTimeout(r, 15));
    }
    await until(() => snaps > 0);
    await new Promise((r) => setTimeout(r, 200));
    const moved = start.z - room.state.players.get(room.sessionId).z;
    expect(moved).toBeLessThan(7.5);
    expect(moved).toBeGreaterThan(2);
  });
});

describe('집 안 (방)', () => {
  const ownerPid = townPid('user-house-owner');
  const enter = (p: TownPass, house: string, start?: { x: number; z: number }) =>
    new Client(`http://localhost:${PORT}`).joinOrCreate('house', { token: signTownPass(p), house, start });

  it('같은 집 토큰을 가진 주인과 손님이 같은 방에서 서로 보인다', async () => {
    const owner = await enter(pass({ pid: ownerPid, name: '주인', house: ownerPid }), ownerPid);
    rooms.push(owner);
    const friend = await enter(pass({ name: '친구', color: 'peach', house: ownerPid, mbti: 'ENFP' }), ownerPid, { x: 2.5, z: 4.5 });
    rooms.push(friend);
    expect(friend.roomId).toBe(owner.roomId);
    await until(() => owner.state.players.size === 2 && friend.state.players.size === 2);
    const seen = owner.state.players.get(friend.sessionId);
    expect(seen).toMatchObject({ name: '친구', color: 'peach', mbti: 'ENFP' });
    expect(near(seen, { x: 2.5, z: 4.5 }, 0.01)).toBe(true);
    // 걸으면 주인 화면에도 보인다
    friend.send(MSG.move, { x: 2.8, z: 4.5, rot: 1, moving: true });
    await until(() => Math.abs(owner.state.players.get(friend.sessionId).x - 2.8) < 0.01);
  });

  it('방에서도 몸짓·이모티콘이 다른 사람에게 간다 (새 몸짓 포함, 모르는 것은 무시)', async () => {
    const house = townPid('user-house-gesture');
    const a = await enter(pass({ house }), house);
    rooms.push(a);
    const b = await enter(pass({ house }), house);
    rooms.push(b);
    const got: { type: string; kind: string; id: string }[] = [];
    a.onMessage(MSG.action, (m: { kind: string; id: string }) => got.push({ type: 'action', ...m }));
    a.onMessage(MSG.emote, (m: { kind: string; id: string }) => got.push({ type: 'emote', ...m }));
    b.send(MSG.action, { kind: 'dance' });
    await until(() => got.length === 1);
    await new Promise((r) => setTimeout(r, 1300));
    b.send(MSG.emote, { kind: 'moonwalk' });
    b.send(MSG.emote, { kind: 'joy' });
    await until(() => got.length === 2);
    expect(got).toEqual([
      { type: 'action', kind: 'dance', id: b.sessionId },
      { type: 'emote', kind: 'joy', id: b.sessionId },
    ]);
  });

  it('다른 집 토큰이나 마을 토큰으로는 들어가지 못한다', async () => {
    await expect(enter(pass({ house: 'someone-else' }), ownerPid)).rejects.toThrow();
    await expect(enter(pass(), ownerPid)).rejects.toThrow();
  });

  it('방 밖 자리는 받지 않는다 (시작 자리, 이동 모두)', async () => {
    const r = await enter(pass({ house: ownerPid }), ownerPid, { x: -5, z: 99 });
    rooms.push(r);
    await until(() => !!r.state.players?.get(r.sessionId));
    const me = r.state.players.get(r.sessionId);
    expect(me.x).toBeGreaterThan(0);
    expect(me.z).toBeLessThan(6);
    const before = { x: me.x, z: me.z };
    r.send(MSG.move, { x: 30, z: 2, rot: 0, moving: true });
    await new Promise((res) => setTimeout(res, 300));
    expect(near(r.state.players.get(r.sessionId), before, 0.01)).toBe(true);
  });
});

describe('서버 전체 공지', () => {
  const enter = (p: TownPass, house: string) => new Client(`http://localhost:${PORT}`).joinOrCreate('house', { token: signTownPass(p), house });
  const post = (body: Record<string, unknown>) =>
    fetch(`http://localhost:${PORT}/scene/announce`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('서명이 맞는 공지는 마을·놀이터·집 안 모두에게 간다', async () => {
    const town = await join(pass({ name: '광장' }), 'plaza');
    const club = await join(pass({ name: '클럽' }), 'plaza', 'club');
    const house = await enter(pass({ house: 'announce-house' }), 'announce-house');
    rooms.push(house);
    const got: { room: string; m: AnnounceBroadcast }[] = [];
    for (const [name, r] of [['town', town], ['club', club], ['house', house]] as const) r.onMessage(MSG.announce, (m: AnnounceBroadcast) => got.push({ room: name, m }));
    const a = { kind: 'golden_whale', name: '고래잡이' } as const;
    const ts = Date.now();
    const res = await post({ ...a, ts, sig: signAnnouncement(announcementBody(a), ts) });
    expect(res.status).toBe(200);
    await until(() => got.length === 3);
    expect(got.map((g) => g.room).sort()).toEqual(['club', 'house', 'town']);
    for (const g of got) expect(g.m).toMatchObject({ kind: 'golden_whale', text: '(공지) 고래잡이님이 황금 고래를 낚았습니다!' });
  });

  it('서명이 없거나 틀리거나 오래된 공지는 받지 않는다', async () => {
    const r = await join(pass({ name: '듣는이' }), 'plaza');
    let heard = 0;
    r.onMessage(MSG.announce, () => heard++);
    const a = { kind: 'notice', text: '가짜 공지' } as const;
    const ts = Date.now();
    expect((await post({ ...a, ts })).status).toBe(403);
    expect((await post({ ...a, ts, sig: signAnnouncement(announcementBody({ kind: 'notice', text: '다른 글' }), ts) })).status).toBe(403);
    const old = ts - 10 * 60_000;
    expect((await post({ ...a, ts: old, sig: signAnnouncement(announcementBody(a), old) })).status).toBe(403);
    expect((await post({ kind: 'shout', text: '아무 말' })).status).toBe(400);
    await new Promise((res) => setTimeout(res, 300));
    expect(heard).toBe(0);
  });
});

describe('실시간 서버 막기', () => {
  it('토큰 없이는 방 찾기 단계에서 자리를 잡지 못한다 (마을·집 모두)', async () => {
    const res = await fetch(`http://localhost:${PORT}/matchmake/joinOrCreate/town`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ place: 'plaza' }) });
    expect(res.ok).toBe(false);
    const house = await fetch(`http://localhost:${PORT}/matchmake/joinOrCreate/house`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ house: townPid('user-x') }) });
    expect(house.ok).toBe(false);
  });

  it('방을 마음대로 만드는 create·join은 열지 않는다', async () => {
    const res = await fetch(`http://localhost:${PORT}/matchmake/create/town`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: signTownPass(pass()) }) });
    expect(res.ok).toBe(false);
    expect(await res.text()).toMatch(/invalid method/);
  });

  it('큰 본문·길이를 밝히지 않은 본문은 읽기 전에 거른다', async () => {
    const big = await fetch(`http://localhost:${PORT}/scene/announce`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(64 * 1024) });
    expect(big.status).toBe(413);
  });
});
