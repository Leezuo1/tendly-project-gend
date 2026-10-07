import type { Metadata } from 'next';
import { HandoffPreview } from '@/components/features/customer/HandoffPreview';

export const metadata: Metadata = {
  title: 'Chuyển tiếp nhân viên — Tendly',
  description: 'Xem trước luồng chuyển tiếp sang nhân viên thật khi khách bức xúc.',
};

export default function ChuyenTiepPage() {
  return <HandoffPreview />;
}
