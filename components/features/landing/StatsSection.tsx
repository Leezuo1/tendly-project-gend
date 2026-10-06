import React from 'react';
import { STATS } from '@/lib/data/landing';
import { StatsClient } from './StatsClient';

export function StatsSection() {
  return (
    <section className="section" style={{ background: 'var(--sand)' }}>
      <div className="wrap">
        <StatsClient stats={STATS} />
      </div>
    </section>
  );
}
