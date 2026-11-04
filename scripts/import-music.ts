// 직접 넣는 음악(클럽 곡·마을 음악)을 우리 규격(OGG + MP3, 음량 맞춤, 파일 하나 2MB 이하)으로 바꿔 public/assets/audio/ 에 넣는다.
// 원본은 저장소에 넣지 않는다. 곡 목록·출처는 src/shared/clubMusic.ts (클럽)와 src/shared/music.ts (마을).
// 쓰는 법: 원본을 "<id>.<확장자>" 이름으로 한 폴더에 받아 두고 (예: party_sector.mp3, village_waltz.mp3)
//          npm run assets:music -- "<폴더>"
// 폴더에 있는 곡만 바꾼다 (없는 곡은 지금 파일을 그대로 둔다).
// manifest.json에 키(title, mood, seconds, 박자 bpm·beat)를 넣고, LICENSES.md에 출처를 한 줄씩 적는다.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLUB_TRACKS } from '../src/shared/clubMusic';
import { VILLAGE_TRACK, type MusicTrack } from '../src/shared/music';
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
/** 좋은 음질부터 해 보고 2MB를 넘으면 한 단계씩 낮춘다 (긴 곡) */
const OGG_QUALITY = ['3', '2', '1', '0'];
const MP3_BITRATE = ['112k', '96k', '80k', '64k'];

const TRACKS: MusicTrack[] = [...CLUB_TRACKS, VILLAGE_TRACK];

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const licensesPath = join(ROOT, 'LICENSES.md');
const licenses = readFileSync(licensesPath, 'utf8').trimEnd().split('\n');

const ffmpeg = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const duration = (file: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

/** 2MB 안에 드는 가장 좋은 설정으로 만든다 */
function encode(common: string[], out: string, codec: string, flag: string, steps: string[]): string {
  for (const q of steps) {
    ffmpeg([...common, '-c:a', codec, flag, q, out]);
    if (statSync(out).size <= MAX_BYTES) return q;
  }
  console.warn(`가장 낮은 설정으로도 2MB를 넘습니다: ${out} (${(statSync(out).size / 1024 / 1024).toFixed(2)}MB)`);
  return steps[steps.length - 1];
}

const files = readdirSync(SRC);
let done = 0;
for (const t of TRACKS) {
  const src = files.find((f) => f.replace(/\.[^.]+$/, '') === t.id);
  if (!src) continue;
  const ogg = `audio/${t.file}.ogg`;
  const mp3 = `audio/${t.file}.mp3`;
  // 메타데이터(표지 그림·가사)는 빼고 소리만
  const common = ['-i', join(SRC, src), '-map_metadata', '-1', '-map', '0:a:0', '-af', LOUDNESS, '-ar', '44100', '-ac', '2'];
  const oq = encode(common, join(ROOT, ogg), 'libvorbis', '-q:a', OGG_QUALITY);
  const mb = encode(common, join(ROOT, mp3), 'libmp3lame', '-b:a', MP3_BITRATE);
  const seconds = Math.round(duration(join(ROOT, ogg)) * 10) / 10;
  // 무대 조명이 맞출 박자 (OGG 기준. MP3는 앞에 아주 짧은 빈 소리가 붙지만 눈으로는 같다)
  const { bpm, beat } = beatGrid(join(ROOT, ogg), [t.tempo - 1, t.tempo + 1]);
  manifest[t.key] = { file: ogg, alt: mp3, title: t.title, mood: t.mood, seconds, bpm, beat };
  for (const f of [ogg, mp3]) {
    const line = `| ${f} | "${t.title}" by ${t.artist} (${t.source}), 음량 맞춤·변환 | ${t.license} | ${TODAY} |`;
    const at = licenses.findIndex((l) => l.startsWith(`| ${f} |`));
    if (at >= 0) licenses[at] = line;
    else licenses.push(line);
  }
  done++;
  console.log(`${t.key}: ${seconds}초, ${bpm} BPM (OGG q${oq}, MP3 ${mb})`);
}
if (!done) {
  console.error(`폴더에 곡이 없습니다. 파일 이름을 곡 id로 맞춰 주세요: ${TRACKS.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(licensesPath, licenses.join('\n') + '\n');
