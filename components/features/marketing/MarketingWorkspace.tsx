'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { dashboardRequest, prepareUploadImage } from '@/lib/services/postsClient';
import { MARKETING_GOALS } from '@/lib/services/marketingBrief';
import type { MarketingCampaign, MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import { CampaignBriefForm } from './CampaignBriefForm';
import { MarketingScheduleTab } from './MarketingScheduleTab';
import { CampaignPerformanceTab } from './CampaignPerformanceTab';
import { ReviewDetails, REVIEW_STATUS } from './ReviewDetails';
import { MarketingContentPlanPanel } from './MarketingContentPlanPanel';
import { MarketingDraft } from './MarketingDraft';

export type MarketingWorkflowSection = 'campaigns' | 'composer' | 'approvals' | 'schedule' | 'performance';

/** Sau khi shop sửa bài/dàn ý/ảnh, AI Review tự chạy lại; null khi chưa đủ điều kiện (brief hoặc kế hoạch chưa duyệt). */
export function autoReview(action: string, input: Record<string, unknown>, next: MarketingWorkspaceView): { action: string; input: object } | null {
  if (action === 'editPlan') return { action: 'reviewPlan', input: { id: input.id } };
  if (action !== 'editPost' && action !== 'image') return null;
  const meta = next.workspace.reviews.find(item => item.postId === input.postId);
  const campaign = meta && next.workspace.campaigns.find(item => item.id === meta.campaignId);
  const plan = campaign?.approvedAt && next.workspace.contentPlans?.find(p => p.campaignId === campaign.id && p.campaignVersion === campaign.version && p.approvedAt);
  if (!meta || meta.publication !== 'draft' || !plan || !plan.items.length) return null;
  const itemId = plan.items.some(item => item.id === meta.plan?.itemId) ? meta.plan!.itemId : plan.items[0].id;
  return { action: 'review', input: { postId: meta.postId, plan: { id: plan.id, version: plan.version, itemId } } };
}
interface Props { section: MarketingWorkflowSection; onNavigate: (section: string, postId?: string) => void; }
type Ask = (title: string, message: string, action: () => Promise<unknown>) => void;
export function MarketingWorkspace({ section, onNavigate }: Props) {
  const [view, setView] = useState<MarketingWorkspaceView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [detailPlanId, setDetailPlanId] = useState('');
  const [detailPostId, setDetailPostId] = useState('');
  const [editing, setEditing] = useState<MarketingCampaign | 'new' | null>(null);
  const [approval, setApproval] = useState<{ title: string; message: string; action: () => Promise<unknown> } | null>(null);
  const { session } = useAppSecurity();
  const load = useCallback(async () => { try { setView(await marketingWorkspaceClient.read()); setError(''); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  // Review chạy ngay sau khi lưu; Review lỗi không làm mất bản đã lưu.
  const reviewAfter = async (action: string, input: Record<string, unknown>, saved: MarketingWorkspaceView) => {
    const next = autoReview(action, input, saved);
    if (!next) return;
    setNotice('Đã lưu. AI đang Review…');
    try { setView(await marketingWorkspaceClient.act(saved.revision, next.action, next.input)); setNotice('Đã lưu và Review xong. Xem đề xuất của AI rồi duyệt.'); }
    catch (e) { setError(`Đã lưu, nhưng Review tự động chưa xong: ${(e as Error).message} Bấm "Review lại" để thử lại.`); }
  };
  const act = async (action: string, input: object): Promise<boolean> => {
    if (!view || busy) return false;
    if (['generatePlan', 'generate', 'review', 'applyReview'].includes(action) && document.querySelector('.mw-root [data-unsaved="true"]')) { setError('Lưu hoặc hủy phần đang sửa trước khi tiếp tục với AI.'); return false; }
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await marketingWorkspaceClient.act(view.revision, action, input);
      setView(next); setNotice('Đã cập nhật');
      await reviewAfter(action, input as Record<string, unknown>, next);
      if (action === 'generatePlan') { setDetailPostId(''); setDetailPlanId(next.workspace.contentPlans?.[0]?.id ?? ''); }
      if (action === 'generate' || action === 'retryReview') {
        const created = next.workspace.reviews.find(r => !view.workspace.reviews.some(old => old.postId === r.postId));
        setDetailPlanId(''); if (created) setDetailPostId(created.postId);
      }
      return true;
    }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const confirm: Ask = (title, message, action) => setApproval({ title, message, action });
  const upload = async (postId: string, file: File | null) => {
    if (!view || busy) return;
    setBusy(true); setError('');
    try {
      const image = file ? await prepareUploadImage(file) : undefined;
      const response = await dashboardRequest(`/api/marketing/workspace/image?postId=${encodeURIComponent(postId)}&revision=${view.revision}`, { method: file ? 'PUT' : 'DELETE', body: image });
      const saved: MarketingWorkspaceView = await response.json();
      setView(saved); setNotice('Đã cập nhật ảnh.');
      await reviewAfter('image', { postId }, saved);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  if (!view) return <div className="mw-root">{error ? <div role="alert" className="mw-error">{error}<button className="btn btn-outline btn-sm" onClick={() => void load()}>Thử tải lại</button></div> : <p role="status">Đang tải Marketing…</p>}</div>;
  const campaigns = view.workspace.campaigns;
  const campaign = campaigns.find(item => item.id === campaignId) ?? campaigns[0];
  const filtered = view.workspace.reviews.filter(item => section === 'approvals' || item.campaignId === campaign?.id);
  return <div className="mw-root">
    {error && <div className="mw-error" role="alert">{error} <button className="btn btn-text btn-sm" onClick={() => void load()}>Tải dữ liệu mới</button></div>}
    <p className="mw-status" aria-live="polite">{busy ? 'Đang xử lý yêu cầu…' : notice}</p>
    <fieldset className="mw-body" disabled={busy}>
      {editing ? <CampaignBriefForm key={editing === 'new' ? 'new' : editing.id} view={view} initial={editing === 'new' ? undefined : editing} owner={session.userId || session.username} act={act} onClose={() => setEditing(null)} /> : <>
      {(section === 'composer' || section === 'approvals') && (view.workspace.reviewAttempts ?? []).filter(attempt => !attempt.appliedAt && !attempt.discardedAt && (attempt.targetPostId || attempt.status !== 'completed')).map(attempt => <section className="mw-item mw-review-attempt" key={attempt.id}>
        <div className="mw-section-head"><div><h3>{attempt.targetPostId ? 'Bản đề xuất sau khi Review lại' : 'Lượt soạn và Review cần xử lý'}</h3><p>{view.workspace.campaigns.find(c => c.id === attempt.campaignId)?.name}</p></div><span className="mw-chip">{REVIEW_STATUS[attempt.status]}</span></div>
        <p>{attempt.targetPostId ? 'Bài đang dùng được giữ nguyên đến khi bạn chọn áp dụng bản đề xuất.' : `${attempt.variants.filter(item => item.finalDraft).length}/${attempt.variants.length} phương án dùng được. Bản chưa đạt chưa được lưu thành bài sẵn sàng duyệt.`}</p>
        {attempt.variants.map(item => <div key={item.draftId}>{item.finalDraft ? <><h4>{item.finalDraft.title}</h4><p className="mw-copy">{item.finalDraft.content}</p>{attempt.targetPostId && <button className="btn btn-primary btn-sm" onClick={() => confirm('Áp dụng bản Review này?', 'Thay nội dung bài bằng bản đề xuất đang xem. Bài cần chủ shop duyệt lại; lịch liên quan sẽ tạm dừng.', () => act('applyReview', { attemptId: attempt.id, draftId: item.draftId }))}>Áp dụng bản đề xuất</button>}</> : <ul className="mw-review-issues" role="alert">{item.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}</div>)}
        <ReviewDetails review={attempt} />
        <div className="mw-actions">{attempt.variants.some(item => !item.finalDraft) && <button className="btn btn-outline btn-sm" onClick={() => act('retryReview', { attemptId: attempt.id })}>Thử lại Review từ bản gốc đã lưu</button>}<button className="btn btn-text btn-sm" onClick={() => act('discardReview', { attemptId: attempt.id })}>Bỏ lượt đề xuất</button></div>
      </section>)}
      {section === 'campaigns' && <>
        <div className="mw-section-head"><div><h2>Chiến dịch của shop</h2><p>Từ brief đến bài đã duyệt và lịch đăng, trong cùng một luồng.</p></div><button className="btn btn-primary" onClick={() => setEditing('new')}>Tạo chiến dịch</button></div>
        {!campaigns.length && <div className="mw-empty"><h3>Bắt đầu bằng một brief rõ ràng</h3><p>Chọn sản phẩm, đối tượng, thông điệp và tài khoản đăng. AI sẽ viết và rà lại trước khi bạn duyệt.</p><button className="btn btn-outline" onClick={() => setEditing('new')}>Tạo brief đầu tiên</button></div>}
        <div className="mw-list">{campaigns.map(item => { const account = view.accounts.find(a => a.id === item.accountId)!; const count = view.workspace.reviews.filter(post => post.campaignId === item.id).length; return <article className="mw-item" key={item.id}><div className="mw-section-head"><div><span className="mw-muted">{MARKETING_GOALS[item.goal as keyof typeof MARKETING_GOALS]} · {item.profile.name || account.name}{account.mock && ' · Dữ liệu mẫu'}</span><h3>{item.name}</h3><p>{item.message}</p></div><span className={`mw-chip ${item.approvedAt ? 'approved' : ''}`}>{item.approvedAt ? 'Brief đã duyệt' : 'Brief nháp'}</span></div><p className="mw-muted">{item.audience || 'Chưa chọn đối tượng'} · {count} bài · Phiên bản {item.version}</p><div className="mw-actions"><button className="btn btn-outline btn-sm" onClick={() => setEditing(item)}>Xem / chỉnh brief</button>{!item.approvedAt && <button className="btn btn-outline btn-sm" onClick={() => confirm('Duyệt brief chiến dịch?', 'Xác nhận sản phẩm, giá, chính sách, đối tượng và ưu đãi trong brief này. Thao tác này chưa đăng bài.', () => act('approveCampaign', { id: item.id }))}>Duyệt brief</button>}<button className="btn btn-primary btn-sm" onClick={() => { setCampaignId(item.id); onNavigate('composer'); }}>Mở soạn nội dung</button></div></article>; })}</div>
      </>}
      {(section === 'composer' || section === 'approvals') && <>
        <div className="mw-section-head"><div><h2>{section === 'composer' ? 'Soạn và rà soát nội dung' : 'Chủ shop duyệt nội dung'}</h2><p>{section === 'composer' ? 'Content viết → Review đối chiếu, sửa → bạn xem và duyệt.' : 'Đã Review không đồng nghĩa đã được duyệt đăng.'}</p></div><button className="btn btn-outline btn-sm" onClick={() => { if (document.querySelector('.mw-root [data-unsaved="true"]')) { setError('Lưu hoặc hủy bài đang chỉnh trước khi tạo chiến dịch.'); return; } onNavigate('campaigns'); setEditing('new'); }}>Tạo chiến dịch</button></div>
        {section === 'composer' && (campaign ? <section className="mw-summary"><label>Chiến dịch<select value={campaign.id} onChange={event => { if (document.querySelector('.mw-root [data-unsaved="true"]')) setError('Lưu hoặc hủy bài đang chỉnh trước khi đổi chiến dịch.'); else setCampaignId(event.target.value); }}>{campaigns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><h3>{campaign.message || campaign.name}</h3><p>{campaign.audience} · {campaign.format} · {campaign.profile.name || view.accounts.find(account => account.id === campaign.accountId)?.name}</p><p>Giọng: {campaign.tone || campaign.profile.tone} · CTA: {campaign.cta}</p><p>{campaign.offer.kind === 'none' ? 'Không áp dụng ưu đãi' : `${campaign.offer.details} · ${campaign.offer.conditions}`}</p><div className="mw-actions"><button className="btn btn-outline btn-sm" onClick={() => setEditing(campaign)}>Chỉnh brief</button></div>{!campaign.approvedAt && <p className="mw-muted">Duyệt brief trong Chiến dịch trước khi tạo bài.</p>}</section> : <p className="mw-empty">Chưa có chiến dịch. Tạo brief để bắt đầu.</p>)}
        {section === 'composer' && campaign && <MarketingContentPlanPanel key={campaign.id} view={view} campaign={campaign} busy={busy} error={error} openId={detailPlanId} onOpen={setDetailPlanId} onPostOpen={setDetailPostId} act={act} />}
        <div className="mw-list">{filtered.map(meta => { const post = view.posts.find(item => item.id === meta.postId); return post && <MarketingDraft key={`${post.id}:${post.updatedAt}:${meta.reviewedAt}:${post.image?.updatedAt}`} post={post} meta={meta} view={view} busy={busy} error={error} open={detailPostId === post.id} onOpen={() => setDetailPostId(post.id)} onClose={() => setDetailPostId('')} act={act} confirm={confirm} upload={upload} onComments={id => onNavigate('comments', id)} />; })}</div>
        {!filtered.length && <p className="mw-empty">Chưa có bài trong mục này.</p>}
      </>}
      {section === 'schedule' && <MarketingScheduleTab view={view} act={act} confirm={confirm} />}
      {section === 'performance' && <><div className="mw-section-head"><div><h2>Kết quả theo chiến dịch</h2><p>Hoạt động Facebook và kết quả mẫu được hiển thị riêng; chưa quy đổi tương tác thành doanh thu.</p></div></div><div className="mw-list">{campaigns.map(item => { const reviews = view.workspace.reviews.filter(review => review.campaignId === item.id); const mock = view.accounts.find(account => account.id === item.accountId)?.mock; return <article className="mw-item" key={item.id}><h3>{item.name}{mock && <span className="mw-chip">Kênh mẫu</span>}</h3><p>{reviews.length} bài · {reviews.filter(review => review.approvedAt).length} bài đã duyệt · {reviews.filter(review => review.publication === 'published').length} bài {mock ? 'hoàn tất mẫu' : 'đã đăng'}</p></article>; })}</div><CampaignPerformanceTab /></>}
      </>}
    </fieldset>
    <ConfirmDialog open={!!approval} title={approval?.title ?? ''} message={approval?.message} busy={busy} confirmLabel="Xác nhận" onClose={() => setApproval(null)} onConfirm={async () => { const action = approval?.action; if (action) await action(); setApproval(null); }} />
  </div>;
}

