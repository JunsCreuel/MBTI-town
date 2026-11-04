// 한국어 조사: 앞말 받침에 맞춰 붙인다 (예: 클럽으로, 낚시터로, 상가로, 서울로).

/** 마지막 글자의 받침 번호 (0 = 받침 없음, 8 = ㄹ). 한글이 아니면 0 */
function jong(word: string): number {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
}

/** "로/으로" (ㄹ 받침은 "로") */
export const withRo = (word: string) => `${word}${jong(word) === 0 || jong(word) === 8 ? '로' : '으로'}`;
