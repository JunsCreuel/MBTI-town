'use client';

// 마을 음악 (Village Waltz): 마을(광장·동네·놀이터)을 걷는 동안 잔잔하게 나오고, 곡이 끝나면 처음부터 다시 반복한다.
// 클럽 안에서는 클럽 음악만 나오고, 다른 화면으로 가거나 다른 탭을 보면 멈춘다.
// 기본은 켜짐. 위쪽 음표 버튼으로 끄고 켜며, 끈 것은 기억해서 다음에 와도 꺼 둔다.
// 브라우저가 자동 재생을 막으면 화면을 처음 누르는(또는 키를 누르는) 순간 시작한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { assetAltUrl, assetUrl } from '@/assets/manifest';
import { VILLAGE_TRACK } from '@/shared/music';
import { Icon } from '../app/Icon';

const PREF_KEY = 'scene:village-music';
/** 걷는 동안 깔리는 음악이라 클럽보다 작게 */
const VOLUME = 0.35;
/** 다른 BGM 플레이어와 겹치지 않게 주고받는 이름 (scene:bgm 이벤트) */
const BGM_ID = 'village';

// 광장 → 동네처럼 마을 안에서 화면이 바뀌어도 이어서 들리게, 소리는 페이지에 하나만 둔다
let shared: HTMLAudioElement | null = null;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;

function element(): HTMLAudioElement {
  if (shared) return shared;
  const a = new Audio();
  const alt = assetAltUrl(VILLAGE_TRACK.key);
  a.src = a.canPlayType('audio/ogg; codecs="vorbis"') || !alt ? assetUrl(VILLAGE_TRACK.key) : alt;
  // 끈 사람은 받지 않는다 (틀 때 받는다)
  a.preload = 'none';
  a.loop = true;
  a.volume = VOLUME;
  shared = a;
  return a;
}

function readWant(): boolean {
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

export interface VillageMusicControl {
  /** 켜 두었는지 (사람이 고른 것) */
  want: boolean;
  /** 지금 소리가 나는지 */
  playing: boolean;
  toggle: () => void;
}

/** active = 마을 음악이 나올 곳인지 (클럽 안이면 false) */
export function useVillageMusic(active: boolean): VillageMusicControl {
  const [want, setWant] = useState(true);
  const [playing, setPlaying] = useState(false);
  const live = useRef({ active, want: true });
  live.current.active = active;

  const start = useCallback(() => {
    if (!live.current.active || !live.current.want || document.hidden) return;
    clearTimeout(pauseTimer);
    const a = element();
    // 다른 BGM 플레이어(방 음악 등)는 멈춘다
    window.dispatchEvent(new CustomEvent('scene:bgm', { detail: BGM_ID }));
    if (!a.paused) return setPlaying(true);
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // 자동 재생이 막히면 첫 터치를 기다린다 (아래)
  }, []);

  // 저장해 둔 켜기·끄기를 읽고, 마을 음악이 나올 곳이면 튼다. 떠나면 멈춘다
  useEffect(() => {
    const w = readWant();
    live.current.want = w;
    setWant(w);
    if (active && w) start();
    else shared?.pause();
    // 마을 안에서 화면만 바뀌는 경우(곧 다시 튼다)에는 끊기지 않게 잠깐 기다렸다 멈춘다
    return () => {
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => shared?.pause(), 400);
    };
  }, [active, start]);

  // 소리가 실제로 나는지 따라간다 (다른 플레이어가 멈추게 한 경우 포함)
  useEffect(() => {
    const a = element();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('playing', onPlay);
    a.addEventListener('pause', onPause);
    setPlaying(!a.paused);
    return () => {
      a.removeEventListener('playing', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  // 자동 재생이 막혔으면 화면을 처음 누르는 순간 시작한다 (음표 버튼을 누른 건 버튼이 처리한다)
  useEffect(() => {
    if (!active || !want || playing) return;
    const onGesture = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-village-music]')) return;
      start();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    };
  }, [active, want, playing, start]);

  // 다른 탭을 보면 멈추고, 돌아오면 이어서 튼다. 다른 플레이어가 틀면 멈춘다
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) shared?.pause();
      else start();
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== BGM_ID) shared?.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('scene:bgm', onOther);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scene:bgm', onOther);
    };
  }, [start]);

  const toggle = useCallback(() => {
    const next = !live.current.want;
    live.current.want = next;
    setWant(next);
    saveWant(next);
    if (next) start();
    else shared?.pause();
  }, [start]);

  return { want, playing, toggle };
}

/** 위쪽 아이콘 줄의 음표 버튼: 마을 음악 켜기·끄기 */
export function VillageMusicButton({ music }: { music: VillageMusicControl }) {
  const label = music.want ? '마을 음악 끄기' : '마을 음악 켜기';
  return (
    <button
      data-village-music
      className={`icon-btn village-music${music.want ? '' : ' village-music--off'}${music.playing ? ' village-music--on' : ''}`}
      onClick={music.toggle}
      aria-pressed={music.want}
      aria-label={label}
      title={`${label} (${VILLAGE_TRACK.title})`}
    >
      <Icon name="music" />
    </button>
  );
}
