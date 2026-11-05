// 올린 사진에서 촬영 정보(EXIF: 찍은 위치(GPS)·기기·시각, XMP·IPTC·글 조각)를 지운다. 그림 자체는 건드리지 않는다.
// 화면은 사진을 캔버스로 줄여 보내서 대부분 이미 지워져 있지만, API를 바로 부르면 원본이 그대로 올 수 있다.
// 모양이 이상하면 원본을 그대로 돌려준다 (sniffImage로 형식은 이미 확인했다).

export function stripImageMetadata(bytes: Uint8Array, mime: string): Uint8Array {
  try {
    if (mime === 'image/jpeg') return stripJpeg(bytes);
    if (mime === 'image/png') return stripPng(bytes);
    if (mime === 'image/webp') return stripWebp(bytes);
  } catch {
    // 아래에서 원본을 돌려준다
  }
  return bytes;
}

/** JPEG: APP1(EXIF·XMP)·APP13(IPTC)·COM(글) 조각을 뺀다. 그림 데이터(SOS 뒤)는 그대로 */
function stripJpeg(b: Uint8Array): Uint8Array {
  if (b[0] !== 0xff || b[1] !== 0xd8) return b;
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b;
    const marker = b[i + 1];
    // 채움 바이트
    if (marker === 0xff) {
      i++;
      continue;
    }
    // 길이가 없는 표시
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return b;
    if (marker === 0xda) {
      // 그림 데이터 시작: 끝까지 그대로
      out.push(b.subarray(i));
      return concat(out);
    }
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return b;
}

/** PNG: eXIf·tEXt·zTXt·iTXt·tIME 조각을 뺀다 */
function stripPng(b: Uint8Array): Uint8Array {
  const SIG = 8;
  if (b.length < SIG) return b;
  const out: Uint8Array[] = [b.subarray(0, SIG)];
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = SIG;
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const end = i + 12 + len;
    if (end > b.length) return b;
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return concat(out);
  }
  return b;
}

/** WebP: EXIF·XMP 조각을 빼고, 확장 머리(VP8X)의 표시와 전체 길이를 고친다 */
function stripWebp(b: Uint8Array): Uint8Array {
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (b.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return b;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const kept: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = tag(i);
    const size = view.getUint32(i + 4, true);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > b.length) return b;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = b.slice(i, Math.min(end, b.length));
      // VP8X 표시: 0x08 = EXIF 있음, 0x04 = XMP 있음
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04);
      kept.push(chunk);
    }
    i = end;
  }
  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
