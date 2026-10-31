'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { IconSearch } from '@/components/ui/Icons';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { productApi } from '@/lib/services/api';
import type { Product, ProductSource } from '@/lib/types/admin';
import { CSV_TEMPLATE, csvToProducts, downloadText } from '@/lib/utils/csv';
import { formatMoney, normalize, relativeTime } from '@/lib/utils/format';

const PAGE_SIZE = 8;
const LOW_STOCK = 20;

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) return <span className="stock-badge stock-out"><span className="s-dot" />Hết hàng</span>;
  if (qty < LOW_STOCK) return <span className="stock-badge stock-low"><span className="s-dot" />Sắp hết</span>;
  return <span className="stock-badge stock-in"><span className="s-dot" />Còn hàng</span>;
}

const FREE_SIZES = ['Freesize', 'One size'];
const sizeLabel = (sizes: string[]) =>
  sizes.length === 1 && FREE_SIZES.includes(sizes[0]) ? sizes[0] : `Size ${sizes.join(', ')}`;

type SortKey ='default' | 'qty-asc' | 'qty-desc';

export function ProductsTab() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [source, setSource] = useState<ProductSource | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingSource, setLoadingSource] = useState(true);
  const [sourceError, setSourceError] = useState('');
  const [importing, setImporting] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [p, s] = await Promise.all([productApi.list(), productApi.getSource()]);
      if (cancelled) return;
      setProducts(p); setSource(s);
      try {
        const data = await productApi.loadShopee();
        if (!cancelled) { setProducts(data.products); setSource(data.source); }
      } catch (error) { if (!cancelled) setSourceError(errorMessage(error)); }
      finally { if (!cancelled) setLoadingSource(false); }
    };
    void load();
    const t = setInterval(() => forceTick((x) => x + 1), 30000); // cập nhật "x phút trước"
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const categories = useMemo(
    () => [...new Set(products?.map((p) => p.category) ?? [])].sort((a, b) => a.localeCompare(b, 'vi')),
    [products],
  );

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = normalize(query);
    let list = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (stock === 'in' && p.qty < LOW_STOCK) return false;
      if (stock === 'low' && (p.qty === 0 || p.qty >= LOW_STOCK)) return false;
      if (stock === 'out' && p.qty !== 0) return false;
      if (!q) return true;
      return normalize([p.name, p.sku, p.category, p.material, ...p.colors, ...p.sizes].join(' ')).includes(q);
    });
    if (sort !== 'default') list = [...list].sort((a, b) => (sort === 'qty-asc' ? a.qty - b.qty : b.qty - a.qty));
    return list;
  }, [products, query, category, stock, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const cycleSort = () => { setSort(sort === 'qty-desc' ? 'qty-asc' : sort === 'qty-asc' ? 'default' : 'qty-desc'); setPage(1); };


  const flash = (before: Product[], after: Product[]) => {
    const prev = new Map(before.map((p) => [p.id, p.qty]));
    const ids = new Set(after.filter((p) => prev.get(p.id) !== p.qty).map((p) => p.id));
    setFlashIds(ids);
    setTimeout(() => setFlashIds(new Set()), 1800);
  };

  const onSync = async () => {
    if (!products) return;
    setSyncing(true);
    setSourceError('');
    try {
      const res = await productApi.syncShopee();
      flash(products, res.products);
      setProducts(res.products);
      setSource(res.source);
      const parts = [`${res.changed} dòng cập nhật`];
      if (res.added) parts.unshift(`${res.added} dòng mới`);
      if (res.removed) parts.push(`${res.removed} dòng ngừng bán`);
      toast(`Đồng bộ Shopee xong: ${parts.join(', ')}`);
    } catch (e) {
      setSourceError(errorMessage(e));
      toast(errorMessage(e), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const onConnect = async () => {
    setConnecting(true);
    setSourceError('');
    try { window.location.assign(await productApi.connectShopee()); }
    catch (error) { setSourceError(errorMessage(error)); setConnecting(false); }
  };

  const onPickCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !products) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return toast('Vui lòng chọn file .csv', 'error');
    setImporting(true);
    try {
      const { rows, skipped } = csvToProducts(await file.text());
      const res = await productApi.importMany(rows);
      flash(products, res.products);
      setProducts(res.products);
      toast(`Nhập xong: ${res.added} thêm mới, ${res.updated} cập nhật${skipped ? `, bỏ qua ${skipped} dòng lỗi` : ''}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card products-card">
      <div className="card-head">
        <div>
          <h2>Nguồn dữ liệu sản phẩm</h2>
          <p className="card-desc">AI học danh mục này để kiểm tra tồn kho, tư vấn kích thước và phân loại màu sắc khi khách hỏi.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={importing || syncing || loadingSource || connecting}>
            {importing && <span className="spinner" />}
            Nhập file CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={onSync} disabled={syncing || connecting || loadingSource || !source?.connected || importing}>
            {syncing && <span className="spinner" />}
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Shopee'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onPickCsv} />
      </div>

      <div className="source-row" aria-busy={syncing || connecting || loadingSource}>
        <div className="source-left">
          <div className="source-icon">S</div>
          <div>
            <div className="source-name">{source?.name ?? '...'}</div>
            <div className="source-meta">
              {products?.length ?? 0} dòng sản phẩm / phân loại • {source?.lastSyncedAt ? `Đồng bộ ${relativeTime(source.lastSyncedAt).toLowerCase()}` : 'Chưa đồng bộ Shopee thật'}
            </div>
          </div>
        </div>
        <div className="source-right">
          {loadingSource
            ? <span className="tag-status syncing" role="status">Đang kiểm tra kết nối</span>
            : syncing
            ? <span className="tag-status syncing"><span className="dot" />Đang đồng bộ</span>
            : <span className={`tag-status${source?.connected ? ' live' : ''}`}><span className="dot" />{source?.connected ? 'Đã cấp quyền' : 'Chưa kết nối'}</span>}
          <button className="btn btn-outline btn-sm" onClick={onConnect} disabled={syncing || connecting || loadingSource || importing}>
            {connecting ? 'Đang mở Shopee...' : source?.connected ? 'Kết nối lại Shopee' : 'Kết nối Shopee'}
          </button>
        </div>
      </div>
      {sourceError && <p role="alert" className="source-meta" data-configuration-error={sourceError.includes('SHOPEE_PARTNER_ID')}>{sourceError}</p>}
      <p className="source-meta product-sync-note">Mỗi phân loại Shopee là một dòng có giá và tồn kho riêng. Sản phẩm nhập thủ công được giữ lại khi đồng bộ.</p>

      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <IconSearch />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm kiếm theo tên sản phẩm, phân loại..." />
          </div>
          <select className="filter-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Lọc danh mục">
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} aria-label="Lọc tồn kho">
            <option value="">Mọi trạng thái</option>
            <option value="in">Còn hàng</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
        </div>
        <div className="table-summary">Hiển thị <b>{pageItems.length}</b> / {filtered.length} sản phẩm</div>
        <button type="button" className="btn btn-outline btn-sm product-sort" onClick={cycleSort}>Tồn kho: {sort === 'qty-desc' ? 'Cao → thấp' : sort === 'qty-asc' ? 'Thấp → cao' : 'Mặc định'}</button>
      </div>

      <div className="table-wrap products-table-wrap">
        <table className="data-table products-table">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Phân loại</th>
              <th style={{ textAlign: 'right' }}>Giá</th>
              <th
                className="sortable"
                style={{ textAlign: 'right' }}
                onClick={cycleSort}
                title="Sắp xếp theo số lượng"
              >
                Số lượng {sort === 'qty-desc' ? '↓' : sort === 'qty-asc' ? '↑' : '↕'}
              </th>
              <th style={{ textAlign: 'center' }}>Trạng thái tồn</th>
            </tr>
          </thead>
          <tbody>
            {!products &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 36 }} /></td></tr>
              ))}
            {pageItems.map((p) => (
              <tr key={p.id} className={flashIds.has(p.id) ? 'flash' : ''}>
                <td>
                  <div className="prod-cell">
                    <div className="prod-avatar">{p.emoji}</div>
                    <div>
                      <div className="prod-title">{p.name}</div>
                      <div className="prod-sku">SKU: {p.sku}{p.material ? ` • ${p.material}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="cat-pill">{p.category}</span>
                  <div className="variant-desc">{[p.colors.join(', '), p.sizes.length ? sizeLabel(p.sizes) : ''].filter(Boolean).join(' • ') || '—'}</div>
                </td>
                <td data-label="Giá" style={{ textAlign: 'right' }}><span className="price-val">{formatMoney(p.price)}</span></td>
                <td data-label="Số lượng" style={{ textAlign: 'right' }}><span className="qty-val">{p.qty}</span></td>
                <td style={{ textAlign: 'center' }}><StockBadge qty={p.qty} /></td>
              </tr>
            ))}
            {products && filtered.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state"><div className="emoji">🔍</div>Không tìm thấy sản phẩm phù hợp</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Trang trước">‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} className={`page-btn${n === current ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button className="page-btn" disabled={current === totalPages} onClick={() => setPage(current + 1)} aria-label="Trang sau">›</button>
        </div>
      )}

      <div className="import-alt">
        Chưa đồng bộ sàn TMĐT?{' '}
        <button className="link-btn" onClick={() => fileRef.current?.click()} disabled={importing || syncing || connecting || loadingSource}>Nhập kho sản phẩm qua file Excel / CSV</button>{' '}
        (<button className="link-btn" onClick={() => downloadText('tendly-mau-san-pham.csv', CSV_TEMPLATE)}>tải file mẫu</button>) hoặc liên kết kho{' '}
        <button className="link-btn" onClick={() => toast('Kết nối Haravan sắp ra mắt', 'info')}>Haravan</button>,{' '}
        <button className="link-btn" onClick={() => toast('Kết nối Sapo sắp ra mắt', 'info')}>Sapo</button>.
      </div>
    </div>
  );
}
