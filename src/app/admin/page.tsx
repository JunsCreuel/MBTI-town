import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminClient } from '@/components/admin/AdminClient';
import { currentUser } from '@/server/auth';
import { getSceneService } from '@/server/scene';

export const metadata: Metadata = { title: '운영 · SCENE', robots: { index: false, follow: false } };

/** 운영 화면: 운영자 계정에만 보인다. 그 밖의 사람에게는 없는 주소처럼 404 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user || !(await (await getSceneService()).isAdminViewer(user))) notFound();
  return <AdminClient />;
}
