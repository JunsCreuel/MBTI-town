// 입장할 때 쓰는 간단 설문. 축마다 3문항이라 항상 한쪽으로 정해진다.
// 정식 검사가 아니라 입장용 추정이다. 결과가 마음에 안 들면 직접 고를 수 있다.
import type { MbtiType } from '../design/mbti';

export type Axis = 'EI' | 'SN' | 'TF' | 'JP';
export type Choice = 'a' | 'b';

export interface SurveyQuestion {
  id: string;
  axis: Axis;
  prompt: string;
  /** a를 고르면 축의 앞 글자 (E, S, T, J) */
  a: string;
  b: string;
}

export const SURVEY: readonly SurveyQuestion[] = [
  { id: 'ei1', axis: 'EI', prompt: '쉬는 날 에너지를 채우는 방법은?', a: '사람들을 만나서 논다', b: '혼자만의 시간을 보낸다' },
  { id: 'sn1', axis: 'SN', prompt: '설명을 들을 때 더 잘 들어오는 쪽은?', a: '구체적인 예시와 순서', b: '전체 그림과 핵심 개념' },
  { id: 'tf1', axis: 'TF', prompt: '친구가 고민을 털어놓으면 먼저 하는 일은?', a: '해결 방법을 같이 찾는다', b: '마음부터 들어주고 공감한다' },
  { id: 'jp1', axis: 'JP', prompt: '여행을 갈 때 나는?', a: '일정표를 미리 짠다', b: '가서 끌리는 대로 다닌다' },
  { id: 'ei2', axis: 'EI', prompt: '처음 보는 사람이 많은 자리에서 나는?', a: '먼저 말을 거는 편', b: '누가 말을 걸어 주면 대화하는 편' },
  { id: 'sn2', axis: 'SN', prompt: '새 물건을 고를 때 더 오래 보는 것은?', a: '실제 후기와 사양', b: '이걸로 뭘 할 수 있을지 상상' },
  { id: 'tf2', axis: 'TF', prompt: '결정을 내릴 때 더 무게를 두는 것은?', a: '논리적으로 맞는지', b: '관련된 사람들의 마음' },
  { id: 'jp2', axis: 'JP', prompt: '마감이 있는 일은?', a: '미리 끝내야 마음이 편하다', b: '마감이 가까울 때 집중이 잘 된다' },
  { id: 'ei3', axis: 'EI', prompt: '생각을 정리할 때 나는?', a: '말하면서 정리된다', b: '혼자 생각한 뒤에 말한다' },
  { id: 'sn3', axis: 'SN', prompt: '더 끌리는 대화 주제는?', a: '실제로 있었던 일과 경험담', b: '"만약에" 하는 상상과 미래 이야기' },
  { id: 'tf3', axis: 'TF', prompt: '더 듣고 싶은 칭찬은?', a: '"정확하고 똑똑하다"', b: '"따뜻하고 배려심 있다"' },
  { id: 'jp3', axis: 'JP', prompt: '내 책상이나 방은?', a: '물건마다 정해진 자리가 있다', b: '필요할 때 찾으면 된다' },
];

const LETTERS: Record<Axis, [string, string]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

export function isSurveyComplete(answers: Partial<Record<string, Choice>>): boolean {
  return SURVEY.every((q) => answers[q.id] === 'a' || answers[q.id] === 'b');
}

export function scoreSurvey(answers: Partial<Record<string, Choice>>): MbtiType {
  if (!isSurveyComplete(answers)) throw new Error('모든 문항에 답해야 합니다');
  const axes: Axis[] = ['EI', 'SN', 'TF', 'JP'];
  return axes
    .map((axis) => {
      const qs = SURVEY.filter((q) => q.axis === axis);
      const aCount = qs.filter((q) => answers[q.id] === 'a').length;
      return aCount * 2 > qs.length ? LETTERS[axis][0] : LETTERS[axis][1];
    })
    .join('') as MbtiType;
}
