import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { SettingsShell } from '@/components/features/settings/SettingsShell';
import '@/components/features/admin/admin-shell.css';
import '../cau-hinh-ai/cau-hinh-ai.css';
import './cai-dat.css';

export const metadata: Metadata = {
  title: 'Cài đặt — Tendly',
  description: 'Quản lý shop, kênh kết nối, sản phẩm, FAQ và email tự động.',
};

export default function CaiDatPage() {
  return (
    <AdminShell currentPath="cai-dat">
      <Suspense fallback={<div style={{ padding: 40 }}>Đang tải Cài đặt...</div>}>
        <SettingsShell />
      </Suspense>
    </AdminShell>
  );
}
