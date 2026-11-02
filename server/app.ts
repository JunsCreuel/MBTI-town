import { defineRoom, defineServer } from '@colyseus/core';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { plazaConfig } from '../src/config/game';
import { PlazaRoom } from './rooms/PlazaRoom';

/**
 * REDIS_URL이 있으면 Redis로 방 목록과 접속 정보를 공유해 서버를 여러 대로 늘릴 수 있다.
 * 없으면 서버 한 대의 메모리로 동작한다 (개발용).
 */
export function createRealtimeServer(redisUrl = process.env.REDIS_URL) {
  return defineServer({
    transport: new WebSocketTransport(),
    ...(redisUrl ? { presence: new RedisPresence(redisUrl), driver: new RedisDriver(redisUrl) } : {}),
    rooms: {
      [plazaConfig.roomName]: defineRoom(PlazaRoom),
    },
  });
}
