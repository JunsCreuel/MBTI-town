// 서버 전체 공지: 웹 서버(Vercel)가 서명해서 POST /scene/announce 로 보내면, 서명을 확인하고
// 모든 방(마을·동네·놀이터·집 안)에 퍼뜨린다. 방들은 presence 주제(ANNOUNCE_TOPIC)를 듣고 있다.
// Redis를 쓰면 서버가 여러 대여도 모든 서버의 방에 간다.
import { createEndpoint, createRouter, matchMaker, type Room } from '@colyseus/core';
import { announcementBody, announcementText, parseAnnouncement, type AnnounceBroadcast } from '../src/shared/announce';
import { MSG } from '../src/shared/protocol';
import { verifyAnnouncement } from '../src/shared/townToken';

export const ANNOUNCE_TOPIC = 'scene:announce';

export const announceRoutes = createRouter({
  announce: createEndpoint('/scene/announce', { method: 'POST' }, async (ctx) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const a = parseAnnouncement(body);
    if (!a) throw ctx.error(400, { message: '공지 모양이 올바르지 않습니다' });
    if (!verifyAnnouncement(announcementBody(a), body.ts, body.sig)) throw ctx.error(403, { message: '서명이 맞지 않습니다' });
    const out: AnnounceBroadcast = { kind: a.kind, text: announcementText(a), at: Date.now() };
    await matchMaker.presence.publish(ANNOUNCE_TOPIC, out);
    return ctx.json({ ok: true });
  }),
});

/** 방이 만들어질 때 부른다: 공지가 오면 그 방의 모두에게 보낸다. 돌려준 함수는 방이 없어질 때 부른다 */
export function listenAnnouncements(room: Room): () => void {
  const onAnnounce = (b: AnnounceBroadcast) => room.broadcast(MSG.announce, b);
  void room.presence.subscribe(ANNOUNCE_TOPIC, onAnnounce);
  return () => void room.presence.unsubscribe(ANNOUNCE_TOPIC, onAnnounce);
}
