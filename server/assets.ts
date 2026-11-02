// 서버도 에셋은 manifest 키로만 찾는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTownMap, type TownMap } from '../src/shared/townMap';

const ASSET_ROOT = join(import.meta.dirname, '..', 'public', 'assets');

function readAsset(key: string): string {
  const manifest = JSON.parse(readFileSync(join(ASSET_ROOT, 'manifest.json'), 'utf8')) as Record<string, { file: string }>;
  const entry = manifest[key];
  if (!entry) throw new Error(`manifest에 ${key} 키가 없습니다`);
  return readFileSync(join(ASSET_ROOT, entry.file), 'utf8');
}

let townMap: TownMap | undefined;
export function getTownMap(): TownMap {
  townMap ??= parseTownMap(JSON.parse(readAsset('map.town')));
  return townMap;
}
