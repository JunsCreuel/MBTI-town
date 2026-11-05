import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { stripImageMetadata } from './imageMeta';

const has = (b: Uint8Array, text: string) => Buffer.from(b).includes(Buffer.from(text));

describe('사진 촬영 정보 지우기', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    it(`${format}: EXIF(GPS 등)를 지우고 그림은 그대로 읽힌다`, async () => {
      const src = await sharp({ create: { width: 8, height: 6, channels: 3, background: { r: 200, g: 120, b: 40 } } })
        [format]()
        .withExif({ IFD0: { ImageDescription: 'SECRET-PLACE', Make: 'PhoneMaker' } })
        .toBuffer();
      const before = new Uint8Array(src);
      expect(has(before, 'SECRET-PLACE')).toBe(true);
      const after = stripImageMetadata(before, `image/${format}`);
      expect(has(after, 'SECRET-PLACE')).toBe(false);
      const meta = await sharp(Buffer.from(after)).metadata();
      expect([meta.width, meta.height, meta.exif]).toEqual([8, 6, undefined]);
    });
  }

  it('모양이 이상하면 원본 그대로', () => {
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
    expect(stripImageMetadata(junk, 'image/jpeg')).toBe(junk);
  });
});
