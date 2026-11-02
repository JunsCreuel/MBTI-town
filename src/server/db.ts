// 서버 전용 DB 연결. DATABASE_URL이 있으면 그 Postgres(Supabase)에 붙고,
// 없으면 개발용으로 PGlite(파일에 저장되는 Postgres)를 띄워 마이그레이션까지 적용한다.
import 'server-only';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Sql {
  /** $1, $2 … 자리표시자를 쓰는 쿼리 하나 */
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** 여러 문장을 한 번에 (마이그레이션용, 값 바인딩 없음) */
  exec(text: string): Promise<void>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/** Supabase에는 auth 스키마가 있지만 PGlite에는 없어서 개발용으로 흉내 낸다 */
const DEV_AUTH_SCHEMA = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz not null default now()
  );
`;

export async function createPgliteSql(dataDir?: string): Promise<Sql> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  const sql: Sql = {
    kind: 'pglite',
    async query<T>(text: string, params: unknown[] = []) {
      return (await db.query<T>(text, params)).rows;
    },
    async exec(text) {
      await db.exec(text);
    },
    async close() {
      await db.close();
    },
  };
  await sql.exec(DEV_AUTH_SCHEMA);
  await migrate(sql);
  return sql;
}

export async function createPostgresSql(url: string): Promise<Sql> {
  const { default: postgres } = await import('postgres');
  // Supabase 트랜잭션 풀러는 이름 있는 prepared statement를 지원하지 않는다
  const pg = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX) || 5 });
  return {
    kind: 'postgres',
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text) {
      await pg.unsafe(text);
    },
    async close() {
      await pg.end();
    },
  };
}

/** 아직 적용하지 않은 마이그레이션 파일을 이름 순서대로 적용한다 (PGlite 전용) */
export async function migrate(sql: Sql): Promise<string[]> {
  await sql.exec(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await sql.query<{ name: string }>(`select name from public.schema_migrations`)).map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await sql.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    await sql.query(`insert into public.schema_migrations (name) values ($1)`, [file]);
    applied.push(file);
  }
  return applied;
}

const g = globalThis as unknown as { __mbtiSql?: Promise<Sql> };

export function getSql(): Promise<Sql> {
  g.__mbtiSql ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (url) return createPostgresSql(url);
    if (process.env.NODE_ENV === 'production' && process.env.DEBATE_ALLOW_PGLITE !== '1') {
      throw new Error('DATABASE_URL이 없습니다. 운영 환경에서는 Supabase Postgres 주소를 설정해야 합니다.');
    }
    // 프로젝트 폴더 안에 두면 개발 서버가 DB 파일 변경을 코드 변경으로 보고 화면을 계속 다시 불러온다
    const dir = process.env.PGLITE_DIR || join(homedir(), '.mbti-town', 'pglite');
    console.warn(`[db] DATABASE_URL이 없어 개발용 PGlite를 씁니다: ${dir}`);
    return createPgliteSql(dir);
  })();
  // 연결에 실패하면 다음 요청에서 다시 시도한다
  g.__mbtiSql.catch(() => {
    g.__mbtiSql = undefined;
  });
  return g.__mbtiSql;
}

/** 개발용 로그인을 쓸 때 auth.users에 사용자를 만든다 (PGlite 전용) */
export async function ensureDevAuthUser(sql: Sql, id: string): Promise<void> {
  if (sql.kind !== 'pglite') throw new Error('개발용 로그인은 PGlite에서만 쓸 수 있습니다');
  await sql.query(`insert into auth.users (id) values ($1) on conflict (id) do nothing`, [id]);
}
