import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { DashboardShell } from '@/components/features/dashboard/DashboardShell';
import './tong-quan.css';

export const metadata: Metadata = {
  title: 'Tổng quan — Tendly Dashboard',
  description: 'Bảng điều khiển và theo dõi hoạt động chăm sóc khách hàng tự động với AI.',
};

export default function TongQuanPage() {
  return (
    <Suspense fallback={<div className="dashboard-root" style={{ padding: 40 }}>Đang tải bảng điều khiển...</div>}>
      <DashboardShell />
    </Suspense>
  );
}
