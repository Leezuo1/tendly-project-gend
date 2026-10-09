'use client';

import React from 'react';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { marketingClient } from '@/lib/services/marketingClient';
import { formatNumber } from '@/lib/utils/format';
import { MarketingDataNotice } from './MarketingDataNotice';

const dateTime = (ts: number) => new Date(ts).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const count = (v: number | null) => (v === null ? '—' : formatNumber(v));
const hoursBetween = (from: number, to: number) => {
  const h = Math.round((to - from) / 3_600_000);
  return h < 1 ? 'dưới 1 giờ' : h < 48 ? `${h} giờ` : `${Math.round(h / 24)} ngày`;
};

/** Số liệu thật: tương tác bài trên Fanpage và tỉ lệ khách nhắn lại sau tin remarketing (chưa có đơn hàng nên chưa tính chuyển đổi). */
export function CampaignPerformanceTab() {
  const { data, error, loading, reload } = useMarketingData(marketingClient.performance);

  if (error) return <div className="tab-panel active" id="tab-performance"><MarketingDataNotice error={error} onRetry={reload} /></div>;

  const posts = data?.posts;
  const rmk = data?.remarketing;
  // Chỉ cộng bài Facebook đã trả số liệu; không có bài nào có số thì hiện "—" thay vì 0 gây hiểu nhầm.
  const measured = posts?.items.filter((p) => p.reactions !== null) ?? [];
  const engagement = measured.length
    ? formatNumber(measured.reduce((sum, p) => sum + (p.reactions ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0))
    : null;
  const replyRate = rmk && rmk.sent ? Math.round((rmk.replied / rmk.sent) * 1000) / 10 : null;
  const dash = loading ? '…' : '—';

  return (
    <div className="tab-panel active" id="tab-performance">
      <div className="kpi-grid kpi-grid-4">
        <div className="kpi-card">
          <div className="label">Bài đã đăng Fanpage</div>
          <div className="value">{posts ? posts.published : dash}</div>
          <div className="trend-note">{posts ? `${posts.drafts} bài nháp đang chờ` : ' '}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Tương tác trên Fanpage</div>
          <div className="value">{engagement ?? dash}</div>
          <div className="trend-note">Cảm xúc + bình luận + chia sẻ ({measured.length} bài có số liệu)</div>
        </div>
        <div className="kpi-card">
          <div className="label">Tin remarketing đã gửi</div>
          <div className="value">{rmk ? rmk.sent : dash}</div>
          <div className="trend-note">Gửi từ tab Hàng chờ duyệt</div>
        </div>
        <div className="kpi-card">
          <div className="label">Khách nhắn lại</div>
          <div className="value">{replyRate === null ? dash : `${String(replyRate).replace('.', ',')}%`}</div>
          <div className="trend-note">{rmk ? `${rmk.replied}/${rmk.sent} khách nhắn lại trong 7 ngày` : ' '}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Bài đã đăng lên Fanpage</h2>
          <span className="hint">Số liệu lấy trực tiếp từ Facebook</span>
        </div>
        {posts?.insightsError && <div className="pc-notice"><b>{posts.insightsError}</b></div>}
        {posts && posts.items.length === 0 && (
          <div className="pc-empty">Chưa có bài nào đăng lên Fanpage — vào tab ✨ Soạn bài AI để tạo &amp; đăng bài.</div>
        )}
        {posts?.items.map((p) => (
          <div key={p.id} className="perf-post">
            <div className="perf-post-body">
              <div className="pc-post-title">{p.hasImage ? '🖼️ ' : ''}{p.title || p.content.slice(0, 60)}</div>
              <div className="approval-context">{p.content.slice(0, 160)}{p.content.length > 160 ? '…' : ''}</div>
              <div className="approval-time">Đăng {dateTime(p.publishedAt)}</div>
            </div>
            <div className="perf-stats">
              <span title="Cảm xúc">👍 {count(p.reactions)}</span>
              <span title="Bình luận">💬 {count(p.comments)}</span>
              <span title="Chia sẻ">↗ {count(p.shares)}</span>
              {p.url && <a className="btn btn-outline btn-sm" href={p.url} target="_blank" rel="noreferrer">Xem ↗</a>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Tin remarketing gần đây</h2>
          <span className="hint">Khách nhắn lại trong 7 ngày sau tin được tính là có phản hồi</span>
        </div>
        {rmk && rmk.items.length === 0 && (
          <div className="pc-empty">Chưa gửi tin remarketing nào — vào tab Hàng chờ duyệt để AI soạn &amp; gửi.</div>
        )}
        {rmk?.items.map((s) => (
          <div key={`${s.psid}-${s.sentAt}`} className="perf-post">
            <div className="perf-post-body">
              <div className="approval-top">
                <span className="approval-name">{s.name}</span>
                <span className={`tag ${s.repliedAt ? 'tag-loop' : 'tag-rfm'}`}>
                  {s.repliedAt ? `✅ Nhắn lại sau ${hoursBetween(s.sentAt, s.repliedAt)}` : 'Chưa nhắn lại'}
                </span>
              </div>
              <div className="approval-context">{s.text}</div>
            </div>
            <div className="approval-time">{dateTime(s.sentAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
