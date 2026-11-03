'use client';

// 운영 화면 (운영자만): 요약 숫자, 신고 처리, 주민 찾기·계정 삭제.
// 운영자는 이 화면 말고도 모든 방·기록을 공개 범위와 상관없이 보고, 방명록·토론 논거를 지울 수 있다.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { call } from '@/lib/api';
import type { AdminReport, AdminUser } from '@/server/scene/service';
import type { AdminCounts } from '@/server/scene/store';
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

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([call<AdminCounts>('GET', '/api/admin'), call<{ reports: AdminReport[] }>('GET', '/api/admin/reports')]);
      setCounts(c);
      setReports(r.reports);
      setState('ok');
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

  useEffect(() => {
    void load();
    void search('');
  }, [load, search]);

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
                  {u.handle ? `@${u.handle}` : '방 없음'} · {u.district ? DISTRICT[u.district].short : '지역 없음'} · 가입 {u.joinedAt ?? '-'} · 기록 {u.records}
                </span>
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
