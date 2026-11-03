import type { Metadata } from 'next';
import { AdminClient } from '@/components/admin/AdminClient';

export const metadata: Metadata = { title: '운영 · SCENE', robots: { index: false } };

export default function AdminPage() {
  return <AdminClient />;
}
