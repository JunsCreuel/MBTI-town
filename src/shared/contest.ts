// 오행 지역 대항전: 한 주(일요일 21시 ~ 다음 일요일 21시, 한국 시간) 동안 활동 점수를 내 지역에 모은다.
// 서버(점수 기록·집계)와 화면(남은 시간·순위)이 같은 계산을 쓴다. 규칙 값은 src/config/game.ts의 contestConfig.
import { contestConfig } from '../config/game';
import { DISTRICTS, type District } from './districts';

/** 점수 종류 (종류마다 하루 상한이 있다) */
export type ContestKind = keyof typeof contestConfig.dailyCap;
export const CONTEST_KINDS = Object.keys(contestConfig.dailyCap) as ContestKind[];
export const CONTEST_KIND_NAME: Record<ContestKind, string> = { fish: '낚시', fruit: '열매', debate: '토론', checkin: '출석', market: '상가' };

const KST_MS = 9 * 3600_000;
const DAY_MS = 86_400_000;

export interface ContestWeek {
  /** 이 주의 이름: 월요일 날짜 (YYYY-MM-DD, 한국 날짜) */
  week: string;
  /** 오늘 (한국 날짜, 하루 상한을 센다) */
  day: string;
  /** 시작(지난 일요일 21시)과 발표(이번 일요일 21시) */
  startsAt: Date;
  closesAt: Date;
}

/** now가 들어가는 대항전 주. 일요일 21시가 지나면 다음 주로 넘어간다 */
export function contestWeek(now: Date): ContestWeek {
  const k = new Date(now.getTime() + KST_MS);
  const dow = k.getUTCDay();
  let monday = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - ((dow + 6) % 7));
  if (dow === contestConfig.closeDow && k.getUTCHours() >= contestConfig.closeHour) monday += 7 * DAY_MS;
  const closesAt = new Date(monday + 6 * DAY_MS + contestConfig.closeHour * 3600_000 - KST_MS);
  return {
    week: new Date(monday).toISOString().slice(0, 10),
    day: k.toISOString().slice(0, 10),
    startsAt: new Date(closesAt.getTime() - 7 * DAY_MS),
    closesAt,
  };
}

/** 지난주 (방금 끝난 주) */
export const previousContestWeek = (now: Date) => contestWeek(new Date(contestWeek(now).startsAt.getTime() - 1));

export interface ContestDistrictScore {
  district: District;
  score: number;
  /** 이번 주 점수를 낸 주민 수 */
  people: number;
  /** 오늘의 토론에서 이긴 횟수 (지역 점수에 contestConfig.points.debateWin씩 들어 있다) */
  debateWins: number;
}

export interface ContestStandings {
  week: string;
  startsAt: string;
  closesAt: string;
  /** 점수 높은 순 (같으면 참여한 사람이 많은 순, 그다음 지역 순서) */
  districts: ContestDistrictScore[];
}

/** 지역마다 점수를 채우고 순서대로 줄 세운다 (없는 지역은 0점) */
export function rankDistricts(rows: Partial<Record<District, Omit<ContestDistrictScore, 'district'>>>): ContestDistrictScore[] {
  return DISTRICTS.map((d) => ({ district: d, score: 0, people: 0, debateWins: 0, ...rows[d] })).sort(
    (a, b) => b.score - a.score || b.people - a.people || DISTRICTS.indexOf(a.district) - DISTRICTS.indexOf(b.district),
  );
}

/** 1위 지역 (모두 0점이면 없음, 1위가 둘 이상이면 함께 1위라 없음) */
export function contestLeader(districts: readonly ContestDistrictScore[]): District | null {
  const [a, b] = districts;
  if (!a || a.score <= 0) return null;
  if (b && b.score === a.score) return null;
  return a.district;
}

/** 남은 시간 (예: "2일 3시간", "4시간 12분", "곧 발표") */
export function timeLeftLabel(closesAt: Date, now: Date): string {
  const ms = closesAt.getTime() - now.getTime();
  if (ms <= 60_000) return '곧 발표';
  const d = Math.floor(ms / DAY_MS);
  const h = Math.floor((ms % DAY_MS) / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}
