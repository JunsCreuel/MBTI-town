// 마을 실시간 연결. React 화면(HUD)은 snapshot을 구독하고, 3D 장면은 매 프레임 room.state를 직접 읽는다.
import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { townConfig } from '@/config/game';
import { call } from '@/lib/api';
import type { TownTicket } from '@/server/scene/service';
import type { AccessoryId, AvatarColor } from '@/shared/avatar';
import type { District } from '@/shared/districts';
import {
  MSG,
  type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type JoinOptions,
  type MoveMessage, type RoomPlace, type SnapMessage, type TownPlace, type WarpMessage,
} from '@/shared/protocol';
import type { TownPass } from '@/shared/townToken';

/** 서버 상태 중 클라이언트가 읽는 부분 */
export interface PlayerView {
  pid: string;
  name: string;
  /** 방 주소 (공개한 사람만) */
  handle: string;
  district: District | '';
  color: AvatarColor;
  acc: AccessoryId;
  x: number;
  z: number;
  /** 바라보는 방향 (라디안) */
  rot: number;
  moving: boolean;
}

export interface Gesture {
  action?: ActionKind;
  actionUntil: number;
  emote?: EmoteKind;
  emoteStart: number;
  emoteUntil: number;
}

export type SessionStatus = 'connecting' | 'ready' | 'error' | 'closed';

export interface SessionSnapshot {
  status: SessionStatus;
  error?: string;
  selfId: string;
  channel: number;
  playerIds: readonly string[];
  /** 토큰에 담긴 내 정보 (이름·지역·집터) */
  pass: TownPass | null;
  guest: boolean;
}

/** 초 단위 현재 시각. 장면 애니메이션과 몸짓 시간을 같은 시계로 맞춘다. */
export const now = () => performance.now() / 1000;

function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL || `${window.location.protocol}//${window.location.hostname}:2567`;
}

export class TownSession {
  room: Room | null = null;
  readonly gestures = new Map<string, Gesture>();
  private snapshot: SessionSnapshot = { status: 'connecting', selfId: '', channel: 0, playerIds: [], pass: null, guest: true };
  private readonly listeners = new Set<() => void>();
  private readonly snapListeners = new Set<(s: SnapMessage) => void>();
  /** 연결 시도 번호. dispose 후 늦게 도착한 연결은 버린다 (개발 모드에서 effect가 두 번 실행된다). */
  private attempt = 0;

  /**
   * @param place 들어갈 곳 (본섬 또는 2동·3동… 동네)
   * @param at 처음 설 곳 (기본: 내 집 문 앞)
   */
  constructor(
    readonly place: RoomPlace = 'town',
    readonly at: TownPlace = 'home',
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  async connect(): Promise<void> {
    const attempt = ++this.attempt;
    this.update({ status: 'connecting', error: undefined });
    try {
      // 웹 서버에서 입장 토큰을 받아 실시간 서버에 낸다
      const ticket = await call<TownTicket>('POST', '/api/town/token');
      if (attempt !== this.attempt) return;
      const options: JoinOptions = { token: ticket.token, place: this.place, at: this.at };
      const room = await new Client(realtimeUrl()).joinOrCreate(townConfig.roomName, options);
      if (attempt !== this.attempt) {
        room.leave();
        return;
      }
      this.room = room;
      const $ = Callbacks.get(room);
      const syncIds = () => this.update({ playerIds: [...room.state.players.keys()] as string[] });
      $.onAdd('players', syncIds);
      $.onRemove('players', (_, id) => {
        this.gestures.delete(String(id));
        syncIds();
      });
      $.listen('channel', (channel: number) => this.update({ channel }));
      room.onMessage(MSG.action, (m: ActionBroadcast) => this.applyAction(m.id, m.kind));
      room.onMessage(MSG.emote, (m: EmoteBroadcast) => this.applyEmote(m.id, m.kind));
      room.onMessage(MSG.snap, (m: SnapMessage) => this.snapListeners.forEach((fn) => fn(m)));
      room.onLeave(() => {
        if (attempt === this.attempt) this.update({ status: 'closed' });
      });
      this.update({ status: 'ready', selfId: room.sessionId, pass: ticket.pass, guest: ticket.guest });
    } catch (e) {
      if (attempt !== this.attempt) return;
      console.error(e);
      this.update({ status: 'error', error: '마을 서버에 연결하지 못했어요.' });
    }
  }

  dispose() {
    this.attempt++;
    this.room?.leave();
    this.room = null;
  }

  player(id: string): PlayerView | undefined {
    return this.room?.state.players.get(id) as PlayerView | undefined;
  }

  onSnap(fn: (s: SnapMessage) => void) {
    this.snapListeners.add(fn);
    return () => {
      this.snapListeners.delete(fn);
    };
  }

  sendMove(msg: MoveMessage) {
    this.room?.send(MSG.move, msg);
  }

  /** 전체 지도에서 고른 곳으로 간다. 서버가 자리를 정해 snap으로 알려 준다. */
  sendWarp(to: WarpMessage['to']) {
    const msg: WarpMessage = { to };
    this.room?.send(MSG.warp, msg);
  }

  /** 내 몸짓은 바로 보여 주고 서버로 보낸다 (다른 사람에게만 전달된다) */
  sendAction(kind: ActionKind) {
    this.applyAction(this.snapshot.selfId, kind);
    this.room?.send(MSG.action, { kind });
  }

  sendEmote(kind: EmoteKind) {
    this.applyEmote(this.snapshot.selfId, kind);
    this.room?.send(MSG.emote, { kind });
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
    g.actionUntil = now() + townConfig.actionDurationMs / 1000;
    // 박수 동작에는 박수 이모티콘을 같이 띄운다
    if (kind === 'clap') this.applyEmote(id, 'clap');
  }

  private applyEmote(id: string, kind: EmoteKind) {
    const g = this.gesture(id);
    g.emote = kind;
    g.emoteStart = now();
    g.emoteUntil = g.emoteStart + townConfig.emoteDurationMs / 1000;
  }
}
