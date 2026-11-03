// 집 안(방) 실시간 연결: 주인과 손님이 같은 방에 들어와 서로 보인다.
// 방 화면은 실시간 서버를 기다리지 않고 먼저 뜨고, 연결은 뒤에서 붙는다 (못 붙으면 혼자 본다).
import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { roomConfig } from '@/config/game';
import { call } from '@/lib/api';
import { realtimeUrl, wakeRealtime } from '@/lib/realtime';
import type { HouseTicket } from '@/server/scene/service';
import { MSG, type HouseJoinOptions, type MoveMessage, type SnapMessage } from '@/shared/protocol';
import type { TownPass } from '@/shared/townToken';
import type { PlayerView } from '../village/session';

/**
 * - loading: 입장 토큰을 받는 중
 * - connecting: 토큰을 받았고 실시간 서버에 붙는 중
 * - ready: 같은 방에 들어왔다 (다른 사람이 보인다)
 * - offline: 붙지 못했거나 끊겼다 (혼자 본다)
 * - denied: 토큰을 받지 못했다 (방을 볼 수 없거나 서버 오류). 혼자 본다
 */
export type PresenceStatus = 'loading' | 'connecting' | 'ready' | 'offline' | 'denied';

export interface PresenceSnapshot {
  status: PresenceStatus;
  selfId: string;
  playerIds: readonly string[];
  /** 내 정보 (이름·모습). 토큰을 받기 전이나 받지 못했으면 null */
  pass: TownPass | null;
  /** 내 화면에서 숨길 사람 번호 (차단 관계) */
  hidden: readonly string[];
}

export class HousePresence {
  room: Room | null = null;
  private snapshot: PresenceSnapshot = { status: 'loading', selfId: '', playerIds: [], pass: null, hidden: [] };
  private readonly listeners = new Set<() => void>();
  private readonly snapListeners = new Set<(s: SnapMessage) => void>();
  private ticket: Promise<HouseTicket | null> | null = null;
  private attempt = 0;

  constructor(readonly handle: string) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<PresenceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** 입장 토큰을 받는다 (그 방을 볼 수 있을 때만 나온다) */
  prepare(): Promise<HouseTicket | null> {
    const attempt = ++this.attempt;
    this.update({ status: 'loading' });
    void wakeRealtime();
    this.ticket = call<HouseTicket>('POST', '/api/house/token', { handle: this.handle })
      .then((t) => {
        if (attempt === this.attempt) this.update({ status: 'connecting', pass: t.pass, hidden: t.hidden });
        return t;
      })
      .catch(() => {
        if (attempt === this.attempt) this.update({ status: 'denied' });
        return null;
      });
    return this.ticket;
  }

  /** 같은 집 방에 들어간다. here: 붙는 순간의 내 자리 */
  async join(here: () => { x: number; z: number }): Promise<void> {
    const attempt = this.attempt;
    const ticket = await (this.ticket ?? this.prepare());
    if (!ticket || attempt !== this.attempt) return;
    try {
      await wakeRealtime();
      if (attempt !== this.attempt) return;
      const options: HouseJoinOptions = { token: ticket.token, house: ticket.house, start: here() };
      const room = await new Client(realtimeUrl()).joinOrCreate(roomConfig.realtimeRoomName, options);
      if (attempt !== this.attempt) {
        room.leave();
        return;
      }
      this.room = room;
      const $ = Callbacks.get(room);
      const sync = () => this.update({ playerIds: [...room.state.players.keys()] as string[] });
      $.onAdd('players', sync);
      $.onRemove('players', sync);
      room.onMessage(MSG.snap, (m: SnapMessage) => this.snapListeners.forEach((fn) => fn(m)));
      // 몸짓은 아직 방 화면에 없다 (메시지만 받아 둔다)
      room.onMessage(MSG.action, () => {});
      room.onMessage(MSG.emote, () => {});
      room.onLeave(() => {
        if (attempt !== this.attempt) return;
        this.room = null;
        this.update({ status: 'offline', playerIds: [], selfId: '' });
      });
      this.update({ status: 'ready', selfId: room.sessionId });
    } catch (e) {
      if (attempt !== this.attempt) return;
      // 혼자서도 방은 볼 수 있으므로 경고로만 남긴다
      console.warn('같은 방 연결에 실패했습니다', e);
      this.room = null;
      this.update({ status: 'offline', playerIds: [], selfId: '' });
    }
  }

  dispose() {
    this.attempt++;
    this.room?.leave();
    this.room = null;
  }

  get connected(): boolean {
    return this.snapshot.status === 'ready' && !!this.room;
  }

  /** 서버에 보냈으면 true */
  sendMove(msg: MoveMessage): boolean {
    if (!this.connected) return false;
    this.room!.send(MSG.move, msg);
    return true;
  }

  onSnap(fn: (s: SnapMessage) => void) {
    this.snapListeners.add(fn);
    return () => {
      this.snapListeners.delete(fn);
    };
  }

  player(id: string): PlayerView | undefined {
    return this.room?.state?.players?.get(id) as PlayerView | undefined;
  }

  /** 나를 뺀, 숨기지 않은 다른 사람들 */
  others(snap = this.snapshot): string[] {
    const hidden = new Set(snap.hidden);
    return snap.playerIds.filter((id) => id !== snap.selfId && !hidden.has(this.player(id)?.pid ?? ''));
  }
}
