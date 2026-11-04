// 직접 넣는 음악(클럽 곡·마을 음악)의 공통 정보. 출처와 라이선스는 public/assets/LICENSES.md에도 적는다.
// 파일은 scripts/import-music.ts가 만든다 (음량 맞춤 OGG + MP3, 박자 bpm·beat).

/**
 * CC0 1.0 = 퍼블릭 도메인 (OpenGameArt 등)
 * 제공자 보유 = 운영자가 직접 만들어(Suno) 넣은 곡. 권리는 만든 사람에게 있고, 서비스 안에서 쓰도록 제공했다
 */
export type MusicLicense = 'CC0 1.0' | '제공자 보유';

export interface MusicTrack {
  /** 곡 id (원본 파일 이름 <id>.<확장자>) */
  id: string;
  /** manifest 키 */
  key: string;
  /** public/assets/audio/ 아래 파일 이름 (확장자 없이) */
  file: string;
  title: string;
  artist: string;
  mood: string;
  /** 원본이 있는 곳 (주소 또는 제공 경위) */
  source: string;
  license: MusicLicense;
  /** 대략의 빠르기 (BPM). 가져올 때 이 근처에서 정확한 박자를 찾는다 */
  tempo: number;
}

/** 운영자가 Suno로 만들어 준 곡의 출처 표기 */
export const PROVIDED_BY_OWNER = '운영자 제공, Suno로 제작';

/** 화면에 곡 아래 작게 붙이는 표기 */
export const creditLine = (t: MusicTrack) => (t.license === 'CC0 1.0' ? `${t.artist} · CC0` : t.artist);

/**
 * 마을 음악: 마을(광장·동네·놀이터)을 걷는 동안 잔잔하게 반복해서 나온다. 클럽 안에서는 클럽 음악만 나온다.
 * 끄고 켤 수 있고, 끈 것은 기억한다 (src/components/village/VillageMusic.tsx).
 */
export const VILLAGE_TRACK: MusicTrack = {
  id: 'village_waltz',
  key: 'bgm.village.waltz',
  file: 'village_waltz',
  title: 'Village Waltz',
  artist: 'zansang',
  mood: '느긋한 마을 왈츠',
  source: PROVIDED_BY_OWNER,
  license: '제공자 보유',
  tempo: 121,
};
