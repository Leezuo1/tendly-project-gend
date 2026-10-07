import React from 'react';
import Link from 'next/link';
import { PricingPlan } from '@/lib/types/pricing';

interface PricingCardProps {
  plan: PricingPlan;
}

export function PricingCard({ plan }: PricingCardProps) {
  return (
    <div
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
      {/* Top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: plan.isPopular ? 4 : 3,
          background: 'var(--coral)',
          transform: plan.isPopular ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 0.4s ease',
        }}
        className="card-topbar"
      ></div>

      <span
        style={{
          display: 'inline-block',
          alignSelf: 'flex-start',
          padding: '5px 12px',
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          marginBottom: 14,
          ...plan.eyebrowStyle,
        }}
      >
        {plan.eyebrow}
      </span>

      <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>
        {plan.title}
      </h3>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, minHeight: 52 }}>
        {plan.desc}
      </p>

      <div style={{ margin: '18px 0 16px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {plan.priceCustom ? (
          <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {plan.priceCustom}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-soft)' }}>đ</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              {plan.price}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{plan.period}</span>
          </>
        )}
      </div>

      <div style={{ marginBottom: 4 }}>
        <Link
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
        </Link>
      </div>

      <ul style={{ listStyle: 'none', margin: '20px 0 4px', flex: 1 }}>
        {plan.features.map((feat, fi) => (
          <li
            key={fi}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 0',
              fontSize: 13.5,
              color: 'var(--ink-soft)',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: 5,
                background: '#FCE4E2',
                color: 'var(--coral-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
                marginTop: 1,
              }}
            >
              ✓
            </span>
            {feat}
          </li>
        ))}
      </ul>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
          fontSize: 12.5,
          color: 'var(--ink-soft)',
          lineHeight: 1.5,
        }}
      >
        <b style={{ color: 'var(--ink)', fontWeight: 700 }}>Phù hợp:</b> {plan.audience}
      </div>
    </div>
  );
}
