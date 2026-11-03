// 실시간 서버 주소와 깨우기. 모든 화면이 쓰므로 실시간 SDK(@colyseus/sdk)를 불러오지 않는다.

export function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL || `${window.location.protocol}//${window.location.hostname}:2567`;
}

/**
 * 실시간 서버를 깨운다. 무료 호스팅은 한동안 아무도 없으면 잠들어서 첫 접속에 수십 초 걸린다.
 * 응답이 오면(서버가 깨어 있으면) 끝난다. 응답 내용은 읽지 않는다.
 */
export async function wakeRealtime(timeoutMs = 90_000): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const base = realtimeUrl().replace(/^ws/, 'http').replace(/\/$/, '');
    await fetch(`${base}/__healthcheck`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
  } catch {
    // 깨우지 못해도 접속은 시도한다
  } finally {
    clearTimeout(timer);
  }
}
