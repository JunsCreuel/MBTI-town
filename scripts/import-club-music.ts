// 클럽 음악(CC0 EDM)을 우리 규격(OGG + MP3, 음량 맞춤)으로 바꿔 public/assets/audio/ 에 넣는다.
// 원본은 저장소에 넣지 않는다. 곡 목록·출처는 src/shared/clubMusic.ts (모두 OpenGameArt의 CC0 곡).
// 쓰는 법: 원본을 "<id>.<확장자>" 이름으로 한 폴더에 받아 두고 (예: party_sector.mp3)
//          npm run assets:club-music -- "<폴더>"
// manifest.json에 bgm.club.* 키(title, mood, seconds, 박자 bpm·beat)를 넣고, LICENSES.md에 출처를 한 줄씩 적는다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLUB_TRACKS } from '../src/shared/clubMusic';
import { beatGrid } from './lib/beat';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('원본 곡을 받아 둔 폴더 경로를 주세요.');
  process.exit(1);
}
const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const TODAY = new Date().toISOString().slice(0, 10);
/** 가이드 규격: BGM 파일 하나 2MB 이하 */
const MAX_BYTES = 2 * 1024 * 1024;
/** 곡마다 크기가 달라 들쭉날쭉하지 않게 음량을 맞춘다 (LUFS) */
const LOUDNESS = 'loudnorm=I=-15:TP=-1.5:LRA=11';

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const licensesPath = join(ROOT, 'LICENSES.md');
const licenses = readFileSync(licensesPath, 'utf8').trimEnd().split('\n');

const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const duration = (file: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

for (const t of CLUB_TRACKS) {
  const src = readdirSync(SRC).find((f) => f.replace(/\.[^.]+$/, '') === t.id);
  if (!src) {
    console.error(`원본이 없습니다: ${t.id}.* (${t.source})`);
    process.exit(1);
  }
  const input = join(SRC, src);
  const ogg = `audio/club_${t.id}.ogg`;
  const mp3 = `audio/club_${t.id}.mp3`;
  const common = ['-i', input, '-map_metadata', '-1', '-vn', '-af', LOUDNESS, '-ar', '44100', '-ac', '2'];
  ffmpeg([...common, '-c:a', 'libvorbis', '-q:a', '3', join(ROOT, ogg)]);
  ffmpeg([...common, '-c:a', 'libmp3lame', '-b:a', '112k', join(ROOT, mp3)]);
  for (const f of [ogg, mp3]) {
    const size = statSync(join(ROOT, f)).size;
    if (size > MAX_BYTES) console.warn(`2MB를 넘습니다: ${f} (${(size / 1024 / 1024).toFixed(2)}MB)`);
  }
  const seconds = Math.round(duration(join(ROOT, ogg)) * 10) / 10;
  // 무대 조명이 맞출 박자 (OGG 기준. MP3는 앞에 아주 짧은 빈 소리가 붙지만 눈으로는 같다)
  const { bpm, beat } = beatGrid(join(ROOT, ogg), [t.tempo - 1, t.tempo + 1]);
  manifest[t.key] = { file: ogg, alt: mp3, title: t.title, mood: t.mood, seconds, bpm, beat };
  for (const f of [ogg, mp3]) {
    const line = `| ${f} | "${t.title}" by ${t.artist} (${t.source}), 음량 맞춤·변환 | CC0 1.0 | ${TODAY} |`;
    const at = licenses.findIndex((l) => l.startsWith(`| ${f} |`));
    if (at >= 0) licenses[at] = line;
    else licenses.push(line);
  }
  console.log(`${t.key}: ${seconds}초, ${bpm} BPM`);
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(licensesPath, licenses.join('\n') + '\n');
