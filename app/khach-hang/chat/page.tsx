import type { Metadata } from 'next';
import { ChatPreview } from '@/components/features/customer/ChatPreview';

export const metadata: Metadata = {
  title: 'Khung chat khách hàng — Tendly',
  description: 'Xem trước khung chat trên website / Fanpage từ góc nhìn của khách hàng.',
};

export default function ChatKhachHangPage() {
  return <ChatPreview />;
}
