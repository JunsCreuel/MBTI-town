import { afterEach, describe, expect, it, vi } from 'vitest';
import { signYoutube, verifyYoutube } from '@/shared/townToken';
import { checkVideo, clearVideoCache, isoDurationSeconds, lookupYoutube } from './youtube';

const ok = {
  snippet: { title: '  좋은   노래  ', categoryId: '10', liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT3M30S' },
  status: { embeddable: true, privacyStatus: 'public' },
};

describe('유튜브 신청곡 확인', () => {
  afterEach(() => {
    clearVideoCache();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('영상 길이(ISO 8601)를 초로 읽는다', () => {
    expect(isoDurationSeconds('PT3M30S')).toBe(210);
    expect(isoDurationSeconds('PT1H2M3S')).toBe(3723);
    expect(isoDurationSeconds('PT45S')).toBe(45);
    expect(isoDurationSeconds('P0D')).toBe(0);
    expect(isoDurationSeconds('엉터리')).toBe(0);
  });

  it('틀 수 있는 음악 영상이면 이름을 다듬어 돌려준다', () => {
    expect(checkVideo('dQw4w9WgXcQ', ok)).toEqual({ id: 'dQw4w9WgXcQ', title: '좋은 노래', seconds: 210 });
    expect(checkVideo('dQw4w9WgXcQ', { ...ok, status: { embeddable: true, privacyStatus: 'unlisted' } }).seconds).toBe(210);
    // 엔터테인먼트 카테고리로 올라온 뮤직비디오도 받는다
    expect(checkVideo('dQw4w9WgXcQ', { ...ok, snippet: { ...ok.snippet, categoryId: '24' } }).seconds).toBe(210);
  });

  it('비공개·퍼가기 막힘·연령 제한·라이브·음악·엔터테인먼트 아님·국내 차단·8분 넘음은 받지 않는다', () => {
    const bad = [
      undefined,
      { ...ok, status: { embeddable: true, privacyStatus: 'private' } },
      { ...ok, status: { embeddable: false, privacyStatus: 'public' } },
      { ...ok, contentDetails: { duration: 'PT3M', contentRating: { ytRating: 'ytAgeRestricted' } } },
      { ...ok, snippet: { ...ok.snippet, liveBroadcastContent: 'live' } },
      { ...ok, snippet: { ...ok.snippet, categoryId: '20' } },
      { ...ok, contentDetails: { duration: 'PT3M', regionRestriction: { blocked: ['KR'] } } },
      { ...ok, contentDetails: { duration: 'PT3M', regionRestriction: { allowed: ['US'] } } },
      { ...ok, contentDetails: { duration: 'PT8M1S' } },
      { ...ok, contentDetails: { duration: '' } },
    ];
    for (const item of bad) expect(() => checkVideo('dQw4w9WgXcQ', item)).toThrow();
  });

  it('제목·채널 이름에 욕설·성인·도박 같은 말이 있으면 받지 않는다 (노래 제목에 흔한 말은 괜찮다)', () => {
    expect(() => checkVideo('dQw4w9WgXcQ', { ...ok, snippet: { ...ok.snippet, title: '19금 영상 모음' } })).toThrow('부적절한 말');
    expect(() => checkVideo('dQw4w9WgXcQ', { ...ok, snippet: { ...ok.snippet, channelTitle: '카지노 채널' } })).toThrow('부적절한 말');
    expect(() => checkVideo('dQw4w9WgXcQ', { ...ok, snippet: { ...ok.snippet, title: 'free porn clip' } })).toThrow('부적절한 말');
    for (const title of ['Sexy Love (Official MV)', 'Kill This Love', '밤양갱']) {
      expect(checkVideo('dQw4w9WgXcQ', { ...ok, snippet: { ...ok.snippet, title } }).title).toBe(title);
    }
  });

  it('운영자가 끈 동안, 막은 영상·채널은 신청표를 주지 않는다', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    vi.stubEnv('TOWN_TOKEN_SECRET', 'test-secret-for-youtube-0123456789');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ ...ok, snippet: { ...ok.snippet, channelId: 'UCbad' } }] }), { status: 200 })));
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    await expect(lookupYoutube(url, 0, { on: async () => false, blocked: async () => null })).rejects.toThrow('쉬고 있어요');
    await expect(lookupYoutube(url, 0, { on: async () => true, blocked: async (v) => (v === 'dQw4w9WgXcQ' ? 'video' : null) })).rejects.toThrow('막아 둔 영상');
    await expect(lookupYoutube(url, 0, { on: async () => true, blocked: async (_v, c) => (c === 'UCbad' ? 'channel' : null) })).rejects.toThrow('막아 둔 채널');
    expect((await lookupYoutube(url, 0, { on: async () => true, blocked: async () => null })).song.id).toBe('dQw4w9WgXcQ');
  });

  it('API 키가 없으면 준비 중이라고 알린다', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');
    await expect(lookupYoutube('https://youtu.be/dQw4w9WgXcQ')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('링크가 아니면 받지 않고, 확인한 곡은 실시간 서버가 믿을 수 있게 서명한다', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    vi.stubEnv('TOWN_TOKEN_SECRET', 'test-secret-for-youtube-0123456789');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [ok] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(lookupYoutube('https://example.com')).rejects.toMatchObject({ code: 'bad_request' });
    expect(fetchMock).not.toHaveBeenCalled();
    const now = 1_000_000;
    const t = await lookupYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ', now);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(t.song).toEqual({ id: 'dQw4w9WgXcQ', title: '좋은 노래', seconds: 210 });
    expect(verifyYoutube(t.song, t.exp, t.sig, now)).toBe(true);
    // 곡을 바꾸거나 시간이 지나면 서명이 맞지 않는다
    expect(verifyYoutube({ ...t.song, seconds: 30 }, t.exp, t.sig, now)).toBe(false);
    expect(verifyYoutube({ ...t.song, title: '다른 곡' }, t.exp, t.sig, now)).toBe(false);
    expect(verifyYoutube(t.song, t.exp, t.sig, t.exp + 1)).toBe(false);
    expect(verifyYoutube(t.song, t.exp, 'nope', now)).toBe(false);
    expect(signYoutube(t.song, t.exp)).toBe(t.sig);
  });
});
