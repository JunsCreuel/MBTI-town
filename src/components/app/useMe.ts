'use client';

// 지금 로그인한 나 (프로필·방). 로그인 안 했거나 방이 없으면 알맞은 곳으로 보낸다.
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { MeResponse } from '@/app/api/me/route';
import { call } from '@/lib/api';

export function useMe(opts: { require?: 'login' | 'onboarded' } = {}) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try {
      const m = await call<MeResponse>('GET', '/api/me');
      if (opts.require && !m.loggedIn) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      // 가입을 마치지 않았거나, 예전에 MBTI 없이 가입한 주민은 MBTI(= 사는 마을)부터 정한다
      if (opts.require === 'onboarded' && (!m.profile?.onboarded || !m.profile.mbti)) {
        router.replace('/onboarding');
        return;
      }
      setMe(m);
    } catch {
      setError(true);
    }
  }, [opts.require, router]);
  useEffect(() => {
    load();
  }, [load]);
  return { me, setMe, reload: load, error };
}
