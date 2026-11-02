// API 라우트 공통 처리: 토론 규칙 오류는 사용자에게 보여 줄 메시지로, 나머지는 500으로.
import 'server-only';
import { NextResponse } from 'next/server';
import { DebateError } from './debate/service';

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof DebateError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
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
