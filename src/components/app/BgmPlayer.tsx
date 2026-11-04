'use client';

// 레트로 음악 플레이어. 자동 재생하지 않는다 (누르면 재생·멈춤). MP3를 먼저 쓴다 (아이폰도 소리가 나게).
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { asset } from '@/assets/manifest';
import { audioSource } from '@/lib/audio';
import { bgmTrack } from '@/shared/bgm';
import { Icon } from './Icon';

export interface BgmHandle {
  toggle: () => void;
}


export const BgmPlayer = forwardRef<BgmHandle, { trackKey: string | null; onPlayingChange?: (playing: boolean) => void; compact?: boolean }>(
  function BgmPlayer({ trackKey, onPlayingChange, compact = false }, ref) {
    const audio = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const track = bgmTrack(trackKey);
    const id = useId();

    // 한 번에 한 곡만: 다른 플레이어가 재생하면 멈춘다
    useEffect(() => {
      const onOther = (e: Event) => {
        if ((e as CustomEvent<string>).detail !== id) audio.current?.pause();
      };
      window.addEventListener('scene:bgm', onOther);
      return () => window.removeEventListener('scene:bgm', onOther);
    }, [id]);

    useEffect(() => {
      onPlayingChange?.(playing);
    }, [playing, onPlayingChange]);

    // 곡이 바뀌면 멈추고 새 곡을 준비한다
    useEffect(() => {
      audio.current?.pause();
      audio.current = null;
      setPlaying(false);
      return () => {
        audio.current?.pause();
        audio.current = null;
      };
    }, [trackKey]);

    function toggle() {
      if (!track) return;
      if (!audio.current) {
        const a = new Audio(audioSource(track.key));
        a.loop = true;
        a.volume = 0.7;
        a.addEventListener('pause', () => setPlaying(false));
        a.addEventListener('play', () => setPlaying(true));
        audio.current = a;
      }
      if (audio.current.paused) {
        window.dispatchEvent(new CustomEvent('scene:bgm', { detail: id }));
        audio.current.play().catch(() => setPlaying(false));
      }
      else audio.current.pause();
    }

    useImperativeHandle(ref, () => ({ toggle }));

    if (!track) return null;
    const seconds = asset(track.key).seconds;
    return (
      <div className={`player${compact ? ' player--compact' : ''}${playing ? ' player--on' : ''}`}>
        <span className="player__disc" aria-hidden />
        <div className="player__info">
          <span className="player__title">{track.title}</span>
          {!compact && (
            <span className="player__sub">
              {track.mood}
              {seconds ? ` · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : ''}
            </span>
          )}
        </div>
        <button className="player__btn" onClick={toggle} aria-label={playing ? '멈추기' : '재생'}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
      </div>
    );
  },
);
