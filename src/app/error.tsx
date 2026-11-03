'use client';

// 화면에서 처리하지 못한 오류가 나면 보여 준다 (Next.js 기본 영어 오류 화면 대신).
// 새 버전이 배포된 뒤 예전 화면 조각을 못 받으면(ChunkLoadError) 한 번만 자동으로 새로고침한다.
import { useEffect } from 'react';

const RELOADED = 'scene:chunk-reloaded';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    const chunk = error.name === 'ChunkLoadError' || /Loading chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(error.message);
    if (!chunk) return;
    try {
      if (sessionStorage.getItem(RELOADED)) return;
      sessionStorage.setItem(RELOADED, '1');
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <main className="page page--center">
      <h1 className="section-title">화면을 불러오지 못했어요</h1>
      <p className="muted">잠깐 문제가 생겼어요. 다시 시도해 주세요.</p>
      <button className="btn-primary" onClick={() => reset()}>다시 시도</button>
      <button className="btn-secondary" onClick={() => window.location.reload()}>새로고침</button>
      {error.digest && <small className="muted">오류 번호 {error.digest}</small>}
    </main>
  );
}
