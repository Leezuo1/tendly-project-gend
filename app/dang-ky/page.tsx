import type { Metadata } from 'next';
import { AuthScreen } from '@/components/features/auth/AuthScreen';

export const metadata: Metadata = {
  title: 'Tạo tài khoản | Tendly',
  description: 'Bắt đầu chăm sóc khách hàng cùng Tendly.',
};

export default function DangKyPage() {
  return <AuthScreen mode="register" />;
}
