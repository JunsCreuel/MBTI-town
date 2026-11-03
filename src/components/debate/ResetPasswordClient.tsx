'use client';

// 새 비밀번호 정하기: 재설정 메일 링크로 로그인된 상태에서 비밀번호를 바꾼다.
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseAnonKey, supabaseUrl } from '@/lib/authConfig';
import { PASSWORD_MIN, authErrorMessage } from '@/lib/authMessages';
import { Wordmark } from '../app/Wordmark';

export function ResetPasswordClient({ next }: { next: string }) {
  const [ready, setReady] = useState<'checking' | 'ok' | 'none'>('checking');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const supabase = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }) => setReady(data.user ? 'ok' : 'none'))
      .catch(() => setReady('none'));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`비밀번호는 ${PASSWORD_MIN}자 이상으로 만들어 주세요.`);
    if (password !== password2) return setError('비밀번호 두 칸이 서로 달라요.');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authErrorMessage(err.code));
    setDone(true);
    setTimeout(() => (window.location.href = next), 1200);
  }

  return (
    <main className="entry">
      <Wordmark />
      <header>
        <h1 className="entry__title">새 비밀번호</h1>
        <p className="entry__lead">앞으로는 이메일과 이 비밀번호로 들어와요.</p>
      </header>
      {ready === 'checking' ? (
        <div className="loader" aria-hidden />
      ) : ready === 'none' ? (
        <p className="notice">
          링크가 만료됐거나 다른 브라우저에서 열었어요. <Link href="/login">로그인 화면</Link>에서 다시 요청해 주세요.
        </p>
      ) : done ? (
        <p className="notice">비밀번호를 정했어요! 들어가는 중…</p>
      ) : (
        <form className="auth-form" onSubmit={save}>
          <label className="auth-field">
            <span>새 비밀번호 ({PASSWORD_MIN}자 이상)</span>
            <input type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>한 번 더</span>
            <input type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>
            {busy ? '저장하는 중…' : '비밀번호 정하기'}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
