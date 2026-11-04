// 음악 파일 고르기와 "첫 터치로 소리 켜기". 휴대폰 브라우저는 사람이 화면을 눌렀다 뗄 때(또는 탭할 때)만 소리를 내게 해 준다.
import { assetAltUrl, assetUrl } from '@/assets/manifest';

/**
 * 틀 파일 주소: MP3가 있고 브라우저가 MP3를 틀 수 있으면 MP3 (아이폰 사파리는 OGG를 제대로 못 트는 경우가 있다), 아니면 OGG.
 */
export function audioSource(key: string): string {
  const alt = assetAltUrl(key);
  if (!alt) return assetUrl(key);
  const probe = typeof document !== 'undefined' ? document.createElement('audio') : null;
  if (probe?.canPlayType('audio/mpeg')) return alt;
  return probe?.canPlayType('audio/ogg; codecs="vorbis"') ? assetUrl(key) : alt;
}

/**
 * 브라우저가 소리를 허락하는 사용자 동작들. 터치에서는 누르는 순간(pointerdown)이 아니라 뗄 때(pointerup·touchend)·탭(click)만 허락된다.
 * fn은 동작 처리 안에서 바로(기다리지 않고) play()를 불러야 한다.
 */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

export function onUserGesture(fn: (e: Event) => void): () => void {
  for (const g of GESTURES) window.addEventListener(g, fn, true);
  return () => {
    for (const g of GESTURES) window.removeEventListener(g, fn, true);
  };
}
