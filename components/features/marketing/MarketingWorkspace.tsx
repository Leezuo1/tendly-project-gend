'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { dashboardRequest, prepareUploadImage } from '@/lib/services/postsClient';
import { MARKETING_GOALS } from '@/lib/services/marketingBrief';
import type { MarketingCampaign, MarketingContentPlan, MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import { BusyStatus } from './BusyStatus';
import { CampaignBriefForm } from './CampaignBriefForm';
import { MarketingScheduleTab } from './MarketingScheduleTab';
import { CampaignPerformanceTab } from './CampaignPerformanceTab';
import { ReviewDetails, REVIEW_STATUS } from './ReviewDetails';
import { MarketingContentPlanPanel } from './MarketingContentPlanPanel';
import { MarketingPostSplit } from './MarketingPostSplit';

export type MarketingWorkflowSection = 'campaigns' | 'composer' | 'approvals' | 'schedule' | 'performance';

/** Sau khi shop sửa bài/dàn ý/ảnh, AI Review tự chạy lại; null khi chưa đủ điều kiện (brief hoặc kế hoạch chưa duyệt). */
export function autoReview(action: string, input: Record<string, unknown>, next: MarketingWorkspaceView): { action: string; input: object } | null {
  if (action === 'editPlan') return { action: 'reviewPlan', input: { id: input.id } };
  // Chủ shop tự sửa bài (editPost) không kéo theo AI; chỉ đổi ảnh mới tự Review lại.
  return action === 'image' ? reviewPostInput(next, String(input.postId)) : null;
}
/** Yêu cầu Review một bài theo kế hoạch hiện hành; null khi chưa đủ điều kiện. Bài chủ shop tự sửa chỉ được Review khi force (shop chủ động nhờ AI). */
export function reviewPostInput(next: MarketingWorkspaceView, postId: string, force = false): { action: string; input: object } | null {
  const meta = next.workspace.reviews.find(item => item.postId === postId);
  const campaign = meta && next.workspace.campaigns.find(item => item.id === meta.campaignId);
  const plan = campaign?.approvedAt && next.workspace.contentPlans?.find(p => p.campaignId === campaign.id && p.campaignVersion === campaign.version && p.approvedAt);
  if (!meta || meta.publication !== 'draft' || !plan || !plan.items.length || (!force && !meta.reviewHash && meta.manualHash)) return null;
  const itemId = plan.items.some(item => item.id === meta.plan?.itemId) ? meta.plan!.itemId : plan.items[0].id;
  return { action: 'review', input: { postId: meta.postId, plan: { id: plan.id, version: plan.version, itemId } } };
}
/** Việc Review tự chạy tiếp theo (kế hoạch thiếu/lỗi Review, lượt Review lỗi, bài cần Review lại); mỗi mục một lần nhờ `attempted`. Lượt bị chặn (blocked) cần chủ shop xử lý nên không tự thử lại. */
export function nextAutoReview(view: MarketingWorkspaceView, attempted: Set<string>, campaignId?: string): { key: string; action: string; input: object } | null {
  const { campaigns, contentPlans = [], reviewAttempts = [], reviews } = view.workspace;
  for (const p of contentPlans.filter(p => !campaignId || p.campaignId === campaignId)) {
    const key = `plan:${p.id}:${p.version}`;
    if (!p.approvedAt && (!p.review || p.review.status === 'failed') && !attempted.has(key) && campaigns.some(c => c.id === p.campaignId && c.approvedAt && c.version === p.campaignVersion)) return { key, action: 'reviewPlan', input: { id: p.id } };
  }
  for (const a of reviewAttempts) {
    const key = `attempt:${a.id}`;
    if (!a.appliedAt && !a.discardedAt && a.status === 'failed' && !attempted.has(key)) return { key, action: 'retryReview', input: { attemptId: a.id } };
  }
  for (const r of reviews) {
    const key = `post:${r.postId}:${r.reviewedAt}`;
    // Bài đang chờ chủ shop áp dụng bản đề xuất đã được Review rồi; Review lại sẽ chỉ chồng thêm lượt trùng.
    const waiting = reviewAttempts.some(a => a.targetPostId === r.postId && !a.appliedAt && !a.discardedAt);
    const next = !r.reviewHash && !waiting && !attempted.has(key) ? reviewPostInput(view, r.postId) : null;
    if (next) return { key, ...next };
  }
  return null;
}
/** Bản kế hoạch với tiêu đề/dàn ý thay bằng đề xuất của AI Review; null khi Review không đề xuất gì khác. */
export function reviewedPlan(plan: MarketingContentPlan): MarketingContentPlan | null {
  let changed = false;
  const items = plan.items.map((item, i) => {
    const fix = plan.review?.variants[i]?.finalDraft;
    if (!fix || (fix.title.trim() === item.title.trim() && fix.content.trim() === item.outline.trim())) return item;
    changed = true;
    return { ...item, title: fix.title, outline: fix.content };
  });
  return changed ? { ...plan, items } : null;
}
interface Props { section: MarketingWorkflowSection; onNavigate: (section: string, postId?: string) => void; }
type Ask = (title: string, message: string, action: () => Promise<unknown>) => void;
export function MarketingWorkspace({ section, onNavigate }: Props) {
  const [view, setView] = useState<MarketingWorkspaceView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false); // `busy` chỉ cập nhật sau render nên hai lần bấm sát nhau vẫn lọt qua.
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
    try { setView(await marketingWorkspaceClient.act(saved.revision, next.action, next.input)); setNotice(''); }
    catch (e) {
      if ((e as { code?: string }).code === 'timeout') await load(); // server có thể đã Review xong; revision cũ sẽ làm lần sau bị từ chối
      setError(`Đã lưu, nhưng Review tự động chưa xong: ${(e as Error).message} Tải lại trang để hệ thống thử lại.`);
    }
  };
  // Mỗi bước là một request riêng (giới hạn 60 giây mỗi request). Lỗi giữa chừng không làm mất phần đã lưu.
  const chain = async (saved: MarketingWorkspaceView, steps: (run: (action: string, input: object, message: string) => Promise<MarketingWorkspaceView>) => Promise<void>) => {
    let current = saved;
    const run = async (action: string, input: object, message: string) => { setNotice(message); current = await marketingWorkspaceClient.act(current.revision, action, input); setView(current); return current; };
    try { await steps(run); }
    catch (e) {
      if ((e as { code?: string }).code === 'timeout') await load();
      setError(`Đã lưu, nhưng bước tự động chưa xong: ${(e as Error).message} Tải lại trang để hệ thống thử lại.`);
    }
  };
  // Kế hoạch mới (AI hoặc tự soạn): Review ngay, tự sửa theo Review một lần, rồi Review lại bản đã sửa.
  const settlePlan = (saved: MarketingWorkspaceView, planId: string) => chain(saved, async run => {
    let view = saved;
    const find = () => view.workspace.contentPlans?.find(p => p.id === planId);
    if (!find()?.review || find()!.review!.status === 'failed') view = await run('reviewPlan', { id: planId }, 'AI đang Review dàn ý…');
    const fixed = find() && reviewedPlan(find()!);
    if (fixed) {
      view = await run('editPlan', { id: planId, plan: fixed }, 'AI đang sửa dàn ý theo Review…');
      await run('reviewPlan', { id: planId }, 'AI đang Review lại dàn ý đã sửa…');
    }
    setNotice('');
  });
  // Chủ shop duyệt kế hoạch xong thì AI viết và Review từng bài theo dàn ý; bài vẫn cần chủ shop duyệt riêng.
  const writeAfterApproval = (saved: MarketingWorkspaceView, planId: string) => chain(saved, async run => {
    let view = saved;
    const plan = view.workspace.contentPlans?.find(p => p.id === planId);
    if (!plan?.approvedAt) return;
    for (const [i, item] of plan.items.entries()) {
      const binding = { id: plan.id, version: plan.version, itemId: item.id };
      const existing = view.workspace.reviews.find(r => r.plan?.id === plan.id && r.plan.itemId === item.id);
      const message = `AI đang viết và Review bài ${i + 1}/${plan.items.length}…`;
      if (!existing) view = await run('generate', { campaignId: plan.campaignId, plan: binding }, message);
      // Bài viết theo bản dàn ý cũ: Review lại theo bản vừa duyệt (ra bản đề xuất, bài hiện tại giữ nguyên đến khi áp dụng).
      else if (existing.plan!.version !== plan.version && existing.publication === 'draft') view = await run('review', { postId: existing.postId, plan: binding }, message);
    }
    setNotice('');
  });
  const act = async (action: string, input: object): Promise<boolean> => {
    if (!view || busy || inflight.current) return false;
    if (['generatePlan', 'generate', 'review', 'applyReview'].includes(action) && document.querySelector('.mw-root [data-unsaved="true"]')) { setError('Lưu hoặc hủy phần đang sửa trước khi tiếp tục với AI.'); return false; }
    inflight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await marketingWorkspaceClient.act(view.revision, action, input);
      setView(next);
      await reviewAfter(action, input as Record<string, unknown>, next);
      if (action === 'generatePlan') { setDetailPostId(''); setDetailPlanId(next.workspace.contentPlans?.[0]?.id ?? ''); }
      if (action === 'generate' || action === 'retryReview') {
        const created = next.workspace.reviews.find(r => !view.workspace.reviews.some(old => old.postId === r.postId));
        setDetailPlanId(''); if (created) { setDetailPostId(created.postId); if (action === 'generate' && section === 'composer') onNavigate('approvals', created.postId); }
      }
      if (action === 'createPlan') setDetailPlanId(next.workspace.contentPlans?.[0]?.id ?? '');
      if (action === 'generatePlan' || action === 'createPlan') await settlePlan(next, next.workspace.contentPlans?.[0]?.id ?? '');
      if (action === 'approvePlan') await writeAfterApproval(next, String((input as { id?: unknown }).id));
      return true;
    }
    catch (e) {
      // A failed publish still changes server state (draft/unknown), so reload it or the card and revision stay stale.
      if (action === 'publish' || (e as { code?: string }).code === 'timeout') await load();
      const message = (e as Error).message;
      setError(message);
      // Duyệt/đăng bị từ chối vì căn cứ Review đã cũ (sản phẩm, FAQ, brief đổi): tự Review lại bài đó, không chờ người dùng bấm.
      if ((action === 'approvePost' || action === 'publish') && /Review/.test(message)) {
        try {
          const fresh = await marketingWorkspaceClient.read(); setView(fresh);
          const waiting = fresh.workspace.reviewAttempts?.some(a => a.targetPostId === (input as { postId?: string }).postId && !a.appliedAt && !a.discardedAt);
          const next = waiting ? null : reviewPostInput(fresh, String((input as { postId?: string }).postId));
          if (next) {
            setNotice('Căn cứ đã thay đổi. AI đang Review lại bài…');
            setView(await marketingWorkspaceClient.act(fresh.revision, next.action, next.input));
            setError(''); setNotice('');
          }
        } catch (inner) { setError(`${message} Review tự động chưa xong: ${(inner as Error).message}`); }
      }
      return false;
    }
    finally { inflight.current = false; setBusy(false); }
  };
  // Không có nút Review: Review thiếu hoặc lỗi thì tự chạy lại, mỗi mục một lần mỗi lần mở trang.
  const attempted = useRef(new Set<string>()), actRef = useRef(act);
  useEffect(() => { actRef.current = act; });
  useEffect(() => {
    if (!view || busy || inflight.current || (section !== 'composer' && section !== 'approvals') || document.querySelector('.mw-root [data-unsaved="true"]')) return;
    const next = nextAutoReview(view, attempted.current, section === 'composer' ? campaignId || view.workspace.campaigns[0]?.id : undefined);
    if (!next) return;
    attempted.current.add(next.key); void actRef.current(next.action, next.input);
  }, [view, busy, section, campaignId]);
  // Rời bước 1 thì bỏ form brief chưa sửa, để nó không bật lại khi quay về.
  const [lastSection, setLastSection] = useState(section);
  if (lastSection !== section) { setLastSection(section); if (section !== 'campaigns') setEditing(null); }
  const confirm: Ask = (title, message, action) => setApproval({ title, message, action });
  const upload = async (postId: string, file: File | null) => {
    if (!view || busy || inflight.current) return;
    inflight.current = true; setBusy(true); setError('');
    try {
      const image = file ? await prepareUploadImage(file) : undefined;
      const response = await dashboardRequest(`/api/marketing/workspace/image?postId=${encodeURIComponent(postId)}&revision=${view.revision}`, { method: file ? 'PUT' : 'DELETE', body: image });
      const saved: MarketingWorkspaceView = await response.json();
      setView(saved);
      await reviewAfter('image', { postId }, saved);
    } catch (e) { setError((e as Error).message); }
    finally { inflight.current = false; setBusy(false); }
  };
  if (!view) return <div className="mw-root">{error ? <div role="alert" className="mw-error">{error}<button className="btn btn-outline btn-sm" onClick={() => void load()}>Thử tải lại</button></div> : <p role="status">Đang tải Marketing…</p>}</div>;
  const campaigns = view.workspace.campaigns;
  const campaign = campaigns.find(item => item.id === campaignId) ?? campaigns[0];
  const studio = section === 'campaigns' || section === 'composer' || section === 'approvals';
  const waiting = view.workspace.reviews.filter(item => item.publication === 'draft' && !item.approvedAt).length;
  const selectPost = (id: string) => { if (document.querySelector('.mw-root [data-unsaved="true"]')) setError('Lưu hoặc hủy bài đang chỉnh trước khi xem bài khác.'); else setDetailPostId(id); };
  const editBrief = (item: MarketingCampaign | 'new') => { setEditing(item); if (section !== 'campaigns') onNavigate('campaigns'); };
  return <div className="mw-root">
    {error && <div className="mw-error" role="alert">{error} <button className="btn btn-text btn-sm" onClick={() => void load()}>Tải dữ liệu mới</button></div>}
    <p className="mw-status" aria-live="polite">{busy ? <><BusyStatus /> {notice}</> : notice}</p>
    {/* Ngoài fieldset: AI đang chạy (có thể vài phút) vẫn phải chuyển bước để xem bài đã viết xong. */}
      {studio && <nav className="mw-stepper" aria-label="Các bước của chiến dịch"><ol>{([['campaigns', '1. Brief chiến dịch', ''], ['composer', '2. Kế hoạch dàn ý', ''], ['approvals', '3. Bài viết & phê duyệt', waiting ? `${waiting} chờ duyệt` : '']] as const).map(([key, label, note]) => <li key={key}><button type="button" aria-current={section === key ? 'step' : undefined} onClick={() => key !== section && onNavigate(key)}>{label}{note && <small>{note}</small>}</button></li>)}</ol></nav>}
    {/* Bước 3 không khóa cả khối: shop vẫn xem và chỉnh tay bài trong lúc AI chạy, từng nút tự khóa theo busy. */}
    <fieldset className="mw-body" disabled={busy && section !== 'approvals'}>
      {editing && section === 'campaigns' ? <CampaignBriefForm key={editing === 'new' ? 'new' : editing.id} view={view} initial={editing === 'new' ? undefined : editing} owner={session.userId || session.username} act={act} onClose={() => setEditing(null)} /> : <>
      {(section === 'composer' || section === 'approvals') && (view.workspace.reviewAttempts ?? []).filter(attempt => !attempt.targetPostId && !attempt.appliedAt && !attempt.discardedAt && attempt.status !== 'completed').map(attempt => <section className="mw-item mw-review-attempt" key={attempt.id}>
        <div className="mw-section-head"><div><h3>Lượt soạn và Review cần xử lý</h3><p>{view.workspace.campaigns.find(c => c.id === attempt.campaignId)?.name}</p></div><span className="mw-badge waiting">{REVIEW_STATUS[attempt.status]}</span></div>
        <p>{attempt.variants.filter(item => item.finalDraft).length}/{attempt.variants.length} phương án dùng được. Bản chưa đạt chưa được lưu thành bài sẵn sàng duyệt.</p>
        {attempt.variants.map(item => <div key={item.draftId}>{item.finalDraft ? <><h4>{item.finalDraft.title}</h4><p className="mw-copy">{item.finalDraft.content}</p></> : <ul className="mw-review-issues" role="alert">{item.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}</div>)}
        <ReviewDetails review={attempt} />
        <div className="mw-actions">{attempt.variants.some(item => !item.finalDraft) && <p className="mw-muted">Review chưa xong; hệ thống tự thử lại.</p>}<button className="btn btn-text btn-sm" onClick={() => act('discardReview', { attemptId: attempt.id })}>Bỏ lượt đề xuất</button></div>
      </section>)}
      {section === 'campaigns' && <>
        <div className="mw-section-head"><h2>Chiến dịch</h2><button className="btn btn-primary" onClick={() => setEditing('new')}>Tạo chiến dịch</button></div>
        {!campaigns.length && <div className="mw-empty"><h3>Bắt đầu bằng một brief rõ ràng</h3><p>Chọn sản phẩm, đối tượng, thông điệp và tài khoản đăng.</p><button className="btn btn-outline" onClick={() => setEditing('new')}>Tạo brief đầu tiên</button></div>}
        <div className="mw-list">{campaigns.map(item => { const account = view.accounts.find(a => a.id === item.accountId)!; const count = view.workspace.reviews.filter(post => post.campaignId === item.id).length; return <article className="mw-item" key={item.id}><div className="mw-section-head"><div><h3>{item.name}</h3><p>{item.message}</p></div><span className={`mw-badge ${item.approvedAt ? 'approved' : 'draft'}`}>{item.approvedAt ? 'Brief đã duyệt' : 'Brief nháp'}</span></div>
          <dl className="mw-facts"><div><dt>Mục tiêu</dt><dd>{MARKETING_GOALS[item.goal as keyof typeof MARKETING_GOALS]}</dd></div><div><dt>Kênh đăng</dt><dd>{item.profile.name || account.name}{account.mock && ' (dữ liệu mẫu)'}</dd></div><div><dt>Đối tượng</dt><dd>{item.audience || 'Chưa chọn'}</dd></div><div><dt>Bài viết</dt><dd>{count} bài · brief phiên bản {item.version}</dd></div></dl>
          <div className="mw-actions"><button className="btn btn-outline btn-sm" onClick={() => setEditing(item)}>Xem / chỉnh brief</button>{item.approvedAt ? <button className="btn btn-primary btn-sm" onClick={() => { setCampaignId(item.id); onNavigate('composer'); }}>Lập kế hoạch dàn ý</button> : <button className="btn btn-primary btn-sm" onClick={() => confirm('Duyệt brief chiến dịch?', 'Xác nhận sản phẩm, giá, chính sách, đối tượng và ưu đãi trong brief này. Thao tác này chưa đăng bài.', () => act('approveCampaign', { id: item.id }))}>Duyệt brief</button>}</div></article>; })}</div>
      </>}
      {(section === 'composer' || section === 'approvals') && <>
        {section === 'composer' && (campaign ? <section className="mw-summary"><div className="mw-summary-head"><label>Chiến dịch<select value={campaign.id} onChange={event => { if (document.querySelector('.mw-root [data-unsaved="true"]')) setError('Lưu hoặc hủy bài đang chỉnh trước khi đổi chiến dịch.'); else setCampaignId(event.target.value); }}>{campaigns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="btn btn-outline btn-sm" onClick={() => editBrief(campaign)}>Chỉnh brief</button></div>
          <h3>{campaign.message || campaign.name}</h3>
          <dl className="mw-facts"><div><dt>Đối tượng</dt><dd>{campaign.audience || 'Chưa chọn'}</dd></div><div><dt>Định dạng</dt><dd>{campaign.format}</dd></div><div><dt>Kênh đăng</dt><dd>{campaign.profile.name || view.accounts.find(account => account.id === campaign.accountId)?.name}</dd></div><div><dt>Giọng điệu</dt><dd>{campaign.tone || campaign.profile.tone}</dd></div><div><dt>CTA</dt><dd>{campaign.cta}</dd></div><div><dt>Ưu đãi</dt><dd>{campaign.offer.kind === 'none' ? 'Không áp dụng' : `${campaign.offer.details} · ${campaign.offer.conditions}`}</dd></div></dl>
          {!campaign.approvedAt && <p className="mw-hint">Duyệt brief ở bước 1 trước khi tạo bài.</p>}</section> : <p className="mw-empty">Chưa có chiến dịch. Tạo brief để bắt đầu.</p>)}
        {section === 'composer' && campaign && <MarketingContentPlanPanel key={campaign.id} view={view} campaign={campaign} busy={busy} error={error} notice={notice} openId={detailPlanId} onOpen={setDetailPlanId} onPostOpen={id => { setDetailPostId(id); onNavigate('approvals', id); }} act={act} />}
        {section === 'approvals' && <MarketingPostSplit view={view} selectedId={detailPostId} busy={busy} error={error} onSelect={selectPost} onAskAi={postId => { const next = reviewPostInput(view, postId, true); if (next) void act(next.action, next.input); }} act={act} confirm={confirm} upload={upload} onComments={id => onNavigate('comments', id)} />}
      </>}
      {section === 'schedule' && <MarketingScheduleTab view={view} act={act} confirm={confirm} />}
      {section === 'performance' && <><div className="mw-section-head"><h2>Hiệu quả</h2></div><CampaignPerformanceTab />
        <section className="card mw-results"><div className="card-head"><h2>Kết quả theo chiến dịch</h2><span className="hint">Chưa quy đổi tương tác thành doanh thu</span></div>
          {!campaigns.length && <p className="mw-muted">Chưa có chiến dịch.</p>}
          {campaigns.map(item => { const reviews = view.workspace.reviews.filter(review => review.campaignId === item.id); const mock = view.accounts.find(account => account.id === item.accountId)?.mock; return <div className="mw-result-row" key={item.id}><b>{item.name}{mock && <span className="mw-badge draft">Kênh mẫu</span>}</b><span>{reviews.length} bài</span><span>{reviews.filter(review => review.approvedAt).length} đã duyệt</span><span>{reviews.filter(review => review.publication === 'published').length} {mock ? 'hoàn tất mẫu' : 'đã đăng'}</span></div>; })}
        </section></>}
      </>}
    </fieldset>
    <ConfirmDialog open={!!approval} title={approval?.title ?? ''} message={approval?.message} busy={busy} confirmLabel="Xác nhận" onClose={() => setApproval(null)} onConfirm={async () => { const action = approval?.action; if (action) await action(); setApproval(null); }} />
  </div>;
}

