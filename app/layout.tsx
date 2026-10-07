import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tendly — Nền tảng chăm sóc khách hàng AI cho shop online",
  description: "Tendly: Một AI duy nhất — Tự động ra đơn, rảnh tay chăm sóc. Turn clicks into sales, customer queries into smiles — on full autopilot.",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
