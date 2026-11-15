'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
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
  return <section className="mw-plan-panel" data-unsaved={!!editing || !!creating}>
    <div className="mw-section-head"><div><h3>Kế hoạch nội dung</h3><p>Trụ cột → heading và dàn ý → duyệt kế hoạch → viết bài.</p></div><div className="mw-actions"><button className="btn btn-outline btn-sm" disabled={busy || !campaign.approvedAt || !!editing || !!creating} onClick={() => setCreating(blankPlan())}>Tự soạn dàn ý</button><button className="btn btn-primary btn-sm" disabled={busy || !campaign.approvedAt || !!editing || !!creating} onClick={() => act('generatePlan', { campaignId: campaign.id })}>Lập kế hoạch bằng AI</button></div></div>
    <Modal open={!!creating} title="Tự soạn kế hoạch nội dung" onClose={() => setCreating(null)} width={900} footer={<><button className="btn btn-outline btn-sm" onClick={() => setCreating(null)}>Hủy</button><button className="btn btn-primary btn-sm" disabled={busy || !valid} onClick={() => void submitCreating()}>Lưu và Review dàn ý</button></>}>
      {creating && <div data-unsaved="true">
        {error && <p className="mw-error" role="alert">{error}</p>}
        <h3>Trụ cột nội dung</h3>
        {creating.pillars.map((pillar, i) => <div className="mw-plan-pillar" key={i}>
          <label>Tên trụ cột<input maxLength={150} value={pillar.name} onChange={e => patchCreating({ pillars: creating.pillars.map((p, n) => n === i ? { ...p, name: e.target.value } : p) })} /></label>
          <label>Mục tiêu<textarea maxLength={500} value={pillar.objective} onChange={e => patchCreating({ pillars: creating.pillars.map((p, n) => n === i ? { ...p, objective: e.target.value } : p) })} /></label>
          {creating.pillars.length > 1 && !creating.items.some(item => item.pillarIndex === i) && <button type="button" className="btn btn-text btn-sm" onClick={() => patchCreating({ pillars: creating.pillars.filter((_, n) => n !== i), items: creating.items.map(item => ({ ...item, pillarIndex: item.pillarIndex > i ? item.pillarIndex - 1 : item.pillarIndex })) })}>Xóa trụ cột</button>}
        </div>)}
        {creating.pillars.length < 3 && <button type="button" className="btn btn-outline btn-sm" onClick={() => patchCreating({ pillars: [...creating.pillars, { name: '', objective: '' }] })}>Thêm trụ cột</button>}
        <h3>Dàn ý</h3>
        {creating.items.map((entry, i) => <div className="mw-plan-pillar" key={i}>
          <label>Trụ cột của bài<select value={entry.pillarIndex} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, pillarIndex: Number(e.target.value) } : p) })}>{creating.pillars.map((p, n) => <option key={n} value={n}>{p.name || `Trụ cột ${n + 1}`}</option>)}</select></label>
          <label>Heading / tiêu đề<input maxLength={200} value={entry.title} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, title: e.target.value } : p) })} /></label>
          <label>Dàn ý chi tiết<textarea rows={8} maxLength={3500} value={entry.outline} onChange={e => patchCreating({ items: creating.items.map((p, n) => n === i ? { ...p, outline: e.target.value } : p) })} /></label>
          {creating.items.length > 1 && <button type="button" className="btn btn-text btn-sm" onClick={() => patchCreating({ items: creating.items.filter((_, n) => n !== i) })}>Xóa dàn ý</button>}
        </div>)}
        {creating.items.length < 6 && <button type="button" className="btn btn-outline btn-sm" onClick={() => patchCreating({ items: [...creating.items, { pillarIndex: 0, title: '', outline: '' }] })}>Thêm dàn ý</button>}
        <p className="mw-muted">Mỗi trụ cột cần ít nhất một dàn ý. Sau khi lưu, AI tự Review và đề xuất sửa; bạn duyệt kế hoạch trước khi viết bài.</p>
      </div>}
    </Modal>
    {editing && !plan && plans.some(p => p.id === editing.id) && <p className="mw-error" role="status">Bạn có bản sửa kế hoạch chưa lưu, nên các thao tác AI đang bị khóa. <button className="btn btn-text btn-sm" onClick={() => onOpen(editing.id)}>Tiếp tục sửa</button><button className="btn btn-text btn-sm" onClick={() => setEditing(null)}>Bỏ bản sửa</button></p>}
    {!plans.length && <p className="mw-empty">Chưa có kế hoạch. Duyệt brief rồi tạo trụ cột và dàn ý để bắt đầu.</p>}
    {plans.map(p => <div className="mw-plan-row" key={p.id}><div><b>{p.pillars.map(pillar => pillar.name).join(' · ')}</b><p className="mw-muted">{p.items.length} dàn ý · Phiên bản {p.version} · {p.campaignVersion !== campaign.version ? 'Brief đã thay đổi' : p.approvedAt ? 'Kế hoạch đã duyệt' : 'Chờ duyệt kế hoạch'}</p></div><button className="btn btn-outline btn-sm" disabled={!!editing && editing.id !== p.id} onClick={() => { setItemIndex(0); onOpen(p.id); }}>Xem dàn ý</button></div>)}
    <Modal open={!!plan} title="Dàn ý chi tiết" onClose={() => onOpen('')} width={1140} footer={<>
      <button className="btn btn-outline btn-sm" onClick={() => onOpen('')}>Đóng</button>
      {draft ? <><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setEditing(null)}>Hủy sửa</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run('editPlan', { id: plan!.id, plan: draft })}>Lưu và Review dàn ý</button></> : <>
        <button className="btn btn-outline btn-sm" disabled={busy || !current} onClick={() => setEditing(structuredClone(plan!))}>Chỉnh kế hoạch</button>
        <button className="btn btn-outline btn-sm" disabled={busy || !current} onClick={() => act('generatePlan', { campaignId: campaign.id })}>Viết lại bằng AI</button>
        {!plan?.approvedAt && plan?.review?.variants.some(v => v.finalDraft) && <button className="btn btn-outline btn-sm" disabled={busy || !current} onClick={() => setEditing({ ...structuredClone(plan), items: plan.items.map((entry, i) => { const s = plan.review!.variants[i]?.finalDraft; return s ? { ...entry, title: s.title, outline: s.content } : entry; }) })}>Dùng gợi ý của Review</button>}
        {!plan?.approvedAt && <button className="btn btn-primary btn-sm" disabled={busy || !current || !plan?.review || plan.review.status === 'failed'} onClick={() => act('approvePlan', { id: plan!.id })}>Duyệt toàn bộ kế hoạch</button>}
        {!!plan?.approvedAt && <button className="btn btn-primary btn-sm" disabled={busy || !current} onClick={() => act('generate', { campaignId: campaign.id, plan: { id: plan.id, version: plan.version, itemId: item!.id } })}>Viết bài theo dàn ý này</button>}
      </>}
    </>}>
      {error && <p className="mw-error" role="alert">{error}</p>}
      {busy && <p role="status"><BusyStatus /> {notice}</p>}
      {plan && item && <><div className="mw-detail-tabs" role="tablist" aria-label="Chi tiết nội dung"><button role="tab" aria-selected="true">Dàn ý</button><button role="tab" aria-selected="false" disabled={!post || busy || !!draft} onClick={() => { onOpen(''); onPostOpen(post!.postId); }}>Bài viết</button></div>
        <div className="mw-detail-layout"><div className="mw-detail-content" data-unsaved={!!draft}>
          <label>Bài trong kế hoạch<select disabled={busy} value={index} onChange={e => setItemIndex(Number(e.target.value))}>{plan.items.map((entry, i) => <option value={i} key={entry.id}>{i + 1}. {draft?.items[i].title ?? entry.title}</option>)}</select></label>
          {draft ? <><h3>Trụ cột nội dung</h3>{draft.pillars.map((pillar, i) => <div className="mw-plan-pillar" key={i}><label>Tên trụ cột<input maxLength={150} required value={pillar.name} onChange={e => setEditing({ ...draft, pillars: draft.pillars.map((p, n) => n === i ? { ...p, name: e.target.value } : p) })} /></label><label>Mục tiêu<textarea maxLength={500} value={pillar.objective} onChange={e => setEditing({ ...draft, pillars: draft.pillars.map((p, n) => n === i ? { ...p, objective: e.target.value } : p) })} /></label></div>)}
            <label>Trụ cột của bài<select value={item.pillarIndex} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, pillarIndex: Number(e.target.value) } : p) })}>{draft.pillars.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select></label>
            <label>Heading / tiêu đề<input aria-label="Heading / tiêu đề" maxLength={200} value={item.title} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, title: e.target.value } : p) })} /></label><label>Dàn ý chi tiết<textarea aria-label="Dàn ý chi tiết" rows={12} maxLength={3500} value={item.outline} onChange={e => setEditing({ ...draft, items: draft.items.map((p, i) => i === index ? { ...p, outline: e.target.value } : p) })} /></label><p className="mw-muted">Lưu sửa sẽ hủy duyệt kế hoạch, bài phụ thuộc và tạm dừng lịch. Cần Review lại.</p>
          </> : <><p className="mw-muted">{plan.pillars[item.pillarIndex].name} · {plan.pillars[item.pillarIndex].objective}</p><h3>{item.title}</h3><div className="mw-copy">{item.outline}</div><p className="mw-muted">{plan.approvedAt ? 'Kế hoạch đã duyệt. Bài viết và lịch vẫn cần duyệt riêng.' : 'Góp ý của AI Review nằm ở cột bên; sau khi tạo kế hoạch, AI có thể đã tự sửa dàn ý một lần theo Review. Duyệt kế hoạch giữ nguyên nội dung bạn đang thấy, bạn vẫn có thể chỉnh trước khi duyệt.'}</p></>}
        </div><aside className="mw-detail-review"><h3>AI Review</h3><p role="status">{draft ? 'Bản đang sửa chưa được Review.' : plan.review ? REVIEW_STATUS[plan.review.status] : 'Lưu xong cần Review lại.'}</p>{!current && <p className="mw-error">Brief đã thay đổi. Tạo kế hoạch theo brief mới.</p>}{!draft && plan.review && <><ReviewSummary review={{ ...plan.review, variants: reviewed ? [reviewed] : [] }} /><ReviewDetails review={{ ...plan.review, variants: reviewed ? [reviewed] : [] }} /></>}</aside></div>
      </>}
    </Modal>
  </section>;
}
