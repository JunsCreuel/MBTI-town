'use client';

// 클럽 음악: 들어오면 바로 튼다 (브라우저가 막으면 "음악 켜기"를 누른다). 클럽에 있는 사람은 모두 같은 곡의 같은 자리를 듣는다.
// 끄면 기억해 두고 다음에 와도 꺼 둔다. 무대에서 멀어지면 조금 작게 들린다. 다른 화면으로 가면 멈춘다.
// 유튜브 신청곡은 화면에 보이는 유튜브 플레이어(200×200 이상, 유튜브 정책)로 튼다. 그동안 클럽 음원은 쉰다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioSource, onUserGesture } from '@/lib/audio';
import { CLUB_TRACKS, type YoutubeSong } from '@/shared/clubMusic';
import { creditLine } from '@/shared/music';
import { Icon } from '../app/Icon';
import { clubAudio, clubQueue, clubSchedule, onClubDj, setClubDj, songKey, songTitle } from './club';
import { YT_STATE, createYoutubePlayer, type YtPlayer } from './youtubePlayer';

const PREF_KEY = 'scene:club-music';
const VOLUME = 0.7;
/** 노래 위치가 다른 사람과 이만큼(초) 넘게 어긋나면 맞춘다 */
const RESYNC_SEC = 2;
/** 유튜브는 광고·버퍼링이 있어 조금 더 너그럽게 맞춘다 */
const YT_RESYNC_SEC = 4;

type Status = 'off' | 'loading' | 'playing' | 'blocked';


function wantMusic(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveWant(on: boolean) {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, 'off');
  } catch {
    // 저장이 안 돼도 이번에는 따른다
  }
}

/** distance: 내 캐릭터와 무대 가운데 사이 거리 (칸) */
export function ClubMusic({ distance }: { distance: () => number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const want = useRef(true);
  /** 지금 넣어 둔 곡 (songKey) */
  const current = useRef('');
  const [status, setStatusState] = useState<Status>('off');
  const statusRef = useRef<Status>('off');
  const setStatus = useCallback((next: Status | ((s: Status) => Status)) => {
    const v = typeof next === 'function' ? next(statusRef.current) : next;
    statusRef.current = v;
    setStatusState(v);
  }, []);
  const [song, setSong] = useState<{ index: number; yt?: YoutubeSong }>(() => clubSchedule() ?? { index: 0 });
  /** 지금 곡을 신청한 사람, 기다리는 신청곡 수 */
  const [requestedBy, setRequestedBy] = useState('');
  const [waiting, setWaiting] = useState(0);

  // 유튜브 플레이어: 처음 유튜브 곡이 나올 때 만들고 클럽에 있는 동안 둔다
  const ytHost = useRef<HTMLDivElement | null>(null);
  const yt = useRef<YtPlayer | null>(null);
  const ytMaking = useRef<Promise<YtPlayer | null> | null>(null);
  /** 우리가 멈춘 것인지 (사람이 플레이어를 눌러 멈춘 것과 가른다) */
  const ytOwnPause = useRef(false);
  const ytVolume = useRef(-1);
  const [ytError, setYtError] = useState('');
  const alive = useRef(true);
  const playRef = useRef<() => void>(() => {});

  const element = useCallback(() => {
    if (audio.current) return audio.current;
    const a = new Audio();
    a.preload = 'auto';
    a.volume = VOLUME;
    audio.current = a;
    return a;
  }, []);

  const pauseYoutube = useCallback(() => {
    const p = yt.current;
    if (!p) return;
    const st = p.getPlayerState();
    if (st === YT_STATE.playing || st === YT_STATE.buffering) {
      ytOwnPause.current = true;
      p.pauseVideo();
    }
  }, []);

  const ensurePlayer = useCallback((): Promise<YtPlayer | null> => {
    if (yt.current) return Promise.resolve(yt.current);
    const host = ytHost.current;
    if (!host) return Promise.resolve(null);
    ytMaking.current ??= createYoutubePlayer(host, {
      onState: (st) => {
        if (st === YT_STATE.playing) {
          setYtError('');
          if (want.current) setStatus('playing');
        } else if (st === YT_STATE.ended) {
          // 시계보다 조금 일찍 끝나면 다음 곡 시작 시각까지 기다린다
          const s = clubSchedule();
          if (s && songKey(s) === current.current) setTimeout(() => alive.current && want.current && playRef.current(), Math.min(5000, s.left * 1000 + 60));
          else playRef.current();
        } else if (st === YT_STATE.paused) {
          // 사람이 플레이어를 눌러 멈췄으면 꺼 둔 것으로 본다 (다시 켜면 지금 자리부터)
          if (!ytOwnPause.current && !document.hidden && statusRef.current === 'playing') setStatus('off');
          ytOwnPause.current = false;
        }
      },
      onError: () => setYtError('이 영상은 여기서 틀 수 없어요. 다음 곡을 기다려 주세요.'),
    })
      .then((p) => {
        if (!alive.current) {
          p.destroy();
          return null;
        }
        yt.current = p;
        return p;
      })
      .catch(() => {
        setYtError('유튜브 플레이어를 불러오지 못했어요.');
        return null;
      })
      .finally(() => {
        ytMaking.current = null;
      });
    return ytMaking.current;
  }, [setStatus]);

  const playYoutube = useCallback(
    async (s: { yt?: YoutubeSong; offset: number }) => {
      if (!s.yt) return;
      const key = songKey({ index: -1, yt: s.yt });
      const p = await ensurePlayer();
      if (!p || !alive.current || !want.current) return;
      // 플레이어를 만드는 사이에 시간이 흘렀으면 지금 자리로
      const now = clubSchedule();
      const offset = now && songKey(now) === key ? now.offset : s.offset;
      if (current.current !== key) {
        current.current = key;
        p.loadVideoById({ videoId: s.yt.id, startSeconds: offset });
      } else {
        if (Math.abs(p.getCurrentTime() - offset) > YT_RESYNC_SEC) p.seekTo(offset, true);
        p.playVideo();
      }
      // 브라우저가 소리 나는 자동 재생을 막으면 "음악 켜기"를 누르게 한다
      setTimeout(() => {
        const st = yt.current?.getPlayerState();
        if (want.current && current.current === key && statusRef.current === 'loading' && st !== YT_STATE.playing && st !== YT_STATE.buffering) setStatus('blocked');
      }, 4000);
    },
    [ensurePlayer, setStatus],
  );

  /** 시계로 정한 곡·위치에서 튼다 (곡이 같으면 위치만 맞춘다). 클럽을 나간 뒤에는 아무것도 하지 않는다 */
  const play = useCallback(() => {
    if (!alive.current) return;
    const s = clubSchedule();
    if (!s) return;
    setSong(s.yt ? { index: -1, yt: s.yt } : { index: s.index });
    setRequestedBy(s.by);
    setWaiting(clubQueue().length);
    // 다른 BGM 플레이어는 멈춘다
    window.dispatchEvent(new CustomEvent('scene:bgm', { detail: 'club' }));
    const key = songKey(s);
    setStatus((st) => (st === 'playing' && current.current === key ? st : 'loading'));
    if (s.yt) {
      audio.current?.pause();
      clubAudio.el = null;
      clubAudio.index = -1;
      void playYoutube(s);
      return;
    }
    pauseYoutube();
    const a = element();
    if (current.current !== key || !a.src) {
      a.src = audioSource(CLUB_TRACKS[s.index].key);
      current.current = key;
    } else if (Math.abs(a.currentTime - s.offset) > RESYNC_SEC) {
      a.currentTime = s.offset;
    }
    clubAudio.el = a;
    clubAudio.index = s.index;
    a.play()
      .then(() => setStatus('playing'))
      .catch((e: Error) => {
        // 새 곡을 넣느라 앞의 play가 끊긴 것은 괜찮다
        if (e?.name === 'AbortError') return;
        setStatus('blocked');
      });
  }, [element, pauseYoutube, playYoutube, setStatus]);
  playRef.current = play;

  const stop = useCallback(
    (nextStatus: 'off' | 'blocked' = 'off') => {
      audio.current?.pause();
      pauseYoutube();
      setStatus(nextStatus);
    },
    [pauseYoutube, setStatus],
  );

  // 오디오 이벤트: 곡 정보를 읽으면 위치를 맞추고, 곡이 끝나면 다음 곡
  useEffect(() => {
    const a = element();
    const onMeta = () => {
      const s = clubSchedule();
      if (!s) return;
      if (songKey(s) === current.current) a.currentTime = s.offset;
      else play();
    };
    // 곡이 시계보다 조금 일찍 끝나면 다음 곡 시작 시각까지 기다린다 (같은 곡을 처음부터 다시 틀지 않게)
    let wait: ReturnType<typeof setTimeout> | undefined;
    const onEnded = () => {
      const s = clubSchedule();
      if (s && songKey(s) === current.current) wait = setTimeout(() => want.current && play(), Math.min(5000, s.left * 1000 + 60));
      else play();
    };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnded);
    return () => {
      clearTimeout(wait);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnded);
    };
  }, [element, play]);

  // 들어오면 튼다 (꺼 둔 사람은 그대로). 나가면 멈추고 비운다.
  // 먼저 alive를 끈다: 아래 setClubDj(null)이 신청곡 흐름 듣기(onClubDj)를 깨워 play()를 부르면, 광장에서도 클럽 곡이 다시 나와 마을 음악과 겹쳤다
  useEffect(() => {
    alive.current = true;
    want.current = wantMusic();
    if (want.current) play();
    return () => {
      alive.current = false;
      want.current = false;
      const a = audio.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
      yt.current?.destroy();
      yt.current = null;
      current.current = '';
      clubAudio.el = null;
      clubAudio.index = -1;
      setClubDj(null);
    };
  }, [play]);

  // 신청곡 흐름이 바뀌면 (대기열에 곡이 들어오면) 곡 정보를 다시 읽는다. 지금 곡은 끝까지 튼다. 클럽을 나가면 흐름은 잊는다
  useEffect(() => {
    const off = onClubDj(() => {
      if (!alive.current) return;
      const s = clubSchedule();
      if (s) {
        setSong(s.yt ? { index: -1, yt: s.yt } : { index: s.index });
        setRequestedBy(s.by);
      }
      setWaiting(clubQueue().length);
      if (want.current && (statusRef.current === 'playing' || statusRef.current === 'loading')) play();
    });
    return off;
  }, [play]);

  // 다른 탭으로 가면 멈추고, 돌아오면 지금 자리에서 다시 튼다. 다른 플레이어가 틀면 멈춘다
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        audio.current?.pause();
        pauseYoutube();
      } else if (want.current && statusRef.current !== 'off') play();
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== 'club') stop();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('scene:bgm', onOther);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scene:bgm', onOther);
    };
  }, [play, stop, pauseYoutube]);

  // 무대 가까이에서 크게, 멀리서 작게. 4초마다 다른 사람과 위치가 어긋났는지 보고 맞춘다
  useEffect(() => {
    let tick = 0;
    const t = setInterval(() => {
      const target = VOLUME * Math.min(1, Math.max(0.45, 1.15 - distance() / 14));
      const a = audio.current;
      if (a) a.volume = a.volume + (target - a.volume) * 0.5;
      const p = yt.current;
      const v = Math.round(target * 100);
      if (p && Math.abs(v - ytVolume.current) >= 2) {
        ytVolume.current = v;
        p.setVolume(v);
      }
      if (++tick % 16 || !want.current || statusRef.current === 'off' || document.hidden) return;
      const s = clubSchedule();
      if (!s) return;
      setWaiting(clubQueue().length);
      if (songKey(s) !== current.current) {
        if (s.offset > RESYNC_SEC) play();
      } else if (s.yt) {
        if (p && p.getPlayerState() === YT_STATE.playing && Math.abs(p.getCurrentTime() - s.offset) > YT_RESYNC_SEC) p.seekTo(s.offset, true);
      } else if (a && !a.paused && Math.abs(a.currentTime - s.offset) > RESYNC_SEC) {
        a.currentTime = s.offset;
      }
    }, 250);
    return () => clearInterval(t);
  }, [distance, play]);

  // 브라우저가 자동 재생을 막았으면 화면을 처음 누르는(손을 떼는) 순간 튼다 (휴대폰은 뗄 때만 소리를 허락한다).
  // 음악 버튼을 누른 건 버튼이 처리한다
  useEffect(() => {
    if (status !== 'blocked' || !want.current) return;
    return onUserGesture((e) => {
      if ((e.target as Element | null)?.closest?.('.club-music__btn, .club-yt')) return;
      play();
    });
  }, [status, play]);

  function toggle() {
    if (status === 'playing' || status === 'loading') {
      want.current = false;
      saveWant(false);
      stop();
    } else {
      want.current = true;
      saveWant(true);
      play();
    }
  }

  const track = song.yt ? null : CLUB_TRACKS[song.index];
  const on = status === 'playing';
  // 유튜브 곡을 켜 둔 동안만 플레이어를 보인다 (끄면 숨기고 멈춘다)
  const showYt = !!song.yt && status !== 'off';
  return (
    <>
      <div className={`pill club-music${on ? ' club-music--on' : ''}${status === 'blocked' ? ' club-music--ask' : ''}`}>
        <span className="club-music__eq" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="club-music__info">
          <span className="club-music__title">{songTitle(song)}</span>
          <span className="pill__sub club-music__artist">
            {requestedBy ? `${requestedBy}의 신청곡` : track ? creditLine(track) : '유튜브'}
            {waiting > 0 && ` · 신청곡 ${waiting}곡 대기`}
          </span>
        </span>
        <button className="club-music__btn" onClick={toggle} aria-label={on ? '클럽 음악 끄기' : '클럽 음악 켜기'}>
          <Icon name={on || status === 'loading' ? 'pause' : 'play'} size={16} />
          {status === 'blocked' && <span>음악 켜기</span>}
        </button>
      </div>
      <div className={`club-yt${showYt ? '' : ' club-yt--hidden'}`} aria-hidden={!showYt}>
        <div className="club-yt__player" ref={ytHost} />
        {ytError ? (
          <p className="club-yt__error">{ytError}</p>
        ) : (
          status === 'blocked' && <p className="club-yt__error club-yt__hint">소리가 안 나면 영상을 한 번 눌러 주세요</p>
        )}
      </div>
    </>
  );
}
