// 에셋 규칙 검사 (PROJECT_GUIDE.md 11, 12, 15, 16, 17장). `npm run build` 전에 실행된다.
// 실패: manifest 파일 누락, 명명 규칙 위반, LICENSES.md 기록 누락, 첫 화면 용량 초과
// 경고: 남아 있는 _ph 임시 에셋 목록, manifest에 없는 파일
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const PLAZA_BUDGET_BYTES = 3 * 1024 * 1024;
// 마을 첫 화면에서 불러오는 키 접두사
const PLAZA_PREFIXES = ['char.', 'map.town', 'prop.plaza.', 'prop.village.', 'ui.'];
// 규칙 검사에서 빼는 파일 (폰트 묶음은 외부 배포본의 파일명을 그대로 쓴다)
const EXEMPT_DIRS = ['fonts/'];
const META_FILES = ['manifest.json', 'LICENSES.md'];
const NAME_RULE = /^[a-z]+(_[a-z0-9]+)*\.[a-z0-9]+$/;

type Entry = { file: string };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p).split('\\').join('/')];
  });
}

const manifest: Record<string, Entry> = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const licenses = readFileSync(join(ROOT, 'LICENSES.md'), 'utf8');
const errors: string[] = [];
const warnings: string[] = [];

const referenced = new Set<string>();
for (const [key, entry] of Object.entries(manifest)) {
  referenced.add(entry.file);
  if (!existsSync(join(ROOT, entry.file))) errors.push(`manifest 키 ${key}의 파일이 없습니다: ${entry.file}`);
}

const files = walk(ROOT).filter((f) => !f.endsWith('.gitkeep'));
for (const file of files) {
  if (META_FILES.includes(file) || EXEMPT_DIRS.some((d) => file.startsWith(d))) continue;
  const base = file.split('/').pop()!;
  if (!NAME_RULE.test(base)) errors.push(`파일명 규칙 위반 (소문자·영문·숫자·밑줄): ${file}`);
  if (!licenses.includes(`| ${file} |`)) errors.push(`LICENSES.md에 기록이 없습니다: ${file}`);
  if (!referenced.has(file)) warnings.push(`manifest에서 쓰지 않는 파일: ${file}`);
}

const placeholders = [...referenced].filter((f) => /_ph\.[a-z0-9]+$/.test(f)).sort();

// 여러 키가 같은 파일을 쓰면 한 번만 센다
const plazaFiles = new Set(
  Object.entries(manifest)
    .filter(([key, entry]) => PLAZA_PREFIXES.some((p) => key.startsWith(p)) && existsSync(join(ROOT, entry.file)))
    .map(([, entry]) => entry.file),
);
let plazaBytes = 0;
for (const f of plazaFiles) plazaBytes += statSync(join(ROOT, f)).size;
const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
if (plazaBytes > PLAZA_BUDGET_BYTES) errors.push(`마을 첫 화면 에셋 ${mb(plazaBytes)}MB가 기준 3MB를 넘습니다.`);

console.log(`마을 첫 화면 에셋: ${mb(plazaBytes)}MB / 3MB (폰트는 쓰는 글자 범위만 따로 내려받음)`);
if (placeholders.length) {
  console.log(`\n아직 임시(_ph) 에셋 ${placeholders.length}개가 남아 있습니다. 배포 전에 실제 에셋으로 바꾸세요:`);
  for (const f of placeholders) console.log(`  - ${f}`);
}
for (const w of warnings) console.warn(`경고: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`오류: ${e}`);
  process.exit(1);
}
console.log('\n에셋 검사 통과');
