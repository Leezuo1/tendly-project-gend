import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ShopProvider } from './components/ShopContext';
import { ToastProvider } from './components/Toast';
import CauHinhAiPage from './pages/admin/ai-config/CauHinhAiPage';
import PlaceholderPage from './pages/admin/PlaceholderPage';
import CaiDatPage from './pages/admin/settings/CaiDatPage';
import ChatKhachHangPage from './pages/customer/ChatKhachHangPage';
import ChuyenTiepPage from './pages/customer/ChuyenTiepPage';
import EmailCaNhanHoaPage from './pages/customer/EmailCaNhanHoaPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ShopProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/cau-hinh-ai" replace />} />
              <Route path="tong-quan" element={<PlaceholderPage title="Tổng quan" desc="Số liệu hội thoại, đơn hàng và hiệu quả AI." />} />
              <Route path="hop-thoai" element={<PlaceholderPage title="Hộp thoại" desc="Tin nhắn từ mọi kênh gom về một nơi." />} />
              <Route path="marketing" element={<PlaceholderPage title="Marketing" desc="Chiến dịch và tệp khách hàng." />} />
              <Route path="cau-hinh-ai" element={<CauHinhAiPage />} />
              <Route path="cai-dat" element={<CaiDatPage />} />
            </Route>

            {/* Góc nhìn khách hàng — không có sidebar */}
            <Route path="khach-hang/chat" element={<ChatKhachHangPage />} />
            <Route path="khach-hang/chuyen-tiep" element={<ChuyenTiepPage />} />
            <Route path="khach-hang/email" element={<EmailCaNhanHoaPage />} />

            <Route path="*" element={<Navigate to="/cau-hinh-ai" replace />} />
          </Routes>
        </ShopProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
