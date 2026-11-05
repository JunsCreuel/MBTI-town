// 서버에서 하나만 만드는 미니홈피 서비스
import 'server-only';
import { announceToTown } from '../announce';
import { getSql } from '../db';
import { clockOffsetMs } from '../debate';
import { SceneService } from './service';
import { SceneStore } from './store';

const g = globalThis as unknown as { __sceneService?: Promise<SceneService> };

export function getSceneService(): Promise<SceneService> {
  // 마을 집 목록은 20초 모아 둔다 (마을 화면마다 1분에 한 번 묻는다)
  g.__sceneService ??= (async () => new SceneService(new SceneStore(await getSql()), () => new Date(Date.now() + clockOffsetMs()), announceToTown, 20_000))();
  g.__sceneService.catch(() => {
    g.__sceneService = undefined;
  });
  return g.__sceneService;
}
