// 한국어 조사: 앞말 받침에 맞춰 붙인다 (예: 클럽으로, 낚시터로, 상가로, 서울로).

/** 마지막 글자의 받침 번호 (0 = 받침 없음, 8 = ㄹ). 한글이 아니면 0 */
function jong(word: string): number {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
}

/** "로/으로" (ㄹ 받침은 "로") */
export const withRo = (word: string) => `${word}${jong(word) === 0 || jong(word) === 8 ? '로' : '으로'}`;

/** "이에요/예요" (받침이 있으면 이에요): 목이에요, 화예요 */
export const withIeyo = (word: string) => `${word}${jong(word) === 0 ? '예요' : '이에요'}`;

/** "E(외향)과", "T(사고)와": 괄호는 건너뛰고 마지막 한글 글자의 받침을 본다 */
export const withGwa = (word: string) => `${word}${jong(word.replace(/[)\]\s]+$/, '')) === 0 ? '와' : '과'}`;

/** "이/가" (받침이 있으면 이): 꿀떡이, 토리가 */
export const withIGa = (word: string) => `${word}${jong(word) === 0 ? '가' : '이'}`;

/** "을/를" (받침이 있으면 을): 강아지를, 고양이를, 곰을 */
export const withEulReul = (word: string) => `${word}${jong(word) === 0 ? '를' : '을'}`;

/** "은/는" (받침이 있으면 은): 닉네임은, 취미는 */
export const withEunNeun = (word: string) => `${word}${jong(word) === 0 ? '는' : '은'}`;
