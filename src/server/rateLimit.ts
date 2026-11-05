// 짧은 시간에 너무 많이 부르는 것을 막는 간단한 제한 (서버 인스턴스 하나 안에서만 센다).
// 서버리스는 인스턴스가 여러 개일 수 있어 정확한 전체 제한은 아니지만, 한 사람이 반복해서 두드리는 것은 대부분 막는다.
import 'server-only';

const buckets = new Map<string, number[]>();
/** 기억하는 열쇠 수 상한 (넘으면 오래된 것부터 버린다) */
const MAX_KEYS = 5000;

/** key로 windowMs 안에 limit번까지 허용한다. 허용하면 true (그리고 한 번 센다) */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.delete(key);
  buckets.set(key, recent);
  if (buckets.size > MAX_KEYS) buckets.delete(buckets.keys().next().value!);
  return true;
}

/** 요청한 곳의 IP (Vercel이 붙여 주는 x-forwarded-for의 첫 값) */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}
