// 마을 방 하나 = 채널 하나. 본섬(가운데 중앙광장 + 둘레 다섯 지역의 1동) 또는 동네(2동·3동…) 하나를 맡는다.
// 방은 들어갈 곳(place)마다 따로 열리고, 정원이 차면 matchmaker가 같은 곳의 새 방(다음 채널)을 만든다.
// 들어올 때는 웹 서버가 준 입장 토큰(townToken.ts)을 확인한다. 이름·지역·집터는 토큰에 적힌 것만 믿는다.
import { Room, matchMaker, type Client } from '@colyseus/core';
import { townConfig } from '../../src/config/game';
import { MOVE_BUDGET_MAX, isMoveAllowed, normalizeAngle, refillMoveBudget } from '../../src/shared/movement';
import { isStartPoint, placePoint } from '../../src/shared/spawn';
import type { TownMap } from '../../src/shared/townMap';
import { verifyTownPass, type TownPass } from '../../src/shared/townToken';
import {
  ACTIONS, EMOTES, MSG,
  type ActionBroadcast, type ActionKind, type EmoteBroadcast, type EmoteKind, type JoinOptions, type MoveMessage,
  type Hood, type SnapMessage, type TownPlace,
  isTownPlace, parseRoomPlace,
} from '../../src/shared/protocol';
import { getHoodMap, getTownMap } from '../assets';
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

// 들어설 자리 규칙은 화면과 같이 쓴다 (src/shared/spawn.ts)
export { placePoint };

function kindOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const kind = (v as { kind?: unknown })?.kind;
  return typeof kind === 'string' && (allowed as readonly string[]).includes(kind) ? (kind as T) : null;
}

export class TownRoom extends Room<{ state: TownState; metadata: { channel: number; place: string } }> {
  maxClients = townRoomCapacity();
  patchRate = townConfig.patchRateMs;
  maxMessagesPerSecond = townConfig.maxMessagesPerSecond;
  state = new TownState();

  /** 이 방이 맡는 동네 (본섬이면 null) */
  private here: Hood | null = null;
  private map: TownMap = getTownMap();
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

  async onCreate(options?: JoinOptions) {
    const here = parseRoomPlace(options?.place);
    if (here === undefined) throw new Error('들어갈 곳이 올바르지 않습니다');
    this.here = here;
    if (here) this.map = getHoodMap(here.district);
    const place = here ? `${here.district}.${here.hood}` : 'town';
    this.state.channel = await this.nextChannelNumber(place);
    await this.setMetadata({ channel: this.state.channel, place });

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
    // 화면은 서버를 기다리지 않고 먼저 캐릭터를 세운다. 그 자리가 걸을 수 있는 곳이면 그대로 쓴다
    // (지도에서 어디로든 바로 갈 수 있으므로 새로 생기는 권한은 없다)
    const spawn = isStartPoint(this.map, options?.start)
      ? { x: options.start.x, z: options.start.z }
      : placePoint(this.map, pass, isTownPlace(options?.at) ? options.at : 'home', this.here);
    const player = new Player();
    player.pid = pass.pid;
    player.name = pass.name;
    player.handle = pass.handle;
    player.district = pass.district;
    player.color = pass.color;
    player.acc = pass.acc;
    player.mbti = pass.mbti ?? '';
    player.ilju = pass.ilju ?? '';
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
    if (!player || !pass || !isTownPlace(to)) return;
    const now = Date.now();
    if (now - (this.lastWarpAt.get(client.sessionId) ?? 0) < townConfig.warpCooldownMs) return;
    this.lastWarpAt.set(client.sessionId, now);
    const spawn = placePoint(this.map, pass, to, this.here);
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

  /** 같은 곳에서 비어 있는 가장 작은 채널 번호 */
  private async nextChannelNumber(place: string): Promise<number> {
    const rooms = await matchMaker.query({ name: this.roomName });
    const used = new Set(
      rooms
        .map((r) => r.metadata as { channel?: number; place?: string } | undefined)
        .filter((m) => m?.place === place)
        .map((m) => m?.channel),
    );
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }
}
