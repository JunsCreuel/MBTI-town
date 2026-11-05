import { describe, expect, it } from 'vitest';
import { FACE_ATLAS, FACES, faceFor, faceOffset } from './character';
import { EMOTES } from './protocol';

describe('표정', () => {
  it('아틀라스 칸: 왼쪽 위부터 FACES 차례, 모든 표정이 칸 안에 있다', () => {
    expect(faceOffset('neutral')).toEqual([0, 0]);
    expect(faceOffset('happy')).toEqual([1 / FACE_ATLAS.cols, 0]);
    expect(faceOffset('surprised')).toEqual([1 / FACE_ATLAS.cols, 1 / FACE_ATLAS.rows]);
    expect(FACES.length).toBeLessThanOrEqual(FACE_ATLAS.cols * FACE_ATLAS.rows);
  });

  it('이모티콘이 떠 있으면 그 표정, 아니면 몸짓 표정, 아니면 평소 얼굴', () => {
    expect(faceFor('joy', 'idle')).toBe('happy');
    expect(faceFor('heart', 'cheer')).toBe('love');
    expect(faceFor(null, 'cheer')).toBe('excited');
    expect(faceFor(null, 'walk')).toBe('neutral');
    expect(faceFor(null, 'fish')).toBe('neutral');
    // 모든 이모티콘에 표정이 있다
    for (const e of EMOTES) expect(faceFor(e, 'idle')).not.toBe('neutral');
  });
});
