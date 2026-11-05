'use client';

// 운영 화면 (운영자만): 요약 숫자, 가입 도움(인증 처리·막힌 기록·가입 설정 점검), 전체 공지, 신고 처리, 주민 찾기·계정 삭제.
// 운영자는 이 화면 말고도 모든 방·기록을 공개 범위와 상관없이 보고, 방명록·토론 논거를 지울 수 있다.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { call } from '@/lib/api';
import { authTroubleLabel } from '@/lib/authMessages';
import type { AuthSettings } from '@/lib/authSettings';
import type { AdminReport, AdminSignup, AdminSignups, AdminUser, AdminYoutube } from '@/server/scene/service';
import type { AdminCounts, SignupFailure } from '@/server/scene/store';
import { NOTICE_MAX } from '@/shared/announce';
import { DISTRICT } from '@/shared/districts';
import { TabBar } from '../app/TabBar';

const KIND_LABEL: Record<AdminReport['kind'], string> = { guestbook: '방명록', record: '기록', user: '사용자' };
const COUNT_LABEL: [keyof AdminCounts, string][] = [
  ['residents', '주민'],
  ['joined_today', '오늘 가입'],
  ['active_today', '오늘 접속'],
  ['records', '기록'],
  ['photos', '사진'],
  ['guestbook', '방명록'],
  ['open_reports', '처리할 신고'],
];

const SIGNUP_STATE: Record<AdminSignup['state'], string> = { pending: '메일 인증 전', joined: '주민 등록 전', resident: '주민' };
const TROUBLE_STEP: Record<SignupFailure['step'], string> = { signup: '가입', login: '로그인', resend: '메일 다시 받기' };

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function AdminClient() {
  // 운영자가 아니면 서버가 이 화면 자체를 404로 돌려보낸다 (src/app/admin/page.tsx)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [youtube, setYoutube] = useState<AdminYoutube | null>(null);
  const [ytLink, setYtLink] = useState('');
  const [signups, setSignups] = useState<(AdminSignups & { auth: AuthSettings | null }) | null>(null);
  const [signupQ, setSignupQ] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([call<AdminCounts>('GET', '/api/admin'), call<{ reports: AdminReport[] }>('GET', '/api/admin/reports')]);
      setCounts(c);
      setReports(r.reports);
      setState('ok');
      // 유튜브 제한 표가 아직 없어도(SQL 전) 다른 운영 기능은 쓸 수 있게 따로 받는다
      call<AdminYoutube>('GET', '/api/admin/youtube').then(setYoutube, () => setYoutube(null));
    } catch {
      setState('error');
    }
  }, []);

  const search = useCallback(async (query: string) => {
    try {
      setUsers((await call<{ users: AdminUser[] }>('GET', `/api/admin/users?q=${encodeURIComponent(query)}`)).users);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadSignups = useCallback(async (query: string) => {
    try {
      setSignups(await call<AdminSignups & { auth: AuthSettings | null }>('GET', `/api/admin/signups?q=${encodeURIComponent(query)}`));
    } catch {
      setSignups(null);
    }
  }, []);

  useEffect(() => {
    void load();
    void search('');
    void loadSignups('');
  }, [load, search, loadSignups]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function resolve(r: AdminReport, action: 'dismiss' | 'remove') {
    if (action === 'remove' && !confirm(`신고된 ${KIND_LABEL[r.kind]}을(를) 지울까요? 되돌릴 수 없어요.`)) return;
    setBusy(r.id);
    try {
      await call('POST', `/api/admin/reports/${r.id}`, { action });
      setToast(action === 'remove' ? '지우고 처리했어요' : '문제없음으로 닫았어요');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : '처리하지 못했어요');
    } finally {
      setBusy(null);
    }
  }

  async function sendNotice() {
    const text = notice.trim();
    if (!text || !confirm(`지금 마을에 접속한 모두에게 보낼까요?\n\n(공지) ${text}`)) return;
    setBusy('notice');
    try {
      await call('POST', '/api/admin/notice', { text });
      setNotice('');
      setToast('공지를 보냈어요');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '보내지 못했어요');
    } finally {
      setBusy(null);
    }
  }

  /** 주민마다 줄 코인 칸에 적은 값 */
  const [give, setGive] = useState<Record<string, string>>({});
  async function adjust(u: AdminUser, body: { coins: number }) {
    setBusy(u.id);
    try {
      const r = await call<{ coins: number }>('POST', `/api/admin/users/${u.id}`, body);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...r } : x)));
      setToast(`${u.displayName} 님 코인 ${r.coins.toLocaleString('ko-KR')}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '바꾸지 못했어요');
    } finally {
      setBusy(null);
    }
  }
  function giveCoins(u: AdminUser, sign: 1 | -1) {
    const n = Math.floor(Number(give[u.id] ?? '1000'));
    if (!Number.isFinite(n) || n <= 0) return setToast('코인 수를 1 이상으로 적어 주세요');
    void adjust(u, { coins: sign * n });
  }

  /** 클럽 유튜브: 켜기·끄기, 막기, 풀기 */
  async function updateYoutube(body: Record<string, unknown>, done: string) {
    setBusy('youtube');
    try {
      setYoutube(await call<AdminYoutube>('POST', '/api/admin/youtube', body));
      setToast(done);
      return true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : '바꾸지 못했어요');
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** 가입 도움: 인증 처리·지우기·막힌 기록 비우기 */
  async function confirmSignup(a: AdminSignup) {
    if (!confirm(`${a.email} 계정을 메일 인증 없이 쓸 수 있게 할까요?\n그분은 가입할 때 정한 비밀번호로 바로 로그인하면 돼요.`)) return;
    setBusy(a.id);
    try {
      const next = await call<AdminSignup>('POST', `/api/admin/signups/${a.id}`);
      setSignups((s) => s && { ...s, pending: Math.max(0, s.pending - 1), accounts: s.accounts.map((x) => (x.id === a.id ? next : x)) });
      setToast('인증 처리했어요');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '처리하지 못했어요');
    } finally {
      setBusy(null);
    }
  }
  async function deleteSignup(a: AdminSignup) {
    if (!confirm(`${a.email} 계정을 지울까요?\n지우면 같은 주소로 처음부터 다시 가입할 수 있어요.`)) return;
    setBusy(a.id);
    try {
      await call('DELETE', `/api/admin/signups/${a.id}`);
      setToast('계정을 지웠어요');
      await loadSignups(signupQ);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '지우지 못했어요');
    } finally {
      setBusy(null);
    }
  }
  async function clearTroubles() {
    if (!confirm('막힌 기록을 모두 지울까요?')) return;
    setBusy('troubles');
    try {
      await call('DELETE', '/api/admin/signups');
      setSignups((s) => s && { ...s, failures: [] });
    } catch (e) {
      setToast(e instanceof Error ? e.message : '지우지 못했어요');
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`${u.displayName} 님의 계정을 지울까요?\n방·기록·사진·방명록이 모두 지워지고 되돌릴 수 없어요.`)) return;
    if (prompt(`정말 지우려면 이름(${u.displayName})을 그대로 적어 주세요.`) !== u.displayName) return;
    setBusy(u.id);
    try {
      await call('DELETE', `/api/admin/users/${u.id}`);
      setToast('계정을 지웠어요');
      await Promise.all([load(), search(q)]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '지우지 못했어요');
    } finally {
      setBusy(null);
    }
  }

  if (state === 'loading') return <main className="page"><div className="loader" aria-hidden /></main>;
  if (state === 'error')
    return (
      <main className="page">
        <header className="page__head"><h1>운영</h1></header>
        <p className="notice">운영 정보를 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.</p>
        <button className="btn-secondary" onClick={() => void load()}>다시 불러오기</button>
        <TabBar />
      </main>
    );

  const open = reports.filter((r) => !r.resolved);
  const done = reports.filter((r) => r.resolved);
  return (
    <main className="page admin">
      <header className="page__head">
        <h1>운영</h1>
        <p className="muted">운영자는 모든 방·기록을 공개 범위와 상관없이 보고, 방명록과 토론 논거를 지울 수 있어요. 방문 기록은 남지 않아요.</p>
      </header>

      {counts && (
        <section className="section card">
          <h2 className="section-title">오늘의 마을</h2>
          <ul className="admin-stats">
            {COUNT_LABEL.map(([k, label]) => (
              <li key={k} className={k === 'open_reports' && counts[k] > 0 ? 'admin-stats__alert' : undefined}>
                <b>{counts[k].toLocaleString('ko-KR')}</b>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section card">
        <h2 className="section-title">
          가입 도움 {signups && <span className="muted">메일 인증 전 {signups.pending}</span>}
        </h2>
        {!signups ? (
          <p className="muted">가입 정보를 불러오지 못했어요.</p>
        ) : (
          <>
            {signups.auth && !signups.auth.signup ? (
              <p className="notice admin-warn">새 가입이 꺼져 있어요. Supabase → Authentication → Sign In / Providers에서 Allow new users to sign up을 켜 주세요.</p>
            ) : signups.auth?.confirmEmail ? (
              <p className="notice admin-warn">
                가입할 때 메일 인증을 해요. Supabase에 메일 발송(SMTP)을 연결하지 않았다면 운영팀 주소 말고는 인증 메일이 가지 않아 가입이 막혀요. 바로 풀려면 Supabase → Authentication → Sign In / Providers → Email에서 Confirm email을 꺼 주세요.
              </p>
            ) : signups.auth ? (
              <p className="muted">메일 인증 없이 바로 가입돼요.</p>
            ) : null}
            {signups.failures.length > 0 && (
              <>
                <h3 className="sub-title admin-sub">
                  막힌 기록
                  <button type="button" className="auth-link auth-link--inline" disabled={busy === 'troubles'} onClick={() => void clearTroubles()}>
                    비우기
                  </button>
                </h3>
                <ul className="admin-list">
                  {signups.failures.map((f) => (
                    <li key={`${f.email}|${f.code}|${f.step}`} className="admin-user">
                      <div className="admin-user__info">
                        <b className="admin-email">{f.email}</b>
                        <span className="muted">
                          {TROUBLE_STEP[f.step]} · {authTroubleLabel(f.code)} · {when(f.at)}
                          {f.count > 1 && ` · ${f.count}번`}
                        </span>
                      </div>
                      <div className="admin-actions">
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => {
                            setSignupQ(f.email);
                            void loadSignups(f.email);
                          }}
                        >
                          계정 찾기
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                void loadSignups(signupQ);
              }}
            >
              <input value={signupQ} onChange={(e) => setSignupQ(e.target.value)} placeholder="이메일로 찾기" maxLength={100} aria-label="찾을 이메일" />
              <button className="btn-primary btn-primary--inline">찾기</button>
            </form>
            <ul className="admin-list">
              {signups.accounts.map((a) => (
                <li key={a.id} className="admin-user">
                  <div className="admin-user__info">
                    <b className="admin-email">
                      {a.email}
                      <span className={`admin-badge${a.state === 'pending' ? ' admin-badge--alert' : ''}`}>{SIGNUP_STATE[a.state]}</span>
                    </b>
                    <span className="muted">
                      가입 {when(a.createdAt)} · 마지막 로그인 {a.lastSignInAt ? when(a.lastSignInAt) : '없음'}
                      {a.displayName && ` · ${a.displayName}`}
                      {a.handle && ` (@${a.handle})`}
                    </span>
                  </div>
                  {a.state !== 'resident' && !a.admin && (
                    <div className="admin-actions">
                      {a.state === 'pending' && (
                        <button className="btn-primary btn-primary--inline btn-small" disabled={busy === a.id} onClick={() => void confirmSignup(a)}>
                          인증 처리
                        </button>
                      )}
                      <button className="btn-danger btn-small" disabled={busy === a.id} onClick={() => void deleteSignup(a)}>
                        지우기
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {signups.accounts.length === 0 && <p className="muted">{signupQ.trim() ? '그 주소로 가입한 계정이 없어요. 가입하다 메일 발송에서 막히면 계정이 만들어지지 않아요.' : '가입한 계정이 없어요.'}</p>}
            </ul>
          </>
        )}
      </section>

      <section className="section card">
        <h2 className="section-title">
          신고 <span className="muted">처리할 것 {open.length}</span>
        </h2>
        {open.length === 0 && <p className="muted">처리할 신고가 없어요.</p>}
        <ul className="admin-list">
          {[...open, ...done.slice(0, 20)].map((r) => (
            <li key={r.id} className={`admin-report${r.resolved ? ' admin-report--done' : ''}`}>
              <div className="admin-report__head">
                <span className="chip chip--small">{KIND_LABEL[r.kind]}</span>
                <span className="muted">{when(r.createdAt)} · 신고한 사람 {r.reporter?.displayName ?? '(지워진 계정)'}</span>
                {r.resolved && <span className="admin-report__state">{r.resolved === 'removed' ? '지움' : '문제없음'}</span>}
              </div>
              <p className="admin-report__preview">{r.gone ? '(이미 지워진 내용)' : r.kind === 'user' ? `사용자: ${r.preview ?? '(지워진 계정)'}` : `“${r.preview}”`}</p>
              {r.reason && <p className="admin-report__reason">이유: {r.reason}</p>}
              {!r.resolved && (
                <div className="admin-actions">
                  {r.roomHandle && (
                    <Link className="btn-secondary btn-small" href={`/r/${r.roomHandle}`} target="_blank">
                      방 보기
                    </Link>
                  )}
                  {r.kind !== 'user' && !r.gone && (
                    <button className="btn-danger btn-small" disabled={busy === r.id} onClick={() => resolve(r, 'remove')}>
                      내용 지우기
                    </button>
                  )}
                  <button className="btn-secondary btn-small" disabled={busy === r.id} onClick={() => resolve(r, 'dismiss')}>
                    문제없음
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="section card">
        <h2 className="section-title">전체 공지</h2>
        <p className="muted">지금 마을·동네·놀이터·집 안에 접속한 모두의 화면 위쪽에 몇 초 동안 보여요. 저장되지 않아서 나중에 들어온 사람은 못 봐요.</p>
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            void sendNotice();
          }}
        >
          <input value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="예: 오늘 밤 10시에 광장에서 만나요!" maxLength={NOTICE_MAX} aria-label="공지 내용" />
          <button className="btn-primary btn-primary--inline" disabled={!notice.trim() || busy === 'notice'}>
            보내기
          </button>
        </form>
      </section>

      <section className="section card">
        <h2 className="section-title">클럽 유튜브 신청</h2>
        {!youtube ? (
          <p className="muted">유튜브 제한 정보를 불러오지 못했어요. (SQL을 실행했는지 확인해 주세요)</p>
        ) : (
          <>
            <p className="muted">
              제목·채널 이름에 욕설·성인·도박 같은 말이 있으면 저절로 막아요. 여기서 막은 영상·채널은 신청할 수 없어요. 이미 신청 목록에 있는 곡은 클럽 DJ 시트에서 빼 주세요.
            </p>
            <div className="admin-yt__switch">
              <span>
                지금 유튜브 신청 <b>{youtube.on ? '받는 중' : '쉬는 중'}</b>
              </span>
              <button
                className={youtube.on ? 'btn-secondary btn-small' : 'btn-primary btn-primary--inline btn-small'}
                disabled={busy === 'youtube'}
                onClick={() => void updateYoutube({ on: !youtube.on }, youtube.on ? '유튜브 신청을 껐어요' : '유튜브 신청을 켰어요')}
              >
                {youtube.on ? '유튜브 신청 끄기' : '유튜브 신청 켜기'}
              </button>
            </div>
            <form
              className="admin-search"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await updateYoutube({ block: { url: ytLink, scope: 'video' } }, '영상을 막았어요')) setYtLink('');
              }}
            >
              <input value={ytLink} onChange={(e) => setYtLink(e.target.value)} placeholder="유튜브 영상 링크나 채널 주소" maxLength={200} aria-label="막을 유튜브 영상 링크나 채널 주소" />
              <button className="btn-primary btn-primary--inline" disabled={!ytLink.trim() || busy === 'youtube'}>
                영상 막기
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!ytLink.trim() || busy === 'youtube'}
                onClick={async () => {
                  if (await updateYoutube({ block: { url: ytLink, scope: 'channel' } }, '채널을 막았어요')) setYtLink('');
                }}
              >
                채널 막기
              </button>
            </form>
            <ul className="admin-list">
              {youtube.blocks.map((b) => (
                <li key={`${b.kind}:${b.id}`} className="admin-user">
                  <div className="admin-user__info">
                    <b>
                      {b.label || b.id}
                      <span className="admin-badge">{b.kind === 'video' ? '영상' : '채널'}</span>
                    </b>
                    <span className="muted">
                      {b.id} · {b.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="admin-actions">
                    <button className="btn-secondary btn-small" disabled={busy === 'youtube'} onClick={() => void updateYoutube({ unblock: { kind: b.kind, id: b.id } }, '막은 것을 풀었어요')}>
                      풀기
                    </button>
                  </div>
                </li>
              ))}
              {youtube.blocks.length === 0 && <p className="muted">막은 영상·채널이 없어요.</p>}
            </ul>
          </>
        )}
      </section>

      <section className="section card">
        <h2 className="section-title">주민</h2>
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            void search(q);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름이나 주소(핸들)로 찾기" maxLength={30} />
          <button className="btn-primary btn-primary--inline">찾기</button>
        </form>
        <ul className="admin-list">
          {users.map((u) => (
            <li key={u.id} className="admin-user">
              <div className="admin-user__info">
                <b>
                  {u.displayName}
                  {u.admin && <span className="admin-badge">운영자</span>}
                </b>
                <span className="muted">
                  {u.handle ? `@${u.handle}` : '방 없음'} · {u.district ? DISTRICT[u.district].name : '마을 없음'} · 가입 {u.joinedAt ?? '-'} · 기록 {u.records}
                </span>
                <span className="admin-user__wallet">
                  코인 <b>{u.coins.toLocaleString('ko-KR')}</b>
                </span>
              </div>
              <div className="admin-wallet">
                <input
                  className="admin-wallet__input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={100}
                  value={give[u.id] ?? '1000'}
                  onChange={(e) => setGive((g) => ({ ...g, [u.id]: e.target.value }))}
                  aria-label={`${u.displayName} 님에게 줄 코인`}
                />
                <button className="btn-primary btn-primary--inline btn-small" disabled={busy === u.id} onClick={() => giveCoins(u, 1)}>
                  코인 주기
                </button>
                <button className="btn-secondary btn-small" disabled={busy === u.id || u.coins === 0} onClick={() => giveCoins(u, -1)}>
                  코인 빼기
                </button>
              </div>
              <div className="admin-actions">
                {u.handle && (
                  <Link className="btn-secondary btn-small" href={`/r/${u.handle}`} target="_blank">
                    방 보기
                  </Link>
                )}
                {!u.admin && (
                  <button className="btn-danger btn-small" disabled={busy === u.id} onClick={() => deleteUser(u)}>
                    계정 삭제
                  </button>
                )}
              </div>
            </li>
          ))}
          {users.length === 0 && <p className="muted">찾는 주민이 없어요.</p>}
        </ul>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
      <TabBar />
    </main>
  );
}
