// 실제 서버를 띄우고 SDK 클라이언트로 접속해 마을 실시간 규칙을 확인한다.
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, type EmoteBroadcast, type JoinOptions, type SnapMessage } from '../src/shared/protocol';
import { loadTownMapForTest } from '../src/shared/testMap';
import { lotDoor, spawnName } from '../src/shared/townMap';
import { guestPid, signTownPass, townPid, type TownPass } from '../src/shared/townToken';
import { createRealtimeServer } from './app';

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

const inSpawn = (p: { x: number; z: number }, name: string) => {
  const { x, z, w, h } = map.spawns[name];
  return p.x >= x && p.x <= x + w && p.z >= z && p.z <= z + h;
};

function pass(over: Partial<TownPass> = {}): TownPass {
  return {
    pid: guestPid(), name: '손님', handle: '', district: '', lot: -1, color: 'mint', acc: 'none',
    exp: Math.floor(Date.now() / 1000) + 600, ...over,
  };
}

const connect = (options: Partial<JoinOptions>) => new Client(`http://localhost:${PORT}`).joinOrCreate('town', options);

async function join(p: TownPass, at?: JoinOptions['at']): Promise<Room> {
  const room = await connect({ token: signTownPass(p), at });
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

  const haru = pass({ pid: townPid('user-haru'), name: '하루', handle: 'haru', district: 'water', lot: 3, color: 'sky', acc: 'cap' });

  it('같은 채널에 들어온 사람끼리 서로 보인다 (토큰에 적힌 이름·모습으로)', async () => {
    a = await join(haru);
    b = await join(pass({ name: '봄', district: 'wood', lot: -1 }));
    expect(b.roomId).toBe(a.roomId);
    await until(() => a.state.players.size === 2 && b.state.players.size === 2);
    expect(a.state.channel).toBe(1);
    expect(b.state.players.get(a.sessionId)).toMatchObject({ pid: haru.pid, name: '하루', handle: 'haru', district: 'water', color: 'sky', acc: 'cap' });
  });

  it('들어오면 내 집 문 앞에서 시작하고, 집이 없으면 내 지역 입구에서 시작한다', () => {
    expect(near(a.state.players.get(a.sessionId), lotDoor(map.lots.water[3]), 0.5)).toBe(true);
    expect(inSpawn(b.state.players.get(b.sessionId), spawnName('wood'))).toBe(true);
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
    b.send(MSG.warp, { to: 'fire' });
    await until(() => snaps.length >= 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(snaps).toHaveLength(1);
    const { x, z, w, h } = map.spawn;
    expect(snaps[0].x).toBeGreaterThanOrEqual(x);
    expect(snaps[0].x).toBeLessThanOrEqual(x + w);
    expect(snaps[0].z).toBeGreaterThanOrEqual(z);
    expect(snaps[0].z).toBeLessThanOrEqual(z + h);
    await until(() => near(a.state.players.get(b.sessionId), snaps[0], 1e-3));

    // 다른 지역으로도 간다
    await new Promise((r) => setTimeout(r, 1600));
    b.send(MSG.warp, { to: 'earth' });
    await until(() => snaps.length === 2);
    expect(inSpawn(snaps[1], spawnName('earth'))).toBe(true);
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
    expect(near(homeSnaps[1], lotDoor(map.lots.water[3]), 0.5)).toBe(true);
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

describe('이동 예산', () => {
  it('메시지를 잘게 쪼개 보내도 걷는 속도보다 빨리 갈 수 없다', async () => {
    const room = await join(pass({ district: 'metal' }));
    const start = { ...room.state.players.get(room.sessionId) };
    let snaps = 0;
    room.onMessage(MSG.snap, () => snaps++);
    // 0.3초 동안 0.25씩 20번 = 5칸 (걷는 속도라면 1칸 남짓)
    for (let i = 1; i <= 20; i++) {
      room.send(MSG.move, { x: start.x, z: start.z - 0.25 * i, rot: Math.PI, moving: true });
      await new Promise((r) => setTimeout(r, 15));
    }
    await until(() => snaps > 0);
    await new Promise((r) => setTimeout(r, 200));
    const moved = start.z - room.state.players.get(room.sessionId).z;
    expect(moved).toBeLessThan(2.6);
  });
});
