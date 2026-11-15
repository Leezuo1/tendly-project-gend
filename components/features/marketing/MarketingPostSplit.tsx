'use client';

import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import { draftStatus, MarketingDraft } from './MarketingDraft';

interface Props {
  view: MarketingWorkspaceView; selectedId: string; busy: boolean; error: string;
  onSelect: (id: string) => void; onAskAi: (postId: string) => void;
  act: (action: string, input: object) => Promise<boolean>;
  confirm: (title: string, message: string, action: () => Promise<unknown>) => void;
  upload: (id: string, file: File | null) => Promise<void>; onComments: (id: string) => void;
}
const created = (at: number) => new Date(at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Danh sách bài bên trái, bài đang xem và phần AI rà soát bên phải: duyệt ngay tại bài, không mở cửa sổ khác. */
export function MarketingPostSplit({ view, selectedId, busy, error, onSelect, onAskAi, act, confirm, upload, onComments }: Props) {
  const rows = view.workspace.reviews.flatMap(meta => { const post = view.posts.find(item => item.id === meta.postId); return post ? [{ meta, post }] : []; });
  if (!rows.length) return <p className="mw-empty">Chưa có bài viết. Duyệt kế hoạch ở bước 2 để AI viết bài.</p>;
  const current = rows.find(row => row.post.id === selectedId) ?? rows[0];
  return <div className="mw-split">
    <ul className="mw-split-list mw-post-list" aria-label="Bài viết">{rows.map(({ meta, post }) => { const status = draftStatus(view, meta); return <li key={post.id}>
      <button type="button" aria-current={post.id === current.post.id ? 'true' : undefined} onClick={() => onSelect(post.id)}>
        <span className="mw-row-top"><b>{post.title}</b><span className={`mw-badge ${status.tone}`}>{status.label}</span></span>
        <span className="mw-post-excerpt">{post.content}</span>
        <span className="mw-row-meta">{view.workspace.campaigns.find(c => c.id === meta.campaignId)?.name} · {created(post.createdAt)}</span>
      </button></li>; })}</ul>
    <div className="mw-split-detail">
      <MarketingDraft key={current.post.id} post={current.post} meta={current.meta} view={view} busy={busy} error={error} onAskAi={onAskAi} act={act} confirm={confirm} upload={upload} onComments={onComments} />
    </div>
  </div>;
}
