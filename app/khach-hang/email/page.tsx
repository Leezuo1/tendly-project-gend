import type { Metadata } from 'next';
import { EmailInbox } from '@/components/features/customer/EmailInbox';

export const metadata: Metadata = {
  title: 'Email cá nhân hóa — Tendly',
  description: 'Xem trước email cá nhân hóa khách hàng nhận được trong hộp thư.',
};

export default function EmailCaNhanHoaPage() {
  return <EmailInbox />;
}
