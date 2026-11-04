'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { debateConfig } from '@/config/game';
import { tokens } from '@/design/tokens';
import type { Phase, Side } from '@/shared/debate';
import { DISTRICT, isDistrict } from '@/shared/districts';
import { call } from '@/lib/api';
import { ApiError, api, type DebateView, type MeResponse } from './api';
import { ResultSection } from './ResultSection';
import { teamColor, teamInk, teamVars } from './teamColor';

const POLL_MS: Record<Phase, number> = { writing: 20_000, voting: 20_000, judging: 5_000, done: 60_000 };

function remaining(to: string, now: number): string {
  const ms = Math.max(0, Date.parse(to) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분`;
  return `${Math.ceil(ms / 1000)}초`;
}

/** 'YYYY-MM-DD#0' → '11월 2일' */
function dayLabel(key: string): string {
  return `${Number(key.slice(5, 7))}월 ${Number(key.slice(8, 10))}일`;
}

function hm(iso: string): string {
  // 한국 시간 표시 (시간표 기준 시간대)
  const d = new Date(Date.parse(iso) + debateConfig.utcOffsetMinutes * 60_000);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function DebateClient({ matchId }: { matchId?: string }) {
  const [view, setView] = useState<DebateView | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 서버 시각 기준으로 남은 시간을 센다 (개발용 시계 이동도 반영된다)
  const [skew, setSkew] = useState(0);
  const [tick, setTick] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    // 나(로그인)를 먼저 받는다: 세션 갱신이 한 번만 일어나게 하고, 그다음 토론을 같은 세션으로 받는다.
    // 내 정보를 못 받아도 토론은 보여 준다 (그때는 위쪽에 로그인 버튼 대신 아무것도 띄우지 않는다)
    const m = await api<MeResponse>('/api/me').catch(() => null);
    if (m) setMe(m);
    try {
      const v = await api<DebateView>(matchId ? `/api/debate/${matchId}` : '/api/debate');
      setView(v);
      setSkew(Date.parse(v.now) - Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '토론을 불러오지 못했어요.');
    }
  }, [matchId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!view || matchId) return;
    const t = setInterval(refresh, POLL_MS[view.phase]);
    return () => clearInterval(t);
  }, [view, matchId, refresh]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 단계가 끝나는 순간 바로 새로 불러온다
  const now = tick + skew;
  useEffect(() => {
    if (!view || view.phase === 'done' || matchId) return;
    const end = view.phase === 'writing' ? view.match.writingEndsAt : view.match.votingEndsAt;
    if (view.phase !== 'judging' && Date.parse(end) <= now) refresh();
  }, [now, view, matchId, refresh]);

  if (error && !view) {
    return (
      <main className="debate">
        <TopBar me={me} />
        <div className="panel">
          <p>{error}</p>
          <button className="btn-secondary" onClick={refresh}>다시 불러오기</button>
        </div>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="debate">
        <TopBar me={me} />
        <div className="panel panel--loading"><div className="loader" aria-label="불러오는 중" /></div>
      </main>
    );
  }

  return (
    <main className="debate">
      <TopBar me={me} />
      <MatchHero view={view} now={now} />
      {view.phase === 'done' && view.result ? (
        <ResultSection view={view} />
      ) : (
        <ActionPanel view={view} me={me} onChanged={refresh} />
      )}
      <Arguments view={view} onChanged={refresh} />
      {view.recent.length > 0 && (
        <section className="panel" aria-label="지난 경기">
          <h2 className="section-title">지난 경기</h2>
          <ul className="recent">
            {view.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/debate/${r.id}`}>
                  <span className="recent__date">{r.key.slice(5, 10).replace('-', '/')}</span>
                  <span className="recent__title">{r.title}</span>
                  <span className="recent__winner">
                    {r.winner === 'draw' ? '무승부' : `${r.winner === 'a' ? r.teamA : r.teamB} 승`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {matchId && (
        <Link className="back-link" href="/debate">‹ 오늘의 토론으로</Link>
      )}
    </main>
  );
}

function TopBar({ me }: { me: MeResponse | null }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await api('/api/auth/logout', {}).catch(() => {});
    window.location.reload();
  }
  return (
    <header className="topbar">
      <Link className="topbar__back" href="/village?at=plaza">‹ 중앙광장</Link>
      <span className="topbar__title">오늘의 토론</span>
      {me?.loggedIn ? (
        <button className="topbar__me" onClick={logout} disabled={busy} title="로그아웃">
          {me.profile?.district ? (
            <span className="pill__dot" style={{ '--chip-color': tokens.district[me.profile.district] } as CSSProperties} />
          ) : null}
          {me.profile?.district ? `${DISTRICT[me.profile.district].short} 주민` : '주민 등록 전'}
          {me.mbti ? ` · ${me.mbti}` : ''} · 로그아웃
        </button>
      ) : me ? (
        <Link className="topbar__me" href="/login?next=/debate">로그인</Link>
      ) : null}
    </header>
  );
}

function MatchHero({ view, now }: { view: DebateView; now: number }) {
  const m = view.match;
  const steps = [
    { label: '논거 작성', at: `~${hm(m.writingEndsAt)}` },
    { label: '관전 판정', at: `~${hm(m.votingEndsAt)}` },
    { label: '결과 발표', at: hm(m.votingEndsAt) },
  ];
  const current = view.phase === 'writing' ? 0 : view.phase === 'voting' ? 1 : 2;
  const countdown =
    view.phase === 'writing'
      ? `관전 판정 시작까지 ${remaining(m.writingEndsAt, now)}`
      : view.phase === 'voting'
        ? `결과 발표까지 ${remaining(m.votingEndsAt, now)}`
        : view.phase === 'judging'
          ? '결과를 집계하고 있어요'
          : '결과가 나왔어요';

  return (
    <section className="hero-card" aria-label="오늘의 대진">
      <p className="eyebrow">{dayLabel(m.key)} 대진</p>
      <div className="versus">
        <TeamName view={view} side="a" />
        <span className="versus__vs">VS</span>
        <TeamName view={view} side="b" />
      </div>
      <h1 className="topic-title">{m.topic.title}</h1>
      <div className="stances">
        {(['a', 'b'] as const).map((s) => (
          <div key={s} className="stance" style={teamVars(s === 'a' ? m.teamA : m.teamB, s) as CSSProperties}>
            <span className="stance__team">{s === 'a' ? m.teamA.label : m.teamB.label}</span>
            {s === 'a' ? m.topic.sideA : m.topic.sideB}
          </div>
        ))}
      </div>
      <ol className="timeline">
        {steps.map((st, i) => (
          <li key={st.label} className={`timeline__step timeline__step--${i < current ? 'done' : i === current ? 'now' : 'next'}`}>
            <span className="timeline__dot" aria-hidden>{i + 1}</span>
            <span className="timeline__label">{st.label}</span>
            <span className="timeline__at">{st.at}</span>
          </li>
        ))}
      </ol>
      <p className="countdown" aria-live="polite">{countdown}</p>
    </section>
  );
}

function TeamName({ view, side }: { view: DebateView; side: Side }) {
  const team = side === 'a' ? view.match.teamA : view.match.teamB;
  return (
    <span className="team-name" style={teamVars(team, side) as CSSProperties}>
      <span className="team-name__dot" aria-hidden />
      {team.label}
      {view.me.side === side && <span className="team-name__mine">우리 지역</span>}
    </span>
  );
}

function ActionPanel({ view, me, onChanged }: { view: DebateView; me: MeResponse | null; onChanged: () => void }) {
  const m = view.match;
  const teamLabel = (s: Side) => (s === 'a' ? m.teamA.label : m.teamB.label);

  if (!view.me.loggedIn) {
    return (
      <section className="panel action-panel">
        <p className="action-panel__lead">
          {view.phase === 'voting' ? '관전 판정이 열렸어요.' : `오늘은 ${m.teamA.label}과 ${m.teamB.label}의 대결이에요.`}
        </p>
        <p className="muted">로그인하면 우리 지역 논거를 쓰거나, 다른 지역 주민으로서 승패를 판정할 수 있어요.</p>
        <Link className="btn-primary btn-primary--inline" href="/login?next=/debate">로그인하고 참여하기</Link>
      </section>
    );
  }
  if (!view.me.district) {
    return (
      <section className="panel action-panel">
        <p className="action-panel__lead">마을 주민만 참여할 수 있어요</p>
        <p className="muted">가입을 마치면 사주로 사는 지역이 정해져요. 우리 지역이 출전하는 날엔 논거를 쓰고, 아닌 날엔 판정해요.</p>
        <Link className="btn-primary btn-primary--inline" href="/onboarding">가입 마치기</Link>
      </section>
    );
  }

  if (view.phase === 'judging') {
    return (
      <section className="panel action-panel action-panel--center">
        <div className="loader" aria-hidden />
        <p className="action-panel__lead">결과를 집계하고 있어요</p>
        <p className="muted">잠시 후 결과가 나와요.</p>
      </section>
    );
  }

  if (view.phase === 'writing') {
    if (!view.me.side) {
      return (
        <section className="panel action-panel">
          <p className="action-panel__lead">오늘 {DISTRICT[view.me.district].short} 지역은 관전 지역이에요.</p>
          <p className="muted">{hm(m.writingEndsAt)}부터 관전 판정이 열려요. 그때 두 지역 대표 논거 중 가장 설득력 있는 하나를 고르면, 그 지역에 한 표가 가요.</p>
        </section>
      );
    }
    if (view.me.argumentsLeft > 0) return <Compose view={view} onChanged={onChanged} />;
    return (
      <section className="panel action-panel">
        <p className="action-panel__lead">논거를 냈어요!</p>
        <p className="muted">우리 지역 논거에 추천을 눌러 대표 논거 {debateConfig.representativeArgs}개를 뽑아 주세요. 추천은 {hm(m.writingEndsAt)}까지예요.</p>
      </section>
    );
  }

  // 판정 시간
  if (!view.me.canVote) {
    return (
      <section className="panel action-panel">
        <p className="action-panel__lead">우리 지역 대표 논거가 정해졌어요.</p>
        <p className="muted">다른 세 지역 주민들이 대표 논거를 읽고 판정하고 있어요. {hm(m.votingEndsAt)}에 결과가 발표돼요.</p>
      </section>
    );
  }
  return <JudgePanel view={view} onChanged={onChanged} teamLabel={teamLabel} />;
}

function Compose({ view, onChanged }: { view: DebateView; onChanged: () => void }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const side = view.me.side!;
  const stance = side === 'a' ? view.match.topic.sideA : view.match.topic.sideB;
  const len = [...body.trim()].length;
  const max = debateConfig.argumentMaxLength;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/debate/arguments', { body });
      setBody('');
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '등록하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel action-panel" aria-label="논거 쓰기">
      <p className="action-panel__lead">우리 지역 입장: “{stance}”</p>
      <p className="muted">설득력 있는 이유와 근거를 써 주세요. 지역 안에서 추천을 많이 받은 {debateConfig.representativeArgs}개가 대표 논거가 돼요.</p>
      <label className="sr-only" htmlFor="argument">논거</label>
      <textarea
        id="argument"
        className="compose"
        value={body}
        maxLength={max}
        rows={5}
        placeholder="예) 계획을 세우면 이동 시간을 줄일 수 있어요. 실제로 지난 여행에서…"
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="compose__footer">
        <span className={len > max ? 'compose__count compose__count--over' : 'compose__count'}>{len}/{max}</span>
        <button className="btn-primary btn-primary--inline" disabled={busy || len < debateConfig.argumentMinLength} onClick={submit}>
          {busy ? '등록하는 중…' : '논거 내기'}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

/** 관전 판정: 양 팀 대표 논거를 함께 보여 주고, 가장 설득력 있는 하나를 고른다 */
function JudgePanel({ view, onChanged, teamLabel }: { view: DebateView; onChanged: () => void; teamLabel: (s: Side) => string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = view.match;
  const picked = view.me.vote;
  const reps = view.arguments.filter((a) => a.representative);

  async function pick(argumentId: string) {
    setBusy(argumentId);
    setError(null);
    try {
      await api('/api/debate/votes', { argumentId });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '판정하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel action-panel" aria-label="관전 판정">
      {picked ? (
        <>
          <p className="action-panel__lead">{teamLabel(picked.side)} 논거를 골랐어요.</p>
          <p className="muted">{hm(m.votingEndsAt)}에 결과가 발표돼요. 가장 많이 뽑힌 논거는 결정타 논거가 돼요.</p>
        </>
      ) : (
        <>
          <p className="action-panel__lead">가장 설득력 있는 논거 하나를 골라 주세요</p>
          <p className="muted">지역 이름보다 내용을 보고 골라 주세요. 고른 논거의 지역에 한 표가 가고, 한 번만 고를 수 있어요.</p>
        </>
      )}
      {reps.length === 0 ? (
        <p className="muted empty">대표 논거가 없어요.</p>
      ) : (
        (['a', 'b'] as const).map((s) => {
          const team = s === 'a' ? m.teamA : m.teamB;
          const list = reps.filter((a) => a.side === s);
          if (!list.length) return null;
          return (
            <div key={s} className="judge-group" style={teamVars(team, s) as CSSProperties}>
              <p className="judge-group__head">
                {team.label} · {s === 'a' ? m.topic.sideA : m.topic.sideB}
              </p>
              <ul className="arguments">
                {list.map((a) => {
                  const mine = picked?.argumentId === a.id;
                  return (
                    <li key={a.id} className={mine ? 'argument argument--picked' : 'argument'}>
                      <p className="argument__body">{a.body}</p>
                      {!picked && (
                        <button className="pick-btn" disabled={busy !== null} onClick={() => pick(a.id)}>
                          {busy === a.id ? '고르는 중…' : '이 논거가 제일 설득력 있어요'}
                        </button>
                      )}
                      {mine && <span className="badge badge--team">내가 고른 논거</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function Arguments({ view, onChanged }: { view: DebateView; onChanged: () => void }) {
  const [tab, setTab] = useState<Side>(view.me.side ?? 'a');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = view.match;
  const list = useMemo(() => view.arguments.filter((a) => a.side === tab), [view, tab]);
  const counts = { a: view.arguments.filter((a) => a.side === 'a').length, b: view.arguments.filter((a) => a.side === 'b').length };
  const canRecommend = view.phase === 'writing' && view.me.side === tab;

  // 운영자: 논거 지우기
  async function remove(id: string) {
    if (!confirm('이 논거를 지울까요? 추천·투표도 같이 지워져요.')) return;
    setPending(id);
    setError(null);
    try {
      await call('DELETE', `/api/debate/arguments/${id}`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      setPending(null);
    }
  }

  async function toggle(id: string, on: boolean) {
    setPending(id);
    setError(null);
    try {
      await api('/api/debate/recommendations', { argumentId: id, on });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '추천하지 못했어요.');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="panel" aria-label="논거">
      <div className="tabs" role="tablist">
        {(['a', 'b'] as const).map((s) => {
          const team = s === 'a' ? m.teamA : m.teamB;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={tab === s}
              className="tab"
              style={teamVars(team, s) as CSSProperties}
              onClick={() => setTab(s)}
            >
              {team.label} <span className="tab__count">{counts[s]}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {list.length === 0 ? (
        <p className="muted empty">아직 논거가 없어요.</p>
      ) : (
        <ul className="arguments">
          {list.map((a) => (
            <li key={a.id} className={a.representative ? 'argument argument--rep' : 'argument'}>
              {a.representative && <span className="badge">대표 논거</span>}
              <p className="argument__body">{a.body}</p>
              <div className="argument__meta">
                <span className="argument__author">
                  <span
                    className="pill__dot"
                    style={{ '--chip-color': isDistrict(a.authorDistrict) ? tokens.district[a.authorDistrict] : tokens.color.lose } as CSSProperties}
                  />
                  {a.mine ? '내 논거' : isDistrict(a.authorDistrict) ? `${DISTRICT[a.authorDistrict].short} 주민` : '주민'}
                  {a.authorMbti && <span className="argument__tag">{a.authorMbti}</span>}
                </span>
                {canRecommend && !a.mine ? (
                  <button
                    className="recommend"
                    aria-pressed={a.recommended}
                    disabled={pending === a.id}
                    onClick={() => toggle(a.id, !a.recommended)}
                  >
                    추천 {a.recommendations}
                  </button>
                ) : (
                  <span className="recommend recommend--static">
                    {a.picks !== null && <strong className="picks">판정 {a.picks}표 · </strong>}추천 {a.recommendations}
                  </span>
                )}
                {view.me.admin && (
                  <button className="recommend recommend--danger" disabled={pending === a.id} onClick={() => remove(a.id)}>
                    운영자 삭제
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
