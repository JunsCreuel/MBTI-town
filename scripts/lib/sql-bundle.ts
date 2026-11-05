// supabase/migrations/*.sql 을 이름 순서대로 이어 붙여, Supabase SQL Editor에 한 번에 붙여 넣을 파일을 만든다.
// 마이그레이션마다 public.schema_migrations에 이름이 있으면 건너뛴다 (이미 실행한 것은 다시 하지 않는다).
// 그래서 데이터를 바꾸는 마이그레이션(집터 비우기·대항전 점수 비우기 등)도 setup.sql을 다시 실행할 때 또 돌지 않는다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
export const SETUP_FILE = join(import.meta.dirname, '..', '..', 'supabase', 'setup.sql');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** 마이그레이션 하나: 실행한 적이 없을 때만 실행하고 이름을 남긴다 */
function guarded(file: string, sql: string): string {
  if (sql.includes('$sql$') || sql.includes('$mig$')) throw new Error(`${file}: $sql$·$mig$ 는 setup.sql이 감싸는 데 쓰므로 마이그레이션 안에 쓸 수 없다`);
  if (!/^[\w.-]+$/.test(file)) throw new Error(`${file}: 파일 이름은 영문·숫자·밑줄·점·하이픈만`);
  return [
    `-- ───────── ${file} ─────────`,
    '',
    'do $mig$',
    'begin',
    `  if exists (select 1 from public.schema_migrations where name = '${file}') then return; end if;`,
    '  execute $sql$',
    sql,
    '$sql$;',
    `  insert into public.schema_migrations (name) values ('${file}') on conflict (name) do nothing;`,
    'end $mig$;',
    '',
  ].join('\n');
}

export function bundleSql(): string {
  const files = migrationFiles();
  return [
    '-- SCENE DB 전체 설정 (자동 생성 파일: 직접 고치지 말고 `npm run db:bundle`로 다시 만든다)',
    '-- Supabase 대시보드 > SQL Editor > New query 에 이 파일 내용을 통째로 붙여 넣고 Run 한다.',
    '-- 여러 번 실행해도 안전하다: 이미 실행한 마이그레이션(public.schema_migrations에 이름이 있는 것)은 건너뛴다.',
    '',
    'create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());',
    'alter table public.schema_migrations enable row level security;',
    '',
    ...files.map((f) => guarded(f, readFileSync(join(MIGRATIONS_DIR, f), 'utf8').trim())),
  ].join('\n');
}
