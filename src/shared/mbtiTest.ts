// 가입 때 MBTI를 모르는 사람을 위한 간단 테스트 (12문항, 성향 축마다 3문항).
// 재미로 보는 테스트다. 공식 검사가 아니고, 결과가 마음에 안 들면 직접 고를 수 있다.
import { isMbtiType, type MbtiType } from '../design/mbti';
import type { Axis, AxisLetter } from './debate';

export interface TestChoice {
  text: string;
  letter: AxisLetter;
}

export interface TestQuestion {
  id: string;
  axis: Axis;
  q: string;
  a: TestChoice;
  b: TestChoice;
}

/** 축마다 3문항이라 비기는 일이 없다. 한쪽 성향이 옳은 것처럼 쓰지 않는다 */
export const MBTI_TEST: readonly TestQuestion[] = [
  { id: 'ei-weekend', axis: 'EI', q: '주말에 충전하는 방법은?', a: { text: '친구를 만나 수다 떨기', letter: 'E' }, b: { text: '집에서 혼자 푹 쉬기', letter: 'I' } },
  { id: 'sn-trip', axis: 'SN', q: '여행에서 오래 기억에 남는 건?', a: { text: '먹은 음식, 본 풍경 같은 장면', letter: 'S' }, b: { text: '그때의 분위기와 떠오른 생각', letter: 'N' } },
  { id: 'tf-worry', axis: 'TF', q: '친구가 고민을 털어놓으면?', a: { text: '해결 방법부터 같이 찾는다', letter: 'T' }, b: { text: '마음부터 들어 주고 공감한다', letter: 'F' } },
  { id: 'jp-trip', axis: 'JP', q: '여행 준비는?', a: { text: '일정표를 미리 짜 둔다', letter: 'J' }, b: { text: '가서 그때그때 정한다', letter: 'P' } },
  { id: 'ei-party', axis: 'EI', q: '처음 간 모임에서 나는?', a: { text: '먼저 말을 걸어 본다', letter: 'E' }, b: { text: '분위기를 보며 천천히 다가간다', letter: 'I' } },
  { id: 'sn-story', axis: 'SN', q: '이야기할 때 나는?', a: { text: '있었던 일을 순서대로 자세히', letter: 'S' }, b: { text: '비유를 섞어 큰 그림부터', letter: 'N' } },
  { id: 'tf-decide', axis: 'TF', q: '결정할 때 더 중요한 건?', a: { text: '논리와 공정함', letter: 'T' }, b: { text: '사람들의 마음과 관계', letter: 'F' } },
  { id: 'jp-deadline', axis: 'JP', q: '마감이 있는 일은?', a: { text: '미리미리 끝내 둔다', letter: 'J' }, b: { text: '마감이 다가와야 집중이 잘 된다', letter: 'P' } },
  { id: 'ei-think', axis: 'EI', q: '생각을 정리할 때는?', a: { text: '말하면서 정리된다', letter: 'E' }, b: { text: '혼자 생각한 뒤에 말한다', letter: 'I' } },
  { id: 'sn-way', axis: 'SN', q: '더 끌리는 말은?', a: { text: '해 본 방법이 제일 확실해', letter: 'S' }, b: { text: '새로운 방법을 시도해 보자', letter: 'N' } },
  { id: 'tf-praise', axis: 'TF', q: '더 기분 좋은 칭찬은?', a: { text: '"정말 똑똑하다"', letter: 'T' }, b: { text: '"정말 따뜻하다"', letter: 'F' } },
  { id: 'jp-change', axis: 'JP', q: '약속 일정이 갑자기 바뀌면?', a: { text: '계획이 틀어져 아쉽다', letter: 'J' }, b: { text: '그럴 수도 있지, 괜찮다', letter: 'P' } },
];

/** 고른 답(질문 id → 글자)으로 유형을 정한다. 모든 문항에 답해야 결과가 나온다 */
export function scoreMbtiTest(answers: Readonly<Record<string, AxisLetter>>): MbtiType | null {
  if (!MBTI_TEST.every((q) => answers[q.id] === q.a.letter || answers[q.id] === q.b.letter)) return null;
  const pick = (axis: Axis): string => {
    const qs = MBTI_TEST.filter((q) => q.axis === axis);
    const first = qs.filter((q) => answers[q.id] === axis[0]).length;
    return first * 2 > qs.length ? axis[0] : axis[1];
  };
  const code = `${pick('EI')}${pick('SN')}${pick('TF')}${pick('JP')}`;
  return isMbtiType(code) ? code : null;
}
