// 집 안(방) 실시간 연결: 주인과 손님이 같은 방에 들어와 서로 보인다.
// 방 화면은 실시간 서버를 기다리지 않고 먼저 뜨고, 연결은 뒤에서 붙는다 (못 붙으면 혼자 본다).
import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { roomConfig } from '@/config/game';
import { call } from '@/lib/api';
import { realtimeUrl, wakeRealtime } from '@/lib/realtime';
import type { HouseTicket } from '@/server/scene/service';
import type { AnnounceBroadcast } from '@/shared/announce';
import { townConfig } from '@/config/game';
import {
  MSG,
  type ActionBroadcast, type ActionKind, type CoEditMessage, type DogLeadMessage, type DogMessage, type EmoteBroadcast, type EmoteKind, type FurniBroadcast, type FurniMessage,
  type HouseJoinOptions, type MoveMessage, type SnapMessage,
} from '@/shared/protocol';
import type { TownPass } from '@/shared/townToken';
import { SELF_GESTURE, now, type Gesture, type PlayerView } from '../village/session';
import { LIFT_SEC } from '@/shared/character';
import { showAnnouncement } from '../app/AnnounceBanner';

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
  /** 같이 꾸미기 중 (주인이 켰다) */
  coEdit: boolean;
}

/** 방 꾸미기에서 가구를 든 사람: holding = 든 가구 id (없으면 null), liftAt·dropAt = 든·내려놓은 시각 (now()) */
export interface CarryState {
  holding: string | null;
  liftAt: number;
  dropAt: number;
}

/** 강아지를 맡은 화면이 보낸 자리를 이만큼(ms) 못 받으면 내 화면이 강아지를 움직인다 (맡은 화면이 예전 판일 때 등) */
const DOG_STALE_MS = 3000;

export class HousePresence {
  room: Room | null = null;
  /** 사람 번호(세션 id, 나는 SELF_GESTURE) → 지금 하는 몸짓 */
  readonly gestures = new Map<string, Gesture>();
  /** 사람 번호(세션 id, 나는 SELF_GESTURE) → 가구를 들고 있는지 */
  readonly carries = new Map<string, CarryState>();
  /** 내 화면이 방 강아지를 맡았는지 (서버가 정한다) */
  dogLead = false;
  /** 강아지를 맡은 화면이 마지막으로 보낸 자리와 받은 시각 */
  dog: DogMessage | null = null;
  private dogAt = 0;
  private readonly furniListeners = new Set<(m: FurniBroadcast) => void>();
  private readonly petListeners = new Set<(id: string) => void>();
  private snapshot: PresenceSnapshot = { status: 'loading', selfId: '', playerIds: [], pass: null, hidden: [], coEdit: false };
  private readonly listeners = new Set<() => void>();
  private readonly snapListeners = new Set<(s: SnapMessage) => void>();
  private ticket: Promise<HouseTicket | null> | null = null;
  /** 토큰을 받은 시각 (오래됐으면 들어가기 전에 새로 받는다) */
  private ticketAt = 0;
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
        this.ticketAt = Date.now();
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
    let ticket = await (this.ticket ?? this.prepare());
    if (!ticket || attempt !== this.attempt) return;
    try {
      await wakeRealtime();
      if (attempt !== this.attempt) return;
      // 집 방 토큰은 짧게(90초) 쓰므로, 서버가 깨어나는 동안 오래됐으면 새로 받는다
      if (Date.now() - this.ticketAt > 45_000) {
        ticket = await call<HouseTicket>('POST', '/api/house/token', { handle: this.handle });
        this.ticketAt = Date.now();
        this.ticket = Promise.resolve(ticket);
        if (attempt !== this.attempt) return;
      }
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
      room.onMessage(MSG.action, (m: ActionBroadcast) => this.applyAction(m.id, m.kind));
      room.onMessage(MSG.emote, (m: EmoteBroadcast) => this.applyEmote(m.id, m.kind));
      room.onMessage(MSG.announce, (m: AnnounceBroadcast) => showAnnouncement(m));
      room.onMessage(MSG.furni, (m: FurniBroadcast) => {
        this.applyCarry(m.by, m);
        this.furniListeners.forEach((fn) => fn(m));
      });
      room.onMessage(MSG.dog, (m: DogMessage) => {
        this.dog = m;
        this.dogAt = Date.now();
      });
      room.onMessage(MSG.dogLead, (m: DogLeadMessage) => {
        this.dogLead = !!m.lead;
      });
      room.onMessage(MSG.coedit, (m: CoEditMessage) => {
        // 같이 꾸미기가 끝나면 손님들이 들고 있던 가구를 내려놓은 것으로 본다 (주인 것은 다음 '옮겼다'에 다시 잡힌다)
        if (!m.on) {
          const owner = !!this.snapshot.pass && this.snapshot.pass.pid === this.snapshot.pass.house;
          for (const id of [...this.carries.keys()]) if (id !== SELF_GESTURE || !owner) this.carries.delete(id);
        }
        this.update({ coEdit: !!m.on });
      });
      room.onLeave(() => {
        if (attempt !== this.attempt) return;
        this.room = null;
        this.dogLead = false;
        this.dog = null;
        this.carries.clear();
        this.update({ status: 'offline', playerIds: [], selfId: '', coEdit: false });
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

  /** 내 몸짓은 바로 보여 주고, 같은 방에 있으면 보낸다 (다른 사람에게만 전달된다) */
  sendAction(kind: ActionKind) {
    this.applyAction(SELF_GESTURE, kind);
    if (this.connected) this.room!.send(MSG.action, { kind });
  }

  sendEmote(kind: EmoteKind) {
    this.applyEmote(SELF_GESTURE, kind);
    if (this.connected) this.room!.send(MSG.emote, { kind });
  }

  /**
   * 방 꾸미기 알림 (집 주인만, 서버가 주인인지 다시 본다). 내 캐릭터의 드는·나르는·내려놓는 동작은 바로 보여 준다
   */
  sendFurni(msg: FurniMessage) {
    this.applyCarry(SELF_GESTURE, msg);
    if (this.connected) this.room!.send(MSG.furni, msg);
  }

  /** 같이 꾸미기를 켜고 끈다 (집 주인만, 서버가 주인인지 본다) */
  sendCoEdit(on: boolean) {
    if (this.connected) this.room!.send(MSG.coedit, { on } satisfies CoEditMessage);
  }

  /** 다른 사람이 보낸 방 꾸미기 알림을 받는다 (주인, 같이 꾸미기 중인 손님) */
  onFurni(fn: (m: FurniBroadcast) => void) {
    this.furniListeners.add(fn);
    return () => {
      this.furniListeners.delete(fn);
    };
  }

  /** 누가 강아지를 쓰다듬었다 (나는 SELF_GESTURE) */
  onPet(fn: (id: string) => void) {
    this.petListeners.add(fn);
    return () => {
      this.petListeners.delete(fn);
    };
  }

  /** 강아지를 맡은 화면이 자리를 알린다 (다른 사람이 있을 때만) */
  sendDog(msg: DogMessage) {
    if (this.connected && this.dogLead && this.others().length > 0) this.room!.send(MSG.dog, msg);
  }

  /** 다른 화면이 맡은 강아지를 따라 그릴지 (맡은 화면이 최근에 자리를 보냈다) */
  followsDog(): boolean {
    return this.connected && !this.dogLead && !!this.dog && Date.now() - this.dogAt < DOG_STALE_MS;
  }

  private applyCarry(id: string, msg: FurniMessage) {
    const c = this.carries.get(id) ?? { holding: null, liftAt: 0, dropAt: 0 };
    if (msg.op === 'carry') {
      c.holding = msg.item.id;
      c.liftAt = now();
    } else if (msg.op === 'move' && c.holding !== msg.item.id) {
      // '들었다'를 놓쳤으면(같이 꾸미기가 끝났다 다시 켜졌을 때 등) 이미 든 것으로 본다
      c.holding = msg.item.id;
      c.liftAt = now() - LIFT_SEC;
    } else if (msg.op === 'drop') {
      if (c.holding) c.dropAt = now();
      c.holding = null;
    } else if (msg.op === 'reset') {
      // 주인이 꾸미기를 끝냈다: 누가 들고 있던 것이든 모두 내려놓는다
      for (const other of this.carries.values()) other.holding = null;
      c.holding = null;
    } else if (msg.op === 'remove' && c.holding === msg.id) {
      c.holding = null;
    }
    this.carries.set(id, c);
  }

  private gesture(id: string): Gesture {
    let g = this.gestures.get(id);
    if (!g) {
      g = { actionUntil: 0, emoteStart: 0, emoteUntil: 0 };
      this.gestures.set(id, g);
    }
    return g;
  }

  private applyAction(id: string, kind: ActionKind) {
    const g = this.gesture(id);
    g.action = kind;
    g.actionStart = now();
    g.actionUntil = g.actionStart + (kind === 'fish' ? townConfig.fishActionMs : kind === 'pet' ? townConfig.petActionMs : townConfig.actionDurationMs) / 1000;
    if (kind === 'clap') this.applyEmote(id, 'clap');
    if (kind === 'pet') this.petListeners.forEach((fn) => fn(id));
  }

  private applyEmote(id: string, kind: EmoteKind) {
    const g = this.gesture(id);
    g.emote = kind;
    g.emoteStart = now();
    g.emoteUntil = g.emoteStart + townConfig.emoteDurationMs / 1000;
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
