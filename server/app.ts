import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { defineRoom, defineServer, matchMaker } from '@colyseus/core';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { roomConfig, townConfig } from '../src/config/game';
import { announceRoutes } from './announce';
import { HouseRoom } from './rooms/HouseRoom';
import { TownRoom } from './rooms/TownRoom';

/**
 * REDIS_URL이 있으면 Redis로 방 목록과 접속 정보를 공유해 서버를 여러 대로 늘릴 수 있다.
 * 없으면 서버 한 대의 메모리로 동작한다 (개발용).
 */
/** HTTP 본문 상한 (바이트). 방 찾기 요청(입장 토큰 포함)·공지는 몇 KB 안이다 */
export const MAX_HTTP_BODY = 16 * 1024;

/**
 * 큰 본문을 보내 서버 메모리를 채우지 못하게, 본문을 읽기 전에 거른다.
 * Colyseus는 서명·토큰을 확인하기 전에 본문 전체를 읽으므로 여기서 먼저 막는다 (길이를 안 밝힌 본문도 막는다)
 */
function guardBodies(server: Server): Server {
  const emit = server.emit.bind(server) as (event: string, ...args: unknown[]) => boolean;
  server.emit = ((event: string, ...args: unknown[]) => {
    if (event === 'request') {
      const [req, res] = args as [IncomingMessage, ServerResponse];
      const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET');
      const length = Number(req.headers['content-length'] ?? NaN);
      if (hasBody && (!Number.isFinite(length) || length > MAX_HTTP_BODY)) {
        res.writeHead(413, { 'content-type': 'application/json', 'access-control-allow-origin': req.headers.origin ?? '*' });
        res.end(JSON.stringify({ error: 'too_large' }));
        req.resume();
        return true;
      }
    }
    return emit(event, ...args);
  }) as Server['emit'];
  return server;
}

export function createRealtimeServer(redisUrl = process.env.REDIS_URL) {
  // 화면은 joinOrCreate만 쓴다. 방을 마음대로 만드는 create·join은 열지 않는다 (joinById는 같은 방 다시 들어가기 테스트용)
  matchMaker.controller.exposedMethods = ['joinOrCreate', 'joinById', 'reconnect'];
  return defineServer({
    transport: new WebSocketTransport({ server: guardBodies(createServer()) }),
    ...(redisUrl ? { presence: new RedisPresence(redisUrl), driver: new RedisDriver(redisUrl) } : {}),
    rooms: {
      // 본섬과 동네(2동·3동…)마다 따로 방을 연다. 같은 곳끼리만 채널이 나뉜다.
      [townConfig.roomName]: defineRoom(TownRoom).filterBy(['place']),
      // 집 안(방)은 집마다 하나. 주인과 손님이 같은 방에 들어온다.
      [roomConfig.realtimeRoomName]: defineRoom(HouseRoom).filterBy(['house']),
    },
    // 서버 전체 공지 (웹 서버가 서명해서 보낸다)
    routes: announceRoutes,
  });
}
