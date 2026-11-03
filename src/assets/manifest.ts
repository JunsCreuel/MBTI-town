// 코드는 파일 경로를 직접 쓰지 않고 manifest 키만 쓴다 (PROJECT_GUIDE.md 18장).
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
  /** 다른 형식 파일 (BGM: OGG를 못 트는 브라우저용 MP3) */
  alt?: string;
  title?: string;
  mood?: string;
  seconds?: number;
}

const manifest = manifestJson as unknown as Record<string, AssetEntry>;

export function asset(key: string): AssetEntry {
  const entry = manifest[key];
  if (!entry) throw new Error(`manifest에 ${key} 키가 없습니다`);
  return entry;
}

/** 배포마다 에셋 내용으로 정한 버전 (next.config.ts). 개발 중에는 비어 있다. */
const VERSION = process.env.NEXT_PUBLIC_ASSET_VERSION ?? '';
const withVersion = (path: string) => (VERSION ? `${path}?v=${VERSION}` : path);

export function assetUrl(key: string): string {
  return withVersion(`/assets/${asset(key).file}`);
}

/** 다른 형식 파일 주소 (없으면 null) */
export function assetAltUrl(key: string): string | null {
  const alt = asset(key).alt;
  return alt ? withVersion(`/assets/${alt}`) : null;
}
