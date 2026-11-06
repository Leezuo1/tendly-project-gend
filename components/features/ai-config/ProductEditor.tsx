'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { productApi } from '@/lib/services/api';
import type { Product } from '@/lib/types/admin';
import styles from './product-editor.module.css';

const LIST_FIELDS = [
  ['features', 'Tính năng'], ['benefits', 'Lợi ích'], ['useCases', 'Tình huống sử dụng'], ['keywords', 'Keyword / từ đồng nghĩa'],
] as const;

export function ProductEditor({ product, products, onClose, onSaved }: {
  product: Product; products: Product[]; onClose: () => void; onSaved: (value: Product) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(product));
  const [stockText, setStockText] = useState(product.stockKnown === false ? '' : String(product.qty));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const dirty = JSON.stringify(draft) !== JSON.stringify(product) || stockText !== (product.stockKnown === false ? '' : String(product.qty));
  useEffect(() => { skuRef.current?.focus(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const update = (patch: Partial<Product>) => setDraft(value => ({ ...value, ...patch }));
  const close = () => { if (!busy) { if (dirty) setConfirmClose(true); else onClose(); } };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const value = await productApi.update(product.id, { ...draft,
        colors: draft.colors.map(item => item.trim()).filter(Boolean), sizes: draft.sizes.map(item => item.trim()).filter(Boolean),
        qty: stockText.trim() ? Number(stockText) : 0, stockKnown: Boolean(stockText.trim()) });
      toast('Đã lưu thông tin sản phẩm.'); onSaved(value);
    } catch (cause) { setError(errorMessage(cause)); toast(errorMessage(cause), 'error'); }
    finally { setBusy(false); }
  }
  return <section className={`card ${styles.root}`} aria-labelledby="product-edit-heading">
    <header className={styles.header}><div><button type="button" className="link-btn" disabled={busy} onClick={close}>← Danh mục sản phẩm</button><h2 id="product-edit-heading">Chỉnh sửa sản phẩm</h2><p>{product.name}</p></div><button type="submit" className="btn btn-primary" form="product-edit-form" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</button></header>
    <form id="product-edit-form" onSubmit={save}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <fieldset disabled={busy} className={styles.fields}>
        <section className={styles.section} aria-labelledby="product-basic-heading"><div className={styles.intro}><h3 id="product-basic-heading">Thông tin sản phẩm</h3><p>Mã, tên và thông tin bán hàng của shop.</p>{product.imageUrl && <img className={styles.photo} src={product.imageUrl} alt={product.name} />}{product.sourceUrl && <a className={styles.sourceLink} href={product.sourceUrl} target="_blank" rel="noopener noreferrer">Xem sản phẩm tại {product.sourceName || 'nguồn'} ↗</a>}{product.sourceUpdatedAt && <p>Nguồn cập nhật: {product.sourceUpdatedAt}</p>}</div>
          <div className={styles.grid}>
            <label className="field" htmlFor="product-sku">Mã sản phẩm / SKU<input ref={skuRef} id="product-sku" required maxLength={100} value={draft.sku} onChange={e => update({ sku: e.target.value })} /></label>
            <label className="field" htmlFor="product-brand">Thương hiệu<input id="product-brand" maxLength={100} value={draft.brand || ''} onChange={e => update({ brand: e.target.value })} /></label>
            <label className={`field ${styles.full}`} htmlFor="product-name">Tên sản phẩm<input id="product-name" required maxLength={500} value={draft.name} onChange={e => update({ name: e.target.value })} /></label>
            <label className="field" htmlFor="product-category">Danh mục<input id="product-category" maxLength={200} value={draft.category} onChange={e => update({ category: e.target.value })} /></label>
            <label className="field" htmlFor="product-material">Chất liệu<input id="product-material" maxLength={1000} value={draft.material} onChange={e => update({ material: e.target.value })} /></label>
            <label className="field" htmlFor="product-price">Giá bán (VND)<input id="product-price" type="number" min="0" step="1" required value={draft.price} onChange={e => update({ price: Number(e.target.value) })} /></label>
            <label className="field" htmlFor="product-qty">Tồn kho của shop<input id="product-qty" type="number" min="0" step="1" placeholder="Chưa nhập" value={stockText} onChange={e => setStockText(e.target.value)} /><span className="field-hint">Để trống khi chưa xác nhận số lượng; nhập 0 nếu hết hàng.</span></label>
            <label className="field" htmlFor="product-colors">Màu sắc<input id="product-colors" value={draft.colors.join(',')} onChange={e => update({ colors: e.target.value.split(',') })} /><span className="field-hint">Ngăn cách bằng dấu phẩy.</span></label>
            <label className="field" htmlFor="product-sizes">Size<input id="product-sizes" value={draft.sizes.join(',')} onChange={e => update({ sizes: e.target.value.split(',') })} /></label>
            {product.id.startsWith('shopee:') && <p className={`${styles.full} field-hint`}>Giá, phân loại và tồn kho theo Shopee sẽ cập nhật ở lần đồng bộ tiếp theo. Nội dung tư vấn được giữ lại.</p>}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="product-content-heading"><div className={styles.intro}><h3 id="product-content-heading">Nội dung tư vấn</h3><p>Mô tả rõ sản phẩm để AI tư vấn và soạn bài đúng thông tin.</p></div><div className={styles.grid}>
          <label className={`field ${styles.full}`} htmlFor="product-description">Mô tả chung<textarea id="product-description" rows={4} maxLength={2000} value={draft.description || ''} onChange={e => update({ description: e.target.value })} /></label>
          {LIST_FIELDS.map(([key, label]) => <label className="field" htmlFor={`product-${key}`} key={key}>{label}<textarea id={`product-${key}`} rows={4} maxLength={key === 'keywords' ? 4000 : 5000} value={(draft[key] || []).join('\n')} onChange={e => update({ [key]: e.target.value.split('\n') })} /><span className="field-hint">Mỗi mục một dòng.</span></label>)}
          <label className={`field ${styles.full}`} htmlFor="product-usp">USP / điểm khác biệt<textarea id="product-usp" rows={3} maxLength={1000} value={draft.usp || ''} onChange={e => update({ usp: e.target.value })} /></label>
          <label className="field" htmlFor="product-audience">Khách hàng phù hợp<textarea id="product-audience" rows={3} maxLength={1000} value={draft.targetAudience || ''} onChange={e => update({ targetAudience: e.target.value })} /></label>
          <label className="field" htmlFor="product-care">Hướng dẫn bảo quản<textarea id="product-care" rows={3} maxLength={1500} value={draft.careInstructions || ''} onChange={e => update({ careInstructions: e.target.value })} /></label>
          <label className={`field ${styles.full}`} htmlFor="product-limits">Thông tin cần xác nhận / giới hạn cam kết<textarea id="product-limits" rows={3} maxLength={1500} value={draft.limitations || ''} onChange={e => update({ limitations: e.target.value })} /></label>
        </div></section>
        <section className={styles.section} aria-labelledby="product-related-heading"><div className={styles.intro}><h3 id="product-related-heading">Sản phẩm liên quan</h3><p>Chọn mẫu phối cùng hoặc thay thế khi phù hợp nhu cầu.</p></div><div className={styles.related}>
          {products.filter(item => item.id !== product.id).map(item => <label key={item.id}><input type="checkbox" checked={draft.relatedProductIds?.includes(item.id) || false} onChange={e => update({ relatedProductIds: e.target.checked ? [...(draft.relatedProductIds || []), item.id] : draft.relatedProductIds?.filter(id => id !== item.id) })} /><span>{item.name}<small>{item.sku}</small></span></label>)}
          <label className="field" htmlFor="product-related-reason">Lý do gợi ý<textarea id="product-related-reason" rows={3} maxLength={1000} value={draft.relatedReason || ''} onChange={e => update({ relatedReason: e.target.value })} /></label>
        </div></section>
        <footer className={styles.footer}><span>{dirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi'}</span><div><button type="button" className="btn btn-outline" onClick={close}>Hủy</button><button type="submit" className="btn btn-primary">{busy ? 'Đang lưu…' : 'Lưu sản phẩm'}</button></div></footer>
      </fieldset>
    </form>
    <ConfirmDialog open={confirmClose} title="Bỏ thay đổi chưa lưu?" message="Thông tin bạn vừa chỉnh sẽ không được lưu." confirmLabel="Bỏ thay đổi" onClose={() => setConfirmClose(false)} onConfirm={onClose} />
  </section>;
}
