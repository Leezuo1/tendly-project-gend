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
import { catalogKeywords, defaultSourcingCriteria, sourcingItems } from '@/lib/services/sourcingCriteria';
import { industries } from '@/lib/data/workspace';
import { createSeed } from '@/lib/data/admin';
import { Modal } from '@/components/ui/Modal';
import type { SourcingAnalysis, SourcingCriteria, SourcingDecision, SourcingItem, SourcingPoint, SourcingRequest, SourcingRun, SupplierTier, TikTokReport, TrendStatus } from '@/lib/types/sourcing';
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
      // Lượt cũ có thể lưu ngành khác (shop đã đổi ngành); truy vấn mới luôn theo ngành hiện tại.
      if (first) { setSelectedId(first.id); setCriteria({ ...first.criteria, industry }); }
    }).catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [industry]);
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
    let sent = criteria;
    // Không nhập gì thì tìm theo loại sản phẩm trong danh mục của shop; chưa có danh mục (hoặc lỗi đọc) thì server dùng từ khóa gợi ý của ngành.
    if (criteria.kind === 'tiktok' && !criteria.product.trim() && !criteria.keywords.length) {
      const samples = new Map(createSeed().products.map(product => [product.id, JSON.stringify(product)]));
      const fromCatalog = catalogKeywords(await productApi.list().catch(() => []), industries, samples);
      if (fromCatalog.length) sent = { ...criteria, keywords: fromCatalog };
    }
    const next = await api({ action: 'prepare', criteria: sent, ...(selected && !selected.runId ? { id: selected.id, revision: selected.revision } : {}) });
    setView(next); setSelectedId(next.id!); setCriteria(next.requests.find(r => r.id === next.id)!.criteria);
  });
  const collect = () => work(async () => {
    if (!selected || dirty) return;
    try { await api({ action: 'run', id: selected.id, revision: selected.revision, confirmed: true }); }
    finally { await load(); }
  });
  const change = <K extends keyof SourcingCriteria>(key: K, value: SourcingCriteria[K]) => { setCriteria(old => ({ ...old, [key]: value })); };
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
  const newRequest = () => { setSelectedId(''); setTransfer(null); setCriteria(old => ({ ...defaultSourcingCriteria(industry), minPrice: old.minPrice, maxPrice: old.maxPrice, maxMoq: old.maxMoq, region: old.region })); };
  const openRequest = (request: SourcingRequest) => { setSelectedId(request.id); setCriteria({ ...request.criteria, industry }); setTransfer(null); };
  return <>
    <div className={styles.context}>
      <span><strong>{shopName}</strong> · {industry}</span>
      <span>Tìm theo sản phẩm, từ khóa bạn nhập hoặc loại sản phẩm trong danh mục của shop; bài khớp từ khóa được xếp lên trước.</span>
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
            {!isSupplier && <label className={styles.field}>Từ khóa khám phá<input maxLength={362} value={criteria.keywords.join(';')} onChange={e => change('keywords', e.target.value ? e.target.value.split(';') : [])} placeholder="Ví dụ: chất liệu thoáng mát; phối đồ đi biển" /><small>Tối đa 3, cách nhau bằng dấu ;. Để trống để tìm theo các loại sản phẩm trong danh mục của shop (nếu có), hoặc từ khóa gợi ý của ngành.</small></label>}
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
            <p>Nhập nhu cầu ở bên trái rồi bấm <strong>Xem truy vấn</strong>. Bạn sẽ thấy chính xác truy vấn được gửi đi và trần phí trước khi thu thập.</p>
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
              <button className="btn btn-primary" disabled={busy || dirty} onClick={collect}>Thu thập dữ liệu</button>
            </div>
            : !run || ['starting', 'running'].includes(run.status) ? <div role="status" className={styles.working}><span className={styles.pulse} aria-hidden="true" /><div><strong>{run?.status === 'running' ? 'Đang thu thập dữ liệu…' : 'Đang khởi chạy lượt tìm…'}</strong><p className={styles.muted}>Thường mất 1–3 phút. Bạn có thể rời trang; kết quả vẫn được lưu và AI sẽ phân tích khi bạn quay lại.</p></div></div>
            : ['failed', 'unknown'].includes(run.status) ? <div className={styles.error}><strong>{run.status === 'failed' ? 'Thu thập không thành công' : 'Chưa rõ kết quả lượt chạy'}</strong><p>{run.error || 'Không nhận được kết quả từ nhà cung cấp dữ liệu.'}</p><p>{run.status === 'unknown' ? 'Kiểm tra lượt chạy trong Apify Console trước khi tạo lượt mới để tránh tính phí trùng.' : 'Thử lại với một lượt tìm mới.'}</p></div>
            : <div className={styles.outcome}>
              <span className={styles.label}>Kết quả</span>
              {run.analysis ? <>
                <p className={styles.summary}>{run.analysis.summary}</p>
                <ul className={`${styles.chips} ${styles.stats}`}>
                  {run.analysis.report && <><li>Trend: <strong>{TREND_LABEL[run.analysis.report.trend.status]}</strong></li><li>Sức mua: <strong>{intentText(run.analysis.report.buyingIntent.score)}</strong></li></>}
                  {run.analysis.suppliers && <li><strong>{run.analysis.suppliers.suppliers.length}</strong> nhà cung cấp đáng chú ý</li>}
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
          <div className={styles.panelHead}><h2 id="sourcing-history">Lượt tìm gần đây</h2>{view.requests.length > 3 && <button type="button" className={styles.historyToggle} aria-expanded={historyOpen} aria-controls="sourcing-history-list" aria-label={historyOpen ? 'Thu gọn lịch sử' : 'Hiển thị tất cả lịch sử'} onClick={() => setHistoryOpen(open => !open)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>}</div>
          <ul id="sourcing-history-list" className={styles.history}>{(historyOpen ? view.requests : view.requests.slice(0, 3)).map(request => <li key={request.id}><button type="button" aria-current={request.id === selectedId ? 'true' : undefined} disabled={busy} onClick={() => openRequest(request)}>
            <svg className={styles.historyIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className={styles.historyTitle}>{request.criteria.product || request.plan.queries.join(' · ') || 'Lượt tìm'}</span>
            <span className={styles.muted}>{request.criteria.kind === 'tiktok' ? 'TikTok' : 'Google'} · {new Date(request.updatedAt).toLocaleDateString('vi-VN')}</span>
            <span className={styles.status} data-status={request.run?.status ?? 'draft'}>{request.run ? statusLabel[request.run.status] || request.run.status : 'Chưa chạy'}</span>
          </button></li>)}</ul>
        </section>}
        {analysisOpen && run && <Modal open title={run.kind === 'tiktok' ? 'Báo cáo khám phá sản phẩm' : 'Báo cáo tìm nhà cung cấp'} width={920} onClose={() => setAnalysisOpen(false)}>
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

// Một lần chụp 7 ngày chưa chứng minh xu hướng tăng, nên nhãn nói "tín hiệu" thay vì kết luận.
const TREND_LABEL: Record<TrendStatus, string> = { early: 'Tín hiệu mới chớm (1 lần chụp)', peaking: 'Tín hiệu mạnh (1 lần chụp)', saturated: 'Tín hiệu bão hòa (1 lần chụp)', entertainment: 'Chủ yếu giải trí, ít người hỏi mua', unclear: 'Chưa đủ dữ liệu' };
const intentText = (score: number | null) => score === null ? 'chưa đủ dữ liệu bình luận' : `${score}/10 (tỉ lệ bình luận hỏi mua)`;
const TIER_LABEL: Record<SupplierTier, string> = { factory: 'Xưởng sản xuất', wholesale: 'Tổng kho sỉ', distributor: 'Đại lý phân phối', unknown: 'Chưa rõ mô hình' };
const HIDDEN = 'Không công khai trên web – cần liên hệ trực tiếp';
const reportSources = (report: TikTokReport) => [report.trend.sources, report.buyingIntent.sources, ...[report.whyNow, report.specs, report.audience, report.price, report.drivers, report.hesitations, report.hooks, report.formats, report.keywords].flat().map(point => point.sources)].flat();

/** Bài phân tích của AI; phần Nguồn bên dưới liệt kê đúng các kết quả được trích làm căn cứ. */
function AnalysisView({ analysis, items, kind, onTransfer }: { analysis: SourcingAnalysis; items: SourcingItem[]; kind: SourcingRun['kind']; onTransfer: (item: SourcingItem, kind: 'product' | 'marketing') => void }) {
  const { report, suppliers } = analysis;
  const [copied, setCopied] = useState(false);
  const keys = report ? [...reportSources(report), ...analysis.productIdeas.flatMap(idea => idea.sources)] : suppliers ? [...suppliers.suppliers.map(card => card.source), ...[...suppliers.tierMix, ...suppliers.regions].flatMap(point => point.sources)]
    : [...analysis.findings, ...analysis.productIdeas].flatMap(entry => entry.sources);
  const cited = [...new Set(keys)].map(key => items.find(item => item.key === key)).filter((item): item is SourcingItem => !!item);
  const ref = (keys: string[]) => keys.map(key => cited.findIndex(item => item.key === key) + 1).filter(n => n > 0);
  const refs = (keys: string[]) => <span className={styles.refs}>{ref(keys).map(n => <a key={n} href={`#source-${n}`}>[{n}]</a>)}</span>;
  const points = (title: string, list: SourcingPoint[]) => <div className={styles.points}><h4>{title}</h4>
    {list.length ? <ul className={styles.findings}>{list.map((point, i) => <li key={i}>{point.text} {refs(point.sources)}</li>)}</ul> : <p className={styles.muted}>Chưa đủ dữ liệu trong các bài thu thập.</p>}</div>;
  return <div className={styles.analysis}>
    <p className={styles.muted}>{analysis.relevantCount}/{items.length} kết quả được dùng làm nguồn{report ? ` · ${report.commentCount} bình luận đã đọc` : ''} · phân tích bởi AI Smart Sourcing ({analysis.model}) lúc {new Date(analysis.createdAt).toLocaleString('vi-VN')}</p>
    <section><h3>Tóm tắt</h3><p>{analysis.summary}</p></section>
    {report ? <>
      {analysis.productIdeas.length > 0 && <section><h3>Sản phẩm đang hot</h3><ul className={styles.findings}>{analysis.productIdeas.map((idea, i) => <li key={i}><strong>{idea.name}</strong> {refs(idea.sources)}<p>{idea.reason}</p></li>)}</ul></section>}
      <section><h3>1. Nhiệt độ trend & sức mua</h3>
        <dl className={styles.signals}>
          <div><dt>Trạng thái trend</dt><dd>{TREND_LABEL[report.trend.status]} {refs(report.trend.sources)}</dd>{report.trend.reason && <p>{report.trend.reason}</p>}</div>
          <div><dt>Bình luận hỏi mua</dt><dd>{intentText(report.buyingIntent.score)} {refs(report.buyingIntent.sources)}</dd>{report.buyingIntent.reason && <p>{report.buyingIntent.reason}</p>}</div>
        </dl>
        {points("Lý do tạo sóng (Why now?)", report.whyNow)}
      </section>
      <section><h3>2. Chân dung sản phẩm chiến thắng</h3>
        {points("Đặc điểm ngoại hình / tính năng ăn tiền", report.specs)}
        {points("Tệp khách hàng mục tiêu trên TikTok", report.audience)}
        {points("Mức giá tâm lý", report.price)}
      </section>
      <section><h3>3. Insight khách hàng từ bình luận</h3>
        {report.commentCount === 0 && <p className={styles.warning}>Lượt này chưa thu được bình luận nào, nên phần này và điểm sức mua chưa có căn cứ.</p>}
        {points("Lý do khách chốt đơn", report.drivers)}
        {points("Nỗi lo / rào cản mua hàng", report.hesitations)}
      </section>
      <section><h3>4. Công thức video & từ khóa</h3>
        <p className={styles.muted}>Suy từ caption và bình luận; AI chưa xem hình ảnh hay lời thoại trong video.</p>
        {points("Cấu trúc hook (3 giây đầu)", report.hooks)}
        {points("Góc quay & bối cảnh", report.formats)}
        {points("Từ khóa ngách", report.keywords)}
        <div className={styles.points}><h4>Hashtag có trong dữ liệu</h4>{report.hashtags.length ? <ul className={styles.chips}>{report.hashtags.map(tag => <li key={tag}>{tag}</li>)}</ul> : <p className={styles.muted}>Chưa đủ dữ liệu trong các bài thu thập.</p>}</div>
      </section>
    </> : suppliers ? <>
      <section><h3>1. Toàn cảnh nguồn cung trên Google</h3>
        <dl className={styles.signals}>
          <div><dt>Tỷ lệ lọc nguồn</dt><dd>{suppliers.suppliers.length}/{suppliers.collected} trang là nhà cung cấp</dd>{suppliers.filterNote && <p>{suppliers.filterNote}</p>}</div>
          <div><dt>Trang đọc được nội dung</dt><dd>{suppliers.pagesRead}/{suppliers.collected}</dd><p>Trang không đọc được chỉ có tiêu đề và mô tả ngắn của Google.</p></div>
        </dl>
        {points('Phân bổ loại hình nguồn hàng', suppliers.tierMix)}
        {points('Khu vực tập trung', suppliers.regions)}
      </section>
      <section><h3>2. Nhà cung cấp đáng chú ý</h3>
        {!suppliers.suppliers.length ? <p className={styles.muted}>Không có trang nào đủ căn cứ là nhà cung cấp phù hợp. Thử tên sản phẩm cụ thể hơn.</p>
          : <ul className={styles.suppliers}>{suppliers.suppliers.map(card => { const item = items.find(entry => entry.key === card.source); return <li key={card.source} className={styles.supplier}>
            <div className={styles.supplierHead}><div><strong>{card.name}</strong> <span className={styles.status}>{TIER_LABEL[card.tier]}</span></div><span className={styles.muted}>Khớp nhu cầu <strong>{card.matchScore ?? '–'}/10</strong></span></div>
            <dl className={styles.facts}>
              <div><dt>Chính sách sỉ & MOQ</dt><dd>{card.moq || HIDDEN}</dd></div>
              <div><dt>Giá sỉ</dt><dd>{card.price || HIDDEN}</dd></div>
              <div><dt>Thế mạnh & mặt hàng chủ lực</dt><dd>{card.strengths || 'Trang chưa nêu rõ.'}</dd></div>
              <div><dt>SĐT / Zalo</dt><dd>{card.phones.join(' · ') || HIDDEN}</dd></div>
              <div><dt>Địa chỉ kho / xưởng</dt><dd>{card.address || HIDDEN}</dd></div>
              <div><dt>Website nguồn</dt><dd>{item ? <a href={item.url} target="_blank" rel="noopener noreferrer">{host(item.url)} ↗</a> : 'Không rõ'} {refs([card.source])}</dd></div>
            </dl>
          </li>; })}</ul>}
      </section>
      {suppliers.suppliers.length > 0 && <section><h3>3. Độ tin cậy & cảnh báo rủi ro</h3>
        {suppliers.suppliers.map(card => <div key={card.source} className={styles.points}><h4>{card.name}</h4>
          {card.greenFlags.length + card.redFlags.length ? <ul className={styles.flags}>
            {card.greenFlags.map((flag, i) => <li key={`g${i}`} data-tone="green"><span aria-hidden="true">✓</span> <span className={styles.srOnly}>Tín hiệu uy tín: </span>{flag}</li>)}
            {card.redFlags.map((flag, i) => <li key={`r${i}`} data-tone="red"><span aria-hidden="true">!</span> <span className={styles.srOnly}>Cần xác minh: </span>{flag}</li>)}
          </ul> : <p className={styles.muted}>Chưa đủ dữ liệu trên trang để đánh giá.</p>}</div>)}
      </section>}
      {suppliers.suppliers.length > 0 && <section><h3>4. Kịch bản liên hệ & đàm phán</h3>
        {suppliers.suppliers.map(card => card.questions.length > 0 && <div key={card.source} className={styles.points}><h4>Hỏi {card.name}</h4><ol className={styles.findings}>{card.questions.map((question, i) => <li key={i}>{question}</li>)}</ol></div>)}
        {suppliers.message && <div className={styles.points}><h4>Mẫu tin nhắn mở lời</h4><p className={styles.message}>{suppliers.message}</p>
          <span className={styles.actions}><button type="button" className="btn btn-outline btn-sm" onClick={() => void navigator.clipboard.writeText(suppliers.message).then(() => setCopied(true), () => {})}>{copied ? 'Đã sao chép' : 'Sao chép tin nhắn'}</button></span></div>}
      </section>}
    </> : <>
      {analysis.findings.length > 0 && <section><h3>Nhận định từ dữ liệu</h3><ol className={styles.findings}>{analysis.findings.map((finding, i) => <li key={i}><strong>{finding.title}</strong> {refs(finding.sources)}<p>{finding.detail}</p></li>)}</ol></section>}
      {analysis.productIdeas.length > 0 && <section><h3>Sản phẩm đáng tìm hiểu</h3><ul className={styles.findings}>{analysis.productIdeas.map((idea, i) => <li key={i}><strong>{idea.name}</strong> {refs(idea.sources)}<p>{idea.reason}</p></li>)}</ul></section>}
    </>}
    {analysis.caveats.length > 0 && <section><h3>Lưu ý</h3><ul className={styles.caveats}>{analysis.caveats.map((caveat, i) => <li key={i}>{caveat}</li>)}</ul></section>}
    <section><h3>{report || suppliers ? 'Dữ liệu nguồn đối chiếu' : 'Nguồn — vì sao AI phân tích như vậy'}</h3>
      {!cited.length ? <p className={styles.muted}>Không có kết quả nào đủ liên quan để làm căn cứ.</p> : <ol className={styles.sources}>{cited.map((item, i) => <li key={item.key} id={`source-${i + 1}`}>
        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'Bài nguồn'} ↗</a>
        <span className={styles.muted}>{kind === 'tiktok' ? metricsText(item.metrics) || 'TikTok' : host(item.url)}{item.comments?.length ? ` · ${item.comments.length} bình luận đã đọc` : ''}</span>
        {report?.sourceNotes[item.key] && <p>{report.sourceNotes[item.key]}</p>}
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
  const [description, setDescription] = useState(''); // do shop tự viết: văn bản cào về không đi thẳng vào danh mục mà AI Chat đọc
  return <section ref={panel} tabIndex={-1} className="card" aria-label="Xác nhận chuyển dữ liệu">
    <h2>{kind === 'product' ? 'Nhập sản phẩm mới' : 'Tạo brief ý tưởng nháp'}</h2><p>Nguồn: <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></p>
    <form onSubmit={e => { e.preventDefault(); void work(async () => {
      const query = new URLSearchParams({ run: runId, item: item.key });
      const { item: source }: { item: SourcingItem } = await (await dashboardRequest(`/api/sourcing/requests?${query}`)).json();
      if (kind === 'product') {
        await productApi.importSourced({ sku, name, price: Number(price), qty: 0, stockKnown: false, material: '', emoji: '📦', category: industry, sizes: [], colors: [], sourceName: source.source, sourceUrl: source.url, sourceUpdatedAt: source.collectedAt, description: description.trim() });
        onDone('Đã thêm sản phẩm mới. Nhập tồn kho và kiểm tra thông tin trong FAQ & sản phẩm.');
      } else {
        const view = await marketingWorkspaceClient.read();
        await marketingWorkspaceClient.act(view.revision, 'sourcingIdea', { runId, itemKey: item.key, confirmed: true, knowledge: currentAiKnowledge() });
        onDone('Đã tạo brief nháp trong Marketing → Chiến dịch.');
      }
    }); }}>
      <fieldset className={styles.fields} disabled={busy}>
        {kind === 'product' ? <><label className={styles.field}>SKU mới<input required maxLength={100} value={sku} onChange={e => setSku(e.target.value)} /></label><label className={styles.field}>Tên sản phẩm<input required maxLength={500} value={name} onChange={e => setName(e.target.value)} /></label><label className={styles.field}>Giá bán do shop xác nhận (VND)<input type="number" min="0" max="1000000000" required value={price} onChange={e => setPrice(e.target.value)} /></label><label className={styles.field}>Mô tả sản phẩm (tự viết, có thể để trống; AI Chat sẽ đọc)<textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label><p>Tồn kho: chưa xác nhận · Lượng ban đầu: 0 · Giá nhập, size, màu: chưa có nguồn.</p></> : <p>Tên brief: Ý tưởng: {item.title}<br />Sản phẩm đang bán: chưa chọn · Ưu đãi: chưa có · Trạng thái: nháp, chờ shop hoàn thiện và duyệt.</p>}
        <div className={styles.actions}><button type="submit" className="btn btn-primary">{kind === 'product' ? 'Xác nhận nhập sản phẩm mới' : 'Xác nhận tạo brief nháp'}</button><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button><Link href={kind === 'product' ? '/cai-dat?tab=products' : '/marketing?tab=campaigns'}>Mở {kind === 'product' ? 'danh mục' : 'Marketing'} →</Link></div>
      </fieldset>
    </form>
  </section>;
}
