import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { HeroSection } from '@/components/features/landing/HeroSection';
import { BrandsSlider } from '@/components/features/landing/BrandsSlider';
import { StatsSection } from '@/components/features/landing/StatsSection';
import { HowItWorksSection } from '@/components/features/landing/HowItWorksSection';
import { FeaturesSection } from '@/components/features/landing/FeaturesSection';
import { BentoSection } from '@/components/features/landing/BentoSection';
import { DetailFeaturesSection } from '@/components/features/landing/DetailFeaturesSection';
import { CtaSection } from '@/components/features/landing/CtaSection';
import { LandingClient } from '@/components/features/landing/LandingClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tendly — Nền tảng chăm sóc khách hàng AI cho shop online',
  description:
    'Tendly: Một AI duy nhất — Tự động ra đơn, rảnh tay chăm sóc. Turn clicks into sales, customer queries into smiles — on full autopilot.',
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <BrandsSlider />
        <StatsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <BentoSection />
        <DetailFeaturesSection />
        <CtaSection />
      </main>
      <Footer />
      <LandingClient />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes rise { to { opacity: 1; transform: translateY(0); } }
        .mock {
          opacity: 0; transform: translateY(14px);
          animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.25s forwards;
        }
        .mock-row { transition: background 0.3s ease, transform 0.3s ease; }
        .mock-row:hover { background: var(--sand); transform: translateX(4px); }
        .step { transition: transform 0.3s ease; }
        .step:hover { transform: translateY(-4px); }
        .feat-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .feat-card:hover { transform: translateY(-5px); box-shadow: 0 12px 28px rgba(43,33,30,0.1); }
        .feat-item { transition: transform 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease; }
        .feat-item:hover { transform: translateY(-6px); border-color: var(--coral); box-shadow: 0 16px 36px rgba(43,33,30,0.1); }
        .stat-item { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .stat-item:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(43,33,30,0.08); }
        @media (max-width: 900px) {
          .hero .wrap, section[style*="gridTemplateColumns: 1.08fr"] .wrap { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
