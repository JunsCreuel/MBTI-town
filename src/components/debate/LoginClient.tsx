'use client';

// 로그인·가입. 처음 가입할 때만 이메일 인증을 하고, 그다음부터는 이메일 + 비밀번호로 들어온다.
// 비밀번호를 잊으면 재설정 메일로 새 비밀번호를 만든다.
// 가입 메일 인증을 끈 프로젝트(대시보드 Confirm email 끔)면 메일 없이 바로 가입되고, 문구도 그에 맞춘다.
// 가입·로그인이 막히면(메일 발송 실패 등) 운영 화면 가입 도움에 저절로 알린다.
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OAUTH_PROVIDERS, supabaseAnonKey, supabaseUrl, type AuthMode } from '@/lib/authConfig';
import { PASSWORD_MIN, authErrorCode, authErrorMessage, shouldReportAuthError, signupErrorMessage } from '@/lib/authMessages';
import { fetchAuthSettings } from '@/lib/authSettings';
import { Wordmark } from '../app/Wordmark';
import { ApiError, api } from './api';

type Tab = 'login' | 'signup' | 'reset';

/** 막힌 가입·로그인을 운영자에게 알린다 (기다리지 않는다) */
function reportTrouble(step: 'signup' | 'login' | 'resend', email: string, err: { code?: string; status?: number }) {
  const code = authErrorCode(err);
  if (!shouldReportAuthError(step, code)) return;
  void fetch('/api/auth/signup-issue', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step, email: email.trim(), code }),
    keepalive: true,
  }).catch(() => {});
}

export function LoginClient({ mode, devLogin, next, failed }: { mode: AuthMode; devLogin: boolean; next: string; failed: string | null }) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  /** 메일을 보냈으면 무슨 메일인지 (가입 인증·비밀번호 재설정) */
  const [sent, setSent] = useState<'signup' | 'reset' | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  /** 메일 보냄 화면에서 한 번 더 보냈는지 */
  const [resent, setResent] = useState(false);
  /** 이미 있는 계정(가입했거나 예전 메일 링크 계정) 또는 비밀번호가 틀림 → 그 자리에서 재설정 메일을 받게 한다 */
  const [offerReset, setOfferReset] = useState(false);
  const [error, setError] = useState<string | null>(failed ? authErrorMessage(failed) : null);
  /** 가입할 때 인증 메일을 보내는지 (못 읽으면 보낸다고 본다) */
  const [confirmEmail, setConfirmEmail] = useState(true);
  useEffect(() => {
    if (mode !== 'supabase') return;
    let live = true;
    void fetchAuthSettings(supabaseUrl, supabaseAnonKey).then((s) => live && s && setConfirmEmail(s.confirmEmail));
    return () => {
      live = false;
    };
  }, [mode]);

  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const supabase = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

  function go(t: Tab) {
    setTab(t);
    setError(null);
    setSent(null);
    setResent(false);
    setNeedsConfirm(false);
    setOfferReset(false);
  }

  async function oauth(provider: (typeof OAUTH_PROVIDERS)[number]['id']) {
    setBusy(true);
    const { error: e } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: callback(next) } });
    if (e) {
      setError('로그인 창을 열지 못했어요.');
      setBusy(false);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNeedsConfirm(false);
    const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (!err) {
      window.location.href = next;
      return;
    }
    setBusy(false);
    setError(authErrorMessage(err.code));
    reportTrouble('login', email, err);
    if (err.code === 'email_not_confirmed') setNeedsConfirm(true);
    if (err.code === 'invalid_credentials') setOfferReset(true);
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`비밀번호는 ${PASSWORD_MIN}자 이상으로 만들어 주세요.`);
    if (password !== password2) return setError('비밀번호 두 칸이 서로 달라요.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      // 인증 메일의 링크를 누르면 바로 로그인되어 첫 화면(동네 정하기)으로 간다
      options: { emailRedirectTo: callback('/onboarding') },
    });
    setBusy(false);
    const exists = err?.code === 'email_exists' || err?.code === 'user_already_exists' || (!err && data.user && data.user.identities?.length === 0);
    if (exists) {
      // 이미 있는 주소 (예전에 메일 링크로 가입한 계정은 비밀번호가 없다): 재설정 메일로 비밀번호를 정하게 한다
      setOfferReset(true);
      return setError('이미 가입한 이메일이에요. 비밀번호를 모르거나 예전에 메일 링크로 가입했다면, 재설정 메일을 받아 비밀번호를 정해 주세요.');
    }
    if (err) {
      reportTrouble('signup', email, err);
      return setError(signupErrorMessage(authErrorCode(err)));
    }
    if (data.session) {
      window.location.href = '/onboarding';
      return;
    }
    setSent('signup');
  }

  async function resend() {
    setBusy(true);
    const { error: err } = await supabase().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: callback('/onboarding') } });
    setBusy(false);
    if (err) {
      reportTrouble('resend', email, err);
      setError(signupErrorMessage(authErrorCode(err)));
    } else {
      setError(null);
      setNeedsConfirm(false);
      setResent(sent === 'signup');
      setSent('signup');
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    await sendReset();
  }

  async function sendReset() {
    setBusy(true);
    setError(null);
    setOfferReset(false);
    const { error: err } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: callback(`/login/reset?next=${encodeURIComponent(next)}`) });
    setBusy(false);
    if (err) setError(authErrorMessage(err.code));
    else setSent('reset');
  }

  async function dev() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/dev-login', {});
      window.location.href = next;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '로그인하지 못했어요.');
      setBusy(false);
    }
  }

  const emailField = (
    <label className="auth-field">
      <span>이메일</span>
      <input type="email" required autoComplete="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
    </label>
  );

  return (
    <main className="entry">
      <Wordmark />
      <header>
        <h1 className="entry__title">{tab === 'signup' ? '처음 오셨어요?' : tab === 'reset' ? '비밀번호 찾기' : '로그인'}</h1>
        <p className="entry__lead">로그인하면 나만의 방이 생겨요. 방을 꾸미고, 음악과 기록을 남기고, 친구 방에 놀러 가요.</p>
      </header>

      {mode === 'supabase' ? (
        <div className="choice-list">
          {OAUTH_PROVIDERS.map((p) => (
            <button key={p.id} className="choice-card" disabled={busy} onClick={() => oauth(p.id)}>
              <span className="choice-card__title">{p.label}</span>
              <span className="choice-card__arrow" aria-hidden>›</span>
            </button>
          ))}

          {tab !== 'reset' && (
            <div className="auth-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'login'} className={`chip${tab === 'login' ? ' chip--on' : ''}`} onClick={() => go('login')}>
                로그인
              </button>
              <button role="tab" aria-selected={tab === 'signup'} className={`chip${tab === 'signup' ? ' chip--on' : ''}`} onClick={() => go('signup')}>
                처음이에요 (가입)
              </button>
            </div>
          )}

          {sent === 'signup' ? (
            <div className="notice">
              <b>{email}</b>로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.
              <br />
              다음부터는 이메일과 비밀번호로 바로 들어오면 돼요. 메일이 안 보이면 스팸함도 봐 주세요.
              <br />
              <button type="button" className="auth-link auth-link--inline" onClick={resend} disabled={busy}>
                {resent ? '다시 보냈어요' : '메일이 안 와요 (다시 받기)'}
              </button>
            </div>
          ) : sent === 'reset' ? (
            <div className="notice">
              <b>{email}</b>로 비밀번호 재설정 메일을 보냈어요. <b>이 브라우저에서</b> 메일의 링크를 열어 새 비밀번호를 정해 주세요.
            </div>
          ) : tab === 'login' ? (
            <form className="auth-form" onSubmit={login}>
              {emailField}
              <label className="auth-field">
                <span>비밀번호</span>
                <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button className="btn-primary" disabled={busy}>
                {busy ? '들어가는 중…' : '로그인'}
              </button>
              <button type="button" className="auth-link" onClick={() => go('reset')}>
                비밀번호를 잊었어요
              </button>
            </form>
          ) : tab === 'signup' ? (
            <form className="auth-form" onSubmit={signup}>
              {emailField}
              <label className="auth-field">
                <span>비밀번호 ({PASSWORD_MIN}자 이상)</span>
                <input type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="auth-field">
                <span>비밀번호 한 번 더</span>
                <input type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              </label>
              <button className="btn-primary" disabled={busy}>
                {confirmEmail ? (busy ? '보내는 중…' : '가입하고 인증 메일 받기') : busy ? '가입하는 중…' : '가입하기'}
              </button>
              {confirmEmail && <p className="muted auth-note">가입할 때 딱 한 번만 이메일 인증을 해요. 그다음부터는 비밀번호로 들어와요.</p>}
            </form>
          ) : (
            <form className="auth-form" onSubmit={reset}>
              <p className="muted auth-note">가입한 이메일을 적으면 새 비밀번호를 만드는 링크를 보내 드려요.</p>
              {emailField}
              <button className="btn-primary" disabled={busy}>
                {busy ? '보내는 중…' : '비밀번호 재설정 메일 받기'}
              </button>
              <button type="button" className="auth-link" onClick={() => go('login')}>
                ‹ 로그인으로 돌아가기
              </button>
            </form>
          )}
          {sent && (
            <button type="button" className="auth-link" onClick={() => go('login')}>
              ‹ 로그인 화면으로
            </button>
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
      {error && (
        <p className="form-error" role="alert">
          {error}
          {needsConfirm && (
            <>
              {' '}
              <button type="button" className="auth-link auth-link--inline" onClick={resend} disabled={busy}>
                인증 메일 다시 받기
              </button>
            </>
          )}
          {offerReset && email.trim() && (
            <>
              {' '}
              <button type="button" className="auth-link auth-link--inline" onClick={() => void sendReset()} disabled={busy}>
                {email.trim()}로 비밀번호 재설정 메일 받기
              </button>
            </>
          )}
        </p>
      )}
      <Link className="back-link" href="/village">‹ 마을 먼저 구경하기</Link>
    </main>
  );
}
