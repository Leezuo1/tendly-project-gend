import type { Metadata } from 'next';
import { AuthScreen } from '@/components/features/auth/AuthScreen';

export const metadata: Metadata = {
  title: 'Đăng nhập | Tendly',
  description: 'Trở lại không gian chăm sóc khách hàng của bạn trên Tendly.',
};

export default function DangNhapPage() {
  return <AuthScreen mode="login" />;
}
