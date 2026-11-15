'use client';

import { useState } from 'react';
import type { MarketingWorkspaceView, ReviewedMarketingPost } from '@/lib/types/marketingWorkspace';
import type { MarketingPost } from '@/lib/types/posts';
import { BusyStatus } from './BusyStatus';
import { ReviewDetails } from './ReviewDetails';

export type DraftTone = 'draft' | 'reviewed' | 'waiting' | 'approved' | 'stale';
const planFor = (view: MarketingWorkspaceView, meta: ReviewedMarketingPost) => view.workspace.contentPlans?.find(p => p.id === meta.plan?.id);
/** Brief và kế hoạch mà bài dựa vào vẫn còn hiệu lực. */
const isCurrent = (view: MarketingWorkspaceView, meta: ReviewedMarketingPost) => {
  const campaign = view.workspace.campaigns.find(item => item.id === meta.campaignId);
  const plan = planFor(view, meta);
  return !!campaign?.approvedAt && meta.campaignVersion === campaign.version && !!plan?.approvedAt && plan.version === meta.plan?.version;
};
/** Nhãn trạng thái duy nhất cho một bài, dùng chung cho danh sách và phần chi tiết. */
export function draftStatus(view: MarketingWorkspaceView, meta: ReviewedMarketingPost): { label: string; tone: DraftTone } {
  const mock = view.accounts.find(item => item.id === meta.accountId)?.mock;
  if (meta.publication === 'published') return { label: mock ? 'Đã hoàn tất mẫu' : 'Đã đăng', tone: 'approved' };
  if (!isCurrent(view, meta)) return { label: 'Cần duyệt lại', tone: 'stale' };
  if (view.workspace.reviewAttempts?.some(a => a.targetPostId === meta.postId && !a.appliedAt && !a.discardedAt)) return { label: 'AI đã rà soát', tone: 'reviewed' };
  if (!meta.reviewHash && meta.manualHash) return meta.approvedAt ? { label: 'Đã duyệt', tone: 'approved' } : { label: 'Chờ bạn duyệt', tone: 'waiting' };
  if (!meta.reviewHash) return { label: 'Bản nháp', tone: 'draft' };
  return meta.approvedAt ? { label: 'Đã duyệt', tone: 'approved' } : { label: 'Chờ bạn duyệt', tone: 'waiting' };
}

interface Props {
  post: MarketingPost; meta: ReviewedMarketingPost; view: MarketingWorkspaceView; busy: boolean; error: string;
  act: (action: string, input: object) => Promise<boolean>;
  confirm: (title: string, message: string, action: () => Promise<unknown>) => void;
  upload: (id: string, file: File | null) => Promise<void>; onComments: (id: string) => void; onAskAi: (postId: string) => void;
}
export function MarketingDraft({ post, meta, view, busy, error, onAskAi, act, confirm, upload, onComments }: Props) {
  const [edit, setEdit] = useState(false);
  const initial = { title: post.title, content: post.content, hashtags: post.hashtags.join(' '), imageIdea: post.imageIdea };
  const [form, setForm] = useState(initial);
  const account = view.accounts.find(item => item.id === meta.accountId)!;
  const campaign = view.workspace.campaigns.find(item => item.id === meta.campaignId)!;
  const plan = planFor(view, meta);
  const outline = plan?.items.find(i => i.id === meta.plan?.itemId);
  const snapshot = meta.outlineSnapshot ?? (outline ? { ...outline, pillar: plan!.pillars[outline.pillarIndex].name } : null);
  const valid = isCurrent(view, meta);
  const draft = meta.publication === 'draft';
  const candidate = view.workspace.reviewAttempts?.find(a => a.targetPostId === post.id && !a.appliedAt && !a.discardedAt);
  const proposed = candidate?.variants[0];
  // Bản chủ shop tự sửa: kết quả Review cũ thuộc về nội dung trước khi sửa nên không hiển thị.
  const manual = !meta.reviewHash && !!meta.manualHash;
  const review = candidate ?? (manual ? undefined : meta.review);
  const reviewValid = valid && (!!meta.reviewHash || manual);
  const status = draftStatus(view, meta);
  const changes = review?.variants.flatMap(v => v.changes) ?? [];
  const issues = review?.variants.flatMap(v => v.issues) ?? [];
  return <article id={`mw-post-${post.id}`} className="mw-detail" data-unsaved={edit}>
    <header className="mw-detail-head"><div><h3>{post.title}</h3><p className="mw-meta">{campaign.name} · {account.platform}{account.mock && ' · Kênh mẫu'}{manual && ' · Bạn tự sửa, AI chưa kiểm tra bản này'}</p></div><span className={`mw-badge ${status.tone}`}>{status.label}</span></header>
    {error && <p className="mw-error" role="alert">{error}</p>}
    {busy && <p role="status"><BusyStatus /></p>}
    {!valid && draft && <p className="mw-error">Brief hoặc dàn ý đã thay đổi so với lúc viết bài. Cần Review lại trước khi duyệt.</p>}
    {edit ? <form id={`mw-edit-${post.id}`} onSubmit={async e => { e.preventDefault(); if (await act('editPost', { postId: post.id, patch: { ...form, hashtags: form.hashtags.split(/\s+/).filter(Boolean) } })) setEdit(false); }}><label>Tiêu đề<input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Nội dung<textarea aria-label="Nội dung" required rows={14} maxLength={5000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label><label>Hashtag<input value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })} /></label><label>Ý tưởng hình ảnh<textarea rows={3} value={form.imageIdea} onChange={e => setForm({ ...form, imageIdea: e.target.value })} /></label></form>
      : <div className="mw-post-body"><div className="mw-copy">{post.content}</div>{!!post.hashtags.length && <p className="mw-hashtags">{post.hashtags.join(' ')}</p>}{post.image && <img className="mw-post-image" src={`/api/posts/${post.id}/image?v=${post.image.updatedAt}`} alt={post.title} />}<p className="mw-muted">Ý tưởng ảnh: {post.imageIdea || 'Chưa có'}</p></div>}
    {draft && <div className="mw-image-controls"><label>Ảnh đính kèm<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || edit} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(post.id, file); }} /></label>{post.image && <button className="btn btn-text btn-sm" disabled={busy || edit} onClick={() => upload(post.id, null)}>Gỡ ảnh</button>}</div>}
    {!edit && candidate && <section className="mw-ai-diff" aria-label="Đề xuất của AI">
      <div className="mw-ai-proposal"><h4>Bản AI đề xuất sửa</h4>{proposed?.finalDraft ? <><p className="mw-proposal-title">{proposed.finalDraft.title}</p><p className="mw-copy">{proposed.finalDraft.content}</p></> : <p className="mw-muted">Chưa có bản đề xuất dùng được; hệ thống tự thử lại.</p>}</div>
      <div className="mw-ai-reason"><h4>Lý do điều chỉnh</h4>{changes.length ? <ul>{changes.map((change, i) => <li key={i}>{change.reason}</li>)}</ul> : <p className="mw-muted">AI không ghi lý do cụ thể.</p>}</div>
      <div className="mw-actions mw-actions-start">{proposed?.finalDraft && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirm('Áp dụng bản Review này?', 'Thay nội dung bài bằng bản đề xuất đang xem. Bài cần chủ shop duyệt lại; lịch liên quan sẽ tạm dừng.', () => act('applyReview', { attemptId: candidate.id, draftId: proposed.draftId }))}>Áp dụng bản đề xuất</button>}<button className="btn btn-text btn-sm" disabled={busy} onClick={() => act('discardReview', { attemptId: candidate.id })}>Bỏ đề xuất</button></div>
      <p className="mw-hint">Bài hiện tại giữ nguyên đến khi bạn áp dụng.</p>
    </section>}
    {!edit && !candidate && (changes.length > 0 || issues.length > 0) && <section className="mw-ai-reason" aria-label="Kết quả rà soát">
      {changes.length > 0 && <><h4>AI đã điều chỉnh {changes.length} chỗ</h4><ul>{changes.map((change, i) => <li key={i}>{change.reason}</li>)}</ul></>}
      {issues.length > 0 && <><h4>Cần bạn xem</h4><ul>{issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul></>}
    </section>}
    {!edit && snapshot && <details className="mw-fold"><summary>Dàn ý đã dùng để viết bài</summary><p className="mw-muted">{snapshot.pillar} · Dàn ý phiên bản {meta.plan?.version}</p><h4>{snapshot.title}</h4><div className="mw-copy">{snapshot.outline}</div></details>}
    {!edit && review && <ReviewDetails review={review} />}
    <div className="mw-actions mw-decision">
      {edit ? <><button className="btn btn-outline" onClick={() => { setForm(initial); setEdit(false); }}>Hủy sửa</button><button className="btn btn-primary" type="submit" form={`mw-edit-${post.id}`} disabled={busy}>Lưu</button></> : <>
        {draft && manual && <button className="btn btn-text btn-sm" disabled={busy || !valid} onClick={() => onAskAi(post.id)}>Nhờ AI kiểm tra</button>}
        {draft && <button className="btn btn-text btn-sm" disabled={busy || !valid} onClick={() => act('generate', { campaignId: campaign.id, plan: meta.plan })}>Viết lại bằng AI</button>}
        {draft && <button className="btn btn-outline" onClick={() => { setForm(initial); setEdit(true); }}>Chỉnh sửa thủ công</button>}
        {draft && !meta.approvedAt && <button className="btn btn-primary" disabled={busy || !reviewValid || !!candidate} onClick={() => act('approvePost', { postId: post.id })}>Duyệt bản này</button>}
        {draft && meta.approvedAt && <button className="btn btn-primary" disabled={busy || !valid} onClick={() => confirm(account.mock ? 'Hoàn tất trên kênh mẫu?' : 'Đăng thật lên Facebook?', account.mock ? 'Mô phỏng bước đăng bằng nội dung đã duyệt; không gửi tới nền tảng.' : 'Nội dung đã duyệt sẽ được đăng lên Fanpage Facebook được kết nối.', () => act('publish', { postId: post.id }))}>{account.mock ? 'Chạy bước đăng mẫu' : 'Đăng Facebook'}</button>}
        {meta.publication === 'published' && !account.mock && <><a className="btn btn-outline" href={meta.externalUrl} target="_blank" rel="noreferrer">Xem bài Facebook</a><button className="btn btn-outline" onClick={() => onComments(meta.externalId!)}>Mở bình luận</button></>}
      </>}
    </div>
    {edit && busy && <p className="mw-hint mw-hint-end">AI đang xử lý. Bạn vẫn sửa được; nút lưu mở lại khi AI xong.</p>}
    {draft && !edit && !meta.approvedAt && <p className="mw-hint mw-hint-end">Bài sau khi duyệt sẽ đủ điều kiện xếp vào lịch đăng.</p>}
    {(meta.publication === 'unknown' || meta.publication === 'publishing') && <p className="mw-error">{meta.publication === 'unknown' ? 'Chưa rõ kết quả gửi. Kiểm tra tài khoản trước khi xử lý lại.' : 'Đang gửi bài. Không bấm đăng lại.'}</p>}
    {meta.publication === 'unknown' && <div className="mw-actions"><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => confirm('Bài chưa lên Facebook?', 'Chỉ xác nhận khi bạn đã mở Fanpage và chắc chắn bài này chưa được đăng. Nếu bài đã đăng mà xác nhận nhầm, bài có thể bị đăng trùng.', () => act('resolveUnknown', { postId: post.id }))}>Đã kiểm tra: bài chưa đăng</button></div>}
  </article>;
}
