import React from 'react';
import { STEPS } from '@/lib/data/landing';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function HowItWorksSection() {
  return (
    <section className="section" id="steps" style={{ background: 'var(--canvas)' }}>
      <div className="wrap">
        <SectionHeader
          title="Cách hoạt động"
          subtitle="Bắt đầu trong 5 phút. Không cần cài đặt phức tạp, không cần đổi quy trình hiện tại của shop."
        />
        <div
          className="steps stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            borderTop: '1px solid var(--line)',
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="step reveal"
              style={{
                padding: '36px 32px 36px 0',
                borderRight: i < STEPS.length - 1 ? '1px solid var(--line)' : 'none',
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--coral)',
                  marginBottom: 18,
                }}
              >
                {step.num}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
