import { defineRoom, defineServer } from '@colyseus/core';
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
export function createRealtimeServer(redisUrl = process.env.REDIS_URL) {
  return defineServer({
    transport: new WebSocketTransport(),
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
