// supabase/setup.sql 을 다시 만든다 (마이그레이션 파일을 추가하면 실행한다).
import { writeFileSync } from 'node:fs';
import { SETUP_FILE, bundleSql, migrationFiles } from './lib/sql-bundle';

writeFileSync(SETUP_FILE, bundleSql());
console.log(`supabase/setup.sql 을 만들었습니다 (마이그레이션 ${migrationFiles().length}개).`);
