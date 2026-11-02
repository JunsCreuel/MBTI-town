// 토론 API 호출. 서버 오류 메시지를 그대로 화면에 보여 준다.
import type { MeResponse } from '@/app/api/me/route';
import type { DebateView } from '@/server/debate/service';

export type { DebateView, MeResponse };

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'error', data.message ?? '잠시 후 다시 시도해 주세요.', res.status);
  return data as T;
}
