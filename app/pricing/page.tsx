import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PricingClient from '@/components/PricingClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bảng giá — Tendly',
  description: 'Chọn gói Tendly phù hợp với quy mô shop của bạn — từ dùng thử miễn phí đến gói doanh nghiệp tùy chỉnh.',
};

const plans = [
  {
    eyebrow: 'MIỄN PHÍ',
    eyebrowStyle: { background: 'var(--sand)', color: 'var(--ink-soft)' },
    title: 'Dùng thử Tendly',
    desc: 'Trải nghiệm AI gom hội thoại và chăm sóc khách hàng cơ bản trước khi mở rộng.',
    price: '0',
    period: '/tháng',
    cta: 'Bắt đầu miễn phí',
    ctaVariant: 'ghost',
    features: [
      '500 email/tháng',
      '100 hội thoại AI CSKH/tháng',
      'Tối đa 500 tệp contacts',
      '1 người dùng',
    ],
    audience: 'Shop mới, dùng thử',
    isPopular: false,
  },
  {
    eyebrow: 'STARTER',
    eyebrowStyle: { background: 'var(--moss-soft)', color: 'var(--moss)' },
    title: 'Mở rộng vận hành',
    desc: 'Đủ hạn mức email và hội thoại AI cho shop nhỏ đã bắt đầu ổn định đơn hàng.',
    price: '299.000',
    period: '/tháng',
    cta: 'Chọn Starter',
    ctaVariant: 'primary',
    features: [
      '3.000 email/tháng',
      '500 hội thoại AI CSKH/tháng',
      'Tối đa 2.000 tệp contacts',
      '2 người dùng',
      'Vượt hạn mức: 150đ/email · 900đ/hội thoại',
    ],
    audience: 'Shop nhỏ, mới ổn định',
    isPopular: false,
  },
  {
    eyebrow: 'GROWTH',
    eyebrowStyle: { background: '#FCE4E2', color: 'var(--coral-deep)' },
    title: 'Tăng trưởng đều đơn',
    desc: 'Hạn mức lớn cho SME đã có tệp khách hàng ổn định, đúng đối tượng mục tiêu.',
    price: '799.000',
    period: '/tháng',
    cta: 'Chọn Growth',
    ctaVariant: 'primary',
    features: [
      '15.000 email/tháng',
      '3.000 hội thoại AI CSKH/tháng',
      'Tối đa 10.000 tệp contacts',
      '5 người dùng',
      'Vượt hạn mức: 90đ/email · 450đ/hội thoại',
    ],
    audience: 'SME đã có tệp khách, đúng ICP chính',
    isPopular: true,
  },
  {
    eyebrow: 'PRO',
    eyebrowStyle: { background: 'var(--ink)', color: 'var(--canvas)' },
    title: 'Sức mạnh không giới hạn',
    desc: 'Dành cho shop lớn, nhiều đơn mỗi ngày, cần hạn mức hội thoại và người dùng không giới hạn.',
    price: '1.990.000',
    period: '/tháng',
    cta: 'Chọn Pro',
    ctaVariant: 'primary',
    features: [
      '50.000 email/tháng',
      'Hội thoại AI CSKH không giới hạn',
      'Tối đa 30.000 tệp contacts',
      'Người dùng không giới hạn',
      'Vượt hạn mức: 60đ/email',
    ],
    audience: 'Shop lớn, nhiều đơn',
    isPopular: false,
  },
  {
    eyebrow: 'CUSTOM',
    eyebrowStyle: { background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' },
    title: 'Giải pháp riêng',
    desc: 'Cho agency quản lý nhiều shop, chuỗi thương hiệu, cần bảo mật và hạ tầng riêng.',
    priceCustom: 'Liên hệ báo giá',
    cta: 'Liên hệ tư vấn',
    ctaVariant: 'ghost',
    features: [
      'Email theo thỏa thuận',
      'Hội thoại AI CSKH không giới hạn',
      'Tệp contacts không giới hạn',
      'Người dùng không giới hạn, phân quyền theo phòng ban',
      'Vượt hạn mức theo thoả thuận hợp đồng',
    ],
    audience: 'Agency quản lý nhiều shop, chuỗi thương hiệu',
    isPopular: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* HERO HEADER */}
        <header style={{ padding: '64px 0 40px', textAlign: 'center' }}>
          <div className="wrap-wide">
            <div style={{ width: 48, height: 4, borderRadius: 4, background: 'var(--coral)', margin: '0 auto 20px' }}></div>
            <h1 style={{ fontSize: 'clamp(30px, 3.2vw, 46px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Chọn gói phù hợp cho shop của bạn
            </h1>
            <p style={{ marginTop: 14, fontSize: 16.5, color: 'var(--ink-soft)', maxWidth: 680, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Một AI duy nhất — tự động ra đơn, rảnh tay chăm sóc. Nâng cấp hoặc huỷ gói bất cứ lúc nào khi shop tăng trưởng.
            </p>
          </div>
        </header>

        {/* PRICING CARDS */}
        <section style={{ padding: '16px 0 96px', width: '100%' }}>
          <div className="wrap-wide">
            <div className="pricing-grid">
              {plans.map((plan, i) => (
                <div
                  key={i}
                  className={`pricing-card${plan.isPopular ? ' is-popular' : ''}`}
                  style={{
                    background: plan.isPopular
                      ? 'linear-gradient(180deg, #FFFDFD 0%, #FFFFFF 100%)'
                      : 'var(--paper)',
                    border: plan.isPopular ? '1px solid var(--coral)' : '1px solid var(--line)',
                    borderRadius: 20,
                    padding: '32px 26px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: plan.isPopular
                      ? '0 12px 32px rgba(240,106,106,0.16)'
                      : '0 4px 16px rgba(43,33,30,0.03)',
                  }}
                >
                  {/* Top bar */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    height: plan.isPopular ? 4 : 3,
                    background: 'var(--coral)',
                    transform: plan.isPopular ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left',
                    transition: 'transform 0.4s ease',
                  }} className="card-topbar"></div>

                  <span style={{ display: 'inline-block', alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 14, ...plan.eyebrowStyle }}>
                    {plan.eyebrow}
                  </span>

                  <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>{plan.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, minHeight: 52 }}>{plan.desc}</p>

                  <div style={{ margin: '18px 0 16px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    {plan.priceCustom ? (
                      <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{plan.priceCustom}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-soft)' }}>đ</span>
                        <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{plan.price}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{plan.period}</span>
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <a
                      href="/tong-quan"
                      style={{
                        background: plan.ctaVariant === 'primary' ? 'var(--coral)' : 'var(--sand)',
                        color: plan.ctaVariant === 'primary' ? 'white' : 'var(--ink)',
                        border: plan.ctaVariant === 'ghost-box' ? '1px solid var(--line)' : 'none',
                        padding: '13px 20px',
                        borderRadius: 9,
                        fontWeight: 700,
                        fontSize: 14.5,
                        cursor: 'pointer',
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      className={plan.ctaVariant === 'primary' ? 'plan-cta-primary' : 'plan-cta-ghost'}
                    >
                      {plan.cta}
                    </a>
                  </div>

                  <ul style={{ listStyle: 'none', margin: '20px 0 4px', flex: 1 }}>
                    {plan.features.map((feat, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: '#FCE4E2', color: 'var(--coral-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, marginTop: 1 }}>✓</span>
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--ink)', fontWeight: 700 }}>Phù hợp:</b> {plan.audience}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ marginTop: 40, textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>
              Cần thêm chi tiết về Tendly?{' '}
              <a href="/" style={{ color: 'var(--coral-deep)', fontWeight: 600 }}>Quay lại trang chủ</a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <PricingClient />

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
    </>
  );
}
