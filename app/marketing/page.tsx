import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/features/marketing/MarketingShell';
import './marketing.css';
import './post-composer.css';
import './facebook-comments.css';
import './facebook-posts.css';
import './marketing-workspace.css';

export const metadata: Metadata = {
  title: 'Marketing — Tendly',
  description: 'Lập chiến dịch, soạn và rà soát nội dung, duyệt bài, xếp lịch và chăm sóc khách từ Fanpage.',
};

export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="marketing-root" style={{ padding: 40 }}>Đang tải Marketing...</div>}>
      <MarketingShell />
    </Suspense>
  );
}
