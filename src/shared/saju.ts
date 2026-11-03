// 사주 표시용 모양과 문구 (화면과 서버가 함께 쓴다). 계산은 서버(src/server/saju.ts)만 한다.
// 재미로 보는 사주다. 성격이나 운명을 정하는 근거로 설명하지 않는다.
import type { District } from './districts';

export type BirthCalendar = 'solar' | 'lunar';

/** 사용자가 넣은 생일 그대로 */
export interface BirthInput {
  calendar: BirthCalendar;
  /** YYYY-MM-DD (음력이면 음력 날짜) */
  date: string;
  /** 음력 윤달 */
  leap?: boolean;
  /** HH:MM, 모르면 null */
  time: string | null;
}

export interface Pillar {
  /** 천간·지지 한자 (예: 甲, 子) */
  stem: string;
  branch: string;
  /** 한글 읽기 (예: 갑자) */
  ko: string;
  stemElement: District;
  branchElement: District;
}

export interface SajuReading {
  /** 양력 생일 (YYYY-MM-DD) */
  solarDate: string;
  timeKnown: boolean;
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 태어난 시간을 모르면 null */
  hour: Pillar | null;
  /** 일간: 나를 나타내는 글자 */
  dayMaster: { stem: string; ko: string; element: District };
  /** 여덟 글자(시간을 모르면 여섯 글자)의 오행 개수 */
  counts: Record<District, number>;
  /** 띠 */
  animal: string;
  /** 배정된 거주 지역 = 일간의 오행 */
  district: District;
  /** 시간을 몰라 기둥이 달라질 수 있는 날 등 알려 줄 말 */
  notes: string[];
}

/** 오행 이름과 재미로 보는 한 줄 */
export const ELEMENT_INFO: Record<District, { ko: string; hanja: string; line: string }> = {
  wood: { ko: '목', hanja: '木', line: '자라나는 나무처럼 새로 시작하고 키워 가는 기운' },
  fire: { ko: '화', hanja: '火', line: '햇빛처럼 밝게 드러내고 나누는 기운' },
  earth: { ko: '토', hanja: '土', line: '너른 땅처럼 받쳐 주고 품어 주는 기운' },
  metal: { ko: '금', hanja: '金', line: '단단한 쇠처럼 맺고 정리하는 기운' },
  water: { ko: '수', hanja: '水', line: '흐르는 물처럼 유연하게 스며드는 기운' },
};

/** 저장해 둔 입력이 올바른 모양인지 (DB·요청 본문에서 읽을 때) */
export function cleanBirthInput(v: unknown): BirthInput {
  const b = (v ?? {}) as Partial<Record<keyof BirthInput, unknown>>;
  return {
    calendar: b.calendar === 'lunar' ? 'lunar' : 'solar',
    date: typeof b.date === 'string' ? b.date.trim() : '',
    leap: b.calendar === 'lunar' && b.leap === true,
    time: typeof b.time === 'string' && b.time.trim() ? b.time.trim() : null,
  };
}
