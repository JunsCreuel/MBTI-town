// 실내 클럽: 맵 판별, 지금 흐르는 곡과 박자. 음악 플레이어(ClubMusic)가 오디오를 알려 주고, 무대 조명(ClubFx)이 박자를 읽는다.
import { asset } from '@/assets/manifest';
import { CLUB_TRACKS, clubScheduleAt } from '@/shared/clubMusic';
import type { TownMap } from '@/shared/townMap';

/** 벽으로 둘러싼 실내 맵인지 (하늘·바다·구름 대신 어둠을 그린다) */
export const isIndoor = (map: TownMap) => map.props.some((p) => p.key === 'prop.club.wall');

const lengths = () => CLUB_TRACKS.map((t) => asset(t.key).seconds ?? 0);

/** 시계로 정한 지금 곡과 위치 (클럽에 있는 사람 모두 같다) */
export const clubSchedule = (nowMs = Date.now()) => clubScheduleAt(nowMs, lengths());

/** 지금 소리가 나는 오디오와 그 곡 번호 (음악을 끄면 비운다) */
export const clubAudio: { el: HTMLAudioElement | null; index: number } = { el: null, index: -1 };

/**
 * 지금 박자. 음악이 나오면 오디오의 실제 위치로, 아니면 시계로 정한 위치로 잰다 (음악을 꺼도 조명은 같은 박자로 움직인다).
 * step: 지금까지 몇 번째 박인지 (조명 무늬를 한 칸씩 넘긴다), level: 박이 떨어진 순간 1에서 다음 박까지 0으로 준다
 */
export function clubPulse(nowMs = Date.now()): { step: number; level: number } | null {
  let index: number;
  let pos: number;
  const a = clubAudio.el;
  if (a && !a.paused && clubAudio.index >= 0) {
    index = clubAudio.index;
    pos = a.currentTime;
  } else {
    const s = clubSchedule(nowMs);
    if (!s) return null;
    index = s.index;
    pos = s.offset;
  }
  const e = asset(CLUB_TRACKS[index].key);
  const beats = ((pos - (e.beat ?? 0)) * (e.bpm ?? 120)) / 60;
  const whole = Math.floor(beats);
  return { step: whole + index * 7, level: (1 - (beats - whole)) ** 2.4 };
}

/** 음수에도 쓰는 나머지 */
export const mod = (a: number, n: number) => ((a % n) + n) % n;
