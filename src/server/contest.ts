// MBTI 마을 대항전 점수 기록과 집계 (마을 서비스와 토론 서비스가 같이 쓴다).
import 'server-only';
import { contestConfig } from '@/config/game';
import { contestWeek, rankDistricts, type ContestKind, type ContestStandings } from '@/shared/contest';
import { DISTRICTS, isDistrict, type District } from '@/shared/districts';
import type { Sql } from './db';

/**
 * 점수를 더한다 (그날 그 종류의 상한까지만). 실제로 더해진 점수를 돌려준다 (상한에 닿았으면 0).
 * 마을이 없는 사람(가입을 마치지 않았거나 MBTI가 없는 사람)은 0.
 */
export async function addContestPoints(sql: Sql, userId: string, district: string | null, kind: ContestKind, points: number, now: Date): Promise<number> {
  if (!district || !isDistrict(district) || !(points > 0)) return 0;
  const cap = contestConfig.dailyCap[kind];
  const { week, day } = contestWeek(now);
  const [r] = await sql.query<{ before: number | null; after: number }>(
    `with prev as (select points from public.contest_points where week = $1 and day = $2 and user_id = $3 and kind = $5)
     insert into public.contest_points as c (week, day, user_id, district, kind, points, updated_at)
     values ($1, $2, $3, $4, $5, least($6::int, $7::int), $8)
     on conflict (week, day, user_id, kind) do update set points = least($7::int, c.points + $6::int), updated_at = $8
     returning (select points from prev) as before, c.points as after`,
    [week, day, userId, district, kind, Math.floor(points), cap, now],
  );
  return r ? Number(r.after) - Number(r.before ?? 0) : 0;
}

/** 이번 주(또는 week) 유형 마을 점수: 주민 점수 합 + 그 주에 끝난 오늘의 토론에서 이긴 편(그 글자를 가진 여덟 유형)만큼 */
export async function contestStandings(sql: Sql, now: Date, week = contestWeek(now)): Promise<ContestStandings> {
  const rows = await sql.query<{ district: string; score: number; people: number }>(
    `select district, sum(points)::int as score, count(distinct user_id)::int as people
     from public.contest_points where week = $1 and points > 0 group by district`,
    [week.week],
  );
  // 판정이 끝난 경기 중 이 주 안에 끝난 것 (일요일 경기는 21시에 끝나 그 주에 들어간다)
  const wins = await sql.query<{ letter: string; wins: number }>(
    `select case m.result ->> 'winner' when 'a' then m.team_a ->> 'id' when 'b' then m.team_b ->> 'id' end as letter, count(*)::int as wins
     from public.matches m
     where m.status = 'done' and m.voting_ends_at > $1 and m.voting_ends_at <= $2
       and m.team_a ->> 'kind' = 'axis' and m.result ->> 'winner' in ('a', 'b')
     group by 1`,
    [week.startsAt, week.closesAt],
  );
  const by: Partial<Record<District, { score: number; people: number; debateWins: number }>> = {};
  for (const r of rows) if (isDistrict(r.district)) by[r.district] = { score: Number(r.score), people: Number(r.people), debateWins: 0 };
  // 이긴 글자(예: E)를 가진 유형 마을마다 한 번씩
  for (const w of wins) {
    if (!w.letter || !/^[EISNTFJP]$/.test(w.letter)) continue;
    for (const d of DISTRICTS) {
      if (!d.includes(w.letter)) continue;
      const cur = (by[d] ??= { score: 0, people: 0, debateWins: 0 });
      cur.debateWins += Number(w.wins);
      cur.score += Number(w.wins) * contestConfig.points.debateWin;
    }
  }
  return { week: week.week, startsAt: week.startsAt.toISOString(), closesAt: week.closesAt.toISOString(), districts: rankDistricts(by) };
}

/** 내가 이번 주에 올린 점수 (종류별 오늘 점수와 이번 주 합) */
export async function myContestPoints(sql: Sql, userId: string, now: Date): Promise<{ week: number; today: Record<ContestKind, number> }> {
  const { week, day } = contestWeek(now);
  const rows = await sql.query<{ day: string; kind: ContestKind; points: number }>(
    `select to_char(day, 'YYYY-MM-DD') as day, kind, points from public.contest_points where week = $1 and user_id = $2`,
    [week, userId],
  );
  const today = Object.fromEntries(Object.keys(contestConfig.dailyCap).map((k) => [k, 0])) as Record<ContestKind, number>;
  let total = 0;
  for (const r of rows) {
    total += Number(r.points);
    if (r.day === day) today[r.kind] += Number(r.points);
  }
  return { week: total, today };
}
