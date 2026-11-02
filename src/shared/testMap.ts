// 테스트에서 실제 마을 맵을 불러온다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTownMap, type TownMap } from './townMap';

export function loadTownMapForTest(): TownMap {
  const root = join(import.meta.dirname, '..', '..', 'public', 'assets');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  return parseTownMap(JSON.parse(readFileSync(join(root, manifest['map.town'].file), 'utf8')));
}
