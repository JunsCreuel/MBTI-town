// 로그인·가입·메일 링크 뒤에 돌아갈 주소(next)를 우리 사이트 안의 경로로만 받는다 (열린 리디렉션 막기).
// '/\evil.com'·'/%09/evil.com'처럼 브라우저가 다른 사이트로 읽는 모양도 막는다.

const FALLBACK = '/home';

export function safeNext(next: string | null | undefined, fallback = FALLBACK): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.length > 512) return fallback;
  // 역슬래시·제어 문자(탭·줄바꿈 등)·인코딩된 제어 문자는 받지 않는다
  if (/[\\\u0000-\u001f\u007f]/.test(next) || /%(0[0-9a-f]|1[0-9a-f]|5c|7f)/i.test(next)) return fallback;
  try {
    const base = 'https://mbti-town.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
