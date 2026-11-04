// 논거 등록 전 금지어 검사. 유형 비하·욕설·개인정보·광고를 거른다 (PROJECT_GUIDE.md 7장).
// 띄어쓰기나 기호를 끼워 넣어 피해 가는 경우("멍 청", "멍.청")도 잡는다.
// 금지어로 못 잡는 교묘한 비하는 나중에 신고 기능으로 다룬다.

export interface ModerationResult {
  allowed: boolean;
  /** 거부 이유 (글쓴이에게 보여 준다) */
  reason: string;
}

/**
 * 깎아내리는 말과 욕설. 붙여 쓴 형태로 비교한다.
 * 정상 문장에 흔히 들어가는 말은 넣지 않는다 (예: 시바견, 새끼 고양이, 불이 꺼져, 열등감, 하등 문제없다).
 */
const BANNED: readonly string[] = [
  // 비하
  '멍청', '한심', '쓰레기', '찐따', '저능', '정신병자', '극혐', '노답', '병신', 'ㅂㅅ', '등신', '모지리', '틀딱',
  '급식충', '한남충', '김치녀', '맘충',
  // 욕설
  '시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '씨바', '개새', '개색', 'ㅅㄲ', '좆', '존나', 'ㅈㄴ', '지랄', 'ㅈㄹ', '미친놈', '미친년',
  '닥쳐',
];

const URL = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|kr|io|co|me|ly)\b)/i;
const PHONE = /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/;
/** 같은 글자 10번 넘게 반복 (도배) */
const REPEAT = /(.)\1{9,}/u;

/** 공백·기호를 지우고 소문자로 */
function squash(text: string): string {
  return text.toLowerCase().replace(/[\s.,·~!?*_\-'"`^()[\]{}<>/\\|:;]+/g, '');
}

export function moderate(body: string): ModerationResult {
  const flat = squash(body);
  const hit = BANNED.find((w) => flat.includes(w));
  if (hit) {
    return { allowed: false, reason: '깎아내리거나 거친 표현이 있어요. 주장과 이유로만 다시 써 주세요.' };
  }
  if (URL.test(body)) return { allowed: false, reason: '링크는 넣을 수 없어요.' };
  if (PHONE.test(body)) return { allowed: false, reason: '전화번호 같은 개인정보는 넣을 수 없어요.' };
  if (REPEAT.test(body.replace(/\s/g, ''))) return { allowed: false, reason: '같은 글자를 너무 많이 반복했어요.' };
  return { allowed: true, reason: '문제없음' };
}

/**
 * 클럽 유튜브 신청곡 제목·채널 이름 검사: 위의 욕설·비하에 더해 성인·도박·폭력 낱말이 있으면 거른다.
 * 노래 제목에 흔한 말(Sexy, Kill This Love 등)은 걸리지 않게 영어는 낱말 단위로만, 뚜렷한 것만 넣는다.
 */
const YOUTUBE_BANNED: readonly string[] = ['19금', '야동', '섹스', '포르노', '성인방송', '야한영상', '노출방송', '카지노', '바카라', '토토사이트', '먹튀', '불법도박', '자살', '고어영상'];
const YOUTUBE_BANNED_EN = /\b(porn|porno|nsfw|xxx|hentai|onlyfans|gore)\b/i;

export function youtubeTextProblem(...texts: string[]): string | null {
  for (const text of texts) {
    const flat = squash(text);
    if (BANNED.some((w) => flat.includes(w)) || YOUTUBE_BANNED.some((w) => flat.includes(w)) || YOUTUBE_BANNED_EN.test(text)) {
      return '부적절한 말이 들어 있는 영상은 틀 수 없어요.';
    }
  }
  return null;
}
