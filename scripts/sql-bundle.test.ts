// supabase/setup.sql 이 마이그레이션과 같고, 빈 DB에 두 번 실행해도 되는지 확인한다.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { MIGRATIONS_DIR, SETUP_FILE, bundleSql, migrationFiles } from './lib/sql-bundle';

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

  it('다시 실행해도 이미 한 마이그레이션은 건너뛴다 (MBTI 마을 전환이 집터·대항전 점수를 또 비우지 않는다)', async () => {
    const db = await PGlite.create();
    await db.exec(`create schema auth; create table auth.users (id uuid primary key);`);
    const sql = readFileSync(SETUP_FILE, 'utf8');
    await db.exec(sql);
    const id = '00000000-0000-0000-0000-000000000001';
    await db.exec(`insert into auth.users (id) values ('${id}');`);
    await db.exec(`insert into public.profiles (id, mbti, district, house_hood, house_lot) values ('${id}', 'ENFP', 'ENFP', 1, 2);`);
    await db.exec(`insert into public.contest_points (week, day, user_id, district, kind, points) values ('2026-11-02', '2026-11-05', '${id}', 'ENFP', 'fish', 3);`);
    await db.exec(sql);
    // 마이그레이션 파일만 따로 다시 붙여 넣어도 마찬가지
    await db.exec(readFileSync(join(MIGRATIONS_DIR, '20261106000000_mbti_town.sql'), 'utf8'));
    const p = (await db.query<{ house_lot: number; district: string }>(`select house_lot, district from public.profiles where id = '${id}'`)).rows[0];
    expect(p).toEqual({ house_lot: 2, district: 'ENFP' });
    const pts = (await db.query<{ n: number }>(`select count(*)::int as n from public.contest_points`)).rows[0];
    expect(pts.n).toBe(1);
    await db.close();
  }, 60_000);
});
