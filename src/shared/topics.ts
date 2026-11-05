// 토론 주제 목록. 그날 축(E·I / S·N / T·F / J·P)의 주제 가운데 가장 오래 안 쓴 것부터 쓴다.
// axis = 다투는 축, a = 첫 번째 입장(sideA)을 자연스럽게 맡는 글자 (그 글자 팀이 A팀이다).
// 유형 자체를 비하하거나 한쪽 성향이 정답인 것처럼 몰아가는 주제는 넣지 않는다.
// axis가 없는 주제는 예전 경기 기록을 위해 남겨 둔다 (모든 축에 주제가 있으면 쓰이지 않는다).
// id는 한번 정하면 바꾸지 않는다 (지난 경기 기록이 이 id를 가리킨다).
import type { Topic } from './debate';

export const TOPICS: readonly Topic[] = [
  { id: 'travel-plan', title: '여행은 계획대로 다녀야 더 즐겁다', sideA: '계획대로가 즐겁다', sideB: '발길 닿는 대로가 즐겁다', axis: 'JP', a: 'J' },
  { id: 'worry-first', title: '친구가 고민을 털어놓으면 무엇이 먼저일까', sideA: '해결책이 먼저다', sideB: '공감이 먼저다', axis: 'TF', a: 'T' },
  { id: 'remote-work', title: '재택근무가 사무실 출근보다 낫다', sideA: '재택이 낫다', sideB: '출근이 낫다' },
  { id: 'perilla-leaf', title: '연인이 내 친구의 깻잎을 떼어 줘도 괜찮다', sideA: '괜찮다', sideB: '안 된다', axis: 'TF', a: 'T' },
  { id: 'sweet-sour', title: '탕수육 소스는 부어 먹어야 한다', sideA: '부어 먹는다', sideB: '찍어 먹는다' },
  { id: 'mint-choco', title: '민트초코는 맛있는 맛이다', sideA: '맛있다', sideB: '치약 맛이다' },
  { id: 'save-or-spend', title: '20대에는 돈을 모으는 것보다 경험에 쓰는 게 낫다', sideA: '경험에 쓴다', sideB: '모아 둔다' },
  { id: 'ai-writing', title: 'AI가 도와준 글도 내 글이라고 할 수 있다', sideA: '내 글이다', sideB: '내 글이 아니다' },
  { id: 'homework', title: '학교 숙제는 없어져야 한다', sideA: '없어져야 한다', sideB: '필요하다' },
  { id: 'salary-or-balance', title: '연봉이 높은 회사와 워라밸이 좋은 회사 중 하나를 고른다면', sideA: '연봉', sideB: '워라밸' },
  { id: 'white-lie', title: '선의의 거짓말은 해도 된다', sideA: '해도 된다', sideB: '하면 안 된다', axis: 'TF', a: 'F' },
  { id: 'cat-or-dog', title: '함께 살기에는 고양이가 강아지보다 낫다', sideA: '고양이', sideB: '강아지' },
  { id: 'morning-night', title: '아침형 인간이 저녁형 인간보다 유리하다', sideA: '아침형이 유리하다', sideB: '저녁형도 똑같다' },
  { id: 'wedding-size', title: '결혼식은 작게 하는 게 낫다', sideA: '작게', sideB: '제대로 크게' },
  { id: 'reply-speed', title: '단톡방 메시지에는 바로 답해야 한다', sideA: '바로 답한다', sideB: '편할 때 답한다', axis: 'EI', a: 'E' },
  { id: 'movie-alone', title: '영화는 혼자 보는 게 더 좋다', sideA: '혼자', sideB: '같이', axis: 'EI', a: 'I' },
  { id: 'sea-or-mountain', title: '휴가는 산보다 바다다', sideA: '바다', sideB: '산' },
  { id: 'money-now', title: '지금 5천만 원과 10년 뒤 1억 원 중 하나를 고른다면', sideA: '지금 5천만 원', sideB: '10년 뒤 1억 원', axis: 'SN', a: 'S' },
  { id: 'cramming', title: '시험 공부는 벼락치기도 충분하다', sideA: '충분하다', sideB: '꾸준히 해야 한다', axis: 'JP', a: 'P' },
  { id: 'anniversary', title: '연인 사이 기념일은 꼭 챙겨야 한다', sideA: '꼭 챙긴다', sideB: '굳이 안 챙겨도 된다', axis: 'JP', a: 'J' },
  { id: 'risk-or-stable', title: '실패하더라도 도전하는 삶이 안정적인 삶보다 낫다', sideA: '도전', sideB: '안정', axis: 'SN', a: 'N' },
  { id: 'lend-money', title: '친구 사이에 돈을 빌려줘도 된다', sideA: '빌려줘도 된다', sideB: '빌려주면 안 된다', axis: 'TF', a: 'F' },
  { id: 'spoiler', title: '스포일러는 어떤 경우에도 하면 안 된다', sideA: '절대 안 된다', sideB: '시간이 지나면 괜찮다' },
  { id: 'leader', title: '좋은 리더에게 더 중요한 건 결단력이다', sideA: '결단력', sideB: '경청', axis: 'TF', a: 'T' },
  { id: 'waiting-line', title: '맛집이라면 한 시간 줄 서는 것도 감수한다', sideA: '감수한다', sideB: '안 기다린다' },
  { id: 'read-no-reply', title: '메시지를 읽고 답하지 않는 건 무례하다', sideA: '무례하다', sideB: '그럴 수 있다' },
  { id: 'after-hours', title: '퇴근 후 회사 연락은 받지 않아도 된다', sideA: '안 받아도 된다', sideB: '급하면 받아야 한다' },
  { id: 'phone-week', title: '스마트폰 없이 일주일을 지낼 수 있다', sideA: '할 수 있다', sideB: '할 수 없다' },
  // 외향(E) · 내향(I)
  { id: 'ei-weekend', title: '주말에는 밖에서 사람을 만나야 충전된다', sideA: '밖에서 만나야 충전된다', sideB: '집에서 혼자 쉬어야 충전된다', axis: 'EI', a: 'E' },
  { id: 'ei-party', title: '처음 보는 사람이 많은 모임은 설렌다', sideA: '설렌다', sideB: '생각만 해도 피곤하다', axis: 'EI', a: 'E' },
  { id: 'ei-call', title: '궁금한 게 있으면 전화가 문자보다 낫다', sideA: '전화가 낫다', sideB: '문자가 낫다', axis: 'EI', a: 'E' },
  { id: 'ei-birthday', title: '생일은 여럿이 모여 시끌벅적하게 보내야 한다', sideA: '시끌벅적하게', sideB: '조용히 몇 명과', axis: 'EI', a: 'E' },
  { id: 'ei-solo-travel', title: '여행은 혼자 가도 충분히 즐겁다', sideA: '혼자도 즐겁다', sideB: '같이 가야 즐겁다', axis: 'EI', a: 'I' },
  // 감각(S) · 직관(N)
  { id: 'sn-what-if', title: '"좀비가 나타나면?" 같은 만약에 질문은 재밌다', sideA: '재밌다', sideB: '일어날 일부터 이야기하자', axis: 'SN', a: 'N' },
  { id: 'sn-hidden-meaning', title: '영화는 숨은 의미를 해석하는 재미가 크다', sideA: '숨은 의미 해석이 재밌다', sideB: '보이는 그대로 즐긴다', axis: 'SN', a: 'N' },
  { id: 'sn-future', title: '10년 뒤 내 모습을 자주 상상하는 게 좋다', sideA: '자주 상상한다', sideB: '오늘 할 일이 먼저다', axis: 'SN', a: 'N' },
  { id: 'sn-proven-place', title: '밥집은 늘 가던 검증된 곳이 낫다', sideA: '검증된 곳', sideB: '새로운 곳 도전', axis: 'SN', a: 'S' },
  { id: 'sn-recipe', title: '요리는 레시피대로 계량해야 맛있다', sideA: '레시피대로', sideB: '감으로', axis: 'SN', a: 'S' },
  // 사고(T) · 감정(F)
  { id: 'tf-accident', title: "친구가 '나 접촉 사고 났어'라고 하면 첫마디는", sideA: '보험사 불렀어?', sideB: '괜찮아? 안 다쳤어?', axis: 'TF', a: 'T' },
  { id: 'tf-gift', title: '선물은 마음보다 쓸모가 중요하다', sideA: '쓸모 있는 선물', sideB: '마음이 담긴 선물', axis: 'TF', a: 'T' },
  { id: 'tf-feedback', title: '친구가 만든 노래가 별로라면 솔직하게 말해야 한다', sideA: '솔직하게 말한다', sideB: '좋은 점부터 말한다', axis: 'TF', a: 'T' },
  // 판단(J) · 인식(P)
  { id: 'jp-deadline', title: '과제는 미리 끝내야 마음이 편하다', sideA: '미리 끝낸다', sideB: '마감 직전이 집중이 잘 된다', axis: 'JP', a: 'J' },
  { id: 'jp-plans-change', title: '약속 당일에 갑자기 바뀐 일정도 괜찮다', sideA: '괜찮다', sideB: '정한 대로 하고 싶다', axis: 'JP', a: 'P' },
  { id: 'jp-tidy', title: '방은 늘 정리돼 있어야 한다', sideA: '늘 정리돼 있어야', sideB: '나만 아는 질서면 된다', axis: 'JP', a: 'J' },
  { id: 'jp-shopping', title: '장 보러 갈 때는 살 것 목록을 꼭 쓴다', sideA: '목록을 쓴다', sideB: '보면서 고른다', axis: 'JP', a: 'J' },
];
