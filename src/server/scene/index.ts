// 서버에서 하나만 만드는 미니홈피 서비스
import 'server-only';
import { announceToTown } from '../announce';
import { getSql } from '../db';
import { clockOffsetMs } from '../debate';
import { SceneService } from './service';
import { SceneStore } from './store';

const g = globalThis as unknown as { __sceneService?: Promise<SceneService> };

export function getSceneService(): Promise<SceneService> {
  g.__sceneService ??= (async () => new SceneService(new SceneStore(await getSql()), () => new Date(Date.now() + clockOffsetMs()), announceToTown))();
  g.__sceneService.catch(() => {
    g.__sceneService = undefined;
  });
  return g.__sceneService;
}
