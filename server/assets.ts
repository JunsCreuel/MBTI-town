// 서버도 에셋은 manifest 키로만 찾는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { District } from '../src/shared/districts';
import { CLUB_TRACKS } from '../src/shared/clubMusic';
import type { Spot } from '../src/shared/protocol';
import { parseTownMap, withDistrict, type TownMap } from '../src/shared/townMap';

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

const spotMaps = new Map<Spot, TownMap>();
/** 놀이터 맵 (낚시터·클럽) */
export function getSpotMap(spot: Spot): TownMap {
  let m = spotMaps.get(spot);
  if (!m) {
    m = parseTownMap(JSON.parse(readAsset(`map.${spot}`)));
    spotMaps.set(spot, m);
  }
  return m;
}

let clubSeconds: number[] | undefined;
/** 클럽 곡 길이 (초, CLUB_TRACKS 순서). manifest의 seconds */
export function clubTrackSeconds(): number[] {
  if (!clubSeconds) {
    const manifest = JSON.parse(readFileSync(join(ASSET_ROOT, 'manifest.json'), 'utf8')) as Record<string, { seconds?: number }>;
    clubSeconds = CLUB_TRACKS.map((t) => manifest[t.key]?.seconds ?? 0);
  }
  return clubSeconds;
}

let hoodTemplate: TownMap | undefined;
const hoodMaps = new Map<District, TownMap>();
/** 2동·3동… 동네 맵: 틀 맵에 그 지역을 입힌 것 (지역마다 한 번 만든다) */
export function getHoodMap(d: District): TownMap {
  hoodTemplate ??= parseTownMap(JSON.parse(readAsset('map.hood')));
  let m = hoodMaps.get(d);
  if (!m) {
    m = withDistrict(hoodTemplate, d);
    hoodMaps.set(d, m);
  }
  return m;
}
