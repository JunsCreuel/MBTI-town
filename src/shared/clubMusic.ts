// 클럽 음악: 누구나 자유롭게 쓸 수 있는 CC0(퍼블릭 도메인) EDM 곡 (PROJECT_GUIDE.md 7장).
// 출처와 라이선스는 public/assets/LICENSES.md에도 적는다. 파일은 scripts/import-club-music.ts가 만든다.
//
// 클럽에 있는 사람은 모두 같은 순간에 같은 곡의 같은 자리를 듣는다:
// 시계(UTC)를 플레이리스트 전체 길이로 나눈 나머지로 지금 곡과 위치를 정한다 (서버 없이도 맞는다).

export interface ClubTrack {
  /** 파일 이름에 쓰는 id (audio/club_<id>.ogg) */
  id: string;
  /** manifest 키 */
  key: string;
  title: string;
  artist: string;
  mood: string;
  /** 원본이 있는 곳 */
  source: string;
  license: 'CC0 1.0';
  /** 대략의 빠르기 (BPM). 가져올 때 이 근처에서 정확한 박자를 찾는다 */
  tempo: number;
}

const track = (id: string, title: string, artist: string, mood: string, tempo: number, source: string): ClubTrack => ({
  id,
  tempo,
  key: `bgm.club.${id}`,
  title,
  artist,
  mood,
  source,
  license: 'CC0 1.0',
});

export const CLUB_TRACKS: readonly ClubTrack[] = [
  track('party_sector', 'Party Sector', 'Joth', '우주 느낌 댄스', 120, 'https://opengameart.org/content/party-sector'),
  track('funky_house', 'Funky House', 'Of Far Different Nature', '여름 해변 하우스', 128, 'https://opengameart.org/content/funky-house'),
  track('hella_bumps', 'Hella Bumps', 'The Cynic Project', '신나는 댄스 하우스', 123, 'https://opengameart.org/content/hella-bumps-menu-music'),
  track('lucid_trigger', 'Lucid Trigger', 'Liq_mmry', '프로그레시브 브레이크', 150, 'https://opengameart.org/content/lucid-trigger'),
];

/**
 * 지금 나올 곡과 위치. seconds = 곡마다 길이(초, CLUB_TRACKS 순서). 길이를 모르면(0) 그 곡은 건너뛴다.
 * 돌려주는 값: 곡 번호, 곡 안의 위치(초), 그 곡이 끝나기까지 남은 시간(초)
 */
export function clubScheduleAt(epochMs: number, seconds: readonly number[]): { index: number; offset: number; left: number } | null {
  const total = seconds.reduce((s, x) => s + (x > 0 ? x : 0), 0);
  if (total <= 0) return null;
  let t = ((epochMs / 1000) % total + total) % total;
  for (let i = 0; i < seconds.length; i++) {
    const len = seconds[i] > 0 ? seconds[i] : 0;
    if (t < len) return { index: i, offset: t, left: len - t };
    t -= len;
  }
  // 소수점 오차로 끝에 닿으면 첫 곡 처음
  const first = seconds.findIndex((x) => x > 0);
  return { index: first, offset: 0, left: seconds[first] };
}

/**
 * 신청곡부터 틀 때: startIndex번 곡을 elapsedMs 전에 시작해서, 끝나면 다음 곡으로 이어 간 경우의 지금 곡과 위치.
 * (클럽 채널에서 누가 DJ에게 곡을 신청하면 그 채널 모두가 이 순서로 듣는다)
 */
export function clubScheduleFrom(elapsedMs: number, seconds: readonly number[], startIndex: number): { index: number; offset: number; left: number } | null {
  const n = seconds.length;
  if (!n || startIndex < 0 || startIndex >= n) return null;
  const order = Array.from({ length: n }, (_, k) => seconds[(startIndex + k) % n]);
  const s = clubScheduleAt(Math.max(0, elapsedMs), order);
  return s && { ...s, index: (startIndex + s.index) % n };
}

