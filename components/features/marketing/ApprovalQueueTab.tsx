'use client';

import React, { useMemo, useState } from 'react';
import { CustomerAvatar } from '@/components/features/inbox/CustomerAvatar';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { marketingClient } from '@/lib/services/marketingClient';
import { PostsApiError } from '@/lib/services/postsClient';
import type { MarketingCustomer } from '@/lib/types/marketing';
import { clockTime, initials, relativeTime } from '@/lib/utils/format';
import { MarketingDataNotice } from './MarketingDataNotice';

interface ApprovalQueueTabProps {
  onToast?: (msg: string) => void;
}

interface RowState {
  text?: string;
  reason?: string;
  drafting?: boolean;
  sending?: boolean;
  sentAt?: number;
  skipped?: boolean;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Đã có lỗi xảy ra, thử lại nhé');

function tagOf(c: MarketingCustomer): { label: string; type: 'loop' | 'rfm' | 'vip' } {
  if (c.complained) return { label: '⚠️ Có từ ngữ phàn nàn', type: 'rfm' };
  if (c.waitingReply) return { label: '⏳ Chờ shop trả lời', type: 'vip' };
  if (c.askedProduct) return { label: '🛍️ Đã hỏi sản phẩm', type: 'loop' };
  return { label: '💬 Đang trò chuyện', type: 'loop' };
}

function timeLeft(until: number, now: number) {
  const min = Math.max(0, Math.floor((until - now) / 60_000));
  return min >= 60 ? `còn ${Math.floor(min / 60)} giờ để nhắn` : `còn ${min} phút để nhắn`;
}

/** Khách nhắn Fanpage trong 24 giờ qua: AI soạn tin nhắn lại theo đúng hội thoại, chủ shop duyệt rồi mới gửi. */
export function ApprovalQueueTab({ onToast }: ApprovalQueueTabProps) {
  const { data, error, loading, reload } = useMarketingData(marketingClient.customers);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const toast = (msg: string) => onToast?.(msg);
  const update = (psid: string, patch: RowState) => setRows((prev) => ({ ...prev, [psid]: { ...prev[psid], ...patch } }));

  const queue = useMemo(() => (data?.customers ?? [])
    .filter((c) => c.canMessageUntil !== null)
    .sort((a, b) => (b.lastInAt ?? 0) - (a.lastInAt ?? 0)), [data]);
  const visible = queue.filter((c) => !rows[c.psid]?.skipped);

  const draft = async (c: MarketingCustomer) => {
    update(c.psid, { drafting: true });
    try {
      const result = await marketingClient.draft(c.psid);
      update(c.psid, { drafting: false, text: result.message, reason: result.reason });
    } catch (e) {
      update(c.psid, { drafting: false });
      toast(errorText(e));
    }
  };

  const send = async (c: MarketingCustomer) => {
    const text = rows[c.psid]?.text?.trim();
    if (!text) return;
    if (!window.confirm(`Gửi tin này tới ${c.name} qua Messenger?`)) return;
    update(c.psid, { sending: true });
    try {
      const { sentAt } = await marketingClient.send(c.psid, text, crypto.randomUUID());
      update(c.psid, { sending: false, sentAt });
      toast(`Đã gửi tin cho ${c.name}`);
    } catch (e) {
      update(c.psid, { sending: false });
      toast(e instanceof PostsApiError && e.status === 409 ? e.message : `Chưa gửi được: ${errorText(e)}`);
    }
  };

  if (error) return <div className="tab-panel active" id="tab-queue"><MarketingDataNotice error={error} onRetry={reload} /></div>;

  return (
    <div className="tab-panel active" id="tab-queue">
      <div className="card">
        <div className="card-head">
          <h2>Khách nhắn trong 24 giờ qua</h2>
          <span className="hint">{loading ? 'Đang tải...' : `${visible.length} khách có thể nhắn lại`}</span>
        </div>
        <div className="card-desc">
          AI đọc hội thoại Messenger thật và soạn tin nhắn lại cá nhân hoá — bạn sửa &amp; duyệt trước khi gửi.
          Messenger chỉ cho phép shop nhắn trong 24 giờ kể từ tin cuối của khách, nên chỉ những khách này mới nhắn lại được.
        </div>

        {!loading && visible.length === 0 && (
          <div className="pc-empty">
            Chưa có khách nào nhắn Fanpage trong 24 giờ qua. Khi khách nhắn tin, họ sẽ xuất hiện ở đây.
          </div>
        )}

        {data && visible.map((c) => {
          const row = rows[c.psid] ?? {};
          const tag = tagOf(c);
          return (
            <div key={c.psid} className="approval-row">
              <CustomerAvatar className="approval-avatar" name={c.name} initials={initials(c.name)} url={c.avatarUrl ?? undefined} />
              <div className="approval-body">
                <div className="approval-top">
                  <span className="approval-name">{c.name}</span>
                  <span className="approval-channel">· Messenger</span>
                  <span className={`tag tag-${tag.type}`}>{tag.label}</span>
                </div>
                <div className="approval-context">
                  {c.lastInboundText ? <>Tin gần nhất của khách: &ldquo;{c.lastInboundText.slice(0, 200)}&rdquo;</> : 'Khách gửi ảnh/tệp đính kèm'}
                  {c.matchedProducts.length > 0 && <> · Sản phẩm: {c.matchedProducts.join(', ')}</>}
                </div>

                {row.sentAt ? (
                  <div className="approval-draft">✅ Đã gửi lúc {clockTime(new Date(row.sentAt))}: {row.text}</div>
                ) : row.text !== undefined ? (
                  <>
                    {row.reason && <div className="approval-context">🤖 {row.reason}</div>}
                    <textarea
                      className="pc-input approval-editor"
                      rows={3}
                      maxLength={2000}
                      value={row.text}
                      onChange={(e) => update(c.psid, { text: e.target.value })}
                    />
                  </>
                ) : null}

                {!row.sentAt && (
                  <div className="approval-actions">
                    {row.text !== undefined && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={row.sending || row.drafting || !row.text.trim()}
                        onClick={() => send(c)}
                      >
                        {row.sending ? 'Đang gửi...' : 'Duyệt & Gửi'}
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" disabled={row.drafting || row.sending} onClick={() => draft(c)}>
                      {row.drafting ? <><span className="pc-spinner" /> AI đang soạn...</> : row.text !== undefined ? 'Soạn lại' : '✨ AI soạn tin'}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={row.sending} onClick={() => update(c.psid, { skipped: true })}>
                      Bỏ qua
                    </button>
                  </div>
                )}
              </div>
              <div className="approval-tail">
                <span className="approval-time">{c.lastInAt ? relativeTime(c.lastInAt, data.now) : ''}</span>
                {c.canMessageUntil && !row.sentAt && <span className="approval-time">{timeLeft(c.canMessageUntil, data.now)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
