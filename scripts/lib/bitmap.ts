// 임시 에셋을 그리기 위한 최소한의 래스터 도구와 PNG 인코더 (외부 의존성 없음).
import { deflateSync } from 'node:zlib';

export type RGBA = [number, number, number, number];

export function hex(c: string, alpha = 255): RGBA {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

export class Bitmap {
  readonly data: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.data = new Uint8Array(width * height * 4);
  }

  /** 알파 합성으로 점 하나를 찍는다 */
  plot(x: number, y: number, c: RGBA): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const a = c[3] / 255;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa === 0) return;
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((c[k] * a + this.data[i + k] * da * (1 - a)) / oa);
    }
    this.data[i + 3] = Math.round(oa * 255);
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.plot(x + i, y + j, c);
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.plot(x, y, c);
      }
    }
  }

  /** 테두리가 있는 타원 */
  outlinedEllipse(cx: number, cy: number, rx: number, ry: number, fill: RGBA, line: RGBA): void {
    this.fillEllipse(cx, cy, rx, ry, line);
    this.fillEllipse(cx, cy, rx - 1, ry - 1, fill);
  }

  fillRoundRect(x: number, y: number, w: number, h: number, r: number, c: RGBA): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const cx = i < r ? r : i >= w - r ? w - r - 1 : i;
        const cy = j < r ? r : j >= h - r ? h - r - 1 : j;
        const dx = i - cx;
        const dy = j - cy;
        if (dx * dx + dy * dy <= r * r) this.plot(x + i, y + j, c);
      }
    }
  }

  fillPolygon(points: [number, number][], c: RGBA): void {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = 0; x < this.width; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, points)) this.plot(x, y, c);
      }
    }
  }

  /** 다른 비트맵을 (x, y)에 겹쳐 그린다 */
  draw(src: Bitmap, x: number, y: number): void {
    for (let j = 0; j < src.height; j++) {
      for (let i = 0; i < src.width; i++) {
        const k = (j * src.width + i) * 4;
        if (src.data[k + 3] === 0) continue;
        this.plot(x + i, y + j, [src.data[k], src.data[k + 1], src.data[k + 2], src.data[k + 3]]);
      }
    }
  }

  /** 5×7 비트 글리프를 scale 배로 찍는다 */
  glyph(rows: string[], x: number, y: number, scale: number, c: RGBA): void {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch !== '.') this.fillRect(x + i * scale, y + j * scale, scale, scale, c);
      }),
    );
  }

  toPng(): Buffer {
    return encodePng(this.width, this.height, this.data);
  }
}

function pointInPolygon(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
