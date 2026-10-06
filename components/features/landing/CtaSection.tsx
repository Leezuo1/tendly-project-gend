import React from 'react';
import Link from 'next/link';

export function CtaSection() {
  return (
    <section className="section cta-section" id="cta" style={{ padding: '96px 0' }}>
      <div className="wrap">
        <div
          className="cta-final reveal-scale"
          style={{
            background: 'linear-gradient(145deg, #FFFFFF 0%, #FAF6F1 50%, #F1EAE3 100%)',
            color: 'var(--ink)',
            border: '1.5px solid var(--line)',
            borderRadius: 28,
            padding: '76px 52px 68px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(43,33,30,0.08)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background:
                'radial-gradient(circle at 12% 18%, rgba(240,106,106,0.1) 0%, transparent 45%), radial-gradient(circle at 88% 82%, rgba(75,99,88,0.08) 0%, transparent 45%)',
              pointerEvents: 'none',
            }}
          ></div>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(240,106,106,0.22) 0%, transparent 70%)',
                filter: 'blur(8px)',
              }}
            ></div>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: '#FCE4E2',
                border: '1px solid rgba(240,106,106,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--coral-deep)',
                position: 'relative',
                zIndex: 2,
                boxShadow: '0 8px 20px rgba(240,106,106,0.15)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                <polyline points="9 9 12 12 15 9"></polyline>
              </svg>
            </div>
          </div>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 800,
              maxWidth: 680,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: '0 auto 16px',
              position: 'relative',
              zIndex: 2,
            }}
          >
            Chăm Sóc Khách Hàng Bằng AI: Tự Động, Cá Nhân Hoá, Đo Lường Được.
          </h2>
          <p
            style={{
              fontSize: 16.5,
              color: 'var(--ink-soft)',
              maxWidth: 500,
              margin: '0 auto 34px',
              lineHeight: 1.6,
              position: 'relative',
              zIndex: 2,
            }}
          >
            Bắt đầu gom hội thoại, để AI trả lời và chăm sóc khách tự động ngay hôm nay.
          </p>
          <Link
            href="/tong-quan"
            className="btn-primary"
            style={{
              fontSize: 16.5,
              fontWeight: 700,
              padding: '17px 36px',
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 10px 30px rgba(240,106,106,0.38)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <span>Bắt đầu ngay</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 22,
              position: 'relative',
              zIndex: 2,
            }}
          >
            {[
              { icon: '💳', text: 'Không cần thẻ tín dụng' },
              { icon: '⏱', text: 'Kết nối trong 2 phút' },
              { icon: '🛡', text: 'Huỷ bất cứ lúc nào' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: 'var(--ink-soft)',
                  fontWeight: 500,
                }}
              >
                {i > 0 && <span style={{ color: '#D8CDC4' }}>•</span>}
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
