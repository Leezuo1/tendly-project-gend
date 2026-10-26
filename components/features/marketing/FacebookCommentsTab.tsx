'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { facebookCommentsClient as client } from '@/lib/services/facebookCommentsClient';
import type { CommentStatus } from '@/lib/types/facebookComments';
import { relativeTime } from '@/lib/utils/format';
import { MarketingDataNotice } from './MarketingDataNotice';

const labels: Record<CommentStatus, string> = {
  pending: 'Chờ AI', processing: 'AI đang đọc', review: 'Cần shop xem', ignored: 'Bỏ qua',
  sending: 'Đang gửi · không gửi lại', sent: 'Đã nhắn riêng', unknown: 'Cần kiểm tra Messenger',
  failed: 'Meta từ chối', deleted: 'Đã xoá trên Facebook',
};

export function FacebookCommentsTab({ onToast }: { onToast: (message: string) => void }) {
  const { data, loading, error, reload } = useMarketingData(client.list);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [edits, setEdits] = useState<Record<string, { revision: number; text: string }>>({});
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !busy) reload(); }, 10_000);
    return () => clearInterval(timer);
  }, [busy, reload]);

  const run = async (name: string, action: () => Promise<unknown>, message?: string) => {
    setBusy(name);
    try { await action(); if (message) onToast(message); }
    catch (e) { onToast(e instanceof Error ? e.message : 'Không xử lý được bình luận.'); }
    finally { setBusy(''); reload(); }
  };
  const comments = (data?.comments ?? []).filter((c) =>
    (filter === 'all' || c.status === filter) && `${c.authorName} ${c.text} ${c.postId}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const selected = comments.find((c) => c.commentId === selectedId) ?? comments[0];
  const edit = selected ? edits[selected.commentId] : undefined;
  const text = selected ? (edit?.revision === selected.revision ? edit.text : selected.draft) : '';
  const canDraft = selected && ['pending', 'review', 'ignored', 'failed'].includes(selected.status);
  const canSend = selected && data && ['review', 'failed'].includes(selected.status) && data.now - selected.createdAt < 7 * 86400_000;

  if (error && !data) return <MarketingDataNotice error={error} onRetry={reload} />;

  return (
    <section className="tab-panel active fc-root" aria-label="Bình luận Facebook">
      <div className="card fc-settings">
        <div className="card-head"><h2>Bình luận → Messenger</h2><span className="fc-status">{data?.settings.autoReply ? 'Tự gửi đang bật' : 'Shop duyệt trước khi gửi'}</span></div>
        <div className="card-desc">
          AI đọc câu hỏi cùng bài đăng, đối chiếu sản phẩm rồi soạn một tin nhắn riêng bằng Fanpage đã kết nối.
          Câu hỏi thiếu dữ liệu sẽ chờ shop xem.
        </div>
        <div className="fc-settings-actions">
          <button type="button" className={`btn ${data?.settings.autoReply ? 'btn-outline' : 'btn-primary'} btn-sm`}
            disabled={!!busy || !data} onClick={() => run('settings', () => client.setAutoReply(!data!.settings.autoReply),
              data?.settings.autoReply ? 'Đã tắt tự gửi.' : 'Đã lưu dữ liệu AI và bật tự gửi cho comment mới.')}>
            {busy === 'settings' ? 'Đang lưu…' : data?.settings.autoReply ? 'Tắt tự gửi' : 'Bật AI tự nhắn riêng'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || !data}
            onClick={() => run('knowledge', () => client.saveSettings(data!.settings.autoReply), 'Đã cập nhật dữ liệu AI trên máy chủ.')}>
            {busy === 'knowledge' ? 'Đang lưu…' : 'Cập nhật dữ liệu AI'}
          </button>
          <span className="hint">{data?.settings.updatedAt
            ? `${data.settings.productCount} sản phẩm · lưu ${relativeTime(data.settings.updatedAt)}`
            : 'Chưa lưu sản phẩm và FAQ lên máy chủ'}</span>
        </div>
        <p className="fc-note">Dữ liệu dùng bản đã lưu gần nhất. Sau khi đổi sản phẩm hoặc FAQ, bấm cập nhật.
          Mỗi comment chỉ được một private reply trong 7 ngày; khách cần nhắn lại để mở cửa sổ trò chuyện 24 giờ.</p>
      </div>

      <div className="fc-toolbar">
        <label className="fc-search">Tìm bình luận<input className="pc-input" type="search" value={query}
          onChange={(e) => setQuery(e.target.value)} placeholder="Tên khách, nội dung, mã bài đăng" /></label>
        <label>Trạng thái<select className="pc-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || loading} onClick={reload}>Làm mới</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || !data?.pending || !data.settings.updatedAt}
          onClick={() => run('process', client.process, 'Đã xử lý thêm hàng chờ.')}>
          {busy === 'process' ? 'AI đang xử lý…' : `Xử lý hàng chờ (${data?.pending ?? 0})`}
        </button>
      </div>
      <div role="status" aria-live="polite" className="hint">{loading ? 'Đang cập nhật bình luận…' : `Hiển thị ${comments.length} bình luận trong 100 bình luận mới nhất`}</div>
      {!loading && !data?.comments.length ? <div className="card pc-empty">
        <h3>Chưa có bình luận</h3><p>Comment mới sẽ xuất hiện sau khi Page đăng ký webhook <b>feed</b>.
          Hãy lưu dữ liệu AI trước khi dùng tính năng này.</p>
      </div> : <div className="fc-workspace">
        <div className="card fc-list" aria-label="Danh sách bình luận">
          {!comments.length && <p className="pc-empty">Không có bình luận phù hợp.</p>}
          {comments.map((comment) => <button type="button" key={comment.commentId}
            className={`fc-comment ${selected?.commentId === comment.commentId ? 'fc-selected' : ''}`}
            aria-pressed={selected?.commentId === comment.commentId} onClick={() => setSelectedId(comment.commentId)}>
            <span className="fc-comment-top"><b>{comment.authorName || 'Người dùng Facebook'}</b><span className={`fc-status fc-${comment.status}`}>{labels[comment.status]}</span></span>
            <span className="fc-preview">{comment.text || '[Bình luận không có văn bản]'}</span>
            <span className="hint">{relativeTime(comment.createdAt)} · Bài {comment.postId}</span>
          </button>)}
        </div>
        {selected && <article className="card fc-detail">
          <div className="card-head"><h2>{selected.authorName || 'Người dùng Facebook'}</h2>
            <a href={`https://www.facebook.com/${selected.postId}?comment_id=${selected.commentId.split('_')[1]}`}
              target="_blank" rel="noreferrer">Xem trên Facebook ↗</a></div>
          <div className="fc-detail-body">
            <blockquote>{selected.text || '[Bình luận không có văn bản]'}</blockquote>
            {selected.postText && <details><summary>Nội dung bài đăng</summary><p className="fc-post">{selected.postText}</p></details>}
            <p className="fc-reason" role="status">{selected.reason || labels[selected.status]}</p>
            <label htmlFor="fc-reply"><b>Tin nhắn riêng từ Fanpage</b></label>
            <textarea id="fc-reply" className="pc-input fc-editor" rows={6} maxLength={2000} value={text}
              disabled={!!busy || !canSend} placeholder="AI soạn hoặc shop nhập câu trả lời…"
              onChange={(e) => setEdits((prev) => ({ ...prev, [selected.commentId]: { revision: selected.revision, text: e.target.value } }))} />
            <div className="fc-settings-actions">
              <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || !canDraft || !data?.settings.updatedAt}
                onClick={() => run('draft', () => client.draft(selected.commentId))}>
                {busy === 'draft' ? 'AI đang đọc…' : 'AI soạn tin'}
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !canSend || !text.trim()}
                onClick={() => run('send', async () => {
                  const result = await client.send(selected, text);
                  onToast(result.persisted ? result.reason : `${result.reason} Đang chờ đồng bộ dữ liệu; không gửi lại.`);
                })}>{busy === 'send' ? 'Đang gửi…' : 'Gửi riêng qua Page'}</button>
              <Link href="/hop-thoai">Mở inbox Messenger →</Link>
            </div>
            <p className="fc-note">Khách nhắn lại sẽ xuất hiện trong inbox Messenger. Chế độ tự gửi chỉ áp dụng cho comment mới sau khi bật.</p>
          </div>
        </article>}
      </div>}
    </section>
  );
}
