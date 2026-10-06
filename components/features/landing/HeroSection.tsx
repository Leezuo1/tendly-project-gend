import React from 'react';
import Link from 'next/link';
import { HERO_CONVERSATIONS } from '@/lib/data/landing';

export function HeroSection() {
  return (
    <section className="hero" style={{ padding: '96px 0 88px', position: 'relative', overflow: 'hidden' }}>
      <div
        className="wrap"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.08fr 0.92fr',
          gap: '52px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div className="hero-content">
          <div className="hero-quote-box reveal">
            <h1
              style={{
                fontSize: 'clamp(34px, 4vw, 46px)',
                lineHeight: 1.15,
                fontWeight: 800,
                letterSpacing: '-0.025em',
                maxWidth: 580,
              }}
            >
              Một AI duy nhất — <span style={{ color: 'var(--coral)' }}>Tự động ra đơn</span>, rảnh tay chăm sóc.
            </h1>
          </div>
          <div
            className="quote-card reveal"
            style={{
              transitionDelay: '0.16s',
              marginTop: 22,
              maxWidth: 520,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--line)',
              borderLeft: '3.5px solid var(--coral)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              boxShadow: '0 6px 20px rgba(43,33,30,0.05)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#FCE4E2',
                color: 'var(--coral-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <p
              style={{
                fontSize: 15,
                color: 'var(--ink-soft)',
                lineHeight: 1.55,
                fontStyle: 'italic',
                letterSpacing: '-0.01em',
              }}
            >
              Turn clicks into sales, customer queries into smiles —{' '}
              <span style={{ color: 'var(--coral-deep)', fontWeight: 700, fontStyle: 'normal' }}>
                on full autopilot.
              </span>
            </p>
          </div>
          <div
            className="hero-ctas reveal"
            style={{
              transitionDelay: '0.24s',
              marginTop: 32,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/tong-quan" className="btn-primary">
              <span>Đăng ký / Đăng nhập</span>
              <svg
                width="16"
                height="16"
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
            <a href="#steps" className="btn-ghost">
              Xem cách hoạt động
            </a>
          </div>
          <div
            className="reveal"
            style={{
              transitionDelay: '0.32s',
              marginTop: 20,
              fontSize: 13.5,
              color: 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: 'var(--moss)', fontWeight: 700 }}>✓</span>
            Kết nối kênh trong 2 phút — không cần biết lập trình
          </div>
        </div>

        {/* HERO MOCKUP */}
        <div
          className="mock"
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            boxShadow: '0 24px 48px -24px rgba(43,33,30,0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink-soft)',
            }}
          >
            <span>HỘP THOẠI HỢP NHẤT</span>
            <span
              style={{
                background: 'var(--coral)',
                color: 'white',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
              }}
            >
              3 mới
            </span>
          </div>
          {HERO_CONVERSATIONS.map((r, i) => (
            <div
              key={i}
              className="mock-row"
              style={{
                display: 'flex',
                gap: 14,
                padding: '16px 20px',
                borderBottom: i < HERO_CONVERSATIONS.length - 1 ? '1px solid var(--sand)' : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: r.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  color: r.color,
                }}
              >
                {r.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 20,
                      background:
                        r.tagClass === 'tag-high'
                          ? '#FCE4E2'
                          : r.tagClass === 'tag-return'
                          ? 'var(--moss-soft)'
                          : 'var(--sand)',
                      color:
                        r.tagClass === 'tag-high'
                          ? 'var(--coral-deep)'
                          : r.tagClass === 'tag-return'
                          ? 'var(--moss)'
                          : 'var(--ink-soft)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.tag}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'var(--ink-soft)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.msg}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-soft)',
                    marginTop: 6,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: r.dotColor,
                      display: 'inline-block',
                    }}
                  ></span>
                  {r.channel}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
