import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { LiveMiniPage } from '@/components/features/livestream/LiveMiniPage';

export const metadata: Metadata = {
  title: 'Tendly Live',
  description: 'Cửa sổ nhỏ hỗ trợ người bán trong lúc livestream.',
};

/** Bản dự phòng của cửa sổ nổi: mở bằng popup hoặc trên điện thoại đặt cạnh máy đang live. */
export default function LiveMiniRoute() {
  return (
    <Suspense fallback={<div className="live-mini-root" />}>
      <LiveMiniPage />
    </Suspense>
  );
}
