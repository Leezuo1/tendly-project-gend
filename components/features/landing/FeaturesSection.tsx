import React from 'react';
import { SIDE_FEATURE_CARDS } from '@/lib/data/landing';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function FeaturesSection() {
  return (
    <section className="section" id="features" style={{ background: 'var(--sand)' }}>
      <div className="wrap">
        <SectionHeader
          title="Ba việc Tendly làm thay bạn"
          subtitle="Không phải công cụ riêng lẻ — cùng một luồng dữ liệu khách hàng chảy xuyên suốt cả ba."
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          {/* Main feature box */}
          <div
            className="feat-main reveal-left"
            style={{
              background: 'var(--ink)',
              color: 'var(--canvas)',
              borderRadius: 20,
              padding: 40,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 340,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 700, maxWidth: 360, lineHeight: 1.3 }}>
                Hộp thoại hợp nhất — quản lý mọi kênh trong 1 màn hình
              </h3>
              <p
                style={{
                  marginTop: 14,
                  color: '#D8D0CB',
                  fontSize: 15,
                  maxWidth: 360,
                  lineHeight: 1.6,
                }}
              >
                Facebook, TikTok, Zalo — mọi tin nhắn, bình luận gom về một nơi. AI phân loại cảm xúc, xếp ưu tiên, gắn nhãn tự động để bạn không bỏ sót khách quan trọng.
              </p>
            </div>
            <a
              href="#details"
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 10,
                padding: '11px 20px',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                width: 'fit-content',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 24,
                textDecoration: 'none',
              }}
            >
              <span>Xem chi tiết</span>
              <span>→</span>
            </a>
          </div>

          {/* Side feature cards */}
          <div
            className="feat-side stagger"
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            {SIDE_FEATURE_CARDS.map((card, i) => (
              <div
                key={i}
                className="feat-card reveal"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 20,
                  padding: 32,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: card.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    fontSize: 18,
                  }}
                >
                  {card.icon}
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{card.title}</h4>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
