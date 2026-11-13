'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { MarketingWorkspaceView, ReviewedMarketingPost } from '@/lib/types/marketingWorkspace';
import type { MarketingPost } from '@/lib/types/posts';
import { BusyStatus } from './BusyStatus';
import { ReviewDetails, ReviewSummary, REVIEW_STATUS } from './ReviewDetails';

interface Props {
  post: MarketingPost; meta: ReviewedMarketingPost; view: MarketingWorkspaceView; busy: boolean; error: string;
  open: boolean; onOpen: () => void; onClose: () => void;
  act: (action: string, input: object) => Promise<boolean>;
  confirm: (title: string, message: string, action: () => Promise<unknown>) => void;
  upload: (id: string, file: File | null) => Promise<void>; onComments: (id: string) => void;
}
export function MarketingDraft({ post, meta, view, busy, error, open, onOpen, onClose, act, confirm, upload, onComments }: Props) {
  const [edit, setEdit] = useState(false);
  const initial = { title: post.title, content: post.content, hashtags: post.hashtags.join(' '), imageIdea: post.imageIdea };
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState<'outline' | 'post'>('post');
  const [itemId, setItemId] = useState('');
  const account = view.accounts.find(item => item.id === meta.accountId)!;
  const campaign = view.workspace.campaigns.find(item => item.id === meta.campaignId)!;
  const plan = view.workspace.contentPlans?.find(p => p.id === meta.plan?.id);
  const outline = plan?.items.find(i => i.id === meta.plan?.itemId);
  const snapshot = meta.outlineSnapshot ?? (outline ? { ...outline, pillar: plan!.pillars[outline.pillarIndex].name } : null);
  const approvedPlan = view.workspace.contentPlans?.find(p => p.campaignId === campaign.id && p.campaignVersion === campaign.version && p.approvedAt);
  const valid = !!campaign.approvedAt && meta.campaignVersion === campaign.version && !!plan?.approvedAt && plan.version === meta.plan?.version;
  const draft = meta.publication === 'draft';
  const candidate = view.workspace.reviewAttempts?.find(a => a.targetPostId === post.id && !a.appliedAt && !a.discardedAt);
  const proposed = candidate?.variants[0];
  const review = tab === 'outline' ? plan?.review : candidate ?? meta.review;
  const reviewValid = valid && !!meta.reviewHash;
  return <article className="mw-item mw-draft" data-unsaved={edit}>
    <div className="mw-section-head"><div><span className="mw-muted">{campaign.name} · {account.platform}{account.mock && ' · Kênh mẫu'}</span><h3>{post.title}</h3></div><span className={`mw-chip ${meta.approvedAt && valid ? 'approved' : ''}`}>{!valid ? 'Cần duyệt lại kế hoạch / bài' : !meta.reviewHash ? 'Cần Review lại' : meta.approvedAt ? 'Chủ shop đã duyệt' : 'Review xong · chờ duyệt'}</span></div>
    <p className="mw-post-excerpt">{post.content}</p>
    <div className="mw-actions"><button id={`mw-post-${post.id}`} className="btn btn-outline btn-sm" onClick={() => { setTab('post'); onOpen(); }}>Xem dàn ý / bài viết</button>
      {draft && meta.approvedAt && <button className="btn btn-primary btn-sm" disabled={busy || edit || !valid} onClick={() => confirm(account.mock ? 'Hoàn tất trên kênh mẫu?' : 'Đăng thật lên Facebook?', account.mock ? 'Mô phỏng bước đăng bằng nội dung đã duyệt; không gửi tới nền tảng.' : 'Nội dung đã duyệt sẽ được đăng lên Fanpage Facebook được kết nối.', () => act('publish', { postId: post.id }))}>{account.mock ? 'Chạy bước đăng mẫu' : 'Đăng Facebook'}</button>}
      {meta.publication === 'published' && (account.mock ? <span className="mw-chip">Đã hoàn tất mẫu</span> : <><a className="btn btn-outline btn-sm" href={meta.externalUrl} target="_blank" rel="noreferrer">Xem bài Facebook</a><button className="btn btn-outline btn-sm" onClick={() => onComments(meta.externalId!)}>Mở bình luận</button></>)}
      {(meta.publication === 'unknown' || meta.publication === 'publishing') && <p className="mw-error">{meta.publication === 'unknown' ? 'Chưa rõ kết quả gửi. Kiểm tra tài khoản trước khi xử lý lại.' : 'Đang gửi bài. Không bấm đăng lại.'}</p>}
      {meta.publication === 'unknown' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => confirm('Bài chưa lên Facebook?', 'Chỉ xác nhận khi bạn đã mở Fanpage và chắc chắn bài này chưa được đăng. Nếu bài đã đăng mà xác nhận nhầm, bài có thể bị đăng trùng.', () => act('resolveUnknown', { postId: post.id }))}>Đã kiểm tra: bài chưa đăng</button>}
    </div>
    <Modal open={open} title="Chi tiết nội dung" onClose={onClose} width={1140} footer={<>
      <button className="btn btn-outline btn-sm" onClick={onClose}>Đóng</button>
      {edit ? <><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setForm(initial); setEdit(false); }}>Hủy sửa</button><button className="btn btn-primary btn-sm" type="submit" form={`mw-edit-${post.id}`} disabled={busy}>Lưu và Review lại</button></> : draft && <>
        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setTab('post'); setEdit(true); }}>Chỉnh bài</button>
        <button className="btn btn-outline btn-sm" disabled={busy || !valid} onClick={() => act('generate', { campaignId: campaign.id, plan: meta.plan })}>Viết lại bằng AI</button>
        <button className="btn btn-outline btn-sm" disabled={busy || !campaign.approvedAt || !approvedPlan} onClick={() => act('review', { postId: post.id, plan: { id: approvedPlan!.id, version: approvedPlan!.version, itemId: itemId || outline?.id || approvedPlan!.items[0].id } })}>Review lại</button>
        {!meta.approvedAt && <button className="btn btn-primary btn-sm" disabled={busy || !reviewValid || !!candidate} onClick={() => act('approvePost', { postId: post.id })}>Duyệt phiên bản bài này</button>}
      </>}
    </>}>
      {error && <p className="mw-error" role="alert">{error}</p>}
      {busy && <p role="status"><BusyStatus /></p>}
      <div className="mw-detail-tabs" role="tablist" aria-label="Chi tiết nội dung" onKeyDown={e => { if (!edit && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setTab(tab === 'outline' ? 'post' : 'outline'); (e.currentTarget.querySelector(`[data-tab="${tab === 'outline' ? 'post' : 'outline'}"]`) as HTMLButtonElement)?.focus(); } }}><button role="tab" data-tab="outline" disabled={edit} tabIndex={tab === 'outline' ? 0 : -1} aria-selected={tab === 'outline'} aria-controls={`mw-detail-${post.id}`} onClick={() => setTab('outline')}>Dàn ý</button><button role="tab" data-tab="post" tabIndex={tab === 'post' ? 0 : -1} aria-selected={tab === 'post'} aria-controls={`mw-detail-${post.id}`} onClick={() => setTab('post')}>Bài viết</button></div>
      <div id={`mw-detail-${post.id}`} role="tabpanel" aria-label={tab === 'outline' ? 'Dàn ý' : 'Bài viết'} className="mw-detail-layout"><div className="mw-detail-content">
        {tab === 'outline' ? snapshot ? <><p className="mw-muted">{snapshot.pillar} · Phiên bản dàn ý đã dùng: {meta.plan?.version}</p>{!valid && <p className="mw-error">Đây là dàn ý đã dùng để viết bài. Cần đối chiếu với kế hoạch hiện hành trước khi duyệt lại.</p>}<h3>{snapshot.title}</h3><div className="mw-copy">{snapshot.outline}</div></> : <p>Bài cũ chưa có dàn ý. Chọn dàn ý đã duyệt rồi Review lại bài.</p> : <>
          {edit ? <form id={`mw-edit-${post.id}`} onSubmit={async e => { e.preventDefault(); if (await act('editPost', { postId: post.id, patch: { ...form, hashtags: form.hashtags.split(/\s+/).filter(Boolean) } })) setEdit(false); }}><label>Tiêu đề<input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Nội dung<textarea aria-label="Nội dung" required rows={14} maxLength={5000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label><label>Hashtag<input value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })} /></label><label>Ý tưởng hình ảnh<textarea rows={3} value={form.imageIdea} onChange={e => setForm({ ...form, imageIdea: e.target.value })} /></label></form> : <><h3>{post.title}</h3><div className="mw-copy">{post.content}</div><p>{post.hashtags.join(' ')}</p>{post.image && <img className="mw-post-image" src={`/api/posts/${post.id}/image?v=${post.image.updatedAt}`} alt={post.title} />}<p className="mw-muted">Ý tưởng ảnh: {post.imageIdea}</p></>}
          {draft && <div className="mw-image-controls"><label>Ảnh đính kèm<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || edit} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(post.id, file); }} /></label>{post.image && <button className="btn btn-text btn-sm" disabled={busy || edit} onClick={() => upload(post.id, null)}>Gỡ ảnh</button>}</div>}
          {!valid && approvedPlan && <label>Dàn ý dùng để đối chiếu lại<select disabled={busy || edit} value={itemId || outline?.id || approvedPlan.items[0].id} onChange={e => setItemId(e.target.value)}>{approvedPlan.items.map(i => <option value={i.id} key={i.id}>{i.title}</option>)}</select></label>}
          {candidate && <section className="mw-review-proposal"><h3>Đề xuất Review</h3><p>Bài hiện tại giữ nguyên đến khi bạn chọn áp dụng.</p>{proposed?.finalDraft ? <><h4>{proposed.finalDraft.title}</h4><p className="mw-copy">{proposed.finalDraft.content}</p><button className="btn btn-primary btn-sm" disabled={busy || edit} onClick={() => act('applyReview', { attemptId: candidate.id, draftId: proposed.draftId })}>Áp dụng bản đề xuất</button></> : <button className="btn btn-outline btn-sm" disabled={busy || edit} onClick={() => act('retryReview', { attemptId: candidate.id })}>Thử lại Review</button>}<button className="btn btn-text btn-sm" disabled={busy} onClick={() => act('discardReview', { attemptId: candidate.id })}>Bỏ lượt đề xuất</button></section>}
        </>}
      </div><aside className="mw-detail-review"><h3>AI Review</h3><p role="status">{edit ? 'Bản đang sửa chưa được Review.' : review ? REVIEW_STATUS[review.status] : 'Chưa có kết quả Review.'}</p>{!valid && <p className="mw-error">Cần dàn ý hiện hành và Review lại trước khi duyệt bài.</p>}{!edit && review && <><ReviewSummary review={review} /><ReviewDetails review={review} /></>}</aside></div>
    </Modal>
  </article>;
}
