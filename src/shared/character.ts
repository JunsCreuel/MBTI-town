// 3D 캐릭터·소품 GLB 규약 (PROJECT_GUIDE.md 10장). 임시 에셋 생성기와 마을 렌더러가 함께 쓴다.
// 실제 모델로 바꿀 때도 이 이름들만 지키면 코드는 고칠 필요가 없다.

/** 애니메이션 클립 이름 (모두 반복 재생) */
export const CHARACTER_CLIPS = ['idle', 'walk', 'cheer', 'clap', 'wave', 'bow', 'dance', 'jump', 'think', 'fish'] as const;
export type ClipName = (typeof CHARACTER_CLIPS)[number];

/** 이 이름의 재질은 유형 색을 입힌다 (캐릭터 옷, 소품의 색 부분) */
export const TINT_MATERIAL = 'outfit';

/** 유형 소품을 붙이는 노드 이름. 머리 가운데에 있다. */
export const HEAD_SOCKET = 'socket_head';

/** 눈 높이 자리 (안경). 머리 소품과 같은 크기·방향이고 높이만 눈에 맞춘다. 없으면 머리 자리에 단다 */
export const EYES_SOCKET = 'socket_eyes';

/** 캐릭터 키 (월드 단위 = 타일 1칸 = 1m). 이름표 높이 계산에 쓴다. */
export const CHARACTER_HEIGHT = 1.32;

/** 낚싯대(prop.tool.rod) 끝 위치 (모델 좌표, 손잡이 아래 끝이 원점). 낚싯줄을 여기서부터 그린다 */
export const ROD_TIP: [number, number, number] = [0, 1.42, 0];

/** 오른손 자리 (낚싯대를 쥔다). 손 가운데에 있고, 가만히 선 자세에서 축이 모델 축과 같다 */
export const HAND_SOCKET = 'socket_hand_r';

/** 얼굴 재질 (베이스 캐릭터): 텍스처가 표정 아틀라스다. 표정은 텍스처 자리(offset)를 옮겨 바꾼다 */
export const FACE_MATERIAL = 'face';

/** 표정 (아틀라스 차례). neutral = 평소 얼굴 */
export const FACES = ['neutral', 'happy', 'excited', 'sad', 'angry', 'surprised', 'shy', 'sleepy', 'wink', 'love'] as const;
export type FaceName = (typeof FACES)[number];

/** 표정 아틀라스: 가로 cols칸 × 세로 rows칸, 왼쪽 위부터 FACES 차례 */
export const FACE_ATLAS = { cols: 4, rows: 3 } as const;

/** 아틀라스에서 표정 칸의 자리 (텍스처 offset, 위가 0) */
export function faceOffset(face: FaceName): [number, number] {
  const i = Math.max(0, FACES.indexOf(face));
  return [(i % FACE_ATLAS.cols) / FACE_ATLAS.cols, Math.floor(i / FACE_ATLAS.cols) / FACE_ATLAS.rows];
}

/** 이모티콘을 띄우는 동안의 표정 */
export const EMOTE_FACE: Record<string, FaceName> = {
  clap: 'happy',
  heart: 'love',
  question: 'surprised',
  wow: 'surprised',
  joy: 'happy',
  sad: 'sad',
  flutter: 'shy',
  tired: 'sleepy',
  sparkle: 'excited',
  music: 'wink',
};

/** 몸짓을 하는 동안의 표정 (걷기·서 있기는 평소 얼굴) */
export const CLIP_FACE: Partial<Record<ClipName, FaceName>> = {
  cheer: 'excited',
  clap: 'happy',
  wave: 'wink',
  bow: 'happy',
  dance: 'excited',
  jump: 'excited',
  think: 'surprised',
};

/** 지금 보일 표정: 이모티콘이 떠 있으면 그 표정, 아니면 몸짓 표정, 아니면 평소 얼굴 */
export function faceFor(emote: string | null | undefined, clip: ClipName): FaceName {
  return (emote && EMOTE_FACE[emote]) || CLIP_FACE[clip] || 'neutral';
}
