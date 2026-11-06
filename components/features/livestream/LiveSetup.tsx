'use client';

import { useEffect, useRef, useState } from 'react';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { liveClient } from '@/lib/services/liveClient';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { openLiveMini } from '@/lib/services/liveMiniWindow';
import { formatMoney } from '@/lib/utils/format';
import type { LivePreparation, LiveSnapshot, LiveSourceOption } from '@/lib/types/live';
import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';

type Props = { initial?: LiveSnapshot; onSaved: (id: string) => void; onCancel?: () => void; onToast: (message: string) => void };
export function LiveSetup({ initial, onSaved, onCancel, onToast }: Props) {
  const [knowledge] = useState(currentAiKnowledge);
  const [sources, setSources] = useState<LiveSourceOption[]>([]);
  const [marketing, setMarketing] = useState<MarketingWorkspaceView | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [sourceKey, setSourceKey] = useState('auto');
  const [title, setTitle] = useState(initial?.session.title || '');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [preparation, setPreparation] = useState<LivePreparation>(() => initial?.session.preparation || {
    host: '', scheduledAt: '', campaignId: '', receivingFields: 'Họ tên, SĐT, địa chỉ nhận hàng', handoff: 'Host kiểm tra tồn biến thể, khiếu nại và yêu cầu ngoài chính sách',
    holdPolicy: 'Giữ lượng theo SKU đến khi shop xác nhận hoặc hủy thủ công; chưa xác nhận tồn từng size/màu.',
    allowPrivate: true, allowPublic: false, catalog: [],
  });
  useEffect(() => {
    let active = true;
    liveClient.sources().then(result => { if (active) setSources(result.sources); }, e => { if (active) setSourceError((e as Error).message); });
    marketingWorkspaceClient.read().then(result => { if (active) setMarketing(result); }, () => {});
    return () => { active = false; };
  }, []);
  const change = <K extends keyof LivePreparation>(key: K, value: LivePreparation[K]) => setPreparation(old => ({ ...old, [key]: value }));
  const updateProduct = (sku: string, key: 'codes' | 'sizeChart' | 'sizeSource' | 'fit', value: string) => change('catalog', preparation.catalog.map(item => item.sku === sku ? { ...item, [key]: key === 'codes' ? value ? value.split(';') : [] : value } : item));
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      if (initial) { await liveClient.saveDraft(initial.session.id, initial.session.preparationRevision!, title, preparation); onSaved(initial.session.id); }
      else {
        const source = sources.find(item => `${item.kind}:${item.id}` === sourceKey);
        if (sourceKey !== 'auto' && !source) throw new Error('Chọn nguồn bình luận của Page.');
        const session = await liveClient.start({ platform: 'facebook', title, preparation, ...(source ? { sourceKind: source.kind, sourceId: source.id } : { sourceKind: 'auto' }) });
        onSaved(session.id);
      }
    } catch (e) { onToast((e as Error).message); }
    finally { saving.current = false; setBusy(false); }
  };
  const page = marketing?.accounts.find(account => account.platform === 'facebook' && !account.mock);
  return <section className="card live-setup">
    <div className="card-head"><div><h2>{initial ? 'Chỉnh phiên nháp' : 'Lên kế hoạch cho phiên tiếp theo'}</h2></div><span className="tag tag-vip">Facebook · Chờ shop duyệt</span></div>
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="live-setup-fields">
      <div className="live-setup-grid"><label>Tiêu đề phiên<input className="pc-input" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Bộ sưu tập cuối tuần" /></label><label>Host / người phụ trách<input className="pc-input" required maxLength={150} value={preparation.host} onChange={e => change('host', e.target.value)} /></label><label>Thời gian dự kiến<input className="pc-input" type="datetime-local" value={preparation.scheduledAt} onChange={e => change('scheduledAt', e.target.value)} /></label><label>Chiến dịch đã duyệt (tùy chọn)<select className="pc-input" value={preparation.campaignId} onChange={e => change('campaignId', e.target.value)}><option value="">Không liên kết chiến dịch</option>{marketing?.workspace.campaigns.filter(c => c.approvedAt && c.accountId === page?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      <p className="hint">Page: {page?.name || 'Page được cấp quyền của shop'} · Kế thừa xưng hô và giọng Page khi duyệt phiên. Sản phẩm và chính sách dùng bản đã lưu của phiên.</p>
      {!initial && <label>Nguồn bình luận<select className="pc-input" value={sourceKey} onChange={e => setSourceKey(e.target.value)}><option value="auto">Tự nhận video khi bật Live trên Page</option>{sources.map(source => <option key={`${source.kind}:${source.id}`} value={`${source.kind}:${source.id}`}>{source.kind === 'post' ? 'Bài đăng' : 'Live'} · {source.title}</option>)}</select>{sourceError && <span className="hint">{sourceError}</span>}</label>}
      <div className="live-section-head"><div><h3>Danh mục và mã host</h3><p className="hint">Chọn SKU có tồn đã nhập. Mã host như A1, 03 hoặc tên gọi khác; phân cách bằng dấu ;.</p></div><a href="/cai-dat?tab=products">FAQ & sản phẩm →</a></div>
      {!knowledge.products.length && <p>Chưa có sản phẩm. Thêm danh mục và xác nhận tồn kho trước khi lập phiên.</p>}
      <div className="live-catalog">{knowledge.products.map(product => {
        const entry = preparation.catalog.find(item => item.sku === product.sku);
        return <article key={product.id} className={`live-catalog-item${entry ? ' selected' : ''}`}><label className="live-check"><input type="checkbox" disabled={product.stockKnown === false} checked={!!entry} onChange={e => change('catalog', e.target.checked ? [...preparation.catalog, { sku: product.sku, codes: [], sizeChart: '', sizeSource: '', fit: '' }] : preparation.catalog.filter(item => item.sku !== product.sku))} /><span><b>{product.sku} · {product.name}</b><small>{formatMoney(product.price)} · {product.stockKnown === false ? 'Chưa xác nhận tồn' : `${product.qty} trong danh mục`}</small></span></label>
          {entry && <div className="live-setup-grid"><label>Mã host / tên gọi khác<input className="pc-input" value={entry.codes.join(';')} onChange={e => updateProduct(product.sku, 'codes', e.target.value)} placeholder="A1;03" /></label><label>Form dáng / giới hạn<input className="pc-input" maxLength={500} value={entry.fit} onChange={e => updateProduct(product.sku, 'fit', e.target.value)} /></label><label>Bảng size (nếu có)<textarea className="pc-input" rows={2} maxLength={2000} value={entry.sizeChart} onChange={e => updateProduct(product.sku, 'sizeChart', e.target.value)} placeholder="Số đo theo từng size" /></label><label>Nguồn bảng size<input className="pc-input" maxLength={500} required={!!entry.sizeChart} value={entry.sizeSource} onChange={e => updateProduct(product.sku, 'sizeSource', e.target.value)} placeholder="URL / tài liệu của shop hoặc hãng" /></label></div>}
        </article>;
      })}</div>
      <div className="live-setup-grid"><label>Thông tin nhận hàng cần hỏi<input className="pc-input" required maxLength={500} value={preparation.receivingFields} onChange={e => change('receivingFields', e.target.value)} /></label><label>Người / điều kiện chuyển giao<input className="pc-input" required maxLength={500} value={preparation.handoff} onChange={e => change('handoff', e.target.value)} /></label></div>
      <p className="hint">Giữ lượng trong phiên đến khi shop xác nhận / hủy thủ công. Giá flash áp dụng đến khi shop tắt hoặc kết thúc phiên; đơn nháp giữ giá lúc ghi nhận.</p>
      <div className="live-setup-grid"><label className="live-check"><input type="checkbox" checked={preparation.allowPrivate} onChange={e => change('allowPrivate', e.target.checked)} />Cho phép nhắn riêng sau mỗi lần duyệt nhóm</label><label className="live-check"><input type="checkbox" checked={preparation.allowPublic} onChange={e => change('allowPublic', e.target.checked)} />Cho phép trả lời công khai sau mỗi lần duyệt</label></div>
      <div className="live-row"><span className="hint">{preparation.catalog.length} SKU đã chọn · Mặc định phản hồi chờ duyệt</span><div className="live-actions">{onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Hủy chỉnh sửa</button>}<button type="submit" className="btn btn-primary" disabled={!preparation.catalog.length}>{busy ? 'Đang lưu…' : 'Lưu nháp & xem bản duyệt'}</button></div></div>
    </fieldset></form>
  </section>;
}

export function LiveDraftReview({ snapshot, onSaved, onToast, apply }: { snapshot: LiveSnapshot; onSaved: (id: string) => void; onToast: (message: string) => void; apply: (snapshot: LiveSnapshot) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withMini, setWithMini] = useState(true);
  const starting = useRef(false);
  const { session, products } = snapshot, prep = session.preparation!;
  if (editing) return <LiveSetup initial={snapshot} onSaved={id => { setEditing(false); setConfirmed(false); onSaved(id); }} onCancel={() => setEditing(false)} onToast={onToast} />;
  const start = async () => {
    if (!confirmed || starting.current) return;
    starting.current = true; setBusy(true);
    const activation = liveClient.activate(session.id, session.preparationRevision!);
    const mini = withMini ? openLiveMini(activation.then(value => value.session.id)) : null;
    try { apply(await activation); onSaved(session.id); if (mini && await mini === 'blocked') onToast('Đã bắt đầu phiên. Bấm mở cửa sổ nổi trong cockpit nếu popup bị chặn.'); }
    catch (e) { onToast((e as Error).message); onSaved(session.id); }
    finally { starting.current = false; setBusy(false); }
  };
  return <section className="card live-setup"><div className="card-head"><div><h2>{session.title}</h2></div><button className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setConfirmed(false); setEditing(true); }}>Chỉnh nháp</button></div>
    <p><b>Host:</b> {prep.host} · {prep.scheduledAt ? new Date(prep.scheduledAt).toLocaleString('vi-VN') : 'Chưa đặt thời gian'} · {session.sourceId ? `Nguồn ${session.sourceId}` : 'Tự nhận Live của Page'}</p>
    <div className="live-table-wrap"><table className="live-review-table"><thead><tr><th>SKU / sản phẩm</th><th>Mã host</th><th>Giá / lượng phiên</th><th>Tư vấn size</th></tr></thead><tbody>{products.map(product => { const entry = prep.catalog.find(item => item.sku === product.sku); return <tr key={product.sku}><td><b>{product.sku}</b><br />{product.name}</td><td>{entry?.codes.join(', ') || 'Chưa đặt'}</td><td>{formatMoney(product.price)}<br />{product.stock} sản phẩm</td><td>{entry?.sizeChart ? <>{entry.sizeChart}<br /><small>Nguồn: {entry.sizeSource} · {entry.fit}</small></> : 'Thiếu bảng có nguồn → host kiểm tra'}</td></tr>; })}</tbody></table></div>
    <p><b>Nhận hàng:</b> {prep.receivingFields}<br /><b>Chuyển người:</b> {prep.handoff}<br /><b>Giữ lượng:</b> {prep.holdPolicy}</p>
    <p><b>Quyền gửi:</b> nhắn riêng {prep.allowPrivate ? 'có duyệt' : 'tắt'} · công khai {prep.allowPublic ? 'có duyệt' : 'tắt'}. Mọi nhóm đều chờ shop duyệt.</p>
    <p><b>Xưng hô / giọng Page:</b> {prep.voice?.address || 'Chưa khai báo'} · {prep.voice?.tone || 'Chưa khai báo'}</p>
    <details><summary>FAQ & chính sách đã lưu ({snapshot.policies?.length || 0})</summary>{snapshot.policies?.map((policy, index) => <p key={index}><b>{policy.question}</b><br />{policy.answer}</p>)}{!snapshot.policies?.length && <p>Chưa có FAQ. Câu hỏi thiếu chính sách cần host xử lý.</p>}</details>
    <label className="live-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Tôi đã kiểm tra sản phẩm, giá, lượng phiên, FAQ/chính sách và quyền gửi ở trên.</label>
    <label className="live-check"><input type="checkbox" checked={withMini} disabled={busy} onChange={e => setWithMini(e.target.checked)} />Mở cửa sổ hỗ trợ nổi khi bắt đầu</label>
    <div className="live-row"><span className="hint">Tồn theo SKU là bản chụp của phiên; xác nhận size/màu riêng trước khi hứa hàng.</span><button className="btn btn-primary" disabled={!confirmed || busy} onClick={() => void start()}>{busy ? 'Đang bắt đầu…' : 'Duyệt dữ liệu & bắt đầu phiên'}</button></div>
  </section>;
}
