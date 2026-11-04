// 오행 채우기 기록 (마을 서비스와 토론 서비스가 같이 쓴다). 따로 표를 만들지 않고 하루 기록 표(daily_picks)에 남긴다:
// 'el:<오행>:<n>' = 그 오행 n번째 칸, 'els:<오행>:<놀이>' = 하루 한 번 세는 놀이를 이미 셌는지, 'el:balance' = 다 채운 날.
import 'server-only';
import { elementConfig } from '@/config/game';
import { localDate } from '@/shared/debate';
import { ELEMENTS, elementNeeds, type Element, type ElementFill, type ElementSource, type ElementsView } from '@/shared/elements';
import type { SajuReading } from '@/shared/saju';
import type { Sql } from './db';

/** 하루에 한 번만 세는 놀이 (화면이 알려 주는 것과 꾸미기 저장처럼 여러 번 할 수 있는 것) */
const ONCE: ReadonlySet<ElementSource> = new Set(['dance', 'request', 'drink', 'shop', 'room', 'market']);

async function sajuCounts(sql: Sql, userId: string): Promise<{ counts: Record<Element, number>; timeKnown: boolean } | null> {
  const [r] = await sql.query<{ saju: SajuReading | string | null; onboarded: boolean }>(
    `select saju, onboarded_at is not null as onboarded from public.profiles where id = $1`,
    [userId],
  );
  const saju = r?.onboarded ? (typeof r.saju === 'string' ? (JSON.parse(r.saju) as SajuReading) : r.saju) : null;
  if (!saju?.counts) return null;
  return { counts: Object.fromEntries(ELEMENTS.map((e) => [e, Number(saju.counts[e] ?? 0)])) as Record<Element, number>, timeKnown: !!saju.timeKnown };
}

async function filledToday(sql: Sql, userId: string, day: string): Promise<Record<Element, number>> {
  const rows = await sql.query<{ spot: string }>(`select spot from public.daily_picks where user_id = $1 and day = $2 and spot like 'el:%'`, [userId, day]);
  const filled = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const r of rows) {
    const [, e, n] = r.spot.split(':');
    if (/^\d+$/.test(n ?? '') && (ELEMENTS as readonly string[]).includes(e)) filled[e as Element]++;
  }
  return filled;
}

const take = async (sql: Sql, userId: string, day: string, spot: string, item: string | null) =>
  (await sql.query(`insert into public.daily_picks (user_id, day, spot, item) values ($1, $2, $3, $4) on conflict do nothing returning spot`, [userId, day, spot, item])).length > 0;

/**
 * 오행 한 칸 채우기 (오늘 채울 칸이 남아 있을 때만). 다섯 오행을 모두 채우면 그날 한 번 보상 코인을 준다.
 * 사주가 없는(가입을 마치지 않은) 사람은 null.
 */
export async function fillElement(sql: Sql, userId: string, element: Element, source: ElementSource, now: Date): Promise<ElementFill | null> {
  const s = await sajuCounts(sql, userId);
  if (!s) return null;
  const day = localDate(now);
  const need = elementNeeds(s.counts);
  let filled = await filledToday(sql, userId, day);
  const result = (added: boolean, reward = 0): ElementFill => ({ element, added, filled: filled[element], need: need[element], reward });
  if (filled[element] >= need[element]) return result(false);
  if (ONCE.has(source) && !(await take(sql, userId, day, `els:${element}:${source}`, null))) return result(false);
  // 동시에 두 번 채우려 하면 다음 칸 번호로 다시 넣는다
  let added = false;
  for (let k = filled[element] + 1; k <= need[element] && !added; k++) added = await take(sql, userId, day, `el:${element}:${k}`, source);
  filled = await filledToday(sql, userId, day);
  if (!added) return result(false);
  const balanced = ELEMENTS.every((e) => filled[e] >= need[e]);
  if (balanced && (await take(sql, userId, day, 'el:balance', null))) {
    await sql.query(`update public.profiles set coins = coins + $2 where id = $1`, [userId, elementConfig.reward]);
    return result(true, elementConfig.reward);
  }
  return result(true);
}

/** 오늘의 오행 채우기 화면 */
export async function elementsView(sql: Sql, userId: string, now: Date): Promise<ElementsView | null> {
  const s = await sajuCounts(sql, userId);
  if (!s) return null;
  const day = localDate(now);
  const [filled, balanceRows] = await Promise.all([
    filledToday(sql, userId, day),
    sql.query<{ day: string }>(`select to_char(day, 'YYYY-MM-DD') as day from public.daily_picks where user_id = $1 and spot = 'el:balance'`, [userId]),
  ]);
  const need = elementNeeds(s.counts);
  const today = balanceRows.some((r) => r.day === day);
  return { counts: s.counts, timeKnown: s.timeKnown, need, filled, balanced: today, reward: today ? elementConfig.reward : 0, balanceDays: balanceRows.length };
}
