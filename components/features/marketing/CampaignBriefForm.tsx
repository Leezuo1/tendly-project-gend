'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { emptyCampaignBrief, MARKETING_GOALS } from '@/lib/services/marketingBrief';
import type { CampaignBrief, MarketingCampaign, MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import type { Product } from '@/lib/types/admin';

interface Props {
  view: MarketingWorkspaceView; initial?: MarketingCampaign; owner: string;
  act: (action: string, input: object) => Promise<boolean>; onClose: () => void;
}
type TextKey = Exclude<keyof CampaignBrief, 'offer' | 'productIds' | 'goal' | 'accountId'>;
const textFields: { key: TextKey; label: string; required?: boolean; type?: string }[] = [
  { key: 'name', label: 'Tên chiến dịch', required: true }, { key: 'audience', label: 'Đối tượng', required: true },
  { key: 'pain', label: 'Nhu cầu / vấn đề chính', required: true }, { key: 'message', label: 'Thông điệp chính', required: true },
  { key: 'benefits', label: 'Lợi ích / USP cần nhấn mạnh' }, { key: 'barriers', label: 'Rào cản cần giải đáp' },
  { key: 'tone', label: 'Giọng văn riêng cho chiến dịch' }, { key: 'format', label: 'Định dạng bài', required: true },
  { key: 'cta', label: 'Lời kêu gọi hành động', required: true }, { key: 'link', label: 'Link đích (nếu có)', type: 'url' },
  { key: 'startsAt', label: 'Bắt đầu chiến dịch', type: 'datetime-local' }, { key: 'endsAt', label: 'Kết thúc chiến dịch', type: 'datetime-local' },
  { key: 'proof', label: 'Feedback được phép sử dụng' }, { key: 'proofSource', label: 'Link nguồn feedback', type: 'url' }, { key: 'notes', label: 'Yêu cầu thêm / nội dung cần tránh' },
];
const field = (key: TextKey) => textFields.find(item => item.key === key)!;
export function CampaignBriefForm({ view, initial, owner, act, onClose }: Props) {
  const firstAccount = initial?.accountId ?? view.accounts[0]?.id ?? '';
  const profile = view.workspace.profiles[firstAccount];
  const [form, setForm] = useState<CampaignBrief>(initial ?? { ...emptyCampaignBrief(firstAccount), audience: profile?.audience ?? '', pain: profile?.pain ?? '', cta: profile?.cta ?? 'Nhắn tin để được tư vấn' });
  const [products] = useState<Product[]>(() => currentAiKnowledge().products.map(product => ({ ...product, emoji: '' })));
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error] = useState('');
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = (patch: Partial<CampaignBrief>) => { setForm(previous => ({ ...previous, ...patch })); setDirty(true); };
  const selected = products.filter(product => form.productIds.includes(product.id));
  const asLocal = (value: string) => value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : '';
  const input = (key: TextKey) => { const f = field(key); return <label key={key}>{f.label}{f.type ? <input type={f.type} value={f.type === 'datetime-local' ? asLocal(form[key]) : form[key]} onChange={event => change({ [key]: f.type === 'datetime-local' && event.target.value ? new Date(`${event.target.value}:00+07:00`).toISOString() : event.target.value })} /> : <textarea rows={key === 'name' ? 1 : 2} required={f.required} maxLength={key === 'name' ? 150 : 1500} value={form[key]} onChange={event => change({ [key]: event.target.value })} />}</label>; };
  return <><form className="mw-editor" data-unsaved={dirty} onSubmit={async event => {
    event.preventDefault();
    // Server tự chép cấu hình AI của Page vào campaign; client không gửi cấu hình. Ưu đãi chỉ được xác nhận bằng ô tick riêng.
    if (await act('campaign', { id: initial?.id, brief: form, knowledge: currentAiKnowledge() })) { setDirty(false); onClose(); }
  }}>
    <div className="mw-section-head"><h2>{initial ? 'Chỉnh brief chiến dịch' : 'Chiến dịch mới'}</h2><button className="btn btn-outline btn-sm" type="button" onClick={() => { if (dirty) setDiscard(true); else onClose(); }}>Đóng</button></div>
    {error && <p className="mw-error" role="alert">{error}</p>}
    <fieldset className="mw-group"><legend>Thông tin cốt lõi</legend><div className="mw-form-grid">
      <label>Tài khoản đăng<select value={form.accountId} onChange={event => { const p = view.workspace.profiles[event.target.value]; change({ accountId: event.target.value, audience: p?.audience ?? form.audience, pain: p?.pain ?? form.pain, cta: p?.cta ?? form.cta }); }}>{view.accounts.map(account => <option key={account.id} value={account.id}>{view.workspace.profiles[account.id]?.name || account.name}</option>)}</select></label>
      <label>Mục tiêu<select value={form.goal} onChange={event => change({ goal: event.target.value })}>{Object.entries(MARKETING_GOALS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {(['name', 'format', 'startsAt', 'endsAt', 'link'] as const).map(input)}
    </div></fieldset>
    <fieldset className="mw-group"><legend>Khách hàng và định vị</legend><div className="mw-form-grid">{(['audience', 'pain', 'message', 'tone', 'benefits', 'barriers'] as const).map(input)}</div></fieldset>
    <fieldset className="mw-group"><legend>Sản phẩm và lời chào hàng</legend>
      <div className="mw-product-picker" role="group" aria-labelledby="mw-product-label"><p id="mw-product-label">Sản phẩm · chọn tối đa 5</p>{products.map(product => <label key={product.id}><input type="checkbox" checked={form.productIds.includes(product.id)} disabled={!form.productIds.includes(product.id) && form.productIds.length >= 5} onChange={event => change({ productIds: event.target.checked ? [...form.productIds, product.id] : form.productIds.filter(id => id !== product.id) })} /><span>{product.name}<small>{product.sku} · {product.price.toLocaleString('vi-VN')}đ</small></span></label>)}</div>
      <section className="mw-offer"><h3>Ưu đãi của chiến dịch</h3><label>Loại ưu đãi<select value={form.offer.kind} onChange={event => change({ offer: { ...form.offer, kind: event.target.value as CampaignBrief['offer']['kind'], confirmed: false } })}>{[['none', 'Không áp dụng ưu đãi'], ['discount', 'Giảm giá'], ['voucher', 'Voucher'], ['gift', 'Quà tặng'], ['combo', 'Combo'], ['shipping', 'Freeship']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {form.offer.kind !== 'none' && <div className="mw-form-grid">{(['details', 'conditions', 'startsAt', 'endsAt'] as const).map(key => <label key={key}>{({ details: 'Giá trị / mã / quà tặng', conditions: 'Điều kiện và giới hạn', startsAt: 'Bắt đầu ưu đãi', endsAt: 'Kết thúc ưu đãi' })[key]}<input type={key.endsWith('At') ? 'datetime-local' : 'text'} value={key.endsWith('At') ? asLocal(form.offer[key]) : form.offer[key]} onChange={event => change({ offer: { ...form.offer, [key]: key.endsWith('At') && event.target.value ? new Date(`${event.target.value}:00+07:00`).toISOString() : event.target.value, confirmed: false } })} /></label>)}</div>}
        {form.offer.kind !== 'none' && <label className="mw-check"><input type="checkbox" checked={form.offer.confirmed} onChange={event => change({ offer: { ...form.offer, confirmed: event.target.checked } })} /> Tôi xác nhận nội dung, điều kiện và thời gian ưu đãi này là đúng</label>}
      </section>
      <div className="mw-form-grid mw-offer-fields">{(['cta', 'proof', 'proofSource', 'notes'] as const).map(input)}</div>
    </fieldset>
    <section className="mw-summary"><h3>AI sẽ dùng những thông tin này</h3>
      <dl className="mw-facts"><div><dt>Sản phẩm</dt><dd>{selected.map(product => product.name).join(' · ') || 'Chưa chọn sản phẩm'}</dd></div><div><dt>Đối tượng</dt><dd>{form.audience || 'Chưa có'}</dd></div><div><dt>Thông điệp</dt><dd>{form.message || 'Chưa có'}</dd></div><div><dt>CTA</dt><dd>{form.cta || 'Chưa có'}</dd></div><div><dt>Ưu đãi</dt><dd>{form.offer.kind === 'none' ? 'Không áp dụng' : form.offer.details || 'Chưa nhập'}</dd></div><div><dt>Giọng điệu</dt><dd>{form.tone || view.workspace.profiles[form.accountId]?.tone || 'Quy tắc Content mặc định'}</dd></div></dl>
      <p className="mw-hint">Duyệt brief sẽ xác nhận bộ thông tin sản phẩm và chính sách dùng cho chiến dịch này.</p></section>
    <div className="mw-actions"><button type="button" className="btn btn-text" onClick={() => change({ name: 'Bộ sưu tập thời trang mới', productIds: products.slice(0, 1).map(product => product.id), audience: 'Nhân viên văn phòng muốn mặc thoải mái', pain: 'Cần trang phục dễ phối và dễ chăm sóc', message: 'Mặc thoải mái, phối đồ dễ dàng mỗi ngày', benefits: products[0]?.benefits?.join('. ') ?? '', cta: 'Nhắn tin để shop tư vấn', format: 'Bài giới thiệu sản phẩm' })}>Điền brief gợi ý</button><button className="btn btn-primary" type="submit">Lưu brief nháp</button></div>
  </form><ConfirmDialog open={discard} title="Bỏ thay đổi brief?" message="Những thay đổi chưa lưu sẽ bị bỏ." confirmLabel="Bỏ thay đổi" onClose={() => setDiscard(false)} onConfirm={onClose} /></>;
}
