// 유튜브 IFrame 플레이어 (클럽 유튜브 신청곡). 유튜브 정책에 따라 화면에 보이는 플레이어(200×200 이상)로만 튼다.
// API 스크립트는 처음 쓸 때 한 번만 불러온다.

/** 쓰는 기능만 적은 플레이어 모양 (https://developers.google.com/youtube/iframe_api_reference) */
export interface YtPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YtNamespace {
  Player: new (
    el: HTMLElement,
    o: {
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** 플레이어 상태 번호 */
export const YT_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

let loading: Promise<YtNamespace> | null = null;

export function loadYoutubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YtNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error('youtube_api'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** host 안에 빈 플레이어를 만든다 (준비되면 돌려준다). 영상은 loadVideoById로 넣는다 */
export async function createYoutubePlayer(
  host: HTMLElement,
  events: { onState: (state: number) => void; onError: (code: number) => void },
): Promise<YtPlayer> {
  const YT = await loadYoutubeApi();
  const el = document.createElement('div');
  host.replaceChildren(el);
  return new Promise<YtPlayer>((resolve) => {
    const player: YtPlayer = new YT.Player(el, {
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3, origin: window.location.origin },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => events.onState(e.data),
        onError: (e) => events.onError(e.data),
      },
    });
  });
}
