'use client';

// 클럽 음악: 들어오면 바로 튼다 (브라우저가 막으면 "음악 켜기"를 누른다). 클럽에 있는 사람은 모두 같은 곡의 같은 자리를 듣는다.
// 끄면 기억해 두고 다음에 와도 꺼 둔다. 무대에서 멀어지면 조금 작게 들린다. 다른 화면으로 가면 멈춘다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetAltUrl, assetUrl } from '@/assets/manifest';
import { CLUB_TRACKS } from '@/shared/clubMusic';
import { Icon } from '../app/Icon';
import { clubAudio, clubDj, clubSchedule, onClubDj, setClubDj } from './club';

const PREF_KEY = 'scene:club-music';
const VOLUME = 0.7;
/** 노래 위치가 다른 사람과 이만큼(초) 넘게 어긋나면 맞춘다 */
const RESYNC_SEC = 2;

function sourceFor(key: string): string {
  const a = document.createElement('audio');
  const alt = assetAltUrl(key);
  return a.canPlayType('audio/ogg; codecs="vorbis"') || !alt ? assetUrl(key) : alt;
}

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
  const [status, setStatus] = useState<'off' | 'loading' | 'playing' | 'blocked'>('off');
  const [index, setIndex] = useState(() => clubSchedule()?.index ?? 0);

  const element = useCallback(() => {
    if (audio.current) return audio.current;
    const a = new Audio();
    a.preload = 'auto';
    a.volume = VOLUME;
    audio.current = a;
    return a;
  }, []);

  /** 시계로 정한 곡·위치에서 튼다 (곡이 같으면 위치만 맞춘다) */
  const play = useCallback(() => {
    const s = clubSchedule();
    if (!s) return;
    const a = element();
    if (clubAudio.index !== s.index || !a.src) {
      a.src = sourceFor(CLUB_TRACKS[s.index].key);
      clubAudio.index = s.index;
      setIndex(s.index);
    } else if (Math.abs(a.currentTime - s.offset) > RESYNC_SEC) {
      a.currentTime = s.offset;
    }
    clubAudio.el = a;
    // 다른 BGM 플레이어는 멈춘다
    window.dispatchEvent(new CustomEvent('scene:bgm', { detail: 'club' }));
    setStatus((st) => (st === 'playing' ? st : 'loading'));
    a.play()
      .then(() => setStatus('playing'))
      .catch((e: Error) => {
        // 새 곡을 넣느라 앞의 play가 끊긴 것은 괜찮다
        if (e?.name === 'AbortError') return;
        setStatus('blocked');
      });
  }, [element]);

  const stop = useCallback((nextStatus: 'off' | 'blocked' = 'off') => {
    audio.current?.pause();
    setStatus(nextStatus);
  }, []);

  // 오디오 이벤트: 곡 정보를 읽으면 위치를 맞추고, 곡이 끝나면 다음 곡
  useEffect(() => {
    const a = element();
    const onMeta = () => {
      const s = clubSchedule();
      if (!s) return;
      if (s.index === clubAudio.index) a.currentTime = s.offset;
      else play();
    };
    // 곡이 시계보다 조금 일찍 끝나면 다음 곡 시작 시각까지 기다린다 (같은 곡을 처음부터 다시 틀지 않게)
    let wait: ReturnType<typeof setTimeout> | undefined;
    const onEnded = () => {
      const s = clubSchedule();
      if (s && s.index === clubAudio.index) wait = setTimeout(() => want.current && play(), Math.min(5000, s.left * 1000 + 60));
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

  // 들어오면 튼다 (꺼 둔 사람은 그대로). 나가면 멈추고 비운다
  useEffect(() => {
    want.current = wantMusic();
    if (want.current) play();
    return () => {
      const a = audio.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
      clubAudio.el = null;
      clubAudio.index = -1;
      setClubDj(null);
    };
  }, [play]);

  // DJ 신청곡이 오면 그 곡으로 바꾼다 (끈 사람은 곡 이름만 바뀐다). 클럽을 나가면 신청곡은 잊는다
  const [requestedBy, setRequestedBy] = useState('');
  useEffect(() => {
    const off = onClubDj(() => {
      setRequestedBy(clubDj.by);
      const s = clubSchedule();
      if (s) setIndex(s.index);
      if (want.current && audio.current && !audio.current.paused) play();
    });
    return off;
  }, [play]);

  // 다른 탭으로 가면 멈추고, 돌아오면 지금 자리에서 다시 튼다. 다른 플레이어가 틀면 멈춘다
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) audio.current?.pause();
      else if (want.current) play();
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
  }, [play, stop]);

  // 무대 가까이에서 크게, 멀리서 작게. 4초마다 다른 사람과 위치가 어긋났는지 보고 맞춘다
  useEffect(() => {
    let tick = 0;
    const t = setInterval(() => {
      const a = audio.current;
      if (!a) return;
      const target = VOLUME * Math.min(1, Math.max(0.45, 1.15 - distance() / 14));
      a.volume = a.volume + (target - a.volume) * 0.5;
      if (++tick % 16 || a.paused) return;
      const s = clubSchedule();
      if (!s) return;
      if (s.index === clubAudio.index) {
        if (Math.abs(a.currentTime - s.offset) > RESYNC_SEC) a.currentTime = s.offset;
      } else if (s.offset > RESYNC_SEC) play();
    }, 250);
    return () => clearInterval(t);
  }, [distance, play]);

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

  const track = CLUB_TRACKS[index];
  const on = status === 'playing';
  return (
    <div className={`pill club-music${on ? ' club-music--on' : ''}${status === 'blocked' ? ' club-music--ask' : ''}`}>
      <span className="club-music__eq" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="club-music__info">
        <span className="club-music__title">{track.title}</span>
        <span className="pill__sub club-music__artist">{requestedBy ? `${requestedBy}의 신청곡` : `${track.artist} · CC0`}</span>
      </span>
      <button className="club-music__btn" onClick={toggle} aria-label={on ? '클럽 음악 끄기' : '클럽 음악 켜기'}>
        <Icon name={on || status === 'loading' ? 'pause' : 'play'} size={16} />
        {status === 'blocked' && <span>음악 켜기</span>}
      </button>
    </div>
  );
}
