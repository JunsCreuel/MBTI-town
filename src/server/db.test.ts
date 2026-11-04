// 서버리스 함수가 쉬는 동안 끊긴 DB 연결처럼, 붙기만 하고 답이 없는 서버에서 오래 멈추지 않는지 본다.
import { createServer } from 'node:net';
import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
it('응답 없는 DB에서 오래 멈추지 않는다', async () => {
  const srv = createServer(() => {});
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  const { createPostgresSql } = await import('./db');
  const sql = await createPostgresSql(`postgres://u:p@127.0.0.1:${port}/db`);
  const t0 = Date.now();
  await expect(sql.query('select 1')).rejects.toThrow();
  const readMs = Date.now() - t0;
  const t1 = Date.now();
  await expect(sql.query('update x set y = 1')).rejects.toThrow();
  const writeMs = Date.now() - t1;
  expect(readMs).toBeLessThan(14_000);
  expect(writeMs).toBeLessThan(9_000);
  srv.close();
}, 40_000);
