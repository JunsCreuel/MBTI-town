// 3D 캐릭터·소품 GLB 규약 (PROJECT_GUIDE.md 10장). 임시 에셋 생성기와 마을 렌더러가 함께 쓴다.
// 실제 모델로 바꿀 때도 이 이름들만 지키면 코드는 고칠 필요가 없다.

/** 애니메이션 클립 이름 (모두 반복 재생) */
export const CHARACTER_CLIPS = ['idle', 'walk', 'cheer', 'clap', 'wave', 'bow', 'dance', 'jump', 'think', 'fish'] as const;
export type ClipName = (typeof CHARACTER_CLIPS)[number];

/** 이 이름의 재질은 유형 색을 입힌다 (캐릭터 옷, 소품의 색 부분) */
export const TINT_MATERIAL = 'outfit';

/** 유형 소품을 붙이는 노드 이름. 머리 가운데에 있다. */
export const HEAD_SOCKET = 'socket_head';

/** 캐릭터 키 (월드 단위 = 타일 1칸 = 1m). 이름표 높이 계산에 쓴다. */
export const CHARACTER_HEIGHT = 1.32;

/** 낚싯대(prop.tool.rod) 끝 위치 (모델 좌표, 손잡이 아래 끝이 원점). 낚싯줄을 여기서부터 그린다 */
export const ROD_TIP: [number, number, number] = [0, 1.42, 0];
