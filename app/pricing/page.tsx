import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PricingClient from '@/components/PricingClient';
import { PricingGrid } from '@/components/features/pricing/PricingGrid';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bảng giá — Tendly',
  description:
    'Chọn gói Tendly phù hợp với quy mô shop của bạn — từ dùng thử miễn phí đến gói doanh nghiệp tùy chỉnh.',
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* HERO HEADER */}
        <header style={{ padding: '64px 0 40px', textAlign: 'center' }}>
          <div className="wrap-wide">
            <div
              style={{
                width: 48,
                height: 4,
                borderRadius: 4,
                background: 'var(--coral)',
                margin: '0 auto 20px',
              }}
            ></div>
            <h1
              style={{
                fontSize: 'clamp(30px, 3.2vw, 46px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Chọn gói phù hợp cho shop của bạn
            </h1>
            <p
              style={{
                marginTop: 14,
                fontSize: 16.5,
                color: 'var(--ink-soft)',
                maxWidth: 680,
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.6,
              }}
            >
              Một AI duy nhất — tự động ra đơn, rảnh tay chăm sóc. Nâng cấp hoặc huỷ gói bất cứ lúc
              nào khi shop tăng trưởng.
            </p>
          </div>
        </header>

        {/* PRICING CARDS */}
        <PricingGrid />
      </main>
      <Footer />
      <PricingClient />
    </>
  );
}
