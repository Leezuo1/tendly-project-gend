import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Lora:ital,wght@0,500;0,600;1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
