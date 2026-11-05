import { schema, t, type SchemaType } from '@colyseus/schema';

export const Player = schema(
  {
    /** 마을 사람 번호 (townToken.ts). 차단한 사람을 화면에서 숨길 때 쓴다. */
    pid: t.string(),
    name: t.string(),
    /** 방 주소 (공개한 사람만, 아니면 '') */
    handle: t.string(),
    /** 사는 지역 (손님은 '') */
    district: t.string(),
    color: t.string(),
    acc: t.string(),
    /** 이름표 둘째 줄: MBTI 태그 (없으면 '') */
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

export const TownState = schema(
  {
    /** 사람에게 보여 주는 채널 번호 (1부터) */
    channel: t.uint16(),
    players: t.map(Player),
  },
  'TownState',
);
export type TownState = SchemaType<typeof TownState>;
