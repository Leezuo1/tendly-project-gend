import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { LivestreamShell } from '@/components/features/livestream/LivestreamShell';
import '../marketing/marketing.css';
import '../marketing/post-composer.css';
import './livestream.css';

export const metadata: Metadata = {
  title: 'Livestream — Tendly',
  description: 'Trợ lý livestream: gom bình luận, giữ đơn, nhắn riêng cho khách sau khi shop duyệt.',
};

export default function LivestreamPage() {
  return (
    <Suspense fallback={<div className="marketing-root" style={{ padding: 40 }}>Đang tải Livestream...</div>}>
      <LivestreamShell />
    </Suspense>
  );
}
