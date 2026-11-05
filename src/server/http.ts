// API 라우트 공통 처리: 규칙 오류(토론·미니홈피)는 사용자에게 보여 줄 메시지로, 나머지는 500으로.
import 'server-only';
import { NextResponse } from 'next/server';

/**
 * 규칙 오류(SceneError·DebateError)인지. instanceof로 보지 않는다: 페이지(서버 컴포넌트)가 먼저 만든 공용 서비스는
 * 그 번들의 오류 클래스로 던지므로, API 라우트 번들의 클래스와 달라 instanceof가 틀리고 500이 된다.
 */
function userError(e: unknown): { code: string; message: string; status: number } | null {
  if (!e || typeof e !== 'object') return null;
  const x = e as { userFacing?: unknown; code?: unknown; message?: unknown; status?: unknown };
  return x.userFacing === true && typeof x.code === 'string' && typeof x.status === 'number' ? { code: x.code, message: String(x.message), status: x.status } : null;
}

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    const u = userError(e);
    if (u) {
      return NextResponse.json({ error: u.code, message: u.message }, { status: u.status });
    }
    // 동시에 두 번 눌러 같은 것을 두 번 만들려다 DB 고유 조건(unique)에 걸린 경우: 500이 아니라 409
    if (e && typeof e === 'object' && (e as { code?: unknown }).code === '23505') {
      return NextResponse.json({ error: 'conflict', message: '이미 처리됐어요. 새로 고침해 주세요.' }, { status: 409 });
    }
    console.error('[api]', e);
    return NextResponse.json({ error: 'server_error', message: '잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
