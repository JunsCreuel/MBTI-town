import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('globals.css', () => {
  it('괄호가 모두 닫혀 있다 (하나라도 빠지면 그 뒤 규칙이 통째로 다른 블록 안에 들어가 버린다)', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    let line = 1;
    const topLevelAt: number[] = [];
    for (const c of css) {
      if (c === '\n') line++;
      if (c === '{') {
        if (depth === 0) topLevelAt.push(line);
        depth++;
      } else if (c === '}') depth--;
      expect(depth, `${line}번째 줄에서 닫는 괄호가 더 많아요`).toBeGreaterThanOrEqual(0);
    }
    expect(depth, `${topLevelAt.at(-1)}번째 줄에서 연 블록이 닫히지 않았어요`).toBe(0);
  });
});
