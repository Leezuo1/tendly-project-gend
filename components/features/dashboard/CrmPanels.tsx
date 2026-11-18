'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CustomerAvatar } from '@/components/features/inbox/CustomerAvatar';
import type { CrmCustomer, CrmOrder, CrmOrderStatus, CrmOverview } from '@/lib/types/crm';
import styles from './crm.module.css';

const money = new Intl.NumberFormat('vi-VN');
const vnd = (value: number) => `${money.format(value)}đ`;
const date = (ms: number) => new Date(ms).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTime = (ms: number) => new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const STATUS: Record<CrmOrderStatus, { label: string; tone: string }> = {
  confirmed: { label: 'Đã chốt', tone: 'green' }, draft: { label: 'Nháp', tone: 'muted' },
  awaiting_info: { label: 'Chờ thông tin', tone: 'amber' }, cancelled: { label: 'Đã hủy', tone: 'red' },
};
const SOURCE: Record<CrmOrder['source'], string> = { messenger: 'Chat Messenger', livestream: 'Livestream' };
const SEGMENT: Record<Required<CrmCustomer>['segment'], { label: string; tone: string }> = {
  lead: { label: 'Mới nhắn tin', tone: 'muted' }, pending: { label: 'Có đơn chưa chốt', tone: 'amber' },
  buyer: { label: 'Đã mua', tone: 'green' }, repeat: { label: 'Mua lại', tone: 'coral' },
};
const itemsText = (order: CrmOrder) => order.items.map(item => `${item.name}${item.variant ? ` (${item.variant})` : ''} ×${item.qty}`).join(', ');
const change = (now: number, before: number) => before ? Math.round(100 * (now - before) / before) : null;

/** Tải bảng ra CSV (UTF-8 có BOM) để mở bằng Google Sheets hoặc Excel mà không lỗi dấu tiếng Việt. */
function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const cell = (value: string | number) => { const text = String(value); return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  const blob = new Blob(['﻿' + [header, ...rows].map(row => row.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Đọc /api/dashboard/crm theo khoảng thời gian; dùng chung cho tab Đơn hàng và Khách hàng. */
export function useCrmOverview(enabled: boolean, range: number, refresh: number) {
  const [data, setData] = useState<CrmOverview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/dashboard/crm?range=${range}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Không tải được dữ liệu.'); setData(result); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [enabled, range, refresh]);
  return { data: data?.range === range ? data : null, error };
}

function RangePicker({ range, onRange }: { range: number; onRange: (range: number) => void }) {
  return <div className={styles.range} role="group" aria-label="Khoảng thời gian">{[7, 30, 90].map(days =>
    <button key={days} type="button" aria-pressed={range === days} onClick={() => onRange(days)}>{days} ngày</button>)}</div>;
}
function Kpi({ label, value, note, delta }: { label: string; value: string; note?: string; delta?: number | null }) {
  return <div className={styles.kpi}><span>{label}</span><strong>{value}</strong>
    {delta !== undefined && delta !== null && <em data-tone={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% so với kỳ trước</em>}
    {note && <small>{note}</small>}</div>;
}
const Badge = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={styles.badge} data-tone={tone}>{children}</span>;

export function OrdersPanel({ data, error, range, onRange }: { data: CrmOverview | null; error: string; range: number; onRange: (range: number) => void }) {
  const [status, setStatus] = useState<'all' | CrmOrderStatus>('all');
  const [source, setSource] = useState<'all' | CrmOrder['source']>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState('');
  const list = useMemo(() => (data?.orders.list ?? []).filter(order => (status === 'all' || order.status === status) && (source === 'all' || order.source === source)
    && (!query.trim() || `${order.id} ${order.customerName} ${itemsText(order)}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))), [data, status, source, query]);
  if (!data) return <div className="tab-panel"><RangePicker range={range} onRange={onRange} /><p role="status" className={styles.empty}>{error || 'Đang tải đơn hàng…'}</p></div>;
  const { kpi, daily, bySource, topProducts } = data.orders;
  const peak = Math.max(1, ...daily.map(day => day.revenue));
  // Khoảng 8 nhãn ngày; ngày cuối chỉ hiện khi không sát nhãn trước đó.
  const step = Math.ceil(daily.length / 8);
  const labelled = (i: number) => i % step === 0 || (i === daily.length - 1 && i % step >= step / 2);
  const totalSource = Math.max(1, bySource.messenger + bySource.livestream);
  return <div className="tab-panel">
    <div className={styles.toolbar}><RangePicker range={range} onRange={onRange} />
      <button type="button" className="btn btn-outline btn-sm" disabled={!list.length} onClick={() => downloadCsv('don-hang', ['Mã đơn', 'Ngày tạo', 'Khách hàng', 'Kênh', 'Sản phẩm', 'Tổng tiền (VND)', 'Trạng thái', 'Ghi chú'],
        list.map(order => [order.id, dateTime(order.createdAt), order.customerName, SOURCE[order.source], itemsText(order), order.total, STATUS[order.status].label, [order.note, order.isMock && 'Đơn mẫu'].filter(Boolean).join(' · ')]))}>Tải CSV (mở bằng Google Sheets)</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.kpis}>
      <Kpi label="Doanh thu đơn đã chốt" value={vnd(kpi.revenue)} delta={change(kpi.revenue, kpi.previousRevenue)} />
      <Kpi label="Tổng đơn" value={money.format(kpi.total)} delta={change(kpi.total, kpi.previousTotal)} note={`${kpi.confirmed} chốt · ${kpi.pending} chờ · ${kpi.cancelled} hủy`} />
      <Kpi label="Giá trị đơn trung bình" value={vnd(kpi.avgOrder)} note="Tính trên đơn đã chốt" />
      <Kpi label="Tỷ lệ chốt" value={kpi.total ? `${Math.round(100 * kpi.confirmed / kpi.total)}%` : '–'} note={`${bySource.messenger} đơn từ chat · ${bySource.livestream} đơn từ livestream`} />
    </div>
    {kpi.mock > 0 && <p className={styles.note}>Có {kpi.mock} đơn mẫu (dữ liệu demo) trong kỳ này, đã tính vào số liệu.</p>}
    <div className={styles.grid}>
      <section className="card"><div className="card-head"><h2>Doanh thu theo ngày</h2><span className="hint">{range} ngày gần nhất · đơn đã chốt</span></div>
        {kpi.total ? <div className={styles.chart} data-dense={range > 30 ? 'true' : undefined}>{daily.map((day, i) => <div key={day.day} className={styles.col} title={`${day.day.split('-').reverse().join('/')}: ${vnd(day.revenue)} · ${day.orders} đơn`}>
          <span className={styles.barBox}><span className={styles.bar} style={{ height: `${Math.max(day.revenue ? 4 : 0, 100 * day.revenue / peak)}%` }} /></span>
          <small aria-hidden={!labelled(i)}>{labelled(i) ? day.day.slice(5).split('-').reverse().join('/') : ''}</small>
        </div>)}</div> : <p className={styles.empty}>Chưa có đơn nào trong {range} ngày qua.</p>}
      </section>
      <section className="card"><div className="card-head"><h2>Bán chạy</h2><span className="hint">Theo số lượng đã chốt</span></div>
        {topProducts.length ? <ol className={styles.top}>{topProducts.map(product => <li key={product.name}><span>{product.name}</span><strong>{money.format(product.qty)}</strong><small>{product.orders} đơn</small></li>)}</ol> : <p className={styles.empty}>Chưa có đơn đã chốt.</p>}
        <div className={styles.split} aria-label="Đơn theo kênh"><span style={{ width: `${100 * bySource.messenger / totalSource}%` }} data-kind="messenger" /><span style={{ width: `${100 * bySource.livestream / totalSource}%` }} data-kind="livestream" /></div>
        <p className={styles.legend}><span data-kind="messenger">Chat Messenger {bySource.messenger}</span><span data-kind="livestream">Livestream {bySource.livestream}</span></p>
      </section>
    </div>
    <section className="card">
      <div className="card-head"><h2>Danh sách đơn hàng</h2><span className="hint">{list.length} đơn</span></div>
      <div className={styles.filters}>
        <label>Tìm<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Mã đơn, tên khách, sản phẩm" /></label>
        <label>Trạng thái<select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">Tất cả</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
        <label>Kênh<select value={source} onChange={e => setSource(e.target.value as typeof source)}><option value="all">Tất cả</option><option value="messenger">Chat Messenger</option><option value="livestream">Livestream</option></select></label>
      </div>
      {list.length ? <div className="table-wrap"><table className={`report-table ${styles.table}`}>
        <thead><tr><th scope="col">Mã đơn</th><th scope="col">Khách hàng</th><th scope="col">Sản phẩm</th><th scope="col">Tổng tiền</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th></tr></thead>
        <tbody>{list.map(order => { const key = `${order.source}:${order.id}`; return <React.Fragment key={key}>
          <tr>
            <td data-label="Mã đơn"><button type="button" className={styles.linkBtn} aria-expanded={open === key} onClick={() => setOpen(open === key ? '' : key)}>{order.id}</button>{order.isMock && <Badge tone="muted">Mẫu</Badge>}</td>
            <td data-label="Khách hàng"><strong>{order.customerName}</strong><small className={styles.sub}>{SOURCE[order.source]}{order.note && ` · ${order.note}`}</small></td>
            <td data-label="Sản phẩm" className={styles.items}>{itemsText(order)}</td>
            <td data-label="Tổng tiền" className={styles.num}>{vnd(order.total)}</td>
            <td data-label="Trạng thái"><Badge tone={STATUS[order.status].tone}>{STATUS[order.status].label}</Badge></td>
            <td data-label="Ngày tạo" className={styles.nowrap}>{dateTime(order.createdAt)}</td>
          </tr>
          {open === key && <tr className={styles.detail}><td colSpan={6}><ul>{order.items.map((item, i) => <li key={i}><span>{item.name}{item.variant && ` · ${item.variant}`}</span><span>×{item.qty}</span><span>{item.price === null ? '—' : vnd(item.price * item.qty)}</span></li>)}</ul>
            <p className={styles.sub}>{order.source === 'messenger' ? 'Đơn do AI Chat tạo trong hội thoại.' : 'Đơn gom từ bình luận livestream.'} Thông tin giao hàng của khách được lưu riêng và không hiển thị ở đây.</p></td></tr>}
        </React.Fragment>; })}</tbody>
      </table></div> : <p className={styles.empty}>{data.orders.list.length ? 'Không có đơn khớp bộ lọc.' : 'Chưa có đơn hàng. Đơn sẽ xuất hiện khi AI Chat chốt đơn trong hội thoại hoặc khi khách đặt qua livestream.'}</p>}
    </section>
  </div>;
}

export function CustomersPanel({ data, error, range, onRange }: { data: CrmOverview | null; error: string; range: number; onRange: (range: number) => void }) {
  const [segment, setSegment] = useState<'all' | Required<CrmCustomer>['segment']>('all');
  const [query, setQuery] = useState('');
  const list = useMemo(() => (data?.customers.list ?? []).filter(customer => (segment === 'all' || customer.segment === segment)
    && (!query.trim() || customer.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))), [data, segment, query]);
  if (!data) return <div className="tab-panel"><RangePicker range={range} onRange={onRange} /><p role="status" className={styles.empty}>{error || 'Đang tải khách hàng…'}</p></div>;
  const { kpi } = data.customers;
  const counts = (Object.keys(SEGMENT) as Required<CrmCustomer>['segment'][]).map(key => [key, data.customers.list.filter(customer => customer.segment === key).length] as const);
  const most = Math.max(1, ...counts.map(([, n]) => n));
  return <div className="tab-panel">
    <div className={styles.toolbar}><RangePicker range={range} onRange={onRange} />
      <button type="button" className="btn btn-outline btn-sm" disabled={!list.length} onClick={() => downloadCsv('khach-hang', ['Khách hàng', 'Kênh', 'Nhóm', 'Lần đầu liên hệ', 'Hoạt động gần nhất', 'Số đơn', 'Đơn đã chốt', 'Đã chi (VND)'],
        list.map(customer => [customer.name, customer.channel === 'messenger' ? 'Messenger' : 'Livestream', SEGMENT[customer.segment].label, date(customer.firstSeenAt), dateTime(customer.lastActiveAt), customer.orders, customer.confirmedOrders, customer.spent]))}>Tải CSV (mở bằng Google Sheets)</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.kpis}>
      <Kpi label="Tổng khách" value={money.format(kpi.total)} note={`${kpi.active} khách hoạt động trong ${range} ngày`} />
      <Kpi label="Khách mới" value={money.format(kpi.newInRange)} note={`Lần đầu nhắn trong ${range} ngày`} />
      <Kpi label="Khách đã mua" value={money.format(kpi.buyers)} note={`${kpi.repeat} khách mua lại (từ 2 đơn)`} />
      <Kpi label="Tỷ lệ chuyển đổi" value={`${kpi.conversion}%`} note="Khách hoạt động có đơn đã chốt" />
    </div>
    <section className="card"><div className="card-head"><h2>Phễu khách hàng</h2><span className="hint">Toàn bộ khách đã lưu</span></div>
      <ul className={styles.funnel}>{counts.map(([key, n]) => <li key={key}><span>{SEGMENT[key].label}</span><span className={styles.funnelBar}><span data-tone={SEGMENT[key].tone} style={{ width: `${Math.max(n ? 3 : 0, 100 * n / most)}%` }} /></span><strong>{money.format(n)}</strong></li>)}</ul>
    </section>
    <section className="card">
      <div className="card-head"><h2>Danh sách khách hàng</h2><span className="hint">{list.length} khách</span></div>
      <div className={styles.filters}>
        <label>Tìm<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tên khách" /></label>
        <label>Nhóm<select value={segment} onChange={e => setSegment(e.target.value as typeof segment)}><option value="all">Tất cả</option>{Object.entries(SEGMENT).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      </div>
      {list.length ? <div className="table-wrap"><table className={`report-table ${styles.table}`}>
        <thead><tr><th scope="col">Khách hàng</th><th scope="col">Nhóm</th><th scope="col">Đơn hàng</th><th scope="col">Đã chi</th><th scope="col">Hoạt động gần nhất</th><th scope="col"><span className={styles.srOnly}>Thao tác</span></th></tr></thead>
        <tbody>{list.map(customer => <tr key={customer.key}>
          <td data-label="Khách hàng"><span className={styles.person}><CustomerAvatar className={styles.avatar} name={customer.name} url={customer.avatarUrl || undefined} initials={(customer.name.trim()[0] ?? '?').toLocaleUpperCase('vi')} />
            <span><strong>{customer.name}</strong><small className={styles.sub}>{customer.channel === 'messenger' ? 'Messenger' : 'Livestream'} · từ {date(customer.firstSeenAt)}</small></span></span></td>
          <td data-label="Nhóm"><Badge tone={SEGMENT[customer.segment].tone}>{SEGMENT[customer.segment].label}</Badge></td>
          <td data-label="Đơn hàng" className={styles.num}>{customer.confirmedOrders}/{customer.orders} đã chốt</td>
          <td data-label="Đã chi" className={styles.num}>{vnd(customer.spent)}</td>
          <td data-label="Hoạt động gần nhất" className={styles.nowrap}>{dateTime(customer.lastActiveAt)}</td>
          <td data-label="Thao tác">{customer.channel === 'messenger' ? <Link href="/hop-thoai" className={styles.linkBtn}>Mở hội thoại</Link> : <Link href="/livestream" className={styles.linkBtn}>Xem livestream</Link>}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.empty}>{data.customers.list.length ? 'Không có khách khớp bộ lọc.' : 'Chưa có khách hàng. Khách sẽ xuất hiện khi nhắn tin vào Fanpage hoặc đặt hàng qua livestream.'}</p>}
    </section>
  </div>;
}
