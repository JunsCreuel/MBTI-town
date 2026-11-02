// 무료 BGM 목록 (PROJECT_GUIDE.md 7장). 권리를 확보한 오리지널 곡만 넣는다.
// 지금은 코드로 만든 임시 곡이다. 실제 곡은 manifest의 같은 키에 파일만 바꿔 넣는다.
import type { District } from './districts';

export interface BgmTrack {
  /** manifest 키 */
  key: string;
  title: string;
  mood: string;
  /** 이 지역을 고른 사람에게 먼저 권하는 곡 */
  district: District;
}

export const BGM_TRACKS: readonly BgmTrack[] = [
  { key: 'bgm.forest', title: '숲길 산책', mood: '산뜻한 어쿠스틱', district: 'wood' },
  { key: 'bgm.sunset', title: '노을 지는 옥상', mood: '따뜻한 시티팝', district: 'fire' },
  { key: 'bgm.hill', title: '언덕 위 작은 카페', mood: '느긋한 재즈', district: 'earth' },
  { key: 'bgm.silver', title: '은빛 오후', mood: '미니멀 일렉트로닉', district: 'metal' },
  { key: 'bgm.lake', title: '달빛 호수', mood: '몽환적인 앰비언트', district: 'water' },
  { key: 'bgm.rain', title: '비 오는 창가', mood: '빗소리와 피아노', district: 'water' },
];

export const bgmTrack = (key: string | null | undefined) => BGM_TRACKS.find((t) => t.key === key) ?? null;

export const bgmForDistrict = (d: District) => BGM_TRACKS.find((t) => t.district === d) ?? BGM_TRACKS[0];
