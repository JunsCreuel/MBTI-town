// 토론 주제 목록. 차례로 돌아가며 쓴다 (가장 오래 안 쓴 주제부터).
// 유형 자체를 비하하거나 한쪽 유형이 정답인 것처럼 몰아가는 주제는 넣지 않는다.
// id는 한번 정하면 바꾸지 않는다 (지난 경기 기록이 이 id를 가리킨다).
import type { Topic } from './debate';

export const TOPICS: readonly Topic[] = [
  { id: 'travel-plan', title: '여행은 계획대로 다녀야 더 즐겁다', sideA: '계획대로가 즐겁다', sideB: '발길 닿는 대로가 즐겁다' },
  { id: 'worry-first', title: '친구가 고민을 털어놓으면 무엇이 먼저일까', sideA: '해결책이 먼저다', sideB: '공감이 먼저다' },
  { id: 'remote-work', title: '재택근무가 사무실 출근보다 낫다', sideA: '재택이 낫다', sideB: '출근이 낫다' },
  { id: 'perilla-leaf', title: '연인이 내 친구의 깻잎을 떼어 줘도 괜찮다', sideA: '괜찮다', sideB: '안 된다' },
  { id: 'sweet-sour', title: '탕수육 소스는 부어 먹어야 한다', sideA: '부어 먹는다', sideB: '찍어 먹는다' },
  { id: 'mint-choco', title: '민트초코는 맛있는 맛이다', sideA: '맛있다', sideB: '치약 맛이다' },
  { id: 'save-or-spend', title: '20대에는 돈을 모으는 것보다 경험에 쓰는 게 낫다', sideA: '경험에 쓴다', sideB: '모아 둔다' },
  { id: 'ai-writing', title: 'AI가 도와준 글도 내 글이라고 할 수 있다', sideA: '내 글이다', sideB: '내 글이 아니다' },
  { id: 'homework', title: '학교 숙제는 없어져야 한다', sideA: '없어져야 한다', sideB: '필요하다' },
  { id: 'salary-or-balance', title: '연봉이 높은 회사와 워라밸이 좋은 회사 중 하나를 고른다면', sideA: '연봉', sideB: '워라밸' },
  { id: 'white-lie', title: '선의의 거짓말은 해도 된다', sideA: '해도 된다', sideB: '하면 안 된다' },
  { id: 'cat-or-dog', title: '함께 살기에는 고양이가 강아지보다 낫다', sideA: '고양이', sideB: '강아지' },
  { id: 'morning-night', title: '아침형 인간이 저녁형 인간보다 유리하다', sideA: '아침형이 유리하다', sideB: '저녁형도 똑같다' },
  { id: 'wedding-size', title: '결혼식은 작게 하는 게 낫다', sideA: '작게', sideB: '제대로 크게' },
  { id: 'reply-speed', title: '단톡방 메시지에는 바로 답해야 한다', sideA: '바로 답한다', sideB: '편할 때 답한다' },
  { id: 'movie-alone', title: '영화는 혼자 보는 게 더 좋다', sideA: '혼자', sideB: '같이' },
  { id: 'sea-or-mountain', title: '휴가는 산보다 바다다', sideA: '바다', sideB: '산' },
  { id: 'money-now', title: '지금 5천만 원과 10년 뒤 1억 원 중 하나를 고른다면', sideA: '지금 5천만 원', sideB: '10년 뒤 1억 원' },
  { id: 'cramming', title: '시험 공부는 벼락치기도 충분하다', sideA: '충분하다', sideB: '꾸준히 해야 한다' },
  { id: 'anniversary', title: '연인 사이 기념일은 꼭 챙겨야 한다', sideA: '꼭 챙긴다', sideB: '굳이 안 챙겨도 된다' },
  { id: 'risk-or-stable', title: '실패하더라도 도전하는 삶이 안정적인 삶보다 낫다', sideA: '도전', sideB: '안정' },
  { id: 'lend-money', title: '친구 사이에 돈을 빌려줘도 된다', sideA: '빌려줘도 된다', sideB: '빌려주면 안 된다' },
  { id: 'spoiler', title: '스포일러는 어떤 경우에도 하면 안 된다', sideA: '절대 안 된다', sideB: '시간이 지나면 괜찮다' },
  { id: 'leader', title: '좋은 리더에게 더 중요한 건 결단력이다', sideA: '결단력', sideB: '경청' },
  { id: 'waiting-line', title: '맛집이라면 한 시간 줄 서는 것도 감수한다', sideA: '감수한다', sideB: '안 기다린다' },
  { id: 'read-no-reply', title: '메시지를 읽고 답하지 않는 건 무례하다', sideA: '무례하다', sideB: '그럴 수 있다' },
  { id: 'after-hours', title: '퇴근 후 회사 연락은 받지 않아도 된다', sideA: '안 받아도 된다', sideB: '급하면 받아야 한다' },
  { id: 'phone-week', title: '스마트폰 없이 일주일을 지낼 수 있다', sideA: '할 수 있다', sideB: '할 수 없다' },
];
