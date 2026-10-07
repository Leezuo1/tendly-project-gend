'use client';

import React, { useState } from 'react';
import { SEGMENT_STATS, CHIP_FILTERS, RFM_SEGMENTS } from '@/lib/data/marketing';

export function CustomerSegmentsTab() {
  const [selectedStatId, setSelectedStatId] = useState<string>('vip');
  const [selectedChip, setSelectedChip] = useState<string>('Tất cả');

  return (
    <div className="tab-panel active" id="tab-segments">
      {/* 4 Stat Cards */}
      <div className="stat-grid">
        {SEGMENT_STATS.map((stat) => (
          <div
            key={stat.id}
            className={`stat-card ${selectedStatId === stat.id ? 'selected' : ''}`}
            onClick={() => setSelectedStatId(stat.id)}
          >
            <div className="label">{stat.label}</div>
            <div className="value">{stat.value}</div>
            <div className="sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter by Intent */}
      <div className="card">
        <div className="card-head">
          <h2>Lọc theo nhóm &amp; ý định gần nhất</h2>
        </div>
        <div className="chip-row">
          {CHIP_FILTERS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`chip ${selectedChip === chip ? 'selected' : ''}`}
              onClick={() => setSelectedChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* RFM Distribution Table */}
      <div className="card">
        <div className="card-head">
          <h2>Phân bổ khách hàng theo nhóm RFM</h2>
        </div>
        {RFM_SEGMENTS.map((seg, i) => (
          <div key={i} className="seg-row">
            <div className={`seg-dot ${seg.dotClass}`}></div>
            <div className="seg-name">{seg.name}</div>
            <div className="seg-count">{seg.count} khách</div>
            <div className="seg-bar-wrap">
              <div
                className="seg-bar"
                style={{ width: `${seg.percentage}%`, background: seg.color }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
