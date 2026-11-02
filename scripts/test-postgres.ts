// 운영 DB 경로 검사: PGlite를 Postgres 서버(접속 프로토콜)로 띄우고,
// 운영과 같은 드라이버(postgres.js)로 토론 하루 흐름 테스트를 돌린다.
// Supabase 없이 마이그레이션 SQL과 드라이버 동작(값 바인딩, jsonb, 시간)을 확인하기 위한 것이다.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORT = 55432;
const root = join(import.meta.dirname, '..');
const db = await PGlite.create();
// Supabase에 있는 auth.users를 흉내 낸다
await db.exec(`create schema auth; create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());`);
const dir = join(root, 'supabase', 'migrations');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'));
  console.log(`마이그레이션 적용: ${f}`);
}
const server = new PGLiteSocketServer({ db, port: PORT, maxConnections: 10 });
await server.start();

// 테스트용 소켓 서버는 여러 연결의 메시지가 섞일 수 있어 연결 하나만 쓴다 (Supabase는 해당 없음).
// 같은 프로세스가 DB 서버를 돌리므로 테스트는 기다리는 동안 이벤트 루프를 막지 않게 따로 띄운다
const code = await new Promise<number>((resolve) => {
  const child = spawn('npx', ['vitest', 'run', 'src/server/debate/service.test.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TEST_DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`, DATABASE_POOL_MAX: '1' },
  });
  child.on('exit', (c) => resolve(c ?? 1));
});
await server.stop();
await db.close();
process.exit(code);
