// MBTI 궁합 카드 (친구 방에 놀러 가면 두 사람 유형으로 본다). 재미로 보는 가벼운 풀이다.
// 점수: 네 글자를 하나씩 비교한다. 인식(N/S)이 같으면 말이 잘 통하고, 에너지(E/I)·판단(T/F)은 달라도 서로 채워 주며,
// 생활 방식(J/P)은 같으면 부딪힐 일이 적다. 1~5 하트로 바꾼다.
import { MBTI, groupOf, type MbtiGroup, type MbtiType } from '../design/mbti';

export interface Compat {
  /** 하트 수 1~5 */
  hearts: number;
  /** 한 줄 제목 (예: "찰떡 궁합") */
  title: string;
  /** 두 기질이 만나면 */
  text: string;
  /** 같이 하면 좋은 것 */
  tip: string;
}

const TITLES = ['노력하면 반짝 궁합', '서로 배우는 궁합', '편안한 궁합', '잘 맞는 궁합', '찰떡 궁합'] as const;

/** 두 기질(NT·NF·SJ·SP)이 만나면 (순서 없이) */
const GROUP_TEXT: Record<string, [string, string]> = {
  'NT|NT': ['밤새 아이디어를 주고받는 사이예요. 대화가 끝이 없어요.', '같이 토론 한 판 해 보기'],
  'NF|NF': ['말하지 않아도 마음이 먼저 통해요. 서로의 감정을 잘 알아줘요.', '방명록에 진심 한 줄 남기기'],
  'SJ|SJ': ['약속은 꼭 지키는 든든한 사이예요. 같이 있으면 안정돼요.', '방을 같이 정리하며 꾸미기'],
  'SP|SP': ['만나면 바로 놀러 나가는 사이예요. 지루할 틈이 없어요.', '클럽에서 같이 춤추기'],
  'NF|NT': ['머리와 마음이 만나요. 깊은 이야기를 나누기 좋아요.', '오늘의 토론에서 같은 편 하기'],
  'NT|SJ': ['계획은 NT가, 실천은 SJ가. 함께하면 일이 착착 진행돼요.', '같이 방 배치 계획 세우기'],
  'NT|SP': ['생각과 행동이 만나요. 엉뚱한 일도 금방 해내요.', '낚시터에서 누가 더 큰 물고기를 낚나 내기'],
  'NF|SJ': ['따뜻함과 성실함이 만나요. 서로를 잘 챙겨 줘요.', '강아지 같이 쓰다듬기'],
  'NF|SP': ['감성과 흥이 만나요. 같이 있으면 분위기가 살아나요.', '좋아하는 노래 클럽에 신청하기'],
  'SJ|SP': ['차분함과 활발함이 만나요. 서로에게 없는 걸 채워 줘요.', '마을 열매 같이 따러 가기'],
};

function pairKey(a: MbtiGroup, b: MbtiGroup): string {
  return [a, b].sort().join('|');
}

/** 네 글자 비교 점수 (0~5.5) */
export function compatScore(a: MbtiType, b: MbtiType): number {
  let s = 0;
  s += a[1] === b[1] ? 2 : 0.5; // N/S: 같으면 말이 잘 통한다
  s += a[0] !== b[0] ? 1 : 0.5; // E/I: 다르면 서로 채워 준다
  s += a[2] !== b[2] ? 1 : 0.5; // T/F: 다르면 서로 채워 준다
  s += a[3] === b[3] ? 1.5 : 0.5; // J/P: 같으면 생활이 편하다
  return s;
}

export function compat(a: MbtiType, b: MbtiType): Compat {
  const score = compatScore(a, b);
  // 2~5.5점을 1~5 하트로
  const hearts = Math.max(1, Math.min(5, Math.round(((score - 2) / 3.5) * 4) + 1));
  const [text, tip] = GROUP_TEXT[pairKey(groupOf(a), groupOf(b))];
  const title = a === b ? '거울 궁합' : TITLES[hearts - 1];
  return {
    hearts,
    title,
    text: a === b ? `같은 ${MBTI[a].name}끼리! 서로를 거울처럼 잘 알아요. ${text}` : text,
    tip,
  };
}
