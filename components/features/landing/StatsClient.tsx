'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Stat } from '@/lib/types/landing';

export function StatsClient({ stats }: { stats: Stat[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<number[]>(stats.map(() => 0));
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const startTime = performance.now();
            const duration = 2000;

            function animate(currentTime: number) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);

              setCounts(
                stats.map((s) => {
                  if (progress >= 1) return s.target;
                  return Math.floor(eased * s.target);
                })
              );

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            }

            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [stats]);

  return (
    <div
      ref={containerRef}
      className="stats-grid stagger"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 24,
        textAlign: 'center',
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="stat-item reveal"
          style={{ padding: '32px 16px', borderRadius: 16 }}
        >
          <div
            className="stat-number"
            data-target={s.target}
            style={{
              fontSize: 44,
              fontWeight: 900,
              color: 'var(--coral)',
              lineHeight: 1.1,
              marginBottom: 6,
            }}
          >
            {s.target >= 1000
              ? (counts[i] || 0).toLocaleString('vi-VN') + (counts[i] === s.target ? '+' : '')
              : s.num.includes('%')
              ? `${counts[i] || 0}%`
              : counts[i] || 0}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 500 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
