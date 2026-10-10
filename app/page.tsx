import type { Metadata } from 'next';
import { LandingPage } from '@/components/features/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Tendly — Your AI teammate for every customer',
  description: 'Đồng đội AI cho shop online: quản lý tin nhắn từ các nền tảng mạng xã hội, hiểu cảm xúc khách hàng, gợi ý từ sản phẩm và FAQ, soạn nội dung bán hàng và đăng Fanpage.',
};

export default function HomePage() {
  return <LandingPage />;
}
