import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // AI 작업 규칙은 CLAUDE.md → PROJECT_GUIDE.md 한 곳에서 관리한다
  agentRules: false,
  // DB 드라이버는 번들하지 않고 Node에서 그대로 불러온다 (PGlite는 WebAssembly 파일을 함께 읽는다)
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
};

export default nextConfig;
