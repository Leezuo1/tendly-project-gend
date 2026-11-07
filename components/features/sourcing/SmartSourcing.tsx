'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMockOnboarding } from '@/lib/hooks/useMockOnboarding';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { dashboardRequest } from '@/lib/services/postsClient';
import { readPageAiProfile } from '@/lib/services/aiSettingsClient';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { productApi } from '@/lib/services/api';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { compareSourcingItem, defaultSourcingCriteria, RELEVANT_AT, sourcingItems, sourcingRelevance } from '@/lib/services/sourcingCriteria';
import { Modal } from '@/components/ui/Modal';
import type { SourcingCriteria, SourcingDecision, SourcingItem, SourcingRequest, SourcingRun } from '@/lib/types/sourcing';
import styles from './sourcing.module.css';

type Workspace = { requests: SourcingRequest[]; decisions: SourcingDecision[] };
const api = async (body?: object): Promise<Workspace & { id?: string; run?: SourcingRun }> =>
  (await dashboardRequest('/api/sourcing/requests', body ? { method: 'POST', body: JSON.stringify(body) } : undefined)).json();
const statusLabel: Record<string, string> = { starting: 'Đang khởi chạy', running: 'Đang thu thập', succeeded: 'Đã thu thập', empty: 'Không có kết quả', failed: 'Thu thập thất bại', unknown: 'Chưa rõ trạng thái' };
const number = new Intl.NumberFormat('vi-VN');

export function SmartSourcing() {
  const { ready, workspace } = useMockOnboarding();
  const { session } = useAppSecurity();
  return <div className={styles.root}>
    <header className="page-head"><div><h1>Smart Sourcing</h1><p>Khám phá sản phẩm, đối chiếu bằng chứng và lưu nguồn đáng xem xét.</p></div></header>
    {!ready ? <p role="status">Đang đọc thông tin shop…</p> : !workspace ? <section className="card"><h2>Bắt đầu từ ngành hàng của shop</h2><Link href="/cai-dat">Thiết lập thông tin shop →</Link></section>
      : <SourcingFlow key={`${session.userId || session.username}:${workspace.industry}`} industry={workspace.industry} shopName={workspace.name} owner={session.userId || session.username} pageId={session.pageId} />}
  </div>;
}

function SourcingFlow({ industry, shopName, owner, pageId }: { industry: string; shopName: string; owner: string; pageId: string | null }) {
  const [view, setView] = useState<Workspace>({ requests: [], decisions: [] });
  const [selectedId, setSelectedId] = useState('');
  const [criteria, setCriteria] = useState<SourcingCriteria>(() => defaultSourcingCriteria(industry));
  useEffect(() => {
    let active = true;
    // Điền sẵn giá/MOQ/khu vực từ cấu hình AI Smart Sourcing của Page; lỗi thì giữ mặc định.
    readPageAiProfile(pageId, owner).then(({ configuration }) => {
      const rules = configuration.profiles.sourcing.rules;
      const optional = (value: string) => value.trim() && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
      if (active) setCriteria(current => ({ ...current, minPrice: optional(rules.minPrice || ''), maxPrice: optional(rules.maxPrice || ''), maxMoq: optional(rules.moq || ''), region: rules.region || current.region }));
    }).catch(() => {});
    return () => { active = false; };
  }, [pageId, owner]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [filter, setFilter] = useState('relevant');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState('');
  const [transfer, setTransfer] = useState<{ item: SourcingItem; runId: string; kind: 'product' | 'marketing' } | null>(null);
  const inFlight = useRef(false);
  const selected = view.requests.find(request => request.id === selectedId);
  const run = selected?.run;
  const dirty = !!selected && JSON.stringify(criteria) !== JSON.stringify(selected.criteria);
  const load = useCallback(async () => { const next = await api(); setView(next); return next; }, []);
  useEffect(() => {
    let active = true;
    api().then(next => {
      if (!active) return;
      setView(next);
      const first = next.requests[0];
      if (first) { setSelectedId(first.id); setCriteria(first.criteria); }
    }).catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!run || !['running', 'starting'].includes(run.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (!document.hidden) {
          const next: SourcingRun = await (await dashboardRequest(`/api/sourcing/runs/${run.id}`, { signal: controller.signal })).json();
          if (controller.signal.aborted) return;
          setView(old => ({ ...old, requests: old.requests.map(request => request.runId === next.id ? { ...request, run: next } : request) }));
          setError('');
          if (!['running', 'starting'].includes(next.status)) return;
        }
      } catch (e) { if (controller.signal.aborted) return; setError(`${(e as Error).message} Lượt thu thập vẫn được lưu; tải lại để kiểm tra.`); }
      timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [run]);
  const work = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const prepare = () => work(async () => {
    const next = await api({ action: 'prepare', criteria, ...(selected && !selected.runId ? { id: selected.id, revision: selected.revision } : {}) });
    setView(next); setSelectedId(next.id!); setCriteria(next.requests.find(r => r.id === next.id)!.criteria); setConfirmed(false);
  });
  const collect = () => work(async () => {
    if (!selected || dirty || !confirmed) return;
    try { await api({ action: 'run', id: selected.id, revision: selected.revision, confirmed: true }); }
    finally { await load(); setConfirmed(false); }
  });
  const decide = (item: SourcingItem, status: SourcingDecision['status'], note: string) => work(async () => {
    if (run) setView(await api({ action: 'decision', runId: run.id, itemKey: item.key, status, note }));
  });
  const change = <K extends keyof SourcingCriteria>(key: K, value: SourcingCriteria[K]) => { setCriteria(old => ({ ...old, [key]: value })); setConfirmed(false); };
  const items = run ? sourcingItems(run) : [];
  const queries = selected ? selected.criteria.kind === 'suppliers' ? [selected.criteria.product] : selected.plan.queries : [];
  const scored = items.map(item => ({ item, score: sourcingRelevance(item, queries), decision: view.decisions.find(d => d.runId === run?.id && d.itemKey === item.key) }));
  const relevantCount = scored.filter(entry => entry.score >= RELEVANT_AT).length;
  const visible = scored.filter(({ item, score, decision }) => (filter === 'all' || (filter === 'relevant' && score >= RELEVANT_AT) || decision?.status === filter
    || (filter === 'missing' && compareSourcingItem(item, selected!.criteria).missing.length > 0)) && `${item.title} ${item.text}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
    .sort((a, b) => b.score - a.score || (b.item.metrics?.views ?? 0) - (a.item.metrics?.views ?? 0));
  const opened = scored.find(entry => entry.item.key === openKey);
  return <>
    <div className={styles.context}><div><strong>{shopName}</strong><span>{industry} · Việt Nam</span></div><Link href="/cau-hinh-ai?tab=settings&ai=sourcing">Quy tắc AI →</Link></div>
    {error && <p role="alert" className={styles.error}>{error} <button className="btn btn-outline btn-sm" onClick={() => work(async () => { await load(); })}>Tải lại tiến trình</button></p>}
    <p aria-live="polite" className={styles.notice}>{busy ? 'Đang xử lý…' : notice}</p>
    <div className={styles.layout}>
      <section className="card">
        <div className={styles.sectionHead}><h2>1. Nhu cầu tìm nguồn</h2><button className="btn btn-text btn-sm" disabled={busy} onClick={() => { setSelectedId(''); setConfirmed(false); setTransfer(null); }}>Yêu cầu mới</button></div>
        <label className={styles.field}>Yêu cầu đã lưu<select disabled={busy} value={selectedId} onChange={e => { const request = view.requests.find(r => r.id === e.target.value); setSelectedId(e.target.value); if (request) setCriteria(request.criteria); setConfirmed(false); setTransfer(null); }}><option value="">Yêu cầu mới</option>{view.requests.map(r => <option key={r.id} value={r.id}>{r.criteria.product || r.criteria.keywords.join(', ')} · {r.run ? statusLabel[r.run.status] : 'Nháp'}</option>)}</select></label>
        <form onSubmit={e => { e.preventDefault(); void prepare(); }}>
          <fieldset disabled={busy} className={styles.fields}>
            <label className={styles.field}>Mục đích<select value={criteria.kind} onChange={e => change('kind', e.target.value as SourcingCriteria['kind'])}><option value="tiktok">Khám phá sản phẩm · TikTok</option><option value="suppliers">Tìm đầu mối nhà cung cấp · Google</option></select></label>
            <label className={styles.field}>Sản phẩm quan tâm<input required={criteria.kind === 'suppliers'} maxLength={120} value={criteria.product} onChange={e => change('product', e.target.value)} placeholder="Ví dụ: áo thun cotton" /></label>
            {criteria.kind === 'tiktok' && <label className={styles.field}>Truy vấn khám phá (tối đa 3, phân cách bằng dấu ;)<input maxLength={362} value={criteria.keywords.join(';')} onChange={e => change('keywords', e.target.value ? e.target.value.split(';') : [])} placeholder="Để trống để gợi ý theo ngành hàng" /><small>Từ khóa khởi đầu để tìm kiếm, chưa phải tín hiệu xu hướng.</small></label>}
            <details className={styles.criteria}><summary>Giá, MOQ và tiêu chí bổ sung</summary><div className={styles.fields}>
            <div className={styles.pair}>{(['minPrice', 'maxPrice', 'quantity', 'maxMoq'] as const).map((key, i) => <label key={key} className={styles.field}>{['Giá nhập từ (VND)', 'Đến (VND)', 'Lượng dự kiến mua', 'MOQ tối đa'][i]}<input type="number" min="0" max="1000000000" value={criteria[key] ?? ''} onChange={e => change(key, e.target.value === '' ? null : Number(e.target.value))} /></label>)}</div>
            <div className={styles.pair}><label className={styles.field}>Đơn vị hàng<input required maxLength={60} value={criteria.unit} onChange={e => change('unit', e.target.value)} /></label><label className={styles.field}>Khu vực nhà cung cấp<input required maxLength={100} value={criteria.region} onChange={e => change('region', e.target.value)} /></label></div>
            {(['required', 'excluded', 'quality', 'leadTime', 'audience'] as const).map((key, i) => <label key={key} className={styles.field}>{['Thuộc tính cần có (phân cách bằng dấu ,)', 'Từ khóa loại trừ', 'Chất lượng / chứng từ cần kiểm tra', 'Thời gian cung ứng mong muốn', 'Nhóm khách / phong cách (tùy chọn)'][i]}<input maxLength={key === 'leadTime' ? 100 : 500} value={criteria[key]} onChange={e => change(key, e.target.value)} /></label>)}
            </div></details>
            <label className={styles.field}>Số kết quả giữ lại<input type="number" min="1" max="20" required value={criteria.resultLimit} onChange={e => change('resultLimit', Number(e.target.value))} /></label>
            <button className="btn btn-primary" type="submit">{selected?.runId ? 'Tạo yêu cầu mới với tiêu chí này' : 'Lưu nhu cầu & xem truy vấn'}</button>
          </fieldset>
        </form>
      </section>
      <div className={styles.main}>
        <section className="card">
          <h2>{selected ? '2. Duyệt truy vấn thu thập' : '2. Xem trước truy vấn'}</h2>
          {!selected ? <p>Nhập tiêu chí tìm nguồn để xem nguồn, truy vấn và giới hạn của lượt tìm.</p> : <>
            <ul className={styles.queries}>{selected.plan.queries.map(q => <li key={q}>{q}</li>)}</ul>
            <p>{selected.criteria.kind === 'tiktok' ? 'TikTok · Việt Nam · 7 ngày gần nhất' : 'Google · truy vấn tiếng Việt'} · Giữ tối đa {selected.plan.resultLimit} kết quả</p>
            <p>Giới hạn phí provider: {selected.plan.maxChargeUsd} USD/lượt · timeout {selected.plan.timeoutSeconds} giây. Phí thực tế theo provider.</p>
            {dirty && <p className={styles.warning}>Tiêu chí đã thay đổi. Lưu và xem lại truy vấn trước khi chạy.</p>}
            {!selected.runId ? <><label className={styles.check}><input type="checkbox" checked={confirmed} disabled={dirty || busy} onChange={e => setConfirmed(e.target.checked)} />Tôi xác nhận các truy vấn và giới hạn phí trên.</label><button className="btn btn-primary" disabled={busy || dirty || !confirmed} onClick={collect}>Xác nhận & thu thập</button></> : <div role="status" className={styles.progress}><strong>{run ? statusLabel[run.status] || run.status : 'Đang đọc lượt tìm'}</strong><p>{run?.error || (run?.status === 'starting' ? 'Yêu cầu đã lưu. Đang chờ phản hồi khởi chạy; không tự gửi lại.' : run?.status === 'running' ? 'Có thể rời trang rồi quay lại để đọc tiến trình.' : run?.status === 'empty' ? 'Thử một yêu cầu mới với từ khóa cụ thể hơn.' : run?.status === 'succeeded' ? `${items.length} kết quả có nguồn đã lưu.` : '')}</p>{run?.status === 'unknown' && <p>Kiểm tra lượt chạy trong Apify Console trước khi tạo lượt mới.</p>}<small>Mã lượt: {selected.runId}</small></div>}
          </>}
        </section>
        <section className="card">
          <div className={styles.sectionHead}><div><h2>3. Đối chiếu kết quả</h2></div><span>{visible.length}/{items.length}</span></div>
          <div className={styles.pair}><label className={styles.field}>Tìm trong kết quả<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên hoặc nội dung" /></label><label className={styles.field}>Hiển thị<select value={filter} onChange={e => setFilter(e.target.value)}><option value="relevant">Liên quan đến truy vấn ({relevantCount})</option><option value="all">Tất cả, kể cả không liên quan ({items.length})</option>{run?.kind === 'suppliers' && <option value="missing">Còn thiếu thông tin</option>}<option value="shortlist">Danh sách ngắn</option><option value="checked">Shop đã kiểm tra</option><option value="rejected">Đã loại</option></select></label></div>
          {!items.length ? <p className={styles.empty}>Kết quả sẽ xuất hiện sau khi hoàn tất thu thập.</p> : <><p className={styles.muted}>{run?.kind === 'tiktok' ? 'Tương tác của bài không phải doanh số. Một lần thu thập chưa chứng minh xu hướng tăng.' : 'Kết quả tìm kiếm là đầu mối tham khảo; cần kiểm tra giá, MOQ, khả năng bán sỉ và chất lượng trực tiếp.'}</p><ul className={styles.resultList}>{visible.map(({ item, score, decision }) => <li key={`${run!.id}:${item.key}`}><ResultCard item={item} relevant={score >= RELEVANT_AT} decision={decision} onOpen={() => setOpenKey(item.key)} /></li>)}</ul>
            {!visible.length && <p className={styles.empty}>{filter === 'relevant' && items.length ? `Không có kết quả nào nhắc tới truy vấn trong ${items.length} bài thu thập được. Thử từ khóa cụ thể hơn hoặc chọn "Tất cả".` : 'Không có kết quả phù hợp bộ lọc.'}</p>}</>}
          {opened && run && <Modal open title="Chi tiết kết quả" width={880} onClose={() => setOpenKey('')}>
            <ResultDetail key={`${run.id}:${opened.item.key}`} item={opened.item} relevant={opened.score >= RELEVANT_AT} criteria={selected!.criteria} decision={opened.decision} busy={busy}
              onDecide={(status, note) => decide(opened.item, status, note)} onTransfer={kind => { setOpenKey(''); setTransfer({ item: opened.item, kind, runId: run.id }); }} />
          </Modal>}
        </section>
        {transfer && <Transfer key={`${transfer.runId}:${transfer.item.key}:${transfer.kind}`} {...transfer} industry={industry} owner={owner} busy={busy} work={work} onClose={() => setTransfer(null)} onDone={message => { setNotice(message); setTransfer(null); }} />}
      </div>
    </div>
  </>;
}

const DECISION_LABEL = { shortlist: 'Danh sách ngắn', checked: 'Shop đã kiểm tra', rejected: 'Đã loại' } as const;
const METRIC_LABEL: Record<string, string> = { views: 'Lượt xem', likes: 'Thích', comments: 'Bình luận', shares: 'Chia sẻ' };
const metricsText = (metrics: SourcingItem['metrics']) => metrics ? Object.entries(metrics).filter(([, value]) => value !== null).map(([key, value]) => `${number.format(value!)} ${METRIC_LABEL[key].toLocaleLowerCase('vi')}`).join(' · ') : '';
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

function ResultCard({ item, relevant, decision, onOpen }: { item: SourcingItem; relevant: boolean; decision?: SourcingDecision; onOpen: () => void }) {
  return <button type="button" className={styles.resultCard} onClick={onOpen}>
    <span className={styles.resultTitle}>{item.title || 'Bài không có nội dung'}</span>
    <span className={styles.resultMeta}>{item.source === 'tiktok' ? metricsText(item.metrics) || 'TikTok' : host(item.url)}</span>
    <span className={styles.resultTags}>{!relevant && <span className={styles.badgeMuted}>Ít liên quan</span>}{decision && <span className={styles.badge}>{DECISION_LABEL[decision.status]}</span>}<span className={styles.resultOpen}>Xem chi tiết →</span></span>
  </button>;
}

function ResultDetail({ item, relevant, criteria, decision, busy, onDecide, onTransfer }: { item: SourcingItem; relevant: boolean; criteria: SourcingCriteria; decision?: SourcingDecision; busy: boolean; onDecide: (status: SourcingDecision['status'], note: string) => void; onTransfer: (kind: 'product' | 'marketing') => void }) {
  const comparison = compareSourcingItem(item, criteria);
  const [note, setNote] = useState(decision?.note || '');
  const supplier = item.source !== 'tiktok';
  return <div className={styles.detail}>
    <div className={styles.sectionHead}><div><span className={styles.muted}>{supplier ? host(item.url) : 'TikTok'} · thu thập {new Date(item.collectedAt).toLocaleString('vi-VN')}</span><h3>{item.title || 'Bài không có nội dung'}</h3></div>
      <span className={styles.resultTags}>{!relevant && <span className={styles.badgeMuted}>Ít liên quan</span>}{decision && <span className={styles.badge}>{DECISION_LABEL[decision.status]}</span>}</span></div>
    {item.metrics && <dl className={styles.metrics}>{Object.entries(item.metrics).map(([key, value]) => <div key={key}><dt>{METRIC_LABEL[key]}</dt><dd>{value === null ? 'chưa rõ' : number.format(value)}</dd></div>)}</dl>}
    <p className={styles.excerpt}>{item.text || 'Không có mô tả.'}</p>
    <a href={item.url} target="_blank" rel="noopener noreferrer">{supplier ? 'Mở trang nguồn' : 'Mở video trên TikTok'} ↗</a>
    {supplier && <p>Giá nhập: {item.price === null ? 'chưa rõ' : number.format(item.price)} · Tiền tệ / đơn vị: {item.currency || 'chưa rõ'} / {item.unit || 'chưa rõ'} · MOQ: {item.moq ?? 'chưa rõ'}</p>}
    {!!comparison.matched.length && <p>Khớp: {comparison.matched.join(' · ')}</p>}
    {!!comparison.missing.length && <p className={styles.muted}>Cần kiểm tra: {comparison.missing.join(' · ')}</p>}
    {!!comparison.mismatched.length && <p className={styles.warning}>Không phù hợp: {comparison.mismatched.join(' · ')}</p>}
    {!supplier && <p className={styles.muted}>Tương tác của bài không phải doanh số. Cần tự kiểm tra sản phẩm trong video và nguồn hàng.</p>}
    <label className={styles.field}>Ghi chú kiểm tra<input maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Giá báo lại, thông tin đã xác nhận…" /></label>
    <div className={styles.actions}><button disabled={busy} className="btn btn-primary btn-sm" onClick={() => onDecide('shortlist', note)}>Lưu danh sách ngắn</button><button disabled={busy} className="btn btn-outline btn-sm" onClick={() => onDecide('checked', note)}>Đánh dấu đã kiểm tra</button><button disabled={busy} className="btn btn-text btn-sm" onClick={() => onDecide('rejected', note)}>Loại</button></div>
    <div className={styles.actions}><button disabled={busy} className="btn btn-outline btn-sm" onClick={() => onTransfer('product')}>Xem trước nhập sản phẩm</button><button disabled={busy} className="btn btn-outline btn-sm" onClick={() => onTransfer('marketing')}>Tạo ý tưởng Marketing</button></div>
  </div>;
}

function Transfer({ item, runId, kind, industry, owner, busy, work, onClose, onDone }: { item: SourcingItem; runId: string; kind: 'product' | 'marketing'; industry: string; owner: string; busy: boolean; work: (fn: () => Promise<void>) => Promise<void>; onClose: () => void; onDone: (message: string) => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  const [sku, setSku] = useState('');
  const [name, setName] = useState(item.title.slice(0, 500));
  const [price, setPrice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <section ref={panel} tabIndex={-1} className="card" aria-label="Xác nhận chuyển dữ liệu">
    <h2>{kind === 'product' ? 'Nhập sản phẩm mới' : 'Tạo brief ý tưởng nháp'}</h2><p>Nguồn: <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></p>
    <form onSubmit={e => { e.preventDefault(); void work(async () => {
      const query = new URLSearchParams({ run: runId, item: item.key });
      const { item: source }: { item: SourcingItem } = await (await dashboardRequest(`/api/sourcing/requests?${query}`)).json();
      if (kind === 'product') {
        await productApi.importSourced({ sku, name, price: Number(price), qty: 0, stockKnown: false, material: '', emoji: '📦', category: industry, sizes: [], colors: [], sourceName: source.source, sourceUrl: source.url, sourceUpdatedAt: source.collectedAt, description: source.text.slice(0, 2000) });
        onDone('Đã thêm sản phẩm mới. Nhập tồn kho và kiểm tra thông tin trong FAQ & sản phẩm.');
      } else {
        const view = await marketingWorkspaceClient.read();
        await marketingWorkspaceClient.act(view.revision, 'sourcingIdea', { runId, itemKey: item.key, confirmed: true, knowledge: currentAiKnowledge() });
        onDone('Đã tạo brief nháp trong Marketing → Chiến dịch.');
      }
    }); }}>
      <fieldset className={styles.fields} disabled={busy}>
        {kind === 'product' ? <><label className={styles.field}>SKU mới<input required maxLength={100} value={sku} onChange={e => { setSku(e.target.value); setConfirmed(false); }} /></label><label className={styles.field}>Tên sản phẩm<input required maxLength={500} value={name} onChange={e => { setName(e.target.value); setConfirmed(false); }} /></label><label className={styles.field}>Giá bán do shop xác nhận (VND)<input type="number" min="0" max="1000000000" required value={price} onChange={e => { setPrice(e.target.value); setConfirmed(false); }} /></label><p>Tồn kho: chưa xác nhận · Lượng ban đầu: 0 · Giá nhập, size, màu: chưa có nguồn.</p></> : <p>Tên brief: Ý tưởng: {item.title}<br />Sản phẩm đang bán: chưa chọn · Ưu đãi: chưa có · Trạng thái: nháp, chờ shop hoàn thiện và duyệt.</p>}
        <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi xác nhận các trường sẽ được chuyển ở trên.</label>
        <div className={styles.actions}><button disabled={!confirmed} type="submit" className="btn btn-primary">{kind === 'product' ? 'Xác nhận nhập sản phẩm mới' : 'Xác nhận tạo brief nháp'}</button><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button><Link href={kind === 'product' ? '/cai-dat?tab=products' : '/marketing?tab=campaigns'}>Mở {kind === 'product' ? 'danh mục' : 'Marketing'} →</Link></div>
      </fieldset>
    </form>
  </section>;
}
