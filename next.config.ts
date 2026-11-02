import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // AI 작업 규칙은 CLAUDE.md → PROJECT_GUIDE.md 한 곳에서 관리한다
  agentRules: false,
};

export default nextConfig;
