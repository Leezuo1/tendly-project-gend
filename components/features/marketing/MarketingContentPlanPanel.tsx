'use client';

import { useState } from 'react';
import type { MarketingCampaign, MarketingContentPlan, MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import { BusyStatus } from './BusyStatus';
import { ReviewDetails, ReviewSummary, REVIEW_STATUS } from './ReviewDetails';

type NewPlan = { pillars: { name: string; objective: string }[]; items: { pillarIndex: number; title: string; outline: string }[] };
const blankPlan = (): NewPlan => ({ pillars: [{ name: '', objective: '' }], items: [{ pillarIndex: 0, title: '', outline: '' }] });
type Props = { view: MarketingWorkspaceView; campaign: MarketingCampaign; busy: boolean; error: string; notice: string; openId: string; onOpen: (id: string) => void; onPostOpen: (id: string) => void; act: (action: string, input: object) => Promise<boolean> };

export function MarketingContentPlanPanel({ view, campaign, busy, error, notice, openId, onOpen, onPostOpen, act }: Props) {
  const [itemIndex, setItemIndex] = useState(0);
  const [editing, setEditing] = useState<MarketingContentPlan | null>(null);
  const plans = (view.workspace.contentPlans ?? []).filter(p => p.campaignId === campaign.id);
  const plan = plans.find(p => p.id === openId);
  const draft = editing?.id === plan?.id ? editing : null;
  const index = Math.min(itemIndex, (plan?.items.length ?? 1) - 1);
  const item = (draft ?? plan)?.items[index];
  const reviewed = plan?.review?.variants[index];
  const current = plan?.campaignVersion === campaign.version && !!campaign.approvedAt;
  const post = plan && item && view.workspace.reviews.find(r => r.plan?.id === plan.id && r.plan.itemId === item.id);
  const run = async (action: string, input: object) => { if (await act(action, input)) setEditing(null); };
  // Chủ shop tự soạn kế hoạch: không cần AI để thêm mới; AI chỉ Review sau khi lưu.
  const [creating, setCreating] = useState<NewPlan | null>(null);
  const valid = !!creating && creating.pillars.every(p => p.name.trim() && p.objective.trim()) && creating.items.every(i => i.title.trim() && i.outline.trim())
    && creating.pillars.every((_, i) => creating.items.some(item => item.pillarIndex === i));
  const patchCreating = (patch: Partial<NewPlan>) => setCreating(current => current && { ...current, ...patch });
  async function submitCreating() {
    const draft = creating!; setCreating(null);
    if (!await act('createPlan', { campaignId: campaign.id, plan: draft })) setCreating(draft);
  }
  const locked = busy || !campaign.approvedAt || !!editing || !!creating;
  return <section className="mw-plan-panel" data-unsaved={!!editing || !!creating}>
    <div className="mw-section-head"><h3>Kế hoạch nội dung</h3><div className="mw-actions mw-actions-start"><button className="btn btn-outline btn-sm" disabled={locked} onClick={() => setCreating(blankPlan())}>Tự soạn dàn ý</button><button className="btn btn-primary btn-sm" disabled={locked} onClick={() => act('generatePlan', { campaignId: campaign.id })}>Lập kế hoạch bằng AI</button></div></div>
    {creating && <section className="mw-editor" data-unsaved="true" aria-label="Tự soạn kế hoạch nội dung">
      {error && <p className="mw-error" role="alert">{error}</p>}
      <h4 className="mw-group-title">Trụ cột nội dung</h4>
      {creating.pillars.map((pillar, i) => <div className="mw-plan-pillar" key={i}>
        <label>Tên trụ cột<input maxLength={150} value={pillar.name} onChange={e => patchCreating({ pillars: creating.pillars.map((p, n) => n === i ? { ...p, name: e.target.value } : p) })} /></label>
        <label>Mục tiêu<textarea maxLength={500} value={pillar.objective} onChange={e => patchCreating({ pillars: creating.pillars.map((p, n) => n === i ? { ...p, objective: e.target.value } : p) })} /></label>
        {creating.pillars.length > 1 && !creating.items.some(item => item.pillarIndex === i) && <button type="button" className="btn btn-text btn-sm" onClick={() => patchCreating({ pillars: creating.pillars.filter((_, n) => n !== i), items: creating.items.map(item => ({ ...item, pillarIndex: item.pillarIndex > i ? item.pillarIndex - 1 : item.pillarIndex })) })}>Xóa trụ cột</button>}
      </div>)}
      {creating.pillars.length < 3 && <button type="button" className="btn btn-outline btn-sm" onClick={() => patchCreating({ pillars: [...creating.pillars, { name: '', objective: '' }] })}>Thêm trụ cột</button>}
      <h4 className="mw-group-title">Dàn ý</h4>
      {creating.items.map((entry, i) => <div className="mw-plan-pillar" key={i}>
        <label>Trụ cột của bài<select value={entry.pillarIndex} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, pillarIndex: Number(e.target.value) } : p) })}>{creating.pillars.map((p, n) => <option key={n} value={n}>{p.name || `Trụ cột ${n + 1}`}</option>)}</select></label>
        <label>Heading / tiêu đề<input maxLength={200} value={entry.title} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, title: e.target.value } : p) })} /></label>
        <label>Dàn ý chi tiết<textarea rows={8} maxLength={3500} value={entry.outline} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, outline: e.target.value } : p) })} /></label>
        {creating.items.length > 1 && <button type="button" className="btn btn-text btn-sm" onClick={() => patchCreating({ items: creating.items.filter((_, n) => n !== i) })}>Xóa dàn ý</button>}
      </div>)}
      {creating.items.length < 6 && <button type="button" className="btn btn-outline btn-sm" onClick={() => patchCreating({ items: [...creating.items, { pillarIndex: 0, title: '', outline: '' }] })}>Thêm dàn ý</button>}
      <div className="mw-actions mw-decision"><button className="btn btn-outline" onClick={() => setCreating(null)}>Hủy</button><button className="btn btn-primary" disabled={busy || !valid} onClick={() => void submitCreating()}>Lưu và Review dàn ý</button></div>
      <p className="mw-hint mw-hint-end">Mỗi trụ cột cần ít nhất một dàn ý. AI sẽ Review ngay sau khi lưu.</p>
    </section>}
    {editing && !plan && plans.some(p => p.id === editing.id) && <p className="mw-error" role="status">Bạn có bản sửa kế hoạch chưa lưu, nên các thao tác AI đang bị khóa. <button className="btn btn-text btn-sm" onClick={() => onOpen(editing.id)}>Tiếp tục sửa</button><button className="btn btn-text btn-sm" onClick={() => setEditing(null)}>Bỏ bản sửa</button></p>}
    {!plans.length && !creating && <p className="mw-empty">{campaign.approvedAt ? 'Chưa có kế hoạch. Tự soạn dàn ý hoặc để AI lập kế hoạch.' : 'Duyệt brief ở bước 1 trước khi lập kế hoạch.'}</p>}
    {plans.map(p => <div className="mw-plan-row" key={p.id}><div><b>{p.pillars.map(pillar => pillar.name).join(' · ')}</b><p className="mw-muted">{p.items.length} dàn ý · Phiên bản {p.version}</p></div><span className={`mw-badge ${p.campaignVersion !== campaign.version ? 'stale' : p.approvedAt ? 'approved' : 'waiting'}`}>{p.campaignVersion !== campaign.version ? 'Brief đã thay đổi' : p.approvedAt ? 'Kế hoạch đã duyệt' : 'Chờ duyệt kế hoạch'}</span><button className="btn btn-outline btn-sm" aria-expanded={p.id === openId} disabled={!!editing && editing.id !== p.id} onClick={() => { setItemIndex(0); onOpen(p.id === openId ? '' : p.id); }}>{p.id === openId ? 'Thu gọn' : 'Xem dàn ý'}</button></div>)}
    {plan && item && <div className="mw-split">
      <ol className="mw-split-list" aria-label="Dàn ý trong kế hoạch">{plan.items.map((entry, i) => { const entryPost = view.workspace.reviews.find(r => r.plan?.id === plan.id && r.plan.itemId === entry.id); return <li key={entry.id}><button type="button" disabled={busy} aria-current={i === index ? 'true' : undefined} onClick={() => setItemIndex(i)}><b>{i + 1}. {(draft ?? plan).items[i].title}</b><span>{plan.pillars[entry.pillarIndex].name}{entryPost ? ' · Đã viết bài' : ''}</span></button></li>; })}</ol>
      <div className="mw-split-detail" data-unsaved={!!draft}>
        {error && <p className="mw-error" role="alert">{error}</p>}
        {busy && <p role="status"><BusyStatus /> {notice}</p>}
        {draft ? <><h4 className="mw-group-title">Trụ cột nội dung</h4>{draft.pillars.map((pillar, i) => <div className="mw-plan-pillar" key={i}><label>Tên trụ cột<input maxLength={150} required value={pillar.name} onChange={e => setEditing({ ...draft, pillars: draft.pillars.map((p, n) => n === i ? { ...p, name: e.target.value } : p) })} /></label><label>Mục tiêu<textarea maxLength={500} value={pillar.objective} onChange={e => setEditing({ ...draft, pillars: draft.pillars.map((p, n) => n === i ? { ...p, objective: e.target.value } : p) })} /></label></div>)}
          <h4 className="mw-group-title">Dàn ý số {index + 1}</h4>
          <label>Trụ cột của bài<select value={item.pillarIndex} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, pillarIndex: Number(e.target.value) } : p) })}>{draft.pillars.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select></label>
          <label>Heading / tiêu đề<input aria-label="Heading / tiêu đề" maxLength={200} value={item.title} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, title: e.target.value } : p) })} /></label><label>Dàn ý chi tiết<textarea aria-label="Dàn ý chi tiết" rows={12} maxLength={3500} value={item.outline} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, outline: e.target.value } : p) })} /></label></>
          : <><header className="mw-detail-head"><div><h3>{item.title}</h3><p className="mw-meta">{plan.pillars[item.pillarIndex].name} · {plan.pillars[item.pillarIndex].objective}</p></div></header><div className="mw-copy">{item.outline}</div>
            <section className="mw-ai-reason" aria-label="AI Review"><h4>Rà soát của AI</h4><p role="status" className="mw-muted">{plan.review ? REVIEW_STATUS[plan.review.status] : 'Chưa có kết quả Review.'}</p>{!current && <p className="mw-error">Brief đã thay đổi. Tạo kế hoạch theo brief mới.</p>}{plan.review && <><ReviewSummary review={{ ...plan.review, variants: reviewed ? [reviewed] : [] }} /><ReviewDetails review={{ ...plan.review, variants: reviewed ? [reviewed] : [] }} /></>}</section></>}
        <div className="mw-actions mw-decision">
          {draft ? <><button className="btn btn-outline" disabled={busy} onClick={() => setEditing(null)}>Hủy sửa</button><button className="btn btn-primary" disabled={busy} onClick={() => run('editPlan', { id: plan.id, plan: draft })}>Lưu và Review dàn ý</button></> : <>
            <button className="btn btn-text btn-sm" disabled={busy || !current} onClick={() => act('generatePlan', { campaignId: campaign.id })}>Viết lại bằng AI</button>
            {!plan.approvedAt && plan.review?.variants.some(v => v.finalDraft) && <button className="btn btn-text btn-sm" disabled={busy || !current} onClick={() => setEditing({ ...structuredClone(plan), items: plan.items.map((entry, i) => { const s = plan.review!.variants[i]?.finalDraft; return s ? { ...entry, title: s.title, outline: s.content } : entry; }) })}>Dùng gợi ý của Review</button>}
            <button className="btn btn-outline" disabled={busy || !current} onClick={() => setEditing(structuredClone(plan))}>Chỉnh kế hoạch</button>
            {post && <button className="btn btn-outline" disabled={busy} onClick={() => onPostOpen(post.postId)}>Mở bài viết</button>}
            {!plan.approvedAt && <button className="btn btn-primary" disabled={busy || !current || !plan.review || plan.review.status === 'failed'} onClick={() => act('approvePlan', { id: plan.id })}>Duyệt toàn bộ kế hoạch</button>}
            {!!plan.approvedAt && <button className="btn btn-primary" disabled={busy || !current} onClick={() => act('generate', { campaignId: campaign.id, plan: { id: plan.id, version: plan.version, itemId: item.id } })}>Viết bài theo dàn ý này</button>}
          </>}
        </div>
        {draft ? <p className="mw-hint mw-hint-end">Lưu sửa sẽ hủy duyệt kế hoạch và các bài phụ thuộc; cần Review lại.</p> : !plan.approvedAt && <p className="mw-hint mw-hint-end">Sau khi duyệt, AI sẽ viết từng bài theo dàn ý.</p>}
      </div>
    </div>}
  </section>;
}
