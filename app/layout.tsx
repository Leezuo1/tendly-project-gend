import type { Metadata } from "next";
import localFont from 'next/font/local';
import "./globals.css";
import { AppSecurityProvider } from '@/components/shared/AppSecurityProvider';

const rem = localFont({ src: '../public/landing/fonts/REM.ttf', weight: '100 900', display: 'swap', variable: '--font-tendly' });

export const metadata: Metadata = {
  title: "Tendly — Nền tảng chăm sóc khách hàng AI cho shop online",
  description: "Tendly — Your AI teammate for every customer. Quản lý tin nhắn từ các nền tảng mạng xã hội, gợi ý phản hồi theo sản phẩm và FAQ, soạn nội dung bán hàng cùng AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={rem.variable}>
      <body><AppSecurityProvider>{children}</AppSecurityProvider></body>
    </html>
  );
}
