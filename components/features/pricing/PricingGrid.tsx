import React from 'react';
import Link from 'next/link';
import { PRICING_PLANS } from '@/lib/data/pricing';
import { PricingCard } from './PricingCard';

export function PricingGrid() {
  return (
    <section style={{ padding: '16px 0 96px', width: '100%' }}>
      <div className="wrap-wide">
        <div className="pricing-grid">
          {PRICING_PLANS.map((plan, i) => (
            <PricingCard key={i} plan={plan} />
          ))}
        </div>

        <p style={{ marginTop: 40, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
          Cần thêm chi tiết về Tendly?{' '}
          <Link href="/" style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>
            Quay lại trang chủ
          </Link>
        </p>
      </div>

      <style>{`
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 22px;
          align-items: stretch;
          width: 100%;
        }
        .pricing-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .pricing-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 40px rgba(43, 33, 30, 0.1) !important;
          border-color: var(--coral) !important;
        }
        .pricing-card:hover .card-topbar {
          transform: scaleX(1) !important;
        }
        .plan-cta-primary:hover {
          background: var(--coral-deep) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(240, 106, 106, 0.35);
        }
        .plan-cta-ghost:hover {
          background: var(--line) !important;
          transform: translateY(-2px);
        }
        @media (max-width: 1280px) {
          .pricing-grid {
            grid-template-columns: repeat(6, 1fr);
            gap: 20px;
          }
          .pricing-card:nth-child(1) { grid-column: 1 / span 2; }
          .pricing-card:nth-child(2) { grid-column: 3 / span 2; }
          .pricing-card:nth-child(3) { grid-column: 5 / span 2; }
          .pricing-card:nth-child(4) { grid-column: 2 / span 2; }
          .pricing-card:nth-child(5) { grid-column: 4 / span 2; }
        }
        @media (max-width: 860px) {
          .pricing-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
          }
          .pricing-card:nth-child(1),
          .pricing-card:nth-child(2),
          .pricing-card:nth-child(3),
          .pricing-card:nth-child(4) { grid-column: auto; }
          .pricing-card:nth-child(5) {
            grid-column: 1 / span 2;
            max-width: 500px;
            margin: 0 auto;
            width: 100%;
          }
        }
        @media (max-width: 580px) {
          .pricing-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .pricing-card:nth-child(5) {
            grid-column: auto;
            max-width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
