// 사주(네 기둥) 계산과 거주 지역 배정 (PROJECT_GUIDE.md 3장).
// 재미로 보는 사주다. 성격이나 운명을 정하는 근거로 설명하지 않는다.
//
// 계산 기준
// - 입력은 한국에서 쓰던 시계 시각(Asia/Seoul)이다. 1950~60년대 UTC+8:30, 서머타임(1948~51, 1955~60, 1987~88)까지 반영해 실제 시각으로 바꾼다.
// - 년주·월주는 절기(입춘·경칩…)가 바뀌는 순간 기준이다. 절기 계산은 lunar-javascript(MIT)를 쓰고, 그 라이브러리가 쓰는 중국 표준시(UTC+8)로 맞춰 넘긴다.
// - 일주·시주는 서울 경도(동경 127도) 기준 지방시(한국 표준시보다 약 32분 늦다)로 본다. 밤 11시 30분 무렵부터는 자시이고,
//   자정 전(야자시)은 그날 일주를 쓴다.
// - 음력 생일은 한국천문연구원 음력을 따르는 korean-lunar-calendar(MIT)로 양력으로 바꾼다.
// - 거주 지역 = 일간(태어난 날의 천간, "나"를 나타내는 글자)의 오행. 태어난 시간을 몰라도 정해진다.
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { Solar } from 'lunar-javascript';
import type { District } from '@/shared/districts';
import type { BirthInput, Pillar, SajuReading } from '@/shared/saju';

export { cleanBirthInput, type BirthInput, type SajuReading } from '@/shared/saju';

export class SajuError extends Error {}

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const STEMS_KO = '갑을병정무기경신임계';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const BRANCHES_KO = '자축인묘진사오미신유술해';
const ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
const STEM_ELEMENT: District[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
const BRANCH_ELEMENT: District[] = [
  'water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water',
];

/** 서울 경도(동경 127도) 지방시 = UTC + 8시간 28분 */
const SEOUL_LMT_MINUTES = (127 / 15) * 60;
/** lunar-javascript 절기 계산 기준 시간대 = UTC+8 */
const TERMS_TZ_MINUTES = 8 * 60;
const MIN_YEAR = 1900;

function pillar(gz: string): Pillar {
  const s = STEMS.indexOf(gz[0]);
  const b = BRANCHES.indexOf(gz[1]);
  if (s < 0 || b < 0) throw new SajuError(`간지를 읽지 못했습니다: ${gz}`);
  return { stem: gz[0], branch: gz[1], ko: STEMS_KO[s] + BRANCHES_KO[b], stemElement: STEM_ELEMENT[s], branchElement: BRANCH_ELEMENT[b] };
}

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

/** 그 순간 서울 시계가 UTC보다 몇 분 빨랐는지 */
function seoulOffsetMinutes(utcMs: number): number {
  const p = Object.fromEntries(offsetFormatter.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}

/** 서울 시계 시각 → 실제 순간(UTC ms) */
function seoulClockToUtc(y: number, m: number, d: number, hh: number, mm: number): number {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - 9 * 3600_000;
  for (let i = 0; i < 3; i++) t = wall - seoulOffsetMinutes(t) * 60_000;
  return t;
}

/** 실제 순간을 offset분 시간대의 시계 시각으로 */
function clockAt(utcMs: number, offsetMinutes: number) {
  const d = new Date(utcMs + offsetMinutes * 60_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

function eightChar(c: { y: number; m: number; d: number; hh: number; mm: number }) {
  const ec = Solar.fromYmdHms(c.y, c.m, c.d, c.hh, c.mm, 0).getLunar().getEightChar();
  // 자정 전 자시(야자시)는 그날 일주를 쓴다
  ec.setSect(2);
  return ec;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 입력을 검사하고 양력 날짜로 바꾼다 */
export function toSolarDate(input: BirthInput, today = new Date()): { y: number; m: number; d: number } {
  const dm = DATE_RE.exec(String(input.date ?? ''));
  if (!dm) throw new SajuError('생년월일을 YYYY-MM-DD로 적어 주세요.');
  const [y, m, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  let solar = { y, m, d };
  if (input.calendar === 'lunar') {
    const cal = new KoreanLunarCalendar();
    if (!cal.setLunarDate(y, m, d, !!input.leap)) {
      throw new SajuError(input.leap ? '그해 그 달에는 윤달이 없어요.' : '음력 날짜가 올바르지 않아요.');
    }
    const s = cal.getSolarCalendar();
    solar = { y: s.year, m: s.month, d: s.day };
  } else if (input.calendar !== 'solar') {
    throw new SajuError('양력·음력을 골라 주세요.');
  } else {
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) throw new SajuError('생년월일이 올바르지 않아요.');
  }
  const asDate = Date.UTC(solar.y, solar.m - 1, solar.d);
  if (solar.y < MIN_YEAR || asDate > today.getTime()) throw new SajuError(`생년월일은 ${MIN_YEAR}년부터 오늘까지 넣을 수 있어요.`);
  return solar;
}

const iso = (c: { y: number; m: number; d: number }) =>
  `${c.y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;

/** 생일로 사주를 풀고 거주 지역을 정한다 */
/** 한국 날짜(YYYY-MM-DD)의 일진 (그날 정오, 서울 지방시 기준) */
export function dayPillarOn(date: string): Pillar {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new SajuError(`날짜를 읽지 못했습니다: ${date}`);
  const instant = seoulClockToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 12, 0);
  return pillar(eightChar(clockAt(instant, SEOUL_LMT_MINUTES)).getDay());
}

/** 한국 날짜(YYYY-MM-DD)가 속한 달의 월주(월건)와 해의 연주 (절기 기준, 그날 정오) */
export function monthYearPillarsOn(date: string): { month: Pillar; year: Pillar } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new SajuError(`날짜를 읽지 못했습니다: ${date}`);
  const ec = eightChar(clockAt(seoulClockToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 12, 0), TERMS_TZ_MINUTES));
  return { month: pillar(ec.getMonth()), year: pillar(ec.getYear()) };
}

export function computeSaju(input: BirthInput, today = new Date()): SajuReading {
  const solar = toSolarDate(input, today);
  let timeKnown = false;
  let hh = 12;
  let mm = 0;
  if (input.time !== null && input.time !== undefined && input.time !== '') {
    const tm = TIME_RE.exec(String(input.time));
    if (!tm) throw new SajuError('태어난 시간을 HH:MM으로 적어 주세요.');
    hh = Number(tm[1]);
    mm = Number(tm[2]);
    timeKnown = true;
  }
  const notes: string[] = [];
  const at = (h: number, mi: number) => seoulClockToUtc(solar.y, solar.m, solar.d, h, mi);
  const instant = at(hh, mm);

  // 년주·월주: 절기 기준 (절기 계산 시간대로 맞춘다)
  const terms = eightChar(clockAt(instant, TERMS_TZ_MINUTES));
  // 일주·시주: 서울 지방시 기준. 시간을 모르면 날짜만 보므로 그날 정오 무렵으로 본다.
  const local = eightChar(clockAt(instant, SEOUL_LMT_MINUTES));

  if (!timeKnown) {
    // 그날 안에 절기가 바뀌면 시간에 따라 년주·월주가 달라질 수 있다
    const early = eightChar(clockAt(at(0, 0), TERMS_TZ_MINUTES));
    const late = eightChar(clockAt(at(23, 59), TERMS_TZ_MINUTES));
    if (early.getMonth() !== late.getMonth()) notes.push('태어난 날에 절기가 바뀌어서, 태어난 시간에 따라 월주(년주)가 달라질 수 있어요.');
    notes.push('태어난 시간을 몰라서 시주는 비워 두었어요. 거주 지역은 일간으로 정해서 시간과 상관없어요.');
  }

  const year = pillar(terms.getYear());
  const month = pillar(terms.getMonth());
  const day = pillar(local.getDay());
  const hour = timeKnown ? pillar(local.getTime()) : null;

  const counts: Record<District, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of [year, month, day, hour]) {
    if (!p) continue;
    counts[p.stemElement]++;
    counts[p.branchElement]++;
  }
  return {
    solarDate: iso(solar),
    timeKnown,
    year,
    month,
    day,
    hour,
    dayMaster: { stem: day.stem, ko: day.ko[0], element: day.stemElement },
    counts,
    animal: ANIMALS[BRANCHES.indexOf(year.branch)],
    district: day.stemElement,
    notes,
  };
}
