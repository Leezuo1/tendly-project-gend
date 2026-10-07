import React from 'react';
import { BENTO_ITEMS } from '@/lib/data/landing';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function BentoSection() {
  return (
    <section className="section" style={{ background: 'var(--canvas)' }}>
      <div className="wrap">
        <SectionHeader
          title="Và còn nhiều tính năng nữa..."
          subtitle="Mỗi tính năng được thiết kế cho người bán hàng online Việt Nam."
        />
        <div
          className="feat-bento stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
        >
          {BENTO_ITEMS.map((item, i) => (
            <div
              key={i}
              className="feat-item reveal"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 20,
                padding: '36px 32px',
                gridColumn: item.span === 2 ? 'span 2' : undefined,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: item.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                  fontSize: 22,
                }}
              >
                {item.icon}
              </div>
              {item.tag && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 14,
                    background: item.tagBg,
                    color: item.tagColor,
                  }}
                >
                  {item.tag}
                </span>
              )}
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{item.title}</h3>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
