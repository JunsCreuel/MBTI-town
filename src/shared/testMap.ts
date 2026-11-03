// 테스트에서 실제 마을 맵(본섬, 동네 틀)을 불러온다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTownMap, type TownMap } from './townMap';

function load(key: string): TownMap {
  const root = join(import.meta.dirname, '..', '..', 'public', 'assets');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  return parseTownMap(JSON.parse(readFileSync(join(root, manifest[key].file), 'utf8')));
}

export const loadTownMapForTest = () => load('map.town');
/** 동네 틀 맵 (지역을 입히기 전) */
export const loadHoodMapForTest = () => load('map.hood');
