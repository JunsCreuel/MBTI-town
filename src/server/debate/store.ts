// 토론 데이터 읽기·쓰기 (SQL). 규칙 검사는 service.ts가 하고, 여기는 저장만 한다.
import 'server-only';
import type { MbtiType } from '@/design/mbti';
import type { District } from '@/shared/districts';
import type { Argument, Match, MatchResult, Side, Team, Topic, VoteRecord } from '@/shared/debate';
import type { Sql } from '../db';

export interface Profile {
  id: string;
  /** 사는 지역 (가입을 마치지 않았으면 null). 토론 편은 지역으로 정해진다 */
  district: District | null;
  /** MBTI 태그 (선택) */
  mbti: MbtiType | null;
  mbtiChangedAt: Date | null;
}

export interface NewMatch {
  key: string;
  seq: number;
  topic: Topic;
  teamA: Team;
  teamB: Team;
  opensAt: Date;
  writingEndsAt: Date;
  votingEndsAt: Date;
}

interface MatchRow {
  id: string;
  key: string;
  seq: number;
  topic: Topic;
  team_a: Team;
  team_b: Team;
  opens_at: Date;
  writing_ends_at: Date;
  voting_ends_at: Date;
  status: Match['status'];
  result: MatchResult | null;
}

interface ArgumentRow {
  id: string;
  match_id: string;
  author_id: string | null;
  author_district: District | null;
  author_mbti: string | null;
  side: Side;
  body: string;
  created_at: Date;
  recommendations: number;
}

// jsonb 값은 문자열로 넘기고 SQL에서 ::text::jsonb로 바꾼다.
// 그냥 ::jsonb로 받으면 postgres.js가 매개변수를 jsonb로 보고 문자열을 한 번 더 JSON으로 감싼다.
const json = (v: unknown) => JSON.stringify(v);

function toMatch(r: MatchRow): Match {
  return {
    id: r.id,
    key: r.key,
    seq: r.seq,
    topic: r.topic,
    teamA: r.team_a,
    teamB: r.team_b,
    opensAt: new Date(r.opens_at),
    writingEndsAt: new Date(r.writing_ends_at),
    votingEndsAt: new Date(r.voting_ends_at),
    status: r.status,
    result: r.result,
  };
}

function toArgument(r: ArgumentRow): Argument {
  return {
    id: r.id,
    matchId: r.match_id,
    authorId: r.author_id,
    authorDistrict: r.author_district,
    authorMbti: r.author_mbti,
    side: r.side,
    body: r.body,
    createdAt: new Date(r.created_at),
    recommendations: Number(r.recommendations),
  };
}

const MATCH_COLS = `id, key, seq, topic, team_a, team_b, opens_at, writing_ends_at, voting_ends_at, status, result`;

export class DebateStore {
  constructor(private readonly sql: Sql) {}

  // ───────── 프로필 ─────────

  async getProfile(userId: string): Promise<Profile | null> {
    const [r] = await this.sql.query<{ id: string; district: District | null; onboarded_at: Date | null; mbti: MbtiType | null; mbti_changed_at: Date | null }>(
      `select id, district, onboarded_at, mbti, mbti_changed_at from public.profiles where id = $1`,
      [userId],
    );
    return r
      ? {
          id: r.id,
          district: r.onboarded_at ? r.district : null,
          mbti: r.mbti,
          mbtiChangedAt: r.mbti_changed_at ? new Date(r.mbti_changed_at) : null,
        }
      : null;
  }

  async setMbti(userId: string, mbti: MbtiType, at: Date): Promise<void> {
    await this.sql.query(
      `insert into public.profiles (id, mbti, mbti_changed_at) values ($1, $2, $3)
       on conflict (id) do update set mbti = excluded.mbti, mbti_changed_at = excluded.mbti_changed_at`,
      [userId, mbti, at],
    );
  }

  // ───────── 주제 ─────────

  /** 코드에 있는 주제 목록을 DB에 맞춘다 (DB에서 직접 추가한 주제는 그대로 둔다) */
  async syncTopics(topics: readonly Topic[]): Promise<void> {
    for (const t of topics) {
      await this.sql.query(
        `insert into public.topics (id, title, side_a, side_b) values ($1, $2, $3, $4)
         on conflict (id) do update set title = excluded.title, side_a = excluded.side_a, side_b = excluded.side_b`,
        [t.id, t.title, t.sideA, t.sideB],
      );
    }
  }

  async activeTopics(): Promise<Topic[]> {
    const rows = await this.sql.query<{ id: string; title: string; side_a: string; side_b: string }>(
      `select id, title, side_a, side_b from public.topics where active order by created_at, id`,
    );
    return rows.map((r) => ({ id: r.id, title: r.title, sideA: r.side_a, sideB: r.side_b }));
  }

  /** 주제별 마지막으로 쓴 경기 번호 */
  async topicLastUsed(): Promise<Map<string, number>> {
    const rows = await this.sql.query<{ topic_id: string; seq: number }>(
      `select topic_id, max(seq)::int as seq from public.matches where topic_id is not null group by topic_id`,
    );
    return new Map(rows.map((r) => [r.topic_id, Number(r.seq)]));
  }

  // ───────── 경기 ─────────

  async getMatch(id: string): Promise<Match | null> {
    const [r] = await this.sql.query<MatchRow>(`select ${MATCH_COLS} from public.matches where id = $1`, [id]);
    return r ? toMatch(r) : null;
  }

  async getMatchByKey(key: string): Promise<Match | null> {
    const [r] = await this.sql.query<MatchRow>(`select ${MATCH_COLS} from public.matches where key = $1`, [key]);
    return r ? toMatch(r) : null;
  }

  async nextSeq(): Promise<number> {
    const [r] = await this.sql.query<{ next: number }>(`select coalesce(max(seq) + 1, 0)::int as next from public.matches`);
    return Number(r.next);
  }

  /** 같은 key의 경기가 이미 있으면 새로 만들지 않고 null */
  async insertMatch(m: NewMatch): Promise<Match | null> {
    const [r] = await this.sql.query<MatchRow>(
      `insert into public.matches (key, seq, topic_id, topic, team_a, team_b, opens_at, writing_ends_at, voting_ends_at)
       values ($1, $2, $3, $4::text::jsonb, $5::text::jsonb, $6::text::jsonb, $7, $8, $9)
       on conflict (key) do nothing
       returning ${MATCH_COLS}`,
      [m.key, m.seq, m.topic.id, json(m.topic), json(m.teamA), json(m.teamB), m.opensAt, m.writingEndsAt, m.votingEndsAt],
    );
    return r ? toMatch(r) : null;
  }

  /** 투표가 끝났는데 아직 결과가 없는 경기 */
  async dueMatches(now: Date): Promise<Match[]> {
    const rows = await this.sql.query<MatchRow>(
      `select ${MATCH_COLS} from public.matches where status <> 'done' and voting_ends_at <= $1 order by seq`,
      [now],
    );
    return rows.map(toMatch);
  }

  async recentDone(limit: number): Promise<Match[]> {
    const rows = await this.sql.query<MatchRow>(
      `select ${MATCH_COLS} from public.matches where status = 'done' order by seq desc limit $1`,
      [limit],
    );
    return rows.map(toMatch);
  }

  /** 결과 집계를 맡는다. 다른 요청이 이미 집계 중이면 false (오래 멈춘 집계는 다시 맡는다). */
  async tryStartJudging(matchId: string, staleMinutes: number): Promise<boolean> {
    const rows = await this.sql.query(
      `update public.matches set status = 'judging', judging_started_at = now()
       where id = $1 and (status = 'open' or (status = 'judging' and judging_started_at < now() - make_interval(mins => $2::int)))
       returning id`,
      [matchId, staleMinutes],
    );
    return rows.length > 0;
  }

  async finishJudging(matchId: string, result: MatchResult): Promise<void> {
    await this.sql.query(
      `update public.matches set status = 'done', result = $2::text::jsonb where id = $1 and status = 'judging'`,
      [matchId, json(result)],
    );
  }

  async releaseJudging(matchId: string): Promise<void> {
    await this.sql.query(
      `update public.matches set status = 'open', judging_started_at = null where id = $1 and status = 'judging'`,
      [matchId],
    );
  }

  // ───────── 논거와 추천 ─────────

  async listArguments(matchId: string): Promise<Argument[]> {
    const rows = await this.sql.query<ArgumentRow>(
      `select a.id, a.match_id, a.author_id, a.author_district, a.author_mbti, a.side, a.body, a.created_at,
              count(r.user_id)::int as recommendations
       from public.arguments a
       left join public.recommendations r on r.argument_id = a.id
       where a.match_id = $1
       group by a.id
       order by a.created_at, a.id`,
      [matchId],
    );
    return rows.map(toArgument);
  }

  async countArgumentsBy(matchId: string, userId: string): Promise<number> {
    const [r] = await this.sql.query<{ n: number }>(
      `select count(*)::int as n from public.arguments where match_id = $1 and author_id = $2`,
      [matchId, userId],
    );
    return Number(r.n);
  }

  async insertArgument(a: {
    matchId: string; authorId: string; authorDistrict: District; authorMbti: string | null; side: Side; body: string; at: Date;
  }): Promise<Argument> {
    const [r] = await this.sql.query<ArgumentRow>(
      `insert into public.arguments (match_id, author_id, author_district, author_mbti, side, body, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, match_id, author_id, author_district, author_mbti, side, body, created_at, 0 as recommendations`,
      [a.matchId, a.authorId, a.authorDistrict, a.authorMbti, a.side, a.body, a.at],
    );
    return toArgument(r);
  }

  async getArgument(id: string): Promise<Argument | null> {
    const rows = await this.sql.query<ArgumentRow>(
      `select a.id, a.match_id, a.author_id, a.author_district, a.author_mbti, a.side, a.body, a.created_at,
              (select count(*)::int from public.recommendations r where r.argument_id = a.id) as recommendations
       from public.arguments a where a.id = $1`,
      [id],
    );
    return rows[0] ? toArgument(rows[0]) : null;
  }

  async setRecommendation(matchId: string, argumentId: string, userId: string, on: boolean): Promise<void> {
    if (on) {
      await this.sql.query(
        `insert into public.recommendations (argument_id, user_id, match_id) values ($1, $2, $3) on conflict do nothing`,
        [argumentId, userId, matchId],
      );
    } else {
      await this.sql.query(`delete from public.recommendations where argument_id = $1 and user_id = $2`, [argumentId, userId]);
    }
  }

  async recommendedBy(matchId: string, userId: string): Promise<string[]> {
    const rows = await this.sql.query<{ argument_id: string }>(
      `select argument_id from public.recommendations where match_id = $1 and user_id = $2`,
      [matchId, userId],
    );
    return rows.map((r) => r.argument_id);
  }

  // ───────── 투표 ─────────

  async getVote(matchId: string, userId: string): Promise<{ side: Side; argumentId: string | null } | null> {
    const [r] = await this.sql.query<{ side: Side; argument_id: string | null }>(
      `select side, argument_id from public.votes where match_id = $1 and user_id = $2`,
      [matchId, userId],
    );
    return r ? { side: r.side, argumentId: r.argument_id } : null;
  }

  /** 이미 판정했으면 false */
  async insertVote(v: { matchId: string; userId: string; voterDistrict: District; side: Side; argumentId: string }): Promise<boolean> {
    const rows = await this.sql.query(
      `insert into public.votes (match_id, user_id, voter_district, side, argument_id) values ($1, $2, $3, $4, $5)
       on conflict do nothing returning match_id`,
      [v.matchId, v.userId, v.voterDistrict, v.side, v.argumentId],
    );
    return rows.length > 0;
  }

  async listVotes(matchId: string): Promise<VoteRecord[]> {
    // 예전(MBTI 대결) 표는 지역이 없어 집계에서 빠진다 (끝난 경기는 결과가 이미 저장돼 있다)
    const rows = await this.sql.query<{ voter_district: District; side: Side; argument_id: string | null }>(
      `select voter_district, side, argument_id from public.votes where match_id = $1 and voter_district is not null`,
      [matchId],
    );
    return rows.map((r) => ({ voterDistrict: r.voter_district, side: r.side, argumentId: r.argument_id }));
  }
}
