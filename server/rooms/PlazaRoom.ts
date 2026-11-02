// 마을 방 하나 = 채널 하나. 한 방이 마을 전체(가운데 광장 + 둘레 16개 유형 마을)를 맡는다.
// 정원이 차면 matchmaker가 새 방(다음 채널)을 만든다.
import { Room, matchMaker, type Client } from '@colyseus/core';
import { plazaConfig, townConfig } from '../../src/config/game';
import { isMbtiType } from '../../src/design/mbti';
import { MOVE_BUDGET_MAX, isMoveAllowed, normalizeAngle, refillMoveBudget } from '../../src/shared/movement';
import { randomSpawnPoint, spawnName } from '../../src/shared/plazaMap';
import {
  ACTIONS, EMOTES, MSG,
  type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type JoinOptions, type MoveMessage,
  type SnapMessage,
} from '../../src/shared/protocol';
import { getPlazaMap } from '../assets';
import { Player, PlazaState } from './PlazaState';

export function plazaRoomCapacity(): number {
  const fromEnv = Number(process.env.PLAZA_ROOM_CAPACITY);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : plazaConfig.roomCapacity;
}

function isMoveMessage(v: unknown): v is MoveMessage {
  const m = v as MoveMessage;
  return (
    typeof m === 'object' && m !== null &&
    typeof m.x === 'number' && typeof m.z === 'number' &&
    typeof m.rot === 'number' && Number.isFinite(m.rot) &&
    typeof m.moving === 'boolean'
  );
}

function kindOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const kind = (v as { kind?: unknown })?.kind;
  return typeof kind === 'string' && (allowed as readonly string[]).includes(kind) ? (kind as T) : null;
}

export class PlazaRoom extends Room<{ state: PlazaState; metadata: { channel: number } }> {
  maxClients = plazaRoomCapacity();
  patchRate = plazaConfig.patchRateMs;
  maxMessagesPerSecond = plazaConfig.maxMessagesPerSecond;
  state = new PlazaState();

  private readonly map = getPlazaMap();
  /** 손님별 이동 예산 (movement.ts 참고) */
  private readonly moveBudget = new Map<string, { value: number; at: number }>();
  private readonly lastGestureAt = new Map<string, number>();
  private readonly lastWarpAt = new Map<string, number>();

  async onCreate() {
    this.state.channel = await this.nextChannelNumber();
    await this.setMetadata({ channel: this.state.channel });

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

    this.onMessage(MSG.warp, (client, message: unknown) => this.handleWarp(client, message));
  }

  onJoin(client: Client, options?: JoinOptions) {
    if (!isMbtiType(options?.mbti)) throw new Error('MBTI 유형이 올바르지 않습니다');
    // 들어오면 내 유형 마을에서 시작한다
    const spawn = randomSpawnPoint(this.map, Math.random, spawnName(options.mbti));
    const player = new Player();
    player.mbti = options.mbti;
    player.x = spawn.x;
    player.z = spawn.z;
    player.rot = 0;
    player.moving = false;
    this.state.players.set(client.sessionId, player);
    this.moveBudget.set(client.sessionId, { value: MOVE_BUDGET_MAX, at: Date.now() });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.moveBudget.delete(client.sessionId);
    this.lastGestureAt.delete(client.sessionId);
    this.lastWarpAt.delete(client.sessionId);
  }

  /** 전체 지도에서 광장이나 유형 마을을 누르면 그 마을 스폰으로 옮긴다 */
  private handleWarp(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    const to = (message as { to?: unknown } | null)?.to;
    if (!player || (to !== 'plaza' && !isMbtiType(to))) return;
    const now = Date.now();
    if (now - (this.lastWarpAt.get(client.sessionId) ?? 0) < townConfig.warpCooldownMs) return;
    this.lastWarpAt.set(client.sessionId, now);
    const spawn = randomSpawnPoint(this.map, Math.random, spawnName(to));
    player.x = spawn.x;
    player.z = spawn.z;
    player.moving = false;
    this.moveBudget.set(client.sessionId, { value: MOVE_BUDGET_MAX, at: now });
    const snap: SnapMessage = { x: spawn.x, z: spawn.z };
    client.send(MSG.snap, snap);
  }

  private handleMove(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    const budget = this.moveBudget.get(client.sessionId);
    if (!player || !budget || !isMoveMessage(message)) return;
    const now = Date.now();
    budget.value = refillMoveBudget(budget.value, now - budget.at);
    budget.at = now;
    if (!isMoveAllowed(this.map, player, message, budget.value)) {
      // 갈 수 없는 위치면 서버 위치로 되돌린다
      client.send(MSG.snap, { x: player.x, z: player.z });
      return;
    }
    budget.value -= Math.hypot(message.x - player.x, message.z - player.z);
    player.x = message.x;
    player.z = message.z;
    player.rot = normalizeAngle(message.rot);
    player.moving = message.moving;
  }

  /** 동작·이모티콘 재사용 대기 시간 검사 */
  private takeGestureSlot(client: Client): boolean {
    const now = Date.now();
    const last = this.lastGestureAt.get(client.sessionId) ?? 0;
    if (now - last < plazaConfig.emoteCooldownMs) return false;
    this.lastGestureAt.set(client.sessionId, now);
    return true;
  }

  /** 비어 있는 가장 작은 채널 번호 */
  private async nextChannelNumber(): Promise<number> {
    const rooms = await matchMaker.query({ name: this.roomName });
    const used = new Set(rooms.map((r) => (r.metadata as { channel?: number } | undefined)?.channel));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }
}
