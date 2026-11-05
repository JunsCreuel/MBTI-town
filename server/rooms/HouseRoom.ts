// 집 안(방) 하나 = 실시간 방 하나. 주인과 손님이 같이 들어와 서로 보인다.
// 웹 서버가 방을 볼 수 있는 사람에게만 house가 담긴 토큰을 준다 (공개 범위·차단 검사, /api/house/token).
// 실시간 서버는 DB를 보지 않으므로 가구 자리는 모른다. 위치는 방 안인지와 걷는 속도만 검사한다.
import { Room, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { roomConfig, townConfig } from '../../src/config/game';
import { MOVE_BUDGET_MAX, normalizeAngle, refillMoveBudget } from '../../src/shared/movement';
import { ACTIONS, EMOTES, MSG, type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type HouseJoinOptions, type MoveMessage } from '../../src/shared/protocol';
import { ROOM_BODY_RADIUS } from '../../src/shared/room';
import { listenAnnouncements } from '../announce';
import { verifyTownPass, type TownPass } from '../../src/shared/townToken';
import { Player } from './TownState';

export const HouseState = schema({ players: t.map(Player) }, 'HouseState');
export type HouseState = SchemaType<typeof HouseState>;

const W = roomConfig.width;
const D = roomConfig.depth;

/** 방 안의 자리인지 (벽에서 몸 반지름만큼 떨어진 곳) */
export function insideHouse(p: unknown): p is { x: number; z: number } {
  const q = p as { x?: unknown; z?: unknown } | null;
  if (typeof q !== 'object' || q === null || typeof q.x !== 'number' || typeof q.z !== 'number') return false;
  if (!Number.isFinite(q.x) || !Number.isFinite(q.z)) return false;
  const r = ROOM_BODY_RADIUS - 0.02;
  return q.x >= r && q.z >= r && q.x <= W - r && q.z <= D - r;
}

function isMove(v: unknown): v is MoveMessage {
  const m = v as MoveMessage;
  return typeof m === 'object' && m !== null && typeof m.rot === 'number' && Number.isFinite(m.rot) && typeof m.moving === 'boolean' && insideHouse(m);
}

function kindOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const kind = (v as { kind?: unknown })?.kind;
  return typeof kind === 'string' && (allowed as readonly string[]).includes(kind) ? (kind as T) : null;
}

export class HouseRoom extends Room<{ state: HouseState }> {
  /** 서버 전체 공지 듣기를 멈춘다 */
  private stopAnnouncements?: () => void;
  maxClients = roomConfig.maxPeople;
  patchRate = townConfig.patchRateMs;
  maxMessagesPerSecond = townConfig.maxMessagesPerSecond;
  state = new HouseState();

  private readonly budgets = new Map<string, { value: number; at: number }>();
  private readonly passes = new Map<string, TownPass>();
  private readonly lastGestureAt = new Map<string, number>();

  /** 이 집에 들어갈 수 있는 토큰인지 (토큰의 house와 들어가려는 집이 같아야 한다) */
  onAuth(_client: Client, options?: HouseJoinOptions): TownPass {
    const pass = verifyTownPass(options?.token);
    if (!pass?.house || typeof options?.house !== 'string' || pass.house !== options.house) {
      throw new Error('이 집에 들어갈 수 있는 토큰이 아닙니다');
    }
    return pass;
  }

  onCreate() {
    this.autoDispose = true;
    this.stopAnnouncements = listenAnnouncements(this);
    this.onMessage(MSG.move, (client, message: unknown) => this.handleMove(client, message));
    this.onMessage(MSG.action, (client, message: unknown) => {
      const kind = kindOf<ActionKind>(message, ACTIONS);
      if (!kind || !this.takeGestureSlot(client)) return;
      const payload: ActionBroadcast = { id: client.sessionId, kind };
      this.broadcast(MSG.action, payload, { except: client });
    });
    this.onMessage(MSG.emote, (client, message: unknown) => {
      const kind = kindOf<EmoteKind>(message, EMOTES);
      if (!kind || !this.takeGestureSlot(client)) return;
      const payload: EmoteBroadcast = { id: client.sessionId, kind };
      this.broadcast(MSG.emote, payload, { except: client });
    });
  }

  onJoin(client: Client, options?: HouseJoinOptions) {
    const pass = client.auth as TownPass;
    // 같은 사람이 다른 창으로 또 들어오면 먼저 들어온 쪽을 내보낸다
    for (const [id, p] of this.passes) {
      if (p.pid === pass.pid) this.clients.find((c) => c.sessionId === id)?.leave(4001);
    }
    this.passes.set(client.sessionId, pass);
    const start = insideHouse(options?.start) ? options.start : { x: W / 2, z: D - 1.5 };
    const player = new Player();
    player.pid = pass.pid;
    player.name = pass.name;
    player.handle = pass.handle;
    player.district = pass.district;
    player.color = pass.color;
    player.acc = pass.acc;
    player.body = pass.body;
    player.mbti = pass.mbti ?? '';
    player.x = start.x;
    player.z = start.z;
    player.rot = 0;
    player.moving = false;
    this.state.players.set(client.sessionId, player);
    this.budgets.set(client.sessionId, { value: MOVE_BUDGET_MAX, at: Date.now() });
  }

  onDispose() {
    this.stopAnnouncements?.();
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.budgets.delete(client.sessionId);
    this.passes.delete(client.sessionId);
    this.lastGestureAt.delete(client.sessionId);
  }

  private handleMove(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    const budget = this.budgets.get(client.sessionId);
    if (!player || !budget || !isMove(message)) return;
    const now = Date.now();
    budget.value = refillMoveBudget(budget.value, now - budget.at);
    budget.at = now;
    const dist = Math.hypot(message.x - player.x, message.z - player.z);
    if (dist > budget.value + 0.05) {
      client.send(MSG.snap, { x: player.x, z: player.z });
      return;
    }
    budget.value -= dist;
    player.x = message.x;
    player.z = message.z;
    player.rot = normalizeAngle(message.rot);
    player.moving = message.moving;
  }

  private takeGestureSlot(client: Client): boolean {
    const now = Date.now();
    if (now - (this.lastGestureAt.get(client.sessionId) ?? 0) < townConfig.emoteCooldownMs) return false;
    this.lastGestureAt.set(client.sessionId, now);
    return true;
  }
}
