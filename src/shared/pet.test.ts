import { describe, expect, it } from 'vitest';
import { petOf } from './pet';

describe('일주 동물 펫', () => {
  it('지지는 띠 동물, 천간은 오행 색', () => {
    expect(petOf('갑자')).toMatchObject({ animal: 'rat', element: 'wood', name: '푸른 쥐' });
    expect(petOf('병오')).toMatchObject({ animal: 'horse', element: 'fire', name: '붉은 말' });
    expect(petOf('경신')).toMatchObject({ animal: 'monkey', element: 'metal', name: '하얀 원숭이' });
    expect(petOf('계해')).toMatchObject({ animal: 'pig', element: 'water', name: '검은 돼지' });
    expect(petOf('기축')).toMatchObject({ animal: 'ox', element: 'earth', name: '황금 소' });
  });

  it('60갑자에 없는 짝이나 이상한 값은 null', () => {
    expect(petOf('갑축')).toBeNull(); // 양간 + 음지 짝은 없다
    expect(petOf('')).toBeNull();
    expect(petOf(null)).toBeNull();
    expect(petOf('갑자일주')).toBeNull();
  });

  it('60가지 일주가 모두 펫이 되고, 이름은 60가지가 다 다르다', () => {
    const stems = '갑을병정무기경신임계';
    const branches = '자축인묘진사오미신유술해';
    const names = new Set<string>();
    for (let i = 0; i < 60; i++) names.add(petOf(stems[i % 10] + branches[i % 12])!.name);
    expect(names.size).toBe(60);
  });
});
