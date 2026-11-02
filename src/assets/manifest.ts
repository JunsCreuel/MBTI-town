// 코드는 파일 경로를 직접 쓰지 않고 manifest 키만 쓴다 (PROJECT_GUIDE.md 12장).
import manifestJson from '../../public/assets/manifest.json';

export interface AssetEntry {
  file: string;
  /** 스프라이트 시트 프레임 크기 [가로, 세로] px */
  frame?: [number, number];
  frames?: number;
  cols?: number;
  /** 타일 크기 [가로, 세로] px */
  tile?: [number, number];
  columns?: number;
  count?: number;
  /** 소품 이미지 크기 [가로, 세로] px */
  size?: [number, number];
}

const manifest = manifestJson as unknown as Record<string, AssetEntry>;

export function asset(key: string): AssetEntry {
  const entry = manifest[key];
  if (!entry) throw new Error(`manifest에 ${key} 키가 없습니다`);
  return entry;
}

export function assetUrl(key: string): string {
  return `/assets/${asset(key).file}`;
}
