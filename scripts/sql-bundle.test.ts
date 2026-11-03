// supabase/setup.sql 이 마이그레이션과 같고, 빈 DB에 두 번 실행해도 되는지 확인한다.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { SETUP_FILE, bundleSql, migrationFiles } from './lib/sql-bundle';

describe('Supabase 한 번에 설정 파일', () => {
  it('마이그레이션 파일과 같다 (다르면 npm run db:bundle)', () => {
    expect(readFileSync(SETUP_FILE, 'utf8')).toBe(bundleSql());
  });

  it('빈 DB에 실행되고, 다시 실행해도 오류가 없다', async () => {
    const db = await PGlite.create();
    // Supabase에는 auth.users가 있다
    await db.exec(`create schema auth; create table auth.users (id uuid primary key);`);
    const sql = readFileSync(SETUP_FILE, 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const done = (await db.query<{ name: string }>(`select name from public.schema_migrations order by name`)).rows.map((r) => r.name);
    expect(done).toEqual(migrationFiles());
    const cols = (await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'`,
    )).rows.map((r) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['handle', 'district', 'house_hood', 'house_lot']));
    await db.close();
  }, 60_000);
});
