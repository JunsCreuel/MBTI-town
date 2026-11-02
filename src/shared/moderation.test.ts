import { describe, expect, it } from 'vitest';
import { moderate } from './moderation';

describe('금지어 검사', () => {
  it('비하·욕설을 막고, 띄어쓰기로 피해도 잡는다', () => {
    expect(moderate('ENTP는 다 멍청해서 그래요').allowed).toBe(false);
    expect(moderate('그 유형은 멍 . 청 해요').allowed).toBe(false);
    expect(moderate('진짜 ㅅ ㅂ 이건 아니다').allowed).toBe(false);
  });

  it('링크·전화번호·도배를 막는다', () => {
    expect(moderate('자세한 건 https://example.com 참고').allowed).toBe(false);
    expect(moderate('연락은 010-1234-5678로 주세요').allowed).toBe(false);
    expect(moderate('ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ 웃기네').allowed).toBe(false);
  });

  it('정상 문장은 통과한다', () => {
    for (const ok of [
      '시바견은 고양이보다 산책을 좋아해서 함께 살기 좋아요.',
      '새끼 고양이 때부터 키우면 금방 친해집니다.',
      '불이 꺼져 있으면 강아지가 불안해해요.',
      '열등감 때문이 아니라, 하등 문제없다고 생각해서 반대합니다.',
      '계획을 세우면 이동 시간이 줄어요. 예를 들어 3시간을 아꼈어요.',
    ]) {
      expect(moderate(ok)).toEqual({ allowed: true, reason: '문제없음' });
    }
  });
});
