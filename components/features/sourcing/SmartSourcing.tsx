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
import { defaultSourcingCriteria, sourcingItems } from '@/lib/services/sourcingCriteria';
import { Modal } from '@/components/ui/Modal';
import type { SourcingAnalysis, SourcingCriteria, SourcingDecision, SourcingItem, SourcingRequest, SourcingRun } from '@/lib/types/sourcing';
import styles from './sourcing.module.css';

type Workspace = { requests: SourcingRequest[]; decisions: SourcingDecision[] };
const api = async (body?: object): Promise<Workspace & { id?: string; run?: SourcingRun; analysis?: SourcingAnalysis }> =>
  (await dashboardRequest('/api/sourcing/requests', body ? { method: 'POST', body: JSON.stringify(body) } : undefined)).json();
const statusLabel: Record<string, string> = { starting: 'Đang khởi chạy', running: 'Đang thu thập', succeeded: 'Đã thu thập', empty: 'Không có kết quả', failed: 'Thu thập thất bại', unknown: 'Chưa rõ trạng thái' };
const number = new Intl.NumberFormat('vi-VN');

export function SmartSourcing() {
  const { ready, workspace } = useMockOnboarding();
  const { session } = useAppSecurity();
  return <div className={styles.root}>
    <header className="page-head"><div><h1>Smart Sourcing</h1><p>Tìm sản phẩm và nhà cung cấp từ dữ liệu thật, để AI phân tích và chỉ rõ nguồn.</p></div></header>
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
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const requested = useRef(new Set<string>());
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
  const change = <K extends keyof SourcingCriteria>(key: K, value: SourcingCriteria[K]) => { setCriteria(old => ({ ...old, [key]: value })); setConfirmed(false); };
  const items = run ? sourcingItems(run) : [];
  const analyze = useCallback(async (runId: string) => {
    setAnalysisError(''); setAnalysisOpen(true);
    try {
      const { analysis } = await api({ action: 'analyze', runId });
      setView(old => ({ ...old, requests: old.requests.map(request => request.run?.id === runId ? { ...request, run: { ...request.run, analysis } } : request) }));
    } catch (e) { setAnalysisError((e as Error).message); }
  }, []);
  // Apify thu thập xong thì AI phân tích dữ liệu thô ngay và mở popup kết quả.
  useEffect(() => {
    if (!run || !['succeeded', 'empty'].includes(run.status) || run.analysis || requested.current.has(run.id)) return;
    requested.current.add(run.id);
    const timer = setTimeout(() => void analyze(run.id), 0);
    return () => clearTimeout(timer);
  }, [run, analyze]);
  const stage = !selected ? 0 : !selected.runId ? 1 : !run || ['starting', 'running', 'unknown'].includes(run.status) ? 2 : 3;
  const isSupplier = criteria.kind === 'suppliers';
  const newRequest = () => { setSelectedId(''); setConfirmed(false); setTransfer(null); setCriteria(old => ({ ...defaultSourcingCriteria(industry), minPrice: old.minPrice, maxPrice: old.maxPrice, maxMoq: old.maxMoq, region: old.region })); };
  const openRequest = (request: SourcingRequest) => { setSelectedId(request.id); setCriteria(request.criteria); setConfirmed(false); setTransfer(null); };
  return <>
    <div className={styles.context}>
      <span><strong>{shopName}</strong> · {industry}</span>
      <span>Truy vấn được gắn ngành hàng này để kết quả đúng chủ đề.</span>
      <Link href="/cau-hinh-ai?tab=settings&ai=sourcing"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>Quy tắc AI Smart Sourcing</Link>
    </div>
    {error && <p role="alert" className={styles.error}>{error} <button className="btn btn-outline btn-sm" onClick={() => work(async () => { await load(); })}>Tải lại</button></p>}
    <ol className={styles.steps} aria-label="Tiến trình">{['Nhập nhu cầu', 'Kiểm tra truy vấn & phí', 'Thu thập dữ liệu', 'AI phân tích'].map((label, i) => <li key={label} data-state={i < stage ? 'done' : i === stage ? 'current' : 'todo'} aria-current={i === stage ? 'step' : undefined}><span aria-hidden="true">{i < stage ? '✓' : i + 1}</span>{label}</li>)}</ol>
    <p aria-live="polite" className={styles.notice}>{busy ? 'Đang xử lý…' : notice}</p>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="sourcing-form">
        <div className={styles.panelHead}><h2 id="sourcing-form">{selected?.runId ? 'Tiêu chí của lượt tìm' : 'Bạn muốn tìm gì?'}</h2>{selected && <button className="btn btn-text btn-sm" disabled={busy} onClick={newRequest}>Tìm mới</button>}</div>
        <form onSubmit={e => { e.preventDefault(); void prepare(); }}>
          <fieldset disabled={busy} className={styles.fields}>
            <div className={styles.segmented} role="radiogroup" aria-label="Nguồn dữ liệu">
              {([['tiktok', 'Khám phá sản phẩm', 'Video TikTok 7 ngày gần nhất'], ['suppliers', 'Tìm nhà cung cấp', 'Kết quả tìm kiếm Google']] as const).map(([kind, label, hint]) => <button key={kind} type="button" role="radio" aria-checked={criteria.kind === kind} onClick={() => change('kind', kind)}><strong>{label}</strong><small>{hint}</small></button>)}
            </div>
            <label className={styles.field}>Sản phẩm quan tâm{isSupplier ? '' : ' (không bắt buộc)'}<input required={isSupplier} maxLength={120} value={criteria.product} onChange={e => change('product', e.target.value)} placeholder="Ví dụ: áo thun cotton" /></label>
            {!isSupplier && <label className={styles.field}>Từ khóa khám phá<input maxLength={362} value={criteria.keywords.join(';')} onChange={e => change('keywords', e.target.value ? e.target.value.split(';') : [])} placeholder="Ví dụ: chất liệu thoáng mát; phối đồ đi biển" /><small>Tối đa 3, cách nhau bằng dấu ;. Để trống để dùng từ khóa gợi ý của ngành.</small></label>}
            {isSupplier && <details className={styles.more} open><summary>Tiêu chí nhà cung cấp</summary><div className={styles.fields}>
              <div className={styles.pair}>{(['minPrice', 'maxPrice', 'quantity', 'maxMoq'] as const).map((key, i) => <label key={key} className={styles.field}>{['Giá nhập từ (VND)', 'Đến (VND)', 'Lượng dự kiến mua', 'MOQ tối đa'][i]}<input type="number" min="0" max="1000000000" inputMode="numeric" value={criteria[key] ?? ''} onChange={e => change(key, e.target.value === '' ? null : Number(e.target.value))} /></label>)}</div>
              <div className={styles.pair}><label className={styles.field}>Đơn vị hàng<input required maxLength={60} value={criteria.unit} onChange={e => change('unit', e.target.value)} /></label><label className={styles.field}>Khu vực<input required maxLength={100} value={criteria.region} onChange={e => change('region', e.target.value)} /></label></div>
              {(['quality', 'leadTime'] as const).map((key, i) => <label key={key} className={styles.field}>{['Chất lượng / chứng từ cần có', 'Thời gian cung ứng mong muốn'][i]}<input maxLength={key === 'leadTime' ? 100 : 500} value={criteria[key]} onChange={e => change(key, e.target.value)} /></label>)}
            </div></details>}
            <details className={styles.more}><summary>Hướng dẫn thêm cho AI phân tích</summary><div className={styles.fields}>
              {(['audience', 'required', 'excluded'] as const).map((key, i) => <label key={key} className={styles.field}>{['Nhóm khách / phong cách', 'Điều cần có (cách nhau bằng dấu ,)', 'Điều cần loại bỏ'][i]}<input maxLength={500} value={criteria[key]} onChange={e => change(key, e.target.value)} placeholder={['Ví dụ: nữ văn phòng 25–35 tuổi', 'Ví dụ: cotton, form rộng', 'Ví dụ: hàng order nước ngoài'][i]} /></label>)}
            </div></details>
            <div className={styles.submitRow}>
              <label className={styles.inline}>Số kết quả<input type="number" min="1" max="20" required value={criteria.resultLimit} onChange={e => change('resultLimit', Number(e.target.value))} /></label>
              <button className="btn btn-primary" type="submit">{selected?.runId ? 'Tìm lại với tiêu chí này' : 'Xem truy vấn'}</button>
            </div>
          </fieldset>
        </form>
      </section>
      <div className={styles.main}>
        <section className={styles.panel} aria-labelledby="sourcing-run">
          {!selected ? <div className={styles.idle}>
            <h2 id="sourcing-run">Lượt tìm</h2>
            <p>Nhập nhu cầu ở bên trái rồi bấm <strong>Xem truy vấn</strong>. Bạn sẽ thấy chính xác truy vấn được gửi đi và trần phí trước khi xác nhận thu thập.</p>
            <p className={styles.muted}>Thu thập xong, AI đọc toàn bộ dữ liệu thô, bỏ bài lạc đề và viết phân tích kèm nguồn cho từng nhận định.</p>
          </div> : <>
            <div className={styles.panelHead}><h2 id="sourcing-run">{selected.criteria.product || selected.plan.queries[0] || 'Lượt tìm'}</h2>{run && <span className={styles.status} data-status={run.status}>{statusLabel[run.status] || run.status}</span>}</div>
            <div className={styles.queryBlock}>
              <span className={styles.label}>Truy vấn gửi tới {selected.criteria.kind === 'tiktok' ? 'TikTok' : 'Google'}</span>
              <ul className={styles.chips}>{selected.plan.queries.map(q => <li key={q}>{q}</li>)}</ul>
              <p className={styles.muted}>{selected.criteria.kind === 'tiktok' ? 'Việt Nam · 7 ngày gần nhất' : 'Tiếng Việt'} · tối đa {selected.plan.resultLimit} kết quả · trần phí {selected.plan.maxChargeUsd} USD · dừng sau {selected.plan.timeoutSeconds} giây</p>
            </div>
            {dirty && <p className={styles.warning}>Tiêu chí bên trái đã thay đổi. Bấm “{selected.runId ? 'Tìm lại với tiêu chí này' : 'Xem truy vấn'}” để cập nhật truy vấn.</p>}
            {!selected.runId ? <div className={styles.confirm}>
              <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={dirty || busy} onChange={e => setConfirmed(e.target.checked)} />Tôi đồng ý chạy các truy vấn trên với trần phí đã nêu.</label>
              <button className="btn btn-primary" disabled={busy || dirty || !confirmed} onClick={collect}>Thu thập dữ liệu</button>
            </div>
            : !run || ['starting', 'running'].includes(run.status) ? <div role="status" className={styles.working}><span className={styles.pulse} aria-hidden="true" /><div><strong>{run?.status === 'running' ? 'Đang thu thập dữ liệu…' : 'Đang khởi chạy lượt tìm…'}</strong><p className={styles.muted}>Thường mất 1–3 phút. Bạn có thể rời trang; kết quả vẫn được lưu và AI sẽ phân tích khi bạn quay lại.</p></div></div>
            : ['failed', 'unknown'].includes(run.status) ? <div className={styles.error}><strong>{run.status === 'failed' ? 'Thu thập không thành công' : 'Chưa rõ kết quả lượt chạy'}</strong><p>{run.error || 'Không nhận được kết quả từ nhà cung cấp dữ liệu.'}</p><p>{run.status === 'unknown' ? 'Kiểm tra lượt chạy trong Apify Console trước khi tạo lượt mới để tránh tính phí trùng.' : 'Thử lại với một lượt tìm mới.'}</p></div>
            : <div className={styles.outcome}>
              <span className={styles.label}>Kết quả</span>
              {run.analysis ? <>
                <p className={styles.summary}>{run.analysis.summary}</p>
                <ul className={`${styles.chips} ${styles.stats}`}>
                  <li><strong>{items.length}</strong> bài thu thập</li>
                  <li><strong>{run.analysis.relevantCount}</strong> bài được AI dùng làm nguồn</li>
                  {run.analysis.productIdeas.length > 0 && <li><strong>{run.analysis.productIdeas.length}</strong> sản phẩm đáng tìm hiểu</li>}
                </ul>
                {run.analysis.productIdeas.length > 0 && <ul className={styles.chips}>{run.analysis.productIdeas.map(idea => <li key={idea.name}>{idea.name}</li>)}</ul>}
                <button className="btn btn-primary" onClick={() => setAnalysisOpen(true)}>Xem phân tích đầy đủ</button>
              </> : analysisError ? <><p className={styles.warning}>{analysisError}</p><button className="btn btn-primary" onClick={() => void analyze(run.id)}>Phân tích lại</button></>
              : <div role="status" className={styles.working}><span className={styles.pulse} aria-hidden="true" /><div><strong>AI đang phân tích {items.length} kết quả…</strong><p className={styles.muted}>Bài phân tích sẽ tự mở khi xong.</p></div></div>}
            </div>}
          </>}
        </section>
        {transfer && <Transfer key={`${transfer.runId}:${transfer.item.key}:${transfer.kind}`} {...transfer} industry={industry} owner={owner} busy={busy} work={work} onClose={() => setTransfer(null)} onDone={message => { setNotice(message); setTransfer(null); }} />}
        {view.requests.length > 0 && <section className={styles.panel} aria-labelledby="sourcing-history">
          <div className={styles.panelHead}><h2 id="sourcing-history">Lượt tìm gần đây</h2><span className={styles.muted}>{view.requests.length}</span></div>
          <ul className={styles.history}>{view.requests.slice(0, 8).map(request => <li key={request.id}><button type="button" aria-current={request.id === selectedId ? 'true' : undefined} disabled={busy} onClick={() => openRequest(request)}>
            <svg className={styles.historyIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className={styles.historyTitle}>{request.criteria.product || request.plan.queries.join(' · ') || 'Lượt tìm'}</span>
            <span className={styles.muted}>{request.criteria.kind === 'tiktok' ? 'TikTok' : 'Google'} · {new Date(request.updatedAt).toLocaleDateString('vi-VN')}</span>
            <span className={styles.status} data-status={request.run?.status ?? 'draft'}>{request.run ? statusLabel[request.run.status] || request.run.status : 'Chưa chạy'}</span>
          </button></li>)}</ul>
        </section>}
        {analysisOpen && run && <Modal open title="Phân tích kết quả tìm kiếm" width={920} onClose={() => setAnalysisOpen(false)}>
          {run.analysis ? <AnalysisView analysis={run.analysis} items={items} kind={run.kind} onTransfer={(item, kind) => { setAnalysisOpen(false); setTransfer({ item, kind, runId: run.id }); }} />
            : analysisError ? <div className={styles.detail}><p className={styles.error}>{analysisError}</p><div className={styles.actions}><button className="btn btn-primary btn-sm" onClick={() => void analyze(run.id)}>Thử phân tích lại</button></div></div>
            : <p role="status" className={styles.empty}>AI đang đọc {items.length} kết quả thu thập được và viết phân tích…</p>}
        </Modal>}
      </div>
    </div>
  </>;
}

const METRIC_LABEL: Record<string, string> = { views: 'Lượt xem', likes: 'Thích', comments: 'Bình luận', shares: 'Chia sẻ' };
const metricsText = (metrics: SourcingItem['metrics']) => metrics ? Object.entries(metrics).filter(([, value]) => value !== null).map(([key, value]) => `${number.format(value!)} ${METRIC_LABEL[key].toLocaleLowerCase('vi')}`).join(' · ') : '';
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** Bài phân tích của AI; phần Nguồn bên dưới liệt kê đúng các kết quả được trích làm căn cứ. */
function AnalysisView({ analysis, items, kind, onTransfer }: { analysis: SourcingAnalysis; items: SourcingItem[]; kind: SourcingRun['kind']; onTransfer: (item: SourcingItem, kind: 'product' | 'marketing') => void }) {
  const cited = [...new Set([...analysis.findings, ...analysis.productIdeas].flatMap(entry => entry.sources))].map(key => items.find(item => item.key === key)).filter((item): item is SourcingItem => !!item);
  const ref = (keys: string[]) => keys.map(key => cited.findIndex(item => item.key === key) + 1).filter(n => n > 0);
  const Refs = ({ keys }: { keys: string[] }) => <span className={styles.refs}>{ref(keys).map(n => <a key={n} href={`#source-${n}`}>[{n}]</a>)}</span>;
  return <div className={styles.analysis}>
    <p className={styles.muted}>{analysis.relevantCount}/{items.length} kết quả được dùng làm nguồn · phân tích bởi AI Smart Sourcing ({analysis.model}) lúc {new Date(analysis.createdAt).toLocaleString('vi-VN')}</p>
    <section><h3>Tóm tắt</h3><p>{analysis.summary}</p></section>
    {analysis.findings.length > 0 && <section><h3>Nhận định từ dữ liệu</h3><ol className={styles.findings}>{analysis.findings.map((finding, i) => <li key={i}><strong>{finding.title}</strong> <Refs keys={finding.sources} /><p>{finding.detail}</p></li>)}</ol></section>}
    {analysis.productIdeas.length > 0 && <section><h3>Sản phẩm đáng tìm hiểu</h3><ul className={styles.findings}>{analysis.productIdeas.map((idea, i) => <li key={i}><strong>{idea.name}</strong> <Refs keys={idea.sources} /><p>{idea.reason}</p></li>)}</ul></section>}
    {analysis.caveats.length > 0 && <section><h3>Lưu ý</h3><ul className={styles.caveats}>{analysis.caveats.map((caveat, i) => <li key={i}>{caveat}</li>)}</ul></section>}
    <section><h3>Nguồn — vì sao AI phân tích như vậy</h3>
      {!cited.length ? <p className={styles.muted}>Không có kết quả nào đủ liên quan để làm căn cứ.</p> : <ol className={styles.sources}>{cited.map((item, i) => <li key={item.key} id={`source-${i + 1}`}>
        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'Bài nguồn'} ↗</a>
        <span className={styles.muted}>{kind === 'tiktok' ? metricsText(item.metrics) || 'TikTok' : host(item.url)}</span>
        <p className={styles.sourceText}>{item.text.slice(0, 280)}{item.text.length > 280 ? '…' : ''}</p>
        <span className={styles.actions}><button type="button" className="btn btn-outline btn-sm" onClick={() => onTransfer(item, 'product')}>Nhập sản phẩm</button><button type="button" className="btn btn-outline btn-sm" onClick={() => onTransfer(item, 'marketing')}>Tạo ý tưởng Marketing</button></span>
      </li>)}</ol>}
    </section>
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
