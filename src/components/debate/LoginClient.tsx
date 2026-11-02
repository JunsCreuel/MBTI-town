'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useState } from 'react';
import { MBTI_GROUPS } from '@/design/mbti';
import { tokens } from '@/design/tokens';
import { OAUTH_PROVIDERS, supabaseAnonKey, supabaseUrl, type AuthMode } from '@/lib/authConfig';
import { loadMbti } from '@/lib/session';
import { ApiError, api } from './api';

export function LoginClient({ mode, devLogin, next, failed }: { mode: AuthMode; devLogin: boolean; next: string; failed: boolean }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(failed ? '로그인하지 못했어요. 다시 시도해 주세요.' : null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const supabase = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

  async function oauth(provider: (typeof OAUTH_PROVIDERS)[number]['id']) {
    setBusy(true);
    const { error: e } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (e) {
      setError('로그인 창을 열지 못했어요.');
      setBusy(false);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (err) setError('메일을 보내지 못했어요. 주소를 확인해 주세요.');
    else setSent(true);
  }

  async function dev() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/dev-login', {});
      // 입장할 때 고른 유형이 있으면 바로 정한다
      const mbti = loadMbti();
      if (mbti) await api('/api/me', { mbti }).catch(() => {});
      window.location.href = next;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '로그인하지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <main className="entry">
      <div className="wordmark">
        <span className="wordmark__dots" aria-hidden>
          {MBTI_GROUPS.map((g) => (
            <span key={g.id} style={{ background: tokens.color[g.colorToken] }} />
          ))}
        </span>
        MBTI 마을
      </div>
      <header>
        <h1 className="entry__title">로그인</h1>
        <p className="entry__lead">로그인하면 내 MBTI로 오늘의 토론에 참여할 수 있어요. 출전 팀이면 논거를 쓰고, 관전자면 투표해요.</p>
      </header>

      {mode === 'supabase' ? (
        <div className="choice-list">
          {OAUTH_PROVIDERS.map((p) => (
            <button key={p.id} className="choice-card" disabled={busy} onClick={() => oauth(p.id)}>
              <span className="choice-card__title">{p.label}</span>
              <span className="choice-card__arrow" aria-hidden>›</span>
            </button>
          ))}
          {sent ? (
            <p className="notice">{email}로 로그인 링크를 보냈어요. 메일함을 확인해 주세요.</p>
          ) : (
            <form className="email-form" onSubmit={magicLink}>
              <label className="muted" htmlFor="email">또는 이메일로 로그인 링크 받기</label>
              <div className="email-form__row">
                <input id="email" type="email" required value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
                <button className="btn-primary btn-primary--inline" disabled={busy}>보내기</button>
              </div>
            </form>
          )}
        </div>
      ) : devLogin ? (
        <div className="choice-list">
          <p className="notice">Supabase 설정이 없어 개발용 로그인을 써요. 이 브라우저에서만 쓰는 임시 계정이 만들어져요.</p>
          <button className="btn-primary" disabled={busy} onClick={dev}>개발용으로 로그인</button>
        </div>
      ) : (
        <p className="notice">로그인이 아직 설정되지 않았어요.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Link className="back-link" href="/debate">‹ 오늘의 토론 구경하기</Link>
    </main>
  );
}
