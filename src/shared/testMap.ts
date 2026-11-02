// 테스트에서 실제 광장 맵을 불러온다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlazaMap, type PlazaMap } from './plazaMap';

export function loadPlazaMapForTest(): PlazaMap {
  const root = join(import.meta.dirname, '..', '..', 'public', 'assets');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  return parsePlazaMap(JSON.parse(readFileSync(join(root, manifest['map.plaza'].file), 'utf8')));
}
