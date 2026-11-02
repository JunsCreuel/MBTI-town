// 서버에서 하나만 만드는 토론 서비스. 개발 모드에서는 시계를 앞으로 돌려 하루 흐름을 확인할 수 있다.
import 'server-only';
import { getSql } from '../db';
import { createDebateAi } from './ai';
import { DebateService } from './service';
import { DebateStore } from './store';

const g = globalThis as unknown as { __mbtiDebate?: Promise<DebateService>; __mbtiClockOffsetMs?: number };

/** 개발용 시계 이동 (운영에서는 항상 0) */
export function clockOffsetMs(): number {
  return process.env.NODE_ENV === 'production' ? 0 : (g.__mbtiClockOffsetMs ?? 0);
}

export function setClockOffsetMs(ms: number): void {
  if (process.env.NODE_ENV === 'production') throw new Error('운영 환경에서는 시계를 바꿀 수 없습니다');
  g.__mbtiClockOffsetMs = ms;
}

export function getDebateService(): Promise<DebateService> {
  g.__mbtiDebate ??= (async () => {
    const sql = await getSql();
    return new DebateService(new DebateStore(sql), createDebateAi(), () => new Date(Date.now() + clockOffsetMs()));
  })();
  g.__mbtiDebate.catch(() => {
    g.__mbtiDebate = undefined;
  });
  return g.__mbtiDebate;
}
