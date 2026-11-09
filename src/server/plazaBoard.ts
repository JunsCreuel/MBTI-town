// 광장 전광판과 대항전 화면에 쓰는 것: 대항전 순위(지난주 결과를 정하는 일 포함)와 오늘의 토론 한 줄.
import 'server-only';
import { phaseOf, type Phase, type Team } from '@/shared/debate';
import { getDebateService } from './debate';
import { getSceneService } from './scene';
import type { ContestView } from './scene/service';

/** 지난주 결과를 아직 정하지 않았으면 일요일 토론부터 집계하고 정한다 (처음 정한 요청이 발표한다) */
export async function settleContestIfDue() {
  const scene = await getSceneService();
  // 주간 낚시 대회 낚시왕도 같은 때 정한다 (표가 없으면 건너뛴다)
  await scene.settleFishingCup().catch((e) => console.error('[fishing] 낚시왕 정하기 실패', e));
  if (!(await scene.contestUnsettled())) return null;
  await (await getDebateService())
    .finalizeDue()
    .catch((e) => console.error('[contest] 토론 집계 실패', e));
  return scene.settleContest();
}

export interface BoardDebate {
  /** 두 편 (성향 대결이면 kind 'axis', id = 글자) */
  a: Pick<Team, 'kind' | 'id' | 'label'>;
  b: Pick<Team, 'kind' | 'id' | 'label'>;
  topic: string;
  phase: Phase;
  writingEndsAt: string;
  votingEndsAt: string;
  winner: 'a' | 'b' | 'draw' | null;
}

export interface PlazaBoard extends Pick<ContestView, 'standings' | 'last'> {
  debate: BoardDebate | null;
  serverNow: string;
}

/** 광장 게시판은 모두에게 같으므로 20초 모아 두고 같이 쓴다 (마을 화면마다 1분에 한 번 묻는다) */
const BOARD_CACHE_MS = 20_000;
let boardCache: { at: number; value: Promise<Omit<PlazaBoard, 'serverNow'>> } | null = null;

export async function plazaBoard(): Promise<PlazaBoard> {
  const t = Date.now();
  if (!boardCache || t - boardCache.at > BOARD_CACHE_MS) {
    const value = (async () => {
      await settleContestIfDue().catch((e) => console.error('[contest] 지난주 결과 정하기 실패', e));
      const scene = await getSceneService();
      const [board, debate] = await Promise.all([scene.contestBoard(), boardDebate().catch(() => null)]);
      return { ...board, debate };
    })();
    boardCache = { at: t, value };
    value.catch(() => (boardCache = null));
  }
  return { ...(await boardCache.value), serverNow: new Date().toISOString() };
}

async function boardDebate(): Promise<BoardDebate> {
  const service = await getDebateService();
  const match = await service.withResult(await service.currentMatch());
  const team = (t: Team) => ({ kind: t.kind, id: t.id, label: t.label });
  return {
    a: team(match.teamA),
    b: team(match.teamB),
    topic: match.topic.title,
    phase: phaseOf(match, service.clock()),
    writingEndsAt: match.writingEndsAt.toISOString(),
    votingEndsAt: match.votingEndsAt.toISOString(),
    winner: match.result?.winner ?? null,
  };
}
