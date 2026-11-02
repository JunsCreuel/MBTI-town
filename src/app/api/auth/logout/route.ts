import { logout } from '@/server/auth';
import { handle } from '@/server/http';

export async function POST() {
  return handle(() => logout());
}
