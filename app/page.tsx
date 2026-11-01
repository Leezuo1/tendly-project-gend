import type { Metadata } from 'next';
import { LandingPage } from '@/components/features/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Tendly — Your AI teammate for every customer',
  description: 'Đồng đội AI đa năng cho shop online: chăm sóc khách hàng, hỗ trợ livestream, soạn nội dung marketing và tư vấn bán hàng. Từ tìm nguồn hàng đến chăm sóc sau mua, cùng một đồng đội hiểu shop.',
};

export default function HomePage() {
  return <LandingPage />;
}
