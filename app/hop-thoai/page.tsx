import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { InboxShell } from '@/components/features/inbox/InboxShell';
import './hop-thoai.css';

export const metadata: Metadata = {
  title: 'Hộp thoại — Tendly',
  description: 'Toàn bộ hội thoại từ Messenger & Zalo OA, gom về 1 nơi và xếp theo mức độ ưu tiên.',
};

export default function HopThoaiPage() {
  return (
    <Suspense
      fallback={
        <div className="inbox-root" style={{ padding: 40, textAlign: 'center' }}>
          Đang tải Hộp thoại...
        </div>
      }
    >
      <InboxShell />
    </Suspense>
  );
}
