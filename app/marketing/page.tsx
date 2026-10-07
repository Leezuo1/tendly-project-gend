import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/features/marketing/MarketingShell';
import './marketing.css';

export const metadata: Metadata = {
  title: 'Marketing — Tendly',
  description: 'Duyệt nội dung remarketing do AI đề xuất và theo dõi hiệu suất so với cách làm cũ.',
};

export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="marketing-root" style={{ padding: 40 }}>Đang tải Marketing...</div>}>
      <MarketingShell />
    </Suspense>
  );
}
