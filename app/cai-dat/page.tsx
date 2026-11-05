import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { SettingsShell } from '@/components/features/settings/SettingsShell';
import { redirect } from 'next/navigation';
import '@/components/features/admin/admin-shell.css';
import '../cau-hinh-ai/cau-hinh-ai.css';
import './cai-dat.css';

export const metadata: Metadata = {
  title: 'Cài đặt — Tendly',
  description: 'Quản lý shop, kênh kết nối, sản phẩm, FAQ và gắn thẻ theo ngữ cảnh.',
};

export default async function CaiDatPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if ((await searchParams).tab === 'email') redirect('/cai-dat?tab=tags');
  return (
    <AdminShell currentPath="cai-dat">
      <Suspense fallback={<div style={{ padding: 40 }}>Đang tải Cài đặt...</div>}>
        <SettingsShell />
      </Suspense>
    </AdminShell>
  );
}
