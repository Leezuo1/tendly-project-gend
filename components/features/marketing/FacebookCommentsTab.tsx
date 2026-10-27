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

function RefreshIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2" /></svg>;
}

export function FacebookCommentsTab({ onToast }: { onToast: (message: string) => void }) {
  const { data, loading, error, reload } = useMarketingData(client.list);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [edits, setEdits] = useState<Record<string, { revision: number; text: string }>>({});
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !busy && !loading) reload(); };
    const timer = setInterval(refresh, 3_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [busy, loading, reload]);

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
  const processDisabledReason = busy ? 'Một tác vụ đang chạy. Vui lòng chờ.' : !data ? 'Đang tải bình luận.'
    : !data.pending ? 'Hiện không có bình luận chờ AI xử lý.'
      : !data.settings.updatedAt ? 'Đồng bộ dữ liệu AI trước khi xử lý hàng chờ.' : '';

  if (error && !data) return <MarketingDataNotice error={error} onRetry={reload} />;

  return (
    <section className="tab-panel active fc-root" aria-label="Bình luận Facebook">
      <div className="card fc-settings">
        <div className="card-head fc-settings-head">
          <h2>Bình luận → Messenger</h2>
          <div className="fc-settings-controls">
          <button type="button" className="fc-toggle" role="switch" aria-checked={data?.settings.autoReply ?? false}
            aria-label="AI tự nhắn riêng" disabled={!!busy || !data}
            onClick={() => run('settings', () => client.setAutoReply(!data!.settings.autoReply),
              data?.settings.autoReply ? 'Đã tắt tự gửi.' : 'Đã lưu dữ liệu AI và bật tự gửi cho comment mới.')}>
            <span>AI tự nhắn riêng <b>{busy === 'settings' ? 'Đang lưu…' : !data ? 'Đang tải…' : data.settings.autoReply ? 'Bật' : 'Tắt'}</b></span>
            <span className="fc-toggle-track" aria-hidden="true"><span /></span>
          </button>
          <button type="button" className="fc-collapse" aria-expanded={settingsExpanded} aria-controls="fc-settings-body"
            onClick={() => setSettingsExpanded(!settingsExpanded)}>
            {settingsExpanded ? 'Thu gọn' : 'Mở cài đặt'}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          </div>
        </div>
        <div id="fc-settings-body" hidden={!settingsExpanded}>
        <div className="card-desc">
          AI dựa vào bài đăng và sản phẩm để soạn tin riêng; câu hỏi thiếu dữ liệu sẽ chờ shop duyệt.
        </div>
        <div className="fc-settings-actions">
          <button type="button" className="btn btn-outline btn-sm fc-sync" disabled={!!busy || !data}
            aria-busy={busy === 'knowledge'}
            aria-describedby="fc-knowledge-status fc-knowledge-help"
            onClick={() => run('knowledge', () => client.saveSettings(data!.settings.autoReply), 'Đã cập nhật dữ liệu AI trên máy chủ.')}>
            <RefreshIcon />{busy === 'knowledge' ? 'Đang đồng bộ…' : 'Đồng bộ dữ liệu AI'}
          </button>
          <span id="fc-knowledge-status" className={data?.settings.updatedAt ? 'hint' : 'fc-warning'}>
            {data?.settings.updatedAt ? `${data.settings.productCount} sản phẩm · Đã đồng bộ ${relativeTime(data.settings.updatedAt).toLocaleLowerCase('vi')}`
              : <><span aria-hidden="true">⚠</span> Chưa đồng bộ sản phẩm và FAQ</>}
          </span>
        </div>
        <p id="fc-knowledge-help" className="fc-note">Cập nhật lại sau khi đổi sản phẩm hoặc FAQ để AI dùng dữ liệu mới nhất.</p>
        <div className="fc-info" role="note" aria-label="Chính sách nhắn tin Facebook"><span className="fc-info-icon" aria-hidden="true">i</span>
          <p>Mỗi bình luận chỉ được một tin nhắn riêng trong 7 ngày. Khách cần nhắn lại để mở cửa sổ trò chuyện 24 giờ.</p>
        </div>
        </div>
      </div>

      <div className="fc-toolbar">
        <label className="fc-search"><span className="fc-sr-only">Tìm bình luận</span><span className="fc-search-field">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input className="pc-input" type="search" value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên khách, nội dung, mã bài…" /></span></label>
        <label><span id="fc-filter-label" className="fc-sr-only">Trạng thái</span><select className="pc-input" aria-labelledby="fc-filter-label" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || loading} onClick={reload}><RefreshIcon /> Làm mới</button>
        <span className="fc-process-wrap" role="group" aria-label="Xử lý hàng chờ" tabIndex={processDisabledReason ? 0 : undefined}
          aria-describedby={processDisabledReason ? 'fc-process-tooltip' : undefined}>
        <button type="button" className="btn btn-outline btn-sm fc-process" disabled={!!processDisabledReason}
          onClick={() => run('process', client.process, 'Đã xử lý thêm hàng chờ.')}>
          {busy === 'process' ? 'AI đang xử lý…' : `Xử lý hàng chờ (${data?.pending ?? 0})`}
        </button>
        {processDisabledReason && <span className="fc-tooltip" id="fc-process-tooltip" role="tooltip">{processDisabledReason}</span>}
        </span>
      </div>
      <div role="status" aria-live="polite" className="fc-count">{data && <>
        {loading ? 'Đang cập nhật…' : 'Tự cập nhật mỗi 3 giây'}
        {data.sync?.syncedAt && <> · Đồng bộ Facebook {relativeTime(data.sync.syncedAt).toLocaleLowerCase('vi')}</>}
        {!!data.comments.length && <> · Hiển thị {comments.length} / {data.comments.length} bình luận</>}
      </>}</div>
      {data?.sync?.error && <p className="fc-warning" role="alert">{data.sync.error} Danh sách đang hiển thị dữ liệu đã lưu; hệ thống sẽ thử đồng bộ lại.</p>}
      {!data ? <p role="status" className="fc-note">Đang tải bình luận…</p> : !data.comments.length ? <div className="card pc-empty fc-empty">
        <div className="fc-empty-illustration" aria-hidden="true">
          <svg viewBox="0 0 280 76" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path className="fc-art-surface" d="M16 12h52a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H37L22 66V54h-6a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8Z" />
            <path d="M25 27h34M25 38h23M88 34h19m-5-5 5 5-5 5M173 34h19m-5-5 5 5-5 5" />
            <circle className="fc-art-surface" cx="140" cy="34" r="24" /><path d="m140 19 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" />
            <path className="fc-art-surface" d="M212 12h52a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8h-6v12l-15-12h-31a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8Z" />
            <path d="m218 40 13-15 10 10 17-10-13 17-11-10-16 8Z" />
          </svg>
          <div className="fc-illustration-labels"><span>Khách bình luận</span><span>AI soạn tin</span><span>Nhắn riêng</span></div>
        </div>
        <h3>Chưa có bình luận</h3><p>Bình luận mới sẽ tự động hiển thị tại đây khi khách hàng tương tác trên Fanpage.
          Đồng bộ dữ liệu sản phẩm để AI sẵn sàng hỗ trợ khách.</p>
        <div className="fc-empty-actions">
          <Link className="btn btn-primary btn-sm" href="/cai-dat?tab=channels">Kiểm tra kết nối Fanpage →</Link>
          <Link className="btn btn-outline btn-sm" href="/cau-hinh-ai">Cài đặt dữ liệu AI</Link>
        </div>
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
