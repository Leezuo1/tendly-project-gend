import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { AiConfigShell } from '@/components/features/ai-config/AiConfigShell';
import '@/components/features/admin/admin-shell.css';
import './cau-hinh-ai.css';

export const metadata: Metadata = {
  title: 'Cấu hình AI — Tendly',
  description: 'Dạy AI hiểu sản phẩm, câu hỏi thường gặp và kịch bản email tự động.',
};

export default function CauHinhAiPage() {
  return (
    <AdminShell currentPath="cau-hinh-ai">
      <Suspense fallback={<div style={{ padding: 40 }}>Đang tải Cấu hình AI...</div>}>
        <AiConfigShell />
      </Suspense>
    </AdminShell>
  );
}
