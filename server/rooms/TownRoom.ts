// 마을 방 하나 = 채널 하나. 한 방이 마을 전체(가운데 중앙광장 + 둘레 다섯 지역)를 맡는다.
// 정원이 차면 matchmaker가 새 방(다음 채널)을 만든다.
// 들어올 때는 웹 서버가 준 입장 토큰(townToken.ts)을 확인한다. 이름·지역·집터는 토큰에 적힌 것만 믿는다.
import { Room, matchMaker, type Client } from '@colyseus/core';
import { townConfig } from '../../src/config/game';
import { isDistrict } from '../../src/shared/districts';
import { MOVE_BUDGET_MAX, isMoveAllowed, normalizeAngle, refillMoveBudget } from '../../src/shared/movement';
import { lotDoor, randomSpawnPoint, spawnName, type TownMap } from '../../src/shared/townMap';
import { verifyTownPass, type TownPass } from '../../src/shared/townToken';
import {
  ACTIONS, EMOTES, MSG,
  type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type JoinOptions, type MoveMessage,
  type SnapMessage, type TownPlace,
} from '../../src/shared/protocol';
import { getTownMap } from '../assets';
import { Player, TownState } from './TownState';

export function townRoomCapacity(): number {
  const fromEnv = Number(process.env.TOWN_ROOM_CAPACITY);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : townConfig.roomCapacity;
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

function isPlace(v: unknown): v is TownPlace {
  return v === 'home' || v === 'plaza' || isDistrict(v);
}

/** 그곳에 들어설 자리. 내 집은 문 앞, 집이 없으면 내 지역 입구, 손님은 중앙광장. */
export function placePoint(map: TownMap, pass: Pick<TownPass, 'district' | 'lot'>, place: TownPlace, rand = Math.random) {
  if (place === 'home') {
    const lot = pass.district ? map.lots[pass.district].find((l) => l.index === pass.lot) : undefined;
    if (lot) {
      const door = lotDoor(lot);
      return { x: door.x + (rand() - 0.5) * 0.4, z: door.z + (rand() - 0.5) * 0.4 };
    }
    return randomSpawnPoint(map, rand, spawnName(pass.district || 'plaza'));
  }
  return randomSpawnPoint(map, rand, spawnName(place));
}

function kindOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const kind = (v as { kind?: unknown })?.kind;
  return typeof kind === 'string' && (allowed as readonly string[]).includes(kind) ? (kind as T) : null;
}

export class TownRoom extends Room<{ state: TownState; metadata: { channel: number } }> {
  maxClients = townRoomCapacity();
  patchRate = townConfig.patchRateMs;
  maxMessagesPerSecond = townConfig.maxMessagesPerSecond;
  state = new TownState();

  private readonly map = getTownMap();
  /** 손님별 이동 예산 (movement.ts 참고) */
  private readonly moveBudget = new Map<string, { value: number; at: number }>();
  private readonly lastGestureAt = new Map<string, number>();
  private readonly lastWarpAt = new Map<string, number>();
  private readonly passes = new Map<string, TownPass>();

  /** 토큰 확인은 들어오기 전에 한다 (틀리면 접속을 받지 않는다) */
  onAuth(_client: Client, options?: JoinOptions): TownPass {
    const pass = verifyTownPass(options?.token);
    if (!pass) throw new Error('입장 토큰이 없거나 만료되었습니다');
    return pass;
  }

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
    const pass = client.auth as TownPass;
    // 같은 사람이 다른 창으로 또 들어오면 먼저 들어온 쪽을 내보낸다
    for (const [id, p] of this.passes) {
      if (p.pid === pass.pid) this.clients.find((c) => c.sessionId === id)?.leave(4001);
    }
    this.passes.set(client.sessionId, pass);
    const spawn = placePoint(this.map, pass, isPlace(options?.at) ? options.at : 'home');
    const player = new Player();
    player.pid = pass.pid;
    player.name = pass.name;
    player.handle = pass.handle;
    player.district = pass.district;
    player.color = pass.color;
    player.acc = pass.acc;
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
    this.passes.delete(client.sessionId);
  }

  /** 전체 지도에서 중앙광장·지역·내 집을 누르면 그곳으로 옮긴다 */
  private handleWarp(client: Client, message: unknown) {
    const player = this.state.players.get(client.sessionId);
    const pass = this.passes.get(client.sessionId);
    const to = (message as { to?: unknown } | null)?.to;
    if (!player || !pass || !isPlace(to)) return;
    const now = Date.now();
    if (now - (this.lastWarpAt.get(client.sessionId) ?? 0) < townConfig.warpCooldownMs) return;
    this.lastWarpAt.set(client.sessionId, now);
    const spawn = placePoint(this.map, pass, to);
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
    if (now - last < townConfig.emoteCooldownMs) return false;
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
