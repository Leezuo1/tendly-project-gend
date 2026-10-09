'use client';

import React, { useMemo, useState } from 'react';
import { CustomerAvatar } from '@/components/features/inbox/CustomerAvatar';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { marketingClient } from '@/lib/services/marketingClient';
import type { ActivitySegment, MarketingCustomer } from '@/lib/types/marketing';
import { initials, relativeTime } from '@/lib/utils/format';
import { MarketingDataNotice } from './MarketingDataNotice';

const SEGMENTS: { id: ActivitySegment; label: string; sub: string; color: string; dotClass: string }[] = [
  { id: 'new', label: '🆕 Mới', sub: 'Nhắn lần đầu trong 7 ngày', color: '#8FA7C7', dotClass: 'seg-new' },
  { id: 'active', label: '💚 Đang tương tác', sub: 'Có nhắn trong 7 ngày qua', color: 'var(--moss)', dotClass: 'seg-loyal' },
  { id: 'quiet', label: '💤 Ít tương tác', sub: 'Im lặng 7–30 ngày', color: 'var(--amber)', dotClass: 'seg-vip' },
  { id: 'risk', label: '⚠️ Sắp rời bỏ', sub: 'Không nhắn lại > 30 ngày', color: 'var(--coral)', dotClass: 'seg-risk' },
];

const FILTERS: { id: string; label: string; match: (c: MarketingCustomer) => boolean }[] = [
  { id: 'all', label: 'Tất cả', match: () => true },
  { id: 'waiting', label: 'Đang chờ shop trả lời', match: (c) => c.waitingReply },
  { id: 'asked', label: 'Đã hỏi sản phẩm / giá', match: (c) => c.askedProduct },
  { id: 'complained', label: 'Có từ ngữ phàn nàn', match: (c) => c.complained },
  { id: 'reachable', label: 'Nhắn được (trong 24 giờ)', match: (c) => c.canMessageUntil !== null },
];

const segmentLabel = (id: ActivitySegment) => SEGMENTS.find((s) => s.id === id)?.label ?? id;

export function CustomerSegmentsTab() {
  const { data, error, loading, reload } = useMarketingData(marketingClient.customers);
  const [segment, setSegment] = useState<ActivitySegment | null>(null);
  const [filter, setFilter] = useState('all');

  const customers = useMemo(() => data?.customers ?? [], [data]);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.id, customers.filter((c) => c.segment === s.id).length])), [customers]);
  const match = FILTERS.find((f) => f.id === filter)?.match ?? (() => true);
  const shown = customers.filter((c) => (!segment || c.segment === segment) && match(c));

  if (error) return <div className="tab-panel active" id="tab-segments"><MarketingDataNotice error={error} onRetry={reload} /></div>;

  return (
    <div className="tab-panel active" id="tab-segments">
      <div className="stat-grid">
        {SEGMENTS.map((s) => (
          <div
            key={s.id}
            className={`stat-card ${segment === s.id ? 'selected' : ''}`}
            onClick={() => setSegment(segment === s.id ? null : s.id)}
          >
            <div className="label">{s.label}</div>
            <div className="value">{loading ? '…' : counts[s.id]}</div>
            <div className="sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Phân bổ khách theo mức độ tương tác</h2>
          <span className="hint">{loading ? 'Đang tải...' : `${customers.length} khách đã nhắn Fanpage`}</span>
        </div>
        <div className="card-desc">
          Shop chưa có dữ liệu đơn hàng nên khách được chia nhóm theo hoạt động nhắn tin Messenger (chưa phải RFM theo lượt mua).
        </div>
        {SEGMENTS.map((s) => (
          <div key={s.id} className="seg-row">
            <div className={`seg-dot ${s.dotClass}`}></div>
            <div className="seg-name">{s.label.replace(/^\S+\s/, '')}</div>
            <div className="seg-count">{counts[s.id] ?? 0} khách</div>
            <div className="seg-bar-wrap">
              <div
                className="seg-bar"
                style={{ width: `${customers.length ? Math.round(((counts[s.id] ?? 0) / customers.length) * 100) : 0}%`, background: s.color }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Danh sách khách</h2>
          <span className="hint">
            {segment ? `${segmentLabel(segment)} · ` : ''}{shown.length} khách
          </span>
        </div>
        <div className="chip-row">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`chip ${filter === f.id ? 'selected' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="pc-hint seg-hint">&ldquo;Đã hỏi sản phẩm&rdquo; và &ldquo;phàn nàn&rdquo; được dò theo từ khoá trong tin nhắn, có thể sót hoặc nhầm.</p>

        {!loading && shown.length === 0 && <div className="pc-empty">Không có khách nào khớp bộ lọc.</div>}
        {data && shown.map((c) => (
          <div key={c.psid} className="seg-customer">
            <CustomerAvatar className="approval-avatar" name={c.name} initials={initials(c.name)} url={c.avatarUrl ?? undefined} />
            <div className="seg-customer-body">
              <div className="approval-top">
                <span className="approval-name">{c.name}</span>
                <span className="approval-channel">{segmentLabel(c.segment)}</span>
                {c.waitingReply && <span className="tag tag-vip">⏳ Chờ trả lời</span>}
                {c.complained && <span className="tag tag-rfm">⚠️ Phàn nàn</span>}
              </div>
              <div className="approval-context">
                {c.lastInboundText ? <>&ldquo;{c.lastInboundText.slice(0, 160)}&rdquo;</> : 'Chưa có tin chữ'}
                {c.matchedProducts.length > 0 && <> · Hỏi: {c.matchedProducts.join(', ')}</>}
              </div>
            </div>
            <div className="approval-tail">
              <span className="approval-time">{c.lastInAt ? relativeTime(c.lastInAt, data.now) : '—'}</span>
              <span className="approval-time">{c.inboundCount} tin</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
