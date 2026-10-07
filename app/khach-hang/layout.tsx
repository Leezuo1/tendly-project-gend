import React from 'react';
import { ShopProvider } from '@/components/shared/ShopProvider';
import { ToastProvider } from '@/components/shared/ToastProvider';
import './khach-hang.css';

/** Các trang xem trước "góc nhìn khách hàng" — không có sidebar quản trị */
export default function KhachHangLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="customer-root">
      <ToastProvider>
        <ShopProvider>{children}</ShopProvider>
      </ToastProvider>
    </div>
  );
}
