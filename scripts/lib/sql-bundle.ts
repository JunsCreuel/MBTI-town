// supabase/migrations/*.sql 을 이름 순서대로 이어 붙여, Supabase SQL Editor에 한 번에 붙여 넣을 파일을 만든다.
// 모든 마이그레이션은 다시 실행해도 안전하게(if not exists) 쓴다. 실행한 파일 이름은 public.schema_migrations에 남긴다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
export const SETUP_FILE = join(import.meta.dirname, '..', '..', 'supabase', 'setup.sql');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

export function bundleSql(): string {
  const files = migrationFiles();
  const parts = files.map((f) => `-- ───────── ${f} ─────────\n\n${readFileSync(join(MIGRATIONS_DIR, f), 'utf8').trim()}\n`);
  return [
    '-- SCENE DB 전체 설정 (자동 생성 파일: 직접 고치지 말고 `npm run db:bundle`로 다시 만든다)',
    '-- Supabase 대시보드 > SQL Editor > New query 에 이 파일 내용을 통째로 붙여 넣고 Run 한다.',
    '-- 여러 번 실행해도 안전하다. 실행한 마이그레이션 목록은 public.schema_migrations에 남는다.',
    '',
    ...parts,
    '-- ───────── 실행 기록 ─────────',
    '',
    'create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());',
    'alter table public.schema_migrations enable row level security;',
    `insert into public.schema_migrations (name) values\n${files.map((f) => `  ('${f}')`).join(',\n')}\non conflict (name) do nothing;`,
    '',
  ].join('\n');
}
