import React from 'react';
import { BRANDS } from '@/lib/data/landing';

export function BrandsSlider() {
  return (
    <section
      style={{
        padding: '48px 0',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-soft)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 32,
        }}
      >
        Hỗ trợ kết nối đa nền tảng cho shop online
      </div>
      <div
        style={{
          overflow: 'hidden',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
          maskImage:
            'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
        }}
      >
        <div
          className="brands-track"
          style={{
            display: 'flex',
            animation: 'marquee 25s linear infinite',
            width: 'max-content',
          }}
        >
          {[...Array(2)].flatMap((_, setIdx) =>
            BRANDS.map((b, i) => (
              <div
                key={`${setIdx}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 40px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: b.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 800,
                    color: 'white',
                  }}
                >
                  {b.letter}
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
