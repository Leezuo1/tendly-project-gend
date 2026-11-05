import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { AiConfigShell } from '@/components/features/ai-config/AiConfigShell';
import '@/components/features/admin/admin-shell.css';
import './cau-hinh-ai.css';

export const metadata: Metadata = {
  title: 'Cấu hình AI — Tendly',
  description: 'Thiết lập mục tiêu, văn phong, nguồn tri thức và cách phối hợp năm vai trò AI.',
};

export default async function CauHinhAiPage({ searchParams }: { searchParams: Promise<{ tab?: string; shopee?: string }> }) {
  const params = await searchParams;
  if (params.tab && ['products', 'faq', 'email'].includes(params.tab)) {
    const query = new URLSearchParams({ tab: params.tab });
    if (params.shopee === 'connected') query.set('shopee', 'connected');
    redirect(`/cai-dat?${query}`);
  }
  return (
    <AdminShell currentPath="cau-hinh-ai">
      <Suspense fallback={<div style={{ padding: 40 }}>Đang tải Cấu hình AI...</div>}>
        <AiConfigShell />
      </Suspense>
    </AdminShell>
  );
}
