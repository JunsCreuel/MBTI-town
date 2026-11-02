// 실제 서버를 띄우고 SDK 클라이언트로 접속해 광장 규칙을 확인한다.
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, type EmoteBroadcast, type SnapMessage } from '../src/shared/protocol';
import { createRealtimeServer } from './app';

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

async function join(mbti: string): Promise<Room> {
  const room = await new Client(`http://localhost:${PORT}`).joinOrCreate('plaza', { mbti });
  rooms.push(room);
  await until(() => room.state.players?.size !== undefined);
  return room;
}

beforeAll(async () => {
  process.env.PLAZA_ROOM_CAPACITY = '2';
  server = createRealtimeServer('');
  await server.listen(PORT);
});

afterAll(async () => {
  await Promise.all(rooms.map((r) => r.leave().catch(() => {})));
  await server.gracefullyShutdown(false);
});

describe('광장 실시간 서버', () => {
  let a: Room;
  let b: Room;

  it('같은 채널에 들어온 사람끼리 서로 보인다', async () => {
    a = await join('ENTP');
    b = await join('INFP');
    expect(b.roomId).toBe(a.roomId);
    await until(() => a.state.players.size === 2 && b.state.players.size === 2);
    expect(a.state.channel).toBe(1);
    expect(b.state.players.get(a.sessionId).mbti).toBe('ENTP');
  });

  it('정원이 차면 다음 채널이 열린다', async () => {
    const c = await join('ISTJ');
    expect(c.roomId).not.toBe(a.roomId);
    await until(() => c.state.channel === 2);
  });

  it('MBTI가 올바르지 않으면 들어오지 못한다', async () => {
    await expect(new Client(`http://localhost:${PORT}`).joinOrCreate('plaza', { mbti: 'ABCD' })).rejects.toThrow();
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

  it('나가면 목록에서 빠진다', async () => {
    await a.leave();
    await until(() => b.state.players.size === 1);
  });
});

describe('이동 예산', () => {
  it('메시지를 잘게 쪼개 보내도 걷는 속도보다 빨리 갈 수 없다', async () => {
    const room = await join('ESTP');
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
