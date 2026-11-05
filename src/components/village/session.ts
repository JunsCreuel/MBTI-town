// 마을 실시간 연결. React 화면(HUD)은 snapshot을 구독하고, 3D 장면은 매 프레임 room.state를 직접 읽는다.
import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { townConfig } from '@/config/game';
import { call } from '@/lib/api';
import { realtimeUrl, wakeRealtime } from '@/lib/realtime';
import type { TownTicket } from '@/server/scene/service';
import type { AccessoryId, AvatarBody, AvatarColor } from '@/shared/avatar';
import type { AnnounceBroadcast } from '@/shared/announce';
import type { District } from '@/shared/districts';
import {
  MSG,
  type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type JoinOptions,
  type MoveMessage, type MusicAdmin, type MusicResult, type MusicState, type RoomPlace, type SnapMessage, type TownPlace, type WarpMessage,
} from '@/shared/protocol';
import type { TownPass } from '@/shared/townToken';
import type { YoutubeSong } from '@/shared/clubMusic';
import { emitClubResult, setClubDj } from './club';
import { showAnnouncement } from '../app/AnnounceBanner';

/** 서버 상태 중 클라이언트가 읽는 부분 */
export interface PlayerView {
  pid: string;
  name: string;
  /** 방 주소 (공개한 사람만) */
  handle: string;
  district: District | '';
  color: AvatarColor;
  acc: AccessoryId;
  /** 캐릭터 몸 (예전 서버면 '' → 남자로 그린다) */
  body: AvatarBody | '';
  /** 이름표 둘째 줄 (없으면 '') */
  mbti: string;
  x: number;
  z: number;
  /** 바라보는 방향 (라디안) */
  rot: number;
  moving: boolean;
}

export interface Gesture {
  action?: ActionKind;
  /** 동작을 시작한 시각 (같은 동작을 다시 해도 처음부터 다시 그린다) */
  actionStart?: number;
  actionUntil: number;
  emote?: EmoteKind;
  emoteStart: number;
  emoteUntil: number;
}

/**
 * - loading: 입장 토큰을 받는 중 (마을을 그리려면 토큰의 이름·모습·집터가 필요하다)
 * - connecting: 토큰을 받았고 실시간 서버에 붙는 중. 마을은 이미 걸어 다닐 수 있다
 * - ready: 실시간 서버에 들어왔다 (이웃이 보인다)
 * - offline: 실시간 서버에 붙지 못했거나 끊겼다. 혼자 걸어 다니고 "다시 연결"할 수 있다
 * - error: 입장 토큰을 받지 못했다 (마을을 그릴 수 없다)
 */
export type SessionStatus = 'loading' | 'connecting' | 'ready' | 'offline' | 'error';

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

/** 내 몸짓을 적어 두는 자리 (실시간 서버에 붙기 전에도 내 몸짓은 보인다) */
export const SELF_GESTURE = '@me';

/** 초 단위 현재 시각. 장면 애니메이션과 몸짓 시간을 같은 시계로 맞춘다. */
export const now = () => performance.now() / 1000;

export class TownSession {
  room: Room | null = null;
  readonly gestures = new Map<string, Gesture>();
  private snapshot: SessionSnapshot = { status: 'loading', selfId: '', channel: 0, playerIds: [], pass: null, guest: true };
  private ticket: TownTicket | null = null;
  /** 접속할 때 서버에 알려 줄 지금 내 자리 */
  private here: (() => { x: number; z: number }) | null = null;
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

  /** 입장 토큰을 받는다. 받으면 마을을 그릴 수 있다 (실시간 서버는 join으로 따로 붙는다) */
  async prepare(): Promise<void> {
    const attempt = ++this.attempt;
    this.update({ status: 'loading', error: undefined });
    try {
      const ticket = await call<TownTicket>('POST', '/api/town/token');
      if (attempt !== this.attempt) return;
      this.ticket = ticket;
      this.update({ status: 'connecting', pass: ticket.pass, guest: ticket.guest });
    } catch (e) {
      if (attempt !== this.attempt) return;
      console.error(e);
      this.update({ status: 'error', error: '마을에 들어가지 못했어요.' });
    }
  }

  /**
   * 실시간 서버에 붙는다. 화면은 이미 내 캐릭터를 세워 두었으므로, 붙는 순간의 내 자리(here)를 서버에 알려 준다.
   * 서버가 잠들어 있으면 먼저 깨운 뒤에 붙는다 (깨는 동안 걸은 거리 때문에 자리가 어긋나지 않게).
   */
  async join(here: () => { x: number; z: number }): Promise<void> {
    this.here = here;
    const attempt = this.attempt;
    const ticket = this.ticket;
    if (!ticket) return;
    this.update({ status: 'connecting', error: undefined });
    try {
      await wakeRealtime();
      if (attempt !== this.attempt) return;
      const options: JoinOptions = { token: ticket.token, place: this.place, at: this.at, start: here() };
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
      // 내 캐릭터가 서버 상태에 들어온 뒤에 준비 완료로 본다
      await new Promise<void>((resolve, reject) => {
        if (room.state?.players?.get(room.sessionId)) return resolve();
        const timer = setTimeout(() => reject(new Error('내 캐릭터 상태를 받지 못했습니다')), 15_000);
        $.onAdd('players', (_: unknown, id: unknown) => {
          if (id === room.sessionId) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      if (attempt !== this.attempt) {
        room.leave();
        return;
      }
      room.onMessage(MSG.action, (m: ActionBroadcast) => this.applyAction(m.id, m.kind));
      room.onMessage(MSG.emote, (m: EmoteBroadcast) => this.applyEmote(m.id, m.kind));
      room.onMessage(MSG.snap, (m: SnapMessage) => this.snapListeners.forEach((fn) => fn(m)));
      room.onMessage(MSG.music, (m: MusicState) => setClubDj(m));
      room.onMessage(MSG.musicResult, (r: MusicResult) => emitClubResult(r));
      room.onMessage(MSG.announce, (m: AnnounceBroadcast) => showAnnouncement(m));
      room.onLeave((code: number) => {
        if (attempt !== this.attempt) return;
        this.room = null;
        this.update({
          status: 'offline',
          playerIds: [],
          selfId: '',
          // 같은 사람이 다른 창으로 들어오면 서버가 먼저 들어온 쪽을 내보낸다 (TownRoom.onJoin)
          error: code === 4001 ? '다른 창에서 마을에 들어왔어요' : '마을 서버와 연결이 끊겼어요',
        });
      });
      this.update({ status: 'ready', selfId: room.sessionId });
    } catch (e) {
      if (attempt !== this.attempt) return;
      // 혼자서도 걸을 수 있으므로 오류가 아니라 경고로 남긴다
      console.warn('마을 서버에 연결하지 못했습니다', e);
      this.room?.leave();
      this.room = null;
      this.update({ status: 'offline', playerIds: [], selfId: '', error: '마을 서버에 연결하지 못했어요' });
    }
  }

  /** 끊긴 뒤 다시 붙는다. 토큰이 만료됐을 수 있어 새로 받는다. */
  async reconnect(): Promise<void> {
    const here = this.here;
    if (!here) return;
    this.room?.leave();
    this.room = null;
    await this.prepare();
    if (this.snapshot.status === 'connecting') await this.join(here);
    else if (this.snapshot.status === 'error') this.update({ status: 'offline', error: '마을 서버에 연결하지 못했어요' });
  }

  get connected(): boolean {
    return this.snapshot.status === 'ready' && !!this.room;
  }

  dispose() {
    this.attempt++;
    this.room?.leave();
    this.room = null;
  }

  /** 서버 상태가 아직 오지 않았으면 undefined */
  player(id: string): PlayerView | undefined {
    return this.room?.state?.players?.get(id) as PlayerView | undefined;
  }

  onSnap(fn: (s: SnapMessage) => void) {
    this.snapListeners.add(fn);
    return () => {
      this.snapListeners.delete(fn);
    };
  }

  /** 서버에 보냈으면 true (아직 붙지 않았으면 보내지 않는다) */
  sendMove(msg: MoveMessage): boolean {
    if (!this.connected) return false;
    this.room!.send(MSG.move, msg);
    return true;
  }

  /**
   * 전체 지도에서 고른 곳으로 간다. 서버에 붙어 있으면 서버가 자리를 정해 snap으로 알려 주고,
   * 아직이면 화면이 같은 규칙(local)으로 정한 자리로 바로 옮긴다.
   */
  sendWarp(to: WarpMessage['to'], local: () => { x: number; z: number }) {
    if (this.connected) {
      const msg: WarpMessage = { to };
      this.room!.send(MSG.warp, msg);
      return;
    }
    const p = local();
    this.snapListeners.forEach((fn) => fn(p));
  }

  /** 내 몸짓은 바로 보여 주고 서버로 보낸다 (다른 사람에게만 전달된다) */
  sendAction(kind: ActionKind) {
    this.applyAction(SELF_GESTURE, kind);
    this.room?.send(MSG.action, { kind });
  }

  /** 내 동작을 멈춘다 (낚시를 그만둘 때). 다른 사람 화면에서는 동작 시간이 끝나면 멈춘다 */
  endAction() {
    const g = this.gestures.get(SELF_GESTURE);
    if (g) g.actionUntil = 0;
  }

  /** 클럽: DJ에게 신청곡 (서버가 채널 모두에게 알린다). 붙어 있지 않으면 false */
  requestSong(index: number): boolean {
    if (!this.room) return false;
    this.room.send(MSG.musicRequest, { index });
    return true;
  }

  /** 클럽 운영자: 지금 곡 넘기기·신청곡 빼기 (실시간 서버가 운영자 토큰인지 확인한다) */
  musicAdmin(cmd: MusicAdmin): boolean {
    if (!this.room) return false;
    this.room.send(MSG.musicAdmin, cmd);
    return true;
  }

  /** 클럽: 유튜브 신청곡 (웹 서버가 확인하고 서명한 신청표를 그대로 보낸다) */
  requestYoutube(ticket: { song: YoutubeSong; exp: number; sig: string }): boolean {
    if (!this.room) return false;
    this.room.send(MSG.musicRequest, { youtube: ticket });
    return true;
  }

  sendEmote(kind: EmoteKind) {
    this.applyEmote(SELF_GESTURE, kind);
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
    g.actionStart = now();
    g.actionUntil = g.actionStart + (kind === 'fish' ? townConfig.fishActionMs : kind === 'jump' ? townConfig.jumpMs : townConfig.actionDurationMs) / 1000;
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
