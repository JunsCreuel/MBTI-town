// 서버도 에셋은 manifest 키로만 찾는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlazaMap, type PlazaMap } from '../src/shared/plazaMap';

const ASSET_ROOT = join(import.meta.dirname, '..', 'public', 'assets');

function readAsset(key: string): string {
  const manifest = JSON.parse(readFileSync(join(ASSET_ROOT, 'manifest.json'), 'utf8')) as Record<string, { file: string }>;
  const entry = manifest[key];
  if (!entry) throw new Error(`manifest에 ${key} 키가 없습니다`);
  return readFileSync(join(ASSET_ROOT, entry.file), 'utf8');
}

let plazaMap: PlazaMap | undefined;
export function getPlazaMap(): PlazaMap {
  plazaMap ??= parsePlazaMap(JSON.parse(readAsset('map.plaza')));
  return plazaMap;
}
