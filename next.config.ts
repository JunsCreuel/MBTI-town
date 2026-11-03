import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const ASSETS = join(process.cwd(), 'public', 'assets');

/**
 * 에셋 버전: public/assets 안 파일 내용의 해시. 에셋 주소 끝에 ?v=버전을 붙여(assetUrl)
 * 브라우저가 오래 캐시해도 에셋이 바뀌면 새로 받는다.
 */
function assetVersion(): string {
  const hash = createHash('sha1');
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else {
        hash.update(relative(ASSETS, path));
        hash.update(readFileSync(path));
      }
    }
  };
  walk(ASSETS);
  return hash.digest('hex').slice(0, 10);
}

export default function config(phase: string): NextConfig {
  // 개발 중에는 에셋을 바로 바꿔 보므로 버전을 붙이지 않는다 (오래 캐시하지 않는다)
  const version = phase === PHASE_DEVELOPMENT_SERVER ? '' : assetVersion();
  return {
    reactStrictMode: true,
    // AI 작업 규칙은 CLAUDE.md → PROJECT_GUIDE.md 한 곳에서 관리한다
    agentRules: false,
    // DB 드라이버는 번들하지 않고 Node에서 그대로 불러온다 (PGlite는 WebAssembly 파일을 함께 읽는다)
    serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
    env: { NEXT_PUBLIC_ASSET_VERSION: version },
    async headers() {
      return [
        {
          // 버전이 붙은 에셋 주소는 내용이 바뀌지 않으므로 1년 동안 다시 묻지 않는다
          source: '/assets/:path*',
          has: [{ type: 'query', key: 'v' }],
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
      ];
    },
  };
}
