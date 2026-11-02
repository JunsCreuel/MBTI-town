// 기록(ARCHIVE)과 공개 범위 규칙 (PROJECT_GUIDE.md 8, 9장). 화면과 서버가 함께 쓴다.
import { recordConfig } from '../config/game';

export const EMOTIONS = ['calm', 'joy', 'flutter', 'tired', 'sad', 'complex', 'angry'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 감정 종류로 점수나 보상을 다르게 주지 않는다. 이름과 아이콘만 다르다. */
export const EMOTION_LABEL: Record<Emotion, string> = {
  calm: '평온',
  joy: '기쁨',
  flutter: '설렘',
  tired: '피곤',
  sad: '슬픔',
  complex: '복잡',
  angry: '화남',
};

export const RECORD_KINDS = ['emotion', 'daily', 'memo'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const RECORD_KIND_LABEL: Record<RecordKind, string> = {
  emotion: '감정 기록',
  daily: '일상 기록',
  memo: '메모',
};

export const VISIBILITIES = ['private', 'friends', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: '나만 보기',
  friends: '친구',
  public: '전체',
};

/** 보는 사람과 주인의 관계. 차단 관계는 서버가 먼저 걸러 낸다. */
export type Relation = 'self' | 'friend' | 'other';

/** 이 공개 범위의 것을 이 관계의 사람이 볼 수 있는지 */
export function canView(visibility: Visibility, relation: Relation): boolean {
  if (relation === 'self') return true;
  if (visibility === 'public') return true;
  return visibility === 'friends' && relation === 'friend';
}

/** 볼 수 있는 공개 범위 목록 (SQL 조건에 쓴다) */
export function visibleLevels(relation: Relation): Visibility[] {
  return VISIBILITIES.filter((v) => canView(v, relation));
}

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === 'string' && (VISIBILITIES as readonly string[]).includes(v);
}

export interface RecordInput {
  kind: RecordKind;
  emotion: Emotion | null;
  body: string;
  photoId: string | null;
  visibility: Visibility;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type RecordCheck = { ok: true; record: RecordInput } | { ok: false; error: string };

/** 새 기록 검사. 메모는 늘 나만 보기, 공개 범위를 안 고르면 나만 보기. */
export function validateRecord(v: unknown): RecordCheck {
  const r = (v ?? {}) as Record<string, unknown>;
  const kind = (RECORD_KINDS as readonly unknown[]).includes(r.kind) ? (r.kind as RecordKind) : null;
  if (!kind) return { ok: false, error: '기록 종류를 골라 주세요.' };
  const body = typeof r.body === 'string' ? r.body.trim() : '';
  const emotion = (EMOTIONS as readonly unknown[]).includes(r.emotion) ? (r.emotion as Emotion) : null;
  const photoId = typeof r.photoId === 'string' && UUID.test(r.photoId) ? r.photoId : null;
  const visibility = kind === 'memo' ? 'private' : isVisibility(r.visibility) ? r.visibility : 'private';
  if (kind === 'emotion') {
    if (!emotion) return { ok: false, error: '오늘의 감정을 골라 주세요.' };
    if (body.length > recordConfig.lineMax) return { ok: false, error: `한 줄은 ${recordConfig.lineMax}자까지 쓸 수 있어요.` };
  } else {
    if (!body && !photoId) return { ok: false, error: '글이나 사진 중 하나는 있어야 해요.' };
    if (body.length > recordConfig.bodyMax) return { ok: false, error: `${recordConfig.bodyMax}자까지 쓸 수 있어요.` };
  }
  return { ok: true, record: { kind, emotion: kind === 'emotion' ? emotion : emotion, body, photoId: kind === 'emotion' ? null : photoId, visibility } };
}
