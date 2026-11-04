// 사주상담소 타로 (부엉 도사): 메이저 아르카나 22장. 카드 뜻은 널리 알려진 전통 해석을 바탕으로 우리 말로 새로 썼다.
// 오늘의 카드(한 장)와 과거·현재·미래(세 장, 주제를 골라서). 카드는 서버가 섞어 뽑고, 풀이는 이 파일이 만든다.
// 카드 그림은 scripts/lib/tarot-cards.ts가 만든다 (manifest item.tarot.<key>, 뒷면 item.tarot.back).

export type TarotTopic = 'general' | 'love' | 'work' | 'money';
export const TAROT_TOPICS: readonly TarotTopic[] = ['general', 'love', 'work', 'money'];
export const TAROT_TOPIC_NAME: Record<TarotTopic, string> = { general: '종합', love: '연애', work: '일·공부', money: '재물' };

export type TarotSpread = 'one' | 'three';
export type TarotRole = 'today' | 'past' | 'present' | 'future';
export const SPREAD_ROLES: Record<TarotSpread, readonly TarotRole[]> = { one: ['today'], three: ['past', 'present', 'future'] };
export const TAROT_ROLE_NAME: Record<TarotRole, string> = { today: '오늘의 카드', past: '과거', present: '현재', future: '미래' };
export const TAROT_SPREAD_NAME: Record<TarotSpread, string> = { one: '오늘의 카드 한 장', three: '과거·현재·미래 세 장' };

interface Face {
  keywords: [string, string, string];
  /** 이 카드가 전하는 말 */
  line: string;
  /** 오늘 해 볼 일 */
  advice: string;
  love: string;
  work: string;
  money: string;
}

export interface TarotCard {
  id: number;
  key: string;
  name: string;
  en: string;
  numeral: string;
  up: Face;
  rev: Face;
}

const card = (id: number, key: string, name: string, en: string, numeral: string, up: Face, rev: Face): TarotCard => ({ id, key, name, en, numeral, up, rev });
const f = (keywords: [string, string, string], line: string, advice: string, love: string, work: string, money: string): Face => ({ keywords, line, advice, love, work, money });

export const TAROT_DECK: readonly TarotCard[] = [
  card(0, 'fool', '바보', 'The Fool', '0',
    f(['새 출발', '자유', '호기심'], '아무것도 정해지지 않았기에 무엇이든 될 수 있는 날이에요. 가볍게 첫발을 떼 보세요.', '망설이던 일을 작게라도 시작해 보세요.', '계산 없이 다가가면 설레는 인연이 생겨요.', '처음 해 보는 일에 손을 들면 길이 열려요.', '작은 돈으로 새로운 걸 해 볼 만해요. 큰돈은 아직이에요.'),
    f(['무모함', '준비 부족', '들뜸'], '마음이 앞서 발밑을 못 볼 수 있어요. 한 번만 더 확인하고 움직이세요.', '약속과 일정부터 다시 챙겨 보세요.', '들뜬 마음에 한 말이 오해를 살 수 있어요. 천천히요.', '덜컥 맡기 전에 할 수 있는 만큼인지 따져 보세요.', '충동구매 주의! 장바구니에 하루 묵혀 두세요.')),
  card(1, 'magician', '마법사', 'The Magician', 'I',
    f(['재능', '실행력', '집중'], '필요한 재료는 이미 손에 다 있어요. 마음먹은 대로 만들어 낼 수 있는 날이에요.', '하고 싶은 말을 또렷하게 꺼내 보세요.', '먼저 표현하는 쪽이 흐름을 이끌어요.', '내 솜씨를 보여 줄 기회가 와요. 준비한 걸 꺼내세요.', '아이디어가 돈이 되는 흐름이에요. 떠오른 건 적어 두세요.'),
    f(['흩어진 힘', '말뿐', '속임수 조심'], '재주는 있는데 힘이 흩어져 있어요. 한 가지에만 마음을 모아 보세요.', '벌여 놓은 일 중 하나를 끝내 보세요.', '말만 번지르르한 사람은 조심해요.', '계획만 세우고 손이 안 가던 일을 오늘 시작해요.', '너무 좋은 조건은 한 번 더 의심하세요.')),
  card(2, 'high_priestess', '여사제', 'The High Priestess', 'II',
    f(['직감', '고요', '숨은 지혜'], '답은 이미 마음속에 있어요. 조용히 귀 기울이면 들려요.', '혼자 생각을 정리하는 시간을 가져 보세요.', '서두르지 않아도 마음은 전해져요. 은은하게 곁에 있어 주세요.', '드러내기보다 살펴볼 때예요. 정보가 힘이 돼요.', '지금은 지키는 쪽이 이득이에요.'),
    f(['흔들리는 마음', '숨긴 이야기', '대화 부족'], '속마음을 너무 꽁꽁 숨기면 오해가 쌓여요. 조금은 꺼내 보세요.', '마음에 걸리는 걸 솔직히 물어보세요.', '말하지 않으면 몰라요. 작은 서운함부터 이야기해요.', '확인 안 된 소문에 휘둘리지 마세요.', '눈에 안 보이게 새는 돈이 있는지 살펴봐요.')),
  card(3, 'empress', '여황제', 'The Empress', 'III',
    f(['풍요', '다정함', '돌봄'], '넉넉하고 포근한 기운이 가득해요. 나를 아끼는 만큼 좋은 일이 자라요.', '맛있는 걸 먹으며 나를 챙겨 주세요.', '다정한 마음이 꽃피어요. 함께 있는 시간이 따뜻해요.', '정성 들인 일이 열매를 맺어요.', '들어오는 흐름이 좋아요. 나눌수록 더 커져요.'),
    f(['지침', '지나친 돌봄', '게으름'], '남을 챙기느라 나를 잊었어요. 오늘은 나에게도 다정해 주세요.', '하루쯤 할 일을 내려놓고 쉬어요.', '너무 맞춰 주기만 하면 지쳐요. 내 마음도 말해요.', '손이 느려질 수 있어요. 쉬운 일부터 끝내요.', '기분 따라 쓰는 돈을 조심해요.')),
  card(4, 'emperor', '황제', 'The Emperor', 'IV',
    f(['책임', '안정', '리더십'], '단단한 바탕 위에 서 있어요. 원칙을 지키면 흔들리지 않아요.', '계획표를 세우고 그대로 해 보세요.', '믿음직한 모습이 상대를 안심시켜요.', '앞장설 때예요. 결정은 분명하게 내려요.', '계획적인 관리가 빛을 봐요.'),
    f(['고집', '통제', '딱딱함'], '내 방식만 고집하면 부딪쳐요. 한 발만 물러서 보세요.', '다른 사람 의견을 한 번 끝까지 들어 보세요.', '이기려 들면 멀어져요. 부드럽게요.', '윗사람과 부딪치지 않게 조심해요.', '무리한 큰 결정은 미뤄요.')),
  card(5, 'hierophant', '교황', 'The Hierophant', 'V',
    f(['배움', '조언', '믿음'], '믿을 만한 사람의 조언이 길잡이가 돼요. 배우는 마음이 복을 불러요.', '선배나 어른께 물어보세요.', '진지하고 바른 만남이 이어져요.', '정해진 순서를 따르면 탈이 없어요.', '검증된 방법이 가장 안전해요.'),
    f(['틀 깨기', '고정관념', '엇갈린 조언'], '남들이 다 하는 방식이 나에게 맞지 않을 수 있어요. 나만의 길도 괜찮아요.', '익숙한 습관 하나를 바꿔 보세요.', '남의 기준보다 둘만의 속도가 중요해요.', '하던 대로에 묶이지 말고 더 나은 방법을 찾아요.', '남 따라 하는 투자는 조심해요.')),
  card(6, 'lovers', '연인', 'The Lovers', 'VI',
    f(['사랑', '선택', '조화'], '마음이 통하는 사람과 함께라면 무엇이든 즐거워요. 진심으로 고르세요.', '좋아하는 사람에게 마음을 표현해 보세요.', '설레는 인연 또는 더 깊어지는 사이! 연애운이 활짝 열렸어요.', '함께하는 사람과 손발이 척척 맞아요.', '마음이 가는 곳에 쓰면 후회 없어요.'),
    f(['엇갈림', '망설임', '유혹'], '마음이 둘로 나뉘어 있어요. 정말 원하는 게 뭔지 먼저 물어보세요.', '결정을 하루 미루고 마음을 정리해요.', '작은 엇갈림이 생길 수 있어요. 솔직한 대화가 약이에요.', '함께하는 일에서 생각 차이가 보여요. 먼저 맞춰 봐요.', '유혹에 흔들리는 지출을 조심해요.')),
  card(7, 'chariot', '전차', 'The Chariot', 'VII',
    f(['전진', '승리', '의지'], '목표를 향해 힘차게 달리는 날이에요. 마음먹은 대로 밀고 나가세요.', '미뤄 둔 목표에 한 걸음 다가가요.', '적극적으로 다가가면 결실이 있어요.', '겨루면 이길 기세예요. 속도를 내요.', '목표를 정하고 모으면 금방 모여요.'),
    f(['폭주', '방향 잃음', '조급함'], '빨리 가려다 방향을 놓칠 수 있어요. 잠깐 멈춰 지도를 보세요.', '오늘 할 일을 세 개로 줄여요.', '밀어붙이면 상대가 지쳐요. 속도를 맞춰요.', '서두르면 실수가 나와요.', '급하게 쓰는 돈이 새어 나가요.')),
  card(8, 'strength', '힘', 'Strength', 'VIII',
    f(['용기', '인내', '부드러운 힘'], '조용하지만 단단한 힘이 있어요. 부드럽게 다가가면 어려운 일도 풀려요.', '화가 나는 순간 한 번 숨을 고르세요.', '따뜻한 인내가 마음을 열어요.', '끈기가 결과를 만들어요. 포기하지 마요.', '꾸준히 모으는 힘이 커져요.'),
    f(['자신감 부족', '지침', '울컥함'], '힘이 빠진 날이에요. 스스로를 너무 다그치지 말아요.', '오늘 잘한 일 세 가지를 적어 보세요.', '감정이 앞서면 말이 날카로워져요.', '버거운 일은 도움을 청해요.', '스트레스 풀려고 쓰는 돈을 조심해요.')),
  card(9, 'hermit', '은둔자', 'The Hermit', 'IX',
    f(['성찰', '지혜', '혼자만의 시간'], '조용히 등불을 켜고 내 마음을 들여다볼 때예요. 혼자 있는 시간이 답을 줘요.', '산책하며 생각을 정리해 보세요.', '서두르지 말고 내가 바라는 사랑을 그려 봐요.', '깊이 파고들면 남들이 못 본 걸 찾아요.', '아끼고 정리하기 좋은 때예요.'),
    f(['고립', '외로움', '지나친 고민'], '혼자 끌어안고 있으면 더 무거워져요. 누군가에게 털어놓아 보세요.', '오랜만에 친구에게 연락해 보세요.', '마음의 문을 조금 열어야 인연이 와요.', '혼자 다 하려 하지 말고 물어봐요.', '쓸 곳에는 쓰는 것도 지혜예요.')),
  card(10, 'wheel', '운명의 수레바퀴', 'Wheel of Fortune', 'X',
    f(['전환점', '행운', '흐름'], '바퀴가 좋은 쪽으로 돌기 시작했어요. 찾아온 기회를 놓치지 마세요.', '평소와 다른 길로 가 보세요. 뜻밖의 행운이 있어요.', '우연한 만남이 인연으로 이어질 수 있어요.', '흐름이 바뀌어요. 새 기회에 올라타세요.', '뜻밖의 수입이 생길 수 있어요.'),
    f(['엇박자', '늦어짐', '되풀이'], '일이 뜻대로 안 굴러가도 잠깐이에요. 바퀴는 다시 돌아요.', '안 풀리는 일은 내일로 넘겨도 괜찮아요.', '같은 일로 또 다투지 않게 조심해요.', '일정이 밀릴 수 있어요. 여유를 둬요.', '들어올 돈이 늦어질 수 있어요.')),
  card(11, 'justice', '정의', 'Justice', 'XI',
    f(['공정', '균형', '책임'], '뿌린 대로 거두는 날이에요. 바르게 한 만큼 돌아와요.', '미뤄 둔 정리나 약속을 지켜 보세요.', '주고받는 마음이 균형을 이뤄요.', '정당한 평가를 받아요. 서류와 계약이 잘 풀려요.', '계산을 정확하게 해요. 영수증을 챙겨요.'),
    f(['불공평', '치우침', '미룬 책임'], '한쪽으로 기운 마음이 판단을 흐려요. 양쪽 이야기를 다 들어 보세요.', '내 잘못이 있다면 먼저 인정해요.', '서운함이 한쪽에만 쌓이지 않게 해요.', '억울한 일이 있어도 감정보다 사실로 말해요.', '빌려주고 빌리는 일은 조심해요.')),
  card(12, 'hanged_man', '매달린 사람', 'The Hanged Man', 'XII',
    f(['멈춤', '새 관점', '기다림'], '거꾸로 보면 전혀 다른 답이 보여요. 잠깐 멈춰도 괜찮은 날이에요.', '서두르던 일을 하루 내려놓고 지켜봐요.', '조급해하지 않으면 마음이 저절로 와요.', '기다림이 필요한 일이에요. 때를 봐요.', '지금은 쓰기보다 두는 게 나아요.'),
    f(['헛된 참음', '제자리걸음', '고집'], '참기만 한다고 나아지지 않아요. 바꿀 수 있는 건 바꿔 보세요.', '참고 있던 걸 하나만 말해 보세요.', '한쪽만 희생하는 사이는 오래가기 어려워요.', '제자리걸음인 일은 방법을 바꿔요.', '묶여 있는 돈을 다시 살펴봐요.')),
  card(13, 'death', '죽음', 'Death', 'XIII',
    f(['끝과 시작', '정리', '변화'], '하나가 끝나야 새것이 와요. 무서운 카드가 아니라 새로 태어나는 카드예요.', '안 쓰는 물건이나 지난 일을 정리해 보세요.', '지난 마음을 보내면 새 인연이 와요.', '끝낼 일을 끝내면 다음 문이 열려요.', '새는 돈을 끊어 내기 좋은 날이에요.'),
    f(['미련', '변화가 두려움', '질질 끎'], '끝난 일을 붙잡고 있어요. 놓아주면 마음이 가벼워져요.', '미뤄 둔 정리를 오늘 하나만 해요.', '지난 인연에 대한 미련을 조심해요.', '바뀌는 흐름을 피하지 말고 타 보세요.', '안 쓰는 구독을 정리해 보세요.')),
  card(14, 'temperance', '절제', 'Temperance', 'XIV',
    f(['균형', '조화', '알맞음'], '물과 불을 알맞게 섞듯, 적당함이 가장 좋은 날이에요.', '먹고 자는 것을 알맞게 챙겨요.', '서로의 속도를 맞추면 편안해져요.', '사람 사이를 잇는 역할이 빛나요.', '들어오고 나가는 돈의 균형이 잘 맞아요.'),
    f(['지나침', '불균형', '서두름'], '무언가 지나치게 치우쳐 있어요. 덜어 내면 편해져요.', '오늘은 하나를 덜 해 보세요.', '감정이 널뛰지 않게 마음을 다독여요.', '일과 쉼의 균형이 깨졌어요. 쉬어 가요.', '과소비 주의! 하나 사면 하나 참기.')),
  card(15, 'devil', '악마', 'The Devil', 'XV',
    f(['유혹', '집착', '달콤한 덫'], '달콤한 것에 마음이 끌려요. 즐기되 빠져들지는 마세요.', '끊고 싶던 습관을 하루만 참아 보세요.', '강한 끌림이 있어요. 집착으로 번지지 않게 조심해요.', '편한 길만 찾으면 발목이 잡혀요.', '쉬운 돈벌이 이야기는 경계해요.'),
    f(['벗어남', '풀려남', '깨달음'], '나를 묶던 것에서 풀려나요. 마음이 한결 가벼워져요.', '나쁜 습관 하나를 끊겠다고 정해 보세요.', '힘들게 하던 관계에서 벗어날 힘이 생겨요.', '얽매였던 일이 풀려요.', '빚이나 할부를 정리하기 좋아요.')),
  card(16, 'tower', '탑', 'The Tower', 'XVI',
    f(['뜻밖의 변화', '깨달음', '무너짐'], '갑작스러운 일이 생겨도 약하던 것이 무너질 뿐이에요. 더 튼튼하게 다시 세워요.', '예상 밖의 일에도 한 템포 쉬고 침착하게 대응해요.', '숨겨 둔 감정이 터질 수 있어요. 솔직함이 오히려 약이 돼요.', '계획이 바뀌어도 당황하지 마세요. 더 나은 방법이 보여요.', '갑작스러운 지출에 대비해 여유를 둬요.'),
    f(['위기 모면', '작은 흔들림', '변화 미루기'], '큰 탈은 비켜 가요. 그래도 금 간 곳은 미리 고쳐 두세요.', '불안한 곳을 하나 점검해요.', '쌓인 문제를 미루면 커져요. 조금씩 풀어요.', '위험 신호를 그냥 넘기지 마세요.', '비상금을 챙겨 둬요.')),
  card(17, 'star', '별', 'The Star', 'XVII',
    f(['희망', '치유', '영감'], '밤하늘의 별처럼 희망이 반짝여요. 바라던 일이 조금씩 다가와요.', '소원을 적어 두고 하루를 시작해 보세요.', '상처가 아물고 맑은 마음으로 사랑할 수 있어요.', '좋은 생각이 떠올라요. 꿈을 크게 그려요.', '조금씩 나아지는 흐름이에요.'),
    f(['실망', '자신감 저하', '흐린 희망'], '별이 구름에 가렸을 뿐 사라지지 않았어요. 기대를 조금 낮추면 편해져요.', '작은 목표 하나를 이뤄 자신감을 되찾아요.', '너무 큰 기대는 실망을 불러요.', '결과가 바로 안 보여도 하던 대로 가요.', '막연한 기대보다 현실적인 계획을 세워요.')),
  card(18, 'moon', '달', 'The Moon', 'XVIII',
    f(['불안', '상상', '흐릿함'], '달빛 아래라 모든 게 흐릿해요. 확실하지 않은 건 서두르지 마세요.', '중요한 결정은 하루 미뤄요.', '상대 마음을 짐작만 하지 말고 물어봐요.', '정보가 부족해요. 확인 또 확인!', '불확실한 곳에는 돈을 넣지 마세요.'),
    f(['오해 풀림', '안개 걷힘', '진실'], '안개가 걷히고 진실이 보이기 시작해요. 불안이 줄어들어요.', '헷갈리던 일을 정리해서 적어 봐요.', '오해가 풀리고 마음이 분명해져요.', '감춰졌던 문제가 드러나 바로잡을 수 있어요.', '숨은 비용을 찾아 줄일 수 있어요.')),
  card(19, 'sun', '태양', 'The Sun', 'XIX',
    f(['기쁨', '성공', '활력'], '햇살 가득한 최고의 날이에요! 웃으면 더 좋은 일이 따라와요.', '하고 싶던 걸 마음껏 해 보세요.', '밝고 따뜻한 사랑운이에요. 함께 웃을 일이 많아요.', '노력이 인정받고 빛나는 날이에요.', '기분 좋은 수입이 기대돼요.'),
    f(['지나친 자신감', '들뜸', '잠깐 흐림'], '햇살이 잠깐 구름 뒤에 숨었어요. 그래도 바탕은 좋은 날이에요.', '자신감은 좋지만 꼼꼼함도 챙겨요.', '내 기분만 앞세우지 않게 해요.', '마무리까지 챙기면 실수가 없어요.', '기분 낸 지출이 커지지 않게 해요.')),
  card(20, 'judgement', '심판', 'Judgement', 'XX',
    f(['다시 일어섬', '결단', '좋은 소식'], '기다리던 소식이 들려와요. 다시 일어설 때예요.', '미뤄 둔 결정을 오늘 내려 보세요.', '다시 연락이 닿거나 관계가 새로워져요.', '노력의 결과가 드러나요. 좋은 평가가 와요.', '지난 노력이 보상으로 돌아와요.'),
    f(['망설임', '자책', '지난 일에 매임'], '지난 실수에 너무 매여 있어요. 스스로를 용서해 주세요.', '나에게 "괜찮아"라고 말해 주세요.', '과거와 비교하지 말고 지금을 봐요.', '결정을 미루면 기회가 지나가요.', '지난 손해는 잊고 다시 계획해요.')),
  card(21, 'world', '세계', 'The World', 'XXI',
    f(['완성', '성취', '새 여정'], '한 바퀴를 멋지게 마무리했어요. 다음 여행이 기다려요.', '끝낸 일을 스스로 축하해 주세요.', '안정되고 꽉 찬 사랑이에요. 함께 그리는 앞날이 밝아요.', '목표를 이루고 인정받아요.', '흐름이 안정적이에요. 여행 자금을 모아 봐요.'),
    f(['마무리 부족', '아쉬움', '한 걸음 더'], '거의 다 왔어요. 마지막 한 조각만 채우면 돼요.', '끝내지 못한 일을 마무리해요.', '조금만 더 마음을 쓰면 사이가 단단해져요.', '마지막 확인이 결과를 바꿔요.', '목표 금액까지 조금 남았어요. 꾸준히요.')),
];

/** 화면이 고르는 카드 자리 수 (뒤집힌 카드를 이만큼 늘어놓는다) */
export const TAROT_SPREAD_SIZE = TAROT_DECK.length;

export interface TarotDrawn {
  id: number;
  reversed: boolean;
}

/**
 * 카드 뽑기: 덱을 섞고(피셔-예이츠) 고른 자리의 카드를 가져온다. 거꾸로 나올 확률은 reversedChance.
 * picks = 늘어놓은 카드 중 고른 자리 (0부터). 서버가 섞으므로 자리를 골라도 확률은 같다.
 */
export function drawTarot(spread: TarotSpread, picks: readonly number[], reversedChance: number, rand: () => number = Math.random): TarotDrawn[] {
  const order = TAROT_DECK.map((c) => c.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return SPREAD_ROLES[spread].map((_, k) => ({ id: order[picks[k] ?? k], reversed: rand() < reversedChance }));
}

/** 고른 자리가 올바른지: 뽑는 장수만큼, 서로 다른 0~21 */
export function validPicks(spread: TarotSpread, picks: unknown): picks is number[] {
  const n = SPREAD_ROLES[spread].length;
  return (
    Array.isArray(picks) &&
    picks.length === n &&
    picks.every((p) => Number.isInteger(p) && p >= 0 && p < TAROT_SPREAD_SIZE) &&
    new Set(picks).size === n
  );
}

export interface TarotCardResult {
  role: TarotRole;
  id: number;
  key: string;
  name: string;
  reversed: boolean;
  keywords: string[];
  text: string;
}

export interface TarotResult {
  spread: TarotSpread;
  topic: TarotTopic;
  /** 화면에 보이는 날짜 */
  period: string;
  title: string;
  cards: TarotCardResult[];
  summary: string;
  advice: string;
  /** 한 장 점: 연애·일·재물 한 줄씩 */
  sections: { title: string; text: string }[];
}

const faceOf = (d: TarotDrawn) => {
  const c = TAROT_DECK[d.id];
  return { c, face: d.reversed ? c.rev : c.up };
};
const topicText = (face: Face, topic: TarotTopic) => (topic === 'general' ? face.line : face[topic]);

/** 세 장이 바로 선 수에 따라 흐름을 한 줄로 */
const FLOW: Record<number, string> = {
  3: '세 장 모두 바로 섰어요. 흐름이 활짝 열려 있어요!',
  2: '대체로 순한 흐름이에요. 한 군데만 조심하면 돼요.',
  1: '조심스러운 흐름이에요. 서두르지 말고 하나씩 풀어 가요.',
  0: '쉬어 가라는 신호예요. 무리하지 않으면 지나가요.',
};

export function tarotReading(spread: TarotSpread, topic: TarotTopic, drawn: readonly TarotDrawn[], periodLabel: string): TarotResult {
  const roles = SPREAD_ROLES[spread];
  const cards = drawn.map((d, k): TarotCardResult => {
    const { c, face } = faceOf(d);
    return {
      role: roles[k],
      id: c.id,
      key: c.key,
      name: c.name,
      reversed: d.reversed,
      keywords: [...face.keywords],
      text: spread === 'one' ? face.line : topicText(face, topic),
    };
  });
  if (spread === 'one') {
    const { c, face } = faceOf(drawn[0]);
    return {
      spread,
      topic: 'general',
      period: periodLabel,
      title: `${c.name}${drawn[0].reversed ? ' (거꾸로)' : ''}`,
      cards,
      summary: face.line,
      advice: face.advice,
      sections: [
        { title: '연애', text: face.love },
        { title: '일·공부', text: face.work },
        { title: '재물', text: face.money },
      ],
    };
  }
  const ups = drawn.filter((d) => !d.reversed).length;
  const chain = cards.map((x) => `${TAROT_ROLE_NAME[x.role]} '${x.keywords[0]}'`).join(' → ');
  const future = faceOf(drawn[2]).face;
  const present = faceOf(drawn[1]).face;
  return {
    spread,
    topic,
    period: periodLabel,
    title: `${TAROT_TOPIC_NAME[topic]} · 과거·현재·미래`,
    cards,
    summary: `${FLOW[ups]} ${chain}.`,
    advice: `${present.advice} ${future.advice}`,
    sections: [],
  };
}
