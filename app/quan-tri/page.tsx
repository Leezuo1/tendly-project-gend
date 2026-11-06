import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { SecurityPanel } from '@/components/features/settings/SecurityPanel';

export const metadata: Metadata = { title: 'Quản trị bảo mật — Tendly' };
export default function SecurityPage() {
  return <AdminShell currentPath="quan-tri"><Suspense fallback={<p role="status">Đang tải quản trị…</p>}><SecurityPanel /></Suspense></AdminShell>;
}
