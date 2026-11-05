import { currentUser } from '@/server/auth';
import { handle } from '@/server/http';
import { getSceneService } from '@/server/scene';

/** 메일 인증 처리 (운영자만): 인증 메일을 못 받은 계정을 인증한 것으로 바꾼다 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getSceneService()).adminConfirmSignup(await currentUser(), (await params).id));
}

/** 주민 등록 전 계정 지우기 (운영자만, 같은 주소로 다시 가입하게) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => (await getSceneService()).adminDeleteSignup(await currentUser(), (await params).id));
}
