import { schema, t, type SchemaType } from '@colyseus/schema';

export const Player = schema(
  {
    mbti: t.string(),
    x: t.float32(),
    z: t.float32(),
    /** 바라보는 방향 (라디안) */
    rot: t.float32(),
    moving: t.boolean(),
  },
  'Player',
);
export type Player = SchemaType<typeof Player>;

export const PlazaState = schema(
  {
    /** 사람에게 보여 주는 채널 번호 (1부터) */
    channel: t.uint16(),
    players: t.map(Player),
  },
  'PlazaState',
);
export type PlazaState = SchemaType<typeof PlazaState>;
