'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMockOnboarding } from '@/lib/hooks/useMockOnboarding';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { dashboardRequest } from '@/lib/services/postsClient';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { productApi } from '@/lib/services/api';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { catalogKeywords, defaultSourcingCriteria, sourcingItems } from '@/lib/services/sourcingCriteria';
import { industries } from '@/lib/data/workspace';
import { scopedTiktokQueries } from '@/lib/services/sourcingSearch';
import { createSeed } from '@/lib/data/admin';
import { upcomingOccasions } from '@/lib/services/sourcingOccasions';
import type { ContentFormat, MarketReport, NewsImpact, SourcingAnalysis, SourcingCriteria, SourcingDecision, SourcingItem, SourcingPoint, SourcingRequest, SourcingRun, SupplierTier, TikTokReport, TrendStatus } from '@/lib/types/sourcing';
import { IconBolt, IconCart, IconDashboard } from '@/components/ui/Icons';
import styles from './sourcing.module.css';

type Workspace = { requests: SourcingRequest[]; decisions: SourcingDecision[] };
type Kind = SourcingCriteria['kind'];
/** idea: đề xuất trong báo cáo gửi sang AI Marketing; server dựng brief từ báo cáo đã lưu. Ý tưởng chỉ dựa vào lịch dịp lễ thì không có bài nguồn (item = null). */
type IdeaTransfer = { section: 'product' | 'content'; index: number; title: string; lines: string[] };
type TransferState = { item: SourcingItem | null; runId: string; kind: 'product' | 'marketing'; name?: string; idea?: IdeaTransfer };
type OnTransfer = (item: SourcingItem | null, kind: 'product' | 'marketing', name?: string, idea?: IdeaTransfer) => void;
type Notice = { message: string; href?: string; label?: string } | null;
const api = async (body?: object): Promise<Workspace & { id?: string; run?: SourcingRun; analysis?: SourcingAnalysis }> =>
  (await dashboardRequest('/api/sourcing/requests', body ? { method: 'POST', body: JSON.stringify(body) } : undefined)).json();
const number = new Intl.NumberFormat('vi-VN');
const when = (at: number | string) => new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const RUN_BADGE: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Chưa chạy', tone: 'muted' }, starting: { label: 'Đang chạy', tone: 'amber' }, running: { label: 'Đang chạy', tone: 'amber' },
  succeeded: { label: 'Thành công', tone: 'green' }, empty: { label: 'Không có kết quả', tone: 'muted' }, failed: { label: 'Thất bại', tone: 'red' }, unknown: { label: 'Chưa rõ', tone: 'red' },
};
const MODES = [
  { kind: 'market', label: 'Thị trường & đối thủ', icon: IconDashboard },
  { kind: 'tiktok', label: 'Xu hướng hot', icon: IconBolt },
  { kind: 'suppliers', label: 'Tìm xưởng sỉ', icon: IconCart },
] as const;
const WINDOWS: [NonNullable<SourcingCriteria['window']>, string][] = [['w1', '7 ngày qua'], ['m1', '1 tháng qua'], ['m3', '3 tháng qua']];
const windowLabel = (criteria: SourcingCriteria) => WINDOWS.find(([value]) => value === (criteria.window ?? 'm1'))?.[1] ?? '1 tháng qua';
const requestTitle = (criteria: SourcingCriteria, industry: string) => criteria.kind === 'market' ? `Thị trường ${criteria.product || criteria.industry || industry}`
  : criteria.product || (criteria.kind === 'tiktok' ? `Xu hướng ngành ${criteria.industry || industry}` : 'Nhà cung cấp');
const UNIT: Record<Kind, string> = { tiktok: 'video TikTok', suppliers: 'trang web', market: 'bài viết và trang tin' };
const REGIONS = [['Việt Nam', 'Toàn quốc'], ['Hà Nội', 'Hà Nội'], ['TP. Hồ Chí Minh', 'TP. Hồ Chí Minh'], ['Đà Nẵng', 'Đà Nẵng']];
const resultCount = (run: SourcingRun | null | undefined) => run?.result?.posts?.length ?? run?.result?.candidates?.length ?? 0;

export function SmartSourcing() {
  const { ready, workspace } = useMockOnboarding();
  const { session } = useAppSecurity();
  return <div className={styles.root}>
    <header className="page-head"><div><h1>Smart Sourcing</h1><p>Săn xu hướng, tìm xưởng sỉ, kèm phân tích của AI.</p></div></header>
    {!ready ? <p role="status">Đang đọc thông tin shop…</p> : !workspace ? <section className="card"><h2>Bắt đầu từ ngành hàng của shop</h2><Link href="/cai-dat">Thiết lập thông tin shop</Link></section>
      : <SourcingFlow key={`${session.userId || session.username}:${workspace.industry}`} industry={workspace.industry} shopName={workspace.name} />}
  </div>;
}

function SourcingFlow({ industry, shopName }: { industry: string; shopName: string }) {
  const [view, setView] = useState<Workspace>({ requests: [], decisions: [] });
  const [selectedId, setSelectedId] = useState('');
  const [criteria, setCriteria] = useState<SourcingCriteria>(() => defaultSourcingCriteria(industry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const requested = useRef(new Set<string>());
  const [transfer, setTransfer] = useState<TransferState | null>(null);
  const inFlight = useRef(false);
  const kind = criteria.kind;
  const isSupplier = kind === 'suppliers', isMarket = kind === 'market';
  const runLabel = isSupplier ? 'Phân tích' : isMarket ? 'Cập nhật' : 'Khám phá';
  // Lịch tính theo ngày lúc mở trang; đủ để gợi ý dịp trong 90 ngày tới.
  const [calendar] = useState(() => upcomingOccasions(new Date(), 90).slice(0, 8));
  const selected = view.requests.find(request => request.id === selectedId);
  const run = selected?.run;
  const mine = view.requests.filter(request => request.criteria.kind === kind);
  const latest = mine[0];
  const load = useCallback(async () => { const next = await api(); setView(next); return next; }, []);
  useEffect(() => {
    let active = true;
    api().then(next => {
      if (!active) return;
      setView(next);
      // Chỉ nạp lại lượt gần nhất của ngành hiện tại; lượt của ngành cũ giữ trong lịch sử, không đem từ khóa/sản phẩm cũ sang form mới.
      const first = next.requests.find(request => request.criteria.industry === industry);
      if (first) { setSelectedId(first.id); setCriteria(first.criteria); }
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
      } catch (e) { if (controller.signal.aborted) return; setError(`${(e as Error).message} Lượt quét vẫn được lưu; tải lại để kiểm tra.`); }
      timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [run]);
  const work = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  // Một nút bấm: chuẩn bị rồi thu thập luôn. Trần phí và thời gian chờ vẫn do máy chủ đặt trong kế hoạch của lượt tìm.
  const search = () => work(async () => {
    let sent = criteria, fromShop: string[] = [];
    // Không nhập gì thì tìm theo loại sản phẩm trong danh mục của shop; chưa có danh mục (hoặc lỗi đọc) thì server dùng từ khóa gợi ý của ngành.
    if (criteria.kind === 'tiktok' && !criteria.product.trim() && !criteria.keywords.length) {
      const samples = new Map(createSeed().products.map(product => [product.id, JSON.stringify(product)]));
      const fromCatalog = catalogKeywords(await productApi.list().catch(() => []), industries, samples);
      if (fromCatalog.length) { sent = { ...criteria, keywords: fromCatalog }; fromShop = fromCatalog; }
    }
    const prepared = await api({ action: 'prepare', criteria: sent, ...(selected && !selected.runId ? { id: selected.id, revision: selected.revision } : {}) });
    const request = prepared.requests.find(item => item.id === prepared.id)!;
    setView(prepared); setSelectedId(request.id); setCriteria(request.criteria); setHistoryOpen(false);
    // Sản phẩm trong danh mục không gắn ngành; nói rõ nguồn từ khóa để shop vừa đổi ngành kịp nhập ngách khác.
    if (fromShop.length) setNotice({ message: `Đang tìm theo loại sản phẩm trong danh mục của shop: ${fromShop.join(', ')}. Nếu chưa đúng ngành hiện tại, nhập ngách khác rồi quét lại.` });
    try { await api({ action: 'run', id: request.id, revision: request.revision, confirmed: true }); }
    finally { await load(); }
  });
  const change = <K extends keyof SourcingCriteria>(key: K, value: SourcingCriteria[K]) => { setCriteria(old => ({ ...old, [key]: value })); };
  const items = run ? sourcingItems(run) : [];
  const analyze = useCallback(async (runId: string) => {
    setAnalysisError('');
    try {
      const { analysis } = await api({ action: 'analyze', runId });
      setView(old => ({ ...old, requests: old.requests.map(request => request.run?.id === runId ? { ...request, run: { ...request.run, analysis } } : request) }));
    } catch (e) { setAnalysisError((e as Error).message); }
  }, []);
  // Thu thập xong thì AI phân tích dữ liệu thô ngay; báo cáo hiện thẳng trên trang.
  useEffect(() => {
    if (!run || !['succeeded', 'empty'].includes(run.status) || run.analysis || requested.current.has(run.id)) return;
    requested.current.add(run.id);
    const timer = setTimeout(() => void analyze(run.id), 0);
    return () => clearTimeout(timer);
  }, [run, analyze]);
  const switchKind = (next: Kind) => {
    if (next === kind) return;
    setTransfer(null); setNotice(null); setError(''); setHistoryOpen(false);
    const last = view.requests.find(request => request.criteria.kind === next && request.criteria.industry === industry);
    if (last) { setSelectedId(last.id); setCriteria(last.criteria); } else { setSelectedId(''); setCriteria({ ...defaultSourcingCriteria(industry), kind: next }); }
  };
  // Lượt của ngành cũ vẫn mở xem được, nhưng không đem từ khóa, sản phẩm, đối tượng khách hay yêu cầu cũ vào ngành hiện tại.
  const openRequest = (request: SourcingRequest) => { setSelectedId(request.id); setCriteria(request.criteria.industry === industry ? request.criteria : { ...defaultSourcingCriteria(industry), kind: request.criteria.kind }); setTransfer(null); setHistoryOpen(false); };
  const regionOptions = REGIONS.some(([value]) => value === criteria.region) ? REGIONS : [...REGIONS, [criteria.region, criteria.region]];
  const phase = !run ? 0 : ['starting', 'running'].includes(run.status) ? 0 : ['succeeded', 'empty'].includes(run.status) && !run.analysis && !analysisError ? 1 : 2;
  const progress = selected?.runId && phase < 2 ? <ol className={styles.progress} aria-label="Tiến trình"><li data-state={phase === 0 ? 'current' : 'done'}>{isSupplier ? 'Tìm và đọc trang web nhà cung cấp' : isMarket ? 'Tìm tin tức, bài viết về thị trường và đối thủ' : 'Thu thập video TikTok mới nhất'}</li><li data-state={phase === 1 ? 'current' : 'todo'}>{isMarket ? 'AI chọn tin quan trọng và lên ý tưởng bài' : 'AI đọc dữ liệu và viết phân tích'}</li><li data-state="todo">Báo cáo sẵn sàng</li></ol> : null;
  const title = selected ? requestTitle(selected.criteria, industry) : '';
  const occasions = criteria.occasions ?? [];
  const toggleOccasion = (name: string) => change('occasions', occasions.includes(name) ? occasions.filter(item => item !== name) : [...occasions, name].slice(-2));
  return <>
    <div className={styles.context}><span><strong>{shopName}</strong> · {industry}</span></div>
    <div className={styles.tabs} role="tablist" aria-label="Chế độ làm việc">{MODES.map(mode => <button key={mode.kind} type="button" role="tab" id={`tab-${mode.kind}`} aria-selected={kind === mode.kind} aria-controls="sourcing-panel" disabled={busy} onClick={() => switchKind(mode.kind)}><mode.icon width={18} height={18} aria-hidden="true" />{mode.label}</button>)}</div>
    <div id="sourcing-panel" role="tabpanel" aria-labelledby={`tab-${kind}`}>
      <form className={styles.bar} onSubmit={e => { e.preventDefault(); void search(); }}>
        <fieldset disabled={busy} className={styles.hero}>
          <label className={styles.heroField}>{isSupplier ? 'Sản phẩm cần tìm' : isMarket ? 'Chủ đề' : 'Ngách / sản phẩm'}<input required={isSupplier} maxLength={120} value={criteria.product} onChange={e => change('product', e.target.value)} placeholder={isSupplier ? 'Ví dụ: áo thun cotton' : isMarket ? `Mặc định theo ngành: ${industry}` : `Không bắt buộc, ví dụ: ${scopedTiktokQueries(industry, [])[0] || 'áo thun cotton'}`} /></label>
          <button className="btn btn-primary" type="submit">{busy ? 'Đang xử lý…' : runLabel}</button>
        </fieldset>
        <fieldset disabled={busy} className={styles.barFields} onKeyDown={noEnterSubmit}>
          {isMarket ? <>
            <label className={styles.field}>Khoảng thời gian<select value={criteria.window ?? 'm1'} onChange={e => change('window', e.target.value as SourcingCriteria['window'])}>{WINDOWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div role="group" aria-labelledby="occasion-label" className={`${styles.field} ${styles.grow}`}><span id="occasion-label">Dịp sắp tới (tối đa 2)</span>
              <ul className={styles.chips}>{calendar.map(item => <li key={item.name}><button type="button" aria-pressed={occasions.includes(item.name)} onClick={() => toggleOccasion(item.name)}>{item.name}<small>{item.daysLeft === 0 ? 'hôm nay' : `còn ${item.daysLeft} ngày`}</small></button></li>)}</ul></div>
            <div className={styles.grow}><TagInput label="Đối thủ" hint="Tối đa 3: tên, website hoặc fanpage." max={3} value={criteria.competitors ?? []} onChange={list => change('competitors', list)} placeholder="Ví dụ: facebook.com/tenshop" clean={text => text.replace(/[\u0000-\u001f"]/g, '').trim().slice(0, 200)} /></div>
          </> : isSupplier ? <>
            <label className={styles.field}>Khu vực ưu tiên<select value={criteria.region} onChange={e => change('region', e.target.value)}>{regionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className={styles.range}>{(['minPrice', 'maxPrice'] as const).map((key, i) => <label key={key} className={styles.field}>{['Giá nhập từ (đ)', 'Đến (đ)'][i]}<input type="number" min="0" max="1000000000" inputMode="numeric" value={criteria[key] ?? ''} onChange={e => change(key, e.target.value === '' ? null : Number(e.target.value))} /></label>)}</div>
          </> : <p className={styles.industry}>Ngành hàng của shop: <strong>{industry}</strong></p>}
        </fieldset>
        <details className={styles.more}><summary>Bộ lọc nâng cao</summary><fieldset disabled={busy} className={styles.moreFields} onKeyDown={noEnterSubmit}>
          {isMarket && <TagInput label="Từ khóa theo dõi thêm" hint="Tối đa 3, ví dụ giá nguyên liệu, chính sách." max={3} value={criteria.keywords} onChange={keywords => change('keywords', keywords)} placeholder="Ví dụ: giá hoa Đà Lạt" clean={text => text.replace(/[^\p{L}\p{N} .(),&+%\/-]/gu, '').slice(0, 120)} />}
          {kind === 'tiktok' && <TagInput label="Từ khóa riêng" hint="Tối đa 3. Để trống = theo danh mục sản phẩm của shop." max={3} value={criteria.keywords} onChange={keywords => change('keywords', keywords)} placeholder={scopedTiktokQueries(industry, [])[1] || 'tên sản phẩm, kiểu dáng'} clean={text => text.replace(/[^\p{L}\p{N} .(),&+%\/-]/gu, '').slice(0, 120)} />}
          {isSupplier && <><label className={styles.field}>Lượng dự kiến nhập<input type="number" min="0" max="1000000000" inputMode="numeric" value={criteria.quantity ?? ''} onChange={e => change('quantity', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <label className={styles.field}>MOQ tối đa<input type="number" min="0" max="1000000000" inputMode="numeric" value={criteria.maxMoq ?? ''} onChange={e => change('maxMoq', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <label className={styles.field}>Đơn vị hàng<input maxLength={60} value={criteria.unit} onChange={e => change('unit', e.target.value)} /></label>
            {(['quality', 'leadTime'] as const).map((key, i) => <label key={key} className={styles.field}>{['Chứng từ cần có', 'Thời gian cung ứng mong muốn'][i]}<input maxLength={key === 'leadTime' ? 100 : 500} value={criteria[key]} onChange={e => change(key, e.target.value)} /></label>)}</>}
          <label className={styles.field}>Nhóm khách / phong cách<input maxLength={500} value={criteria.audience} onChange={e => change('audience', e.target.value)} placeholder="Ví dụ: nữ văn phòng 25–35 tuổi" /></label>
          <TagInput label="Điều cần có" value={splitList(criteria.required)} onChange={list => change('required', list.join(', '))} placeholder="Ví dụ: cotton" clean={text => text.replace(/,/g, '').slice(0, 100)} />
          <TagInput label="Điều cần loại bỏ" value={splitList(criteria.excluded)} onChange={list => change('excluded', list.join(', '))} placeholder="Ví dụ: hàng order nước ngoài" clean={text => text.replace(/,/g, '').slice(0, 100)} />
        </fieldset></details>
        <p className={styles.lastRun}>{latest ? <>Lần quét gần nhất: {when(latest.updatedAt)}{resultCount(latest.run) > 0 && ` (${resultCount(latest.run)} ${UNIT[kind]})`}</> : 'Chưa có lần quét nào.'}
          {mine.length > 1 && <> · <button type="button" className={styles.link} aria-expanded={historyOpen} aria-controls="sourcing-history" onClick={() => setHistoryOpen(open => !open)}>{historyOpen ? 'Ẩn các lần trước' : 'Xem các lần trước'}</button></>}</p>
        {historyOpen && <ul id="sourcing-history" className={styles.history}>{mine.map(request => { const badge = RUN_BADGE[request.run?.status ?? 'draft'] ?? RUN_BADGE.draft; return <li key={request.id}><button type="button" aria-current={request.id === selectedId ? 'true' : undefined} disabled={busy} onClick={() => openRequest(request)}>
          <span className={styles.historyTitle}>{requestTitle(request.criteria, industry)}</span>
          <span className={styles.muted}>{when(request.updatedAt)}</span><span className={styles.badge} data-tone={badge.tone}>{badge.label}</span></button></li>; })}</ul>}
      </form>
      {error && <p role="alert" className={styles.error}>{error} <button className="btn btn-outline btn-sm" onClick={() => work(async () => { await load(); })}>Tải lại</button></p>}
      <p aria-live="polite" className={styles.notice}>{notice && <>{notice.message}{notice.href && <> <Link href={notice.href}>{notice.label}</Link></>}</>}</p>
      <section className={styles.results} aria-label="Kết quả">
        {!selected ? <div className={styles.idle}>
          <p>{isSupplier ? 'Nhập sản phẩm và bấm Phân tích để so sánh xưởng sỉ.' : isMarket ? 'Bấm Cập nhật để xem tin mới nhất của ngành.' : 'Bấm Khám phá để xem xu hướng mới nhất của ngành.'}</p>
          {kind === 'tiktok' && scopedTiktokQueries(industry, []).length > 0 && <div className={styles.suggest}><span className={styles.muted}>Gợi ý ngách cho ngành {industry}:</span><ul>{scopedTiktokQueries(industry, []).map(query => <li key={query}><button type="button" disabled={busy} onClick={() => change('product', query)}>{query}</button></li>)}</ul></div>}</div> : <>
          <header className={styles.resultHead}><div><h2>{title}</h2><p className={styles.muted}>{selected.criteria.kind === 'tiktok' ? 'TikTok Việt Nam · 7 ngày gần nhất' : selected.criteria.kind === 'market' ? `Google · ${windowLabel(selected.criteria)}` : `Google · ${selected.criteria.region}`}{resultCount(run) > 0 && ` · ${resultCount(run)} ${UNIT[selected.criteria.kind]}`} · {when(selected.updatedAt)}</p></div>
            {run && <span className={styles.badge} data-tone={(RUN_BADGE[run.status] ?? RUN_BADGE.draft).tone}>{(RUN_BADGE[run.status] ?? RUN_BADGE.draft).label}</span>}</header>
          {!selected.runId ? <p className={styles.warning}>Lượt này chưa được quét. Bấm {runLabel} để bắt đầu.</p>
            : progress ? <div role="status" className={styles.working}>{progress}<p className={styles.muted}>{run?.status === 'starting' || !run ? 'Đang kết nối nguồn dữ liệu…' : phase === 0 ? 'Đang thu thập dữ liệu…' : `AI đang đọc ${items.length} kết quả…`} Thường mất 1–3 phút. Bạn có thể rời trang; kết quả vẫn được lưu.</p></div>
            : run && ['failed', 'unknown'].includes(run.status) ? <div className={styles.error}><strong>{run.status === 'failed' ? 'Quét không thành công' : 'Chưa rõ kết quả lượt quét'}</strong><p>{run.error || 'Không nhận được kết quả từ nhà cung cấp dữ liệu.'}</p><p>{run.status === 'unknown' ? 'Đừng quét lại ngay để tránh tính phí trùng; hãy liên hệ quản trị để kiểm tra lượt này.' : 'Thử quét lại.'}</p></div>
            : run?.analysis ? <Report analysis={run.analysis} items={items} kind={run.kind} product={selected.criteria.product} onTransfer={(item, transferKind, name, idea) => { setError(''); setTransfer({ item, kind: transferKind, runId: run.id, name, idea }); }} />
            : analysisError ? <div className={styles.error}><p>{analysisError}</p><div className={styles.actions}><button className="btn btn-primary btn-sm" onClick={() => run && void analyze(run.id)}>Phân tích lại</button></div></div> : null}
        </>}
      </section>
    </div>
    {transfer && <Transfer key={`${transfer.runId}:${transfer.item?.key}:${transfer.kind}:${transfer.idea?.section}:${transfer.idea?.index}`} {...transfer} industry={industry} busy={busy} error={error} work={work} onClose={() => setTransfer(null)} onDone={setNotice} />}
  </>;
}

// Chỉ ô tìm chính được gửi form bằng Enter; Enter ở ô khác không được kích hoạt lượt quét (có tính phí).
const noEnterSubmit = (event: React.KeyboardEvent) => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault(); };
const splitList = (text: string) => text.split(',').map(item => item.trim()).filter(Boolean);

/** Gõ rồi Enter (hoặc dấu phẩy) để thành thẻ, có nút × để xóa. Không tách theo dấu cách vì từ khóa tiếng Việt thường gồm nhiều chữ ("áo thun"). */
function TagInput({ label, hint, value, onChange, placeholder, max = 10, clean }: { label: string; hint?: string; value: string[]; onChange: (value: string[]) => void; placeholder?: string; max?: number; clean: (text: string) => string }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const full = value.length >= max;
  const add = (raw: string) => { const fresh = [...new Set(raw.split(/[,;]/).map(part => clean(part).trim()).filter(text => text.length >= 2 && !value.includes(text)))].slice(0, max - value.length); if (fresh.length) onChange([...value, ...fresh]); setDraft(''); };
  return <div role="group" aria-labelledby={id} className={styles.field}>
    <span id={id}>{label}</span>
    <div className={styles.tagBox}>
      {value.map(tag => <span key={tag} className={styles.tag}>{tag}<button type="button" aria-label={`Xóa ${tag}`} onClick={() => onChange(value.filter(item => item !== tag))}>×</button></span>)}
      <input aria-labelledby={id} value={draft} disabled={full} placeholder={full ? `Đã đủ ${max} thẻ` : value.length ? '' : placeholder} onChange={e => /[,;]/.test(e.target.value) && e.target.value.length > 1 ? add(e.target.value) : setDraft(e.target.value)} onBlur={() => draft.trim() && add(draft)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); if (draft.trim()) add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }} />
    </div>
    <small>{hint ? `${hint} ` : ''}Nhấn Enter để thêm.</small>
  </div>;
}

const METRIC_LABEL: Record<string, string> = { views: 'Lượt xem', likes: 'Thích', comments: 'Bình luận', shares: 'Chia sẻ' };
const metricsText = (metrics: SourcingItem['metrics']) => metrics ? Object.entries(metrics).filter(([, value]) => value !== null).map(([key, value]) => `${number.format(value!)} ${METRIC_LABEL[key].toLocaleLowerCase('vi')}`).join(' · ') : '';
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
// Một lần chụp 7 ngày chưa chứng minh xu hướng tăng: chữ lớn theo thiết kế, nhãn phụ nói là "tín hiệu" và có ghi chú đi kèm.
const TREND: Record<TrendStatus, { label: string; tone: string }> = { early: { label: 'Mới chớm', tone: 'green' }, peaking: { label: 'Bùng nổ', tone: 'amber' }, saturated: { label: 'Bão hòa', tone: 'muted' }, entertainment: { label: 'Chủ yếu giải trí', tone: 'muted' }, unclear: { label: 'Chưa đủ dữ liệu', tone: 'muted' } };
// shortcut: ngưỡng 7 và 4 trên thang 10 là tự đặt, chỉnh khi có dữ liệu thật để hiệu chỉnh.
const buyTone = (score: number | null) => score === null ? null : score >= 7 ? { label: 'Sức mua mạnh', tone: 'green' } : score >= 4 ? { label: 'Sức mua vừa', tone: 'amber' } : { label: 'Sức mua yếu', tone: 'muted' };
const Caveats = ({ list }: { list: string[] }) => list.length ? <details className={`${styles.fold} ${styles.caution}`}><summary>Lưu ý khi dùng báo cáo ({list.length})</summary><ul className={styles.caveats}>{list.map((caveat, i) => <li key={i}>{caveat}</li>)}</ul></details> : null;
const TIER_LABEL: Record<SupplierTier, string> = { factory: 'Xưởng sản xuất', wholesale: 'Tổng kho sỉ', distributor: 'Đại lý phân phối', unknown: 'Chưa rõ mô hình' };
const reportSources = (report: TikTokReport) => [report.trend.sources, report.buyingIntent.sources, ...[report.whyNow, report.specs, report.audience, report.price, report.drivers, report.hesitations, report.hooks, report.formats, report.keywords].flat().map(point => point.sources)].flat();
const bullets = (list: SourcingPoint[]) => list.length ? <ul className={styles.bullets}>{list.map((point, i) => <li key={i}>{point.text}</li>)}</ul> : <p className={styles.muted}>Chưa đủ dữ liệu từ các bài đã quét.</p>;

/** Báo cáo của AI trình bày ngay trên trang; bài nguồn gom vào mục gập ở cuối để đối chiếu. */
function Report({ analysis, items, kind, product, onTransfer }: { analysis: SourcingAnalysis; items: SourcingItem[]; kind: SourcingRun['kind']; product: string; onTransfer: OnTransfer }) {
  const { report, suppliers, market } = analysis;
  const [copied, setCopied] = useState('');
  if (market) return <MarketView analysis={analysis} market={market} items={items} onTransfer={onTransfer} />;
  const copy = (id: string, text: string) => void navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(''), 2000); }, () => {});
  const keys = report ? [...reportSources(report), ...analysis.productIdeas.flatMap(idea => idea.sources)] : suppliers ? [...suppliers.suppliers.map(card => card.source), ...[...suppliers.tierMix, ...suppliers.regions].flatMap(point => point.sources)]
    : [...analysis.findings, ...analysis.productIdeas].flatMap(entry => entry.sources);
  const cited = [...new Set(keys)].map(key => items.find(item => item.key === key)).filter((item): item is SourcingItem => !!item);
  const top = suppliers && [...suppliers.suppliers].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))[0];
  const views = items.reduce((sum, item) => sum + (item.metrics?.views ?? 0), 0);
  const ideas = analysis.productIdeas.length > 0 && <section className={styles.block}><h3>Sản phẩm đáng tìm hiểu</h3><ul className={styles.ideas}>{analysis.productIdeas.map((idea, i) => { const item = items.find(entry => entry.key === idea.sources[0]); return <li key={i}><strong>{idea.name}</strong><p>{idea.reason}</p>{item && <span className={styles.actions}><button type="button" className="btn btn-primary btn-sm" onClick={() => onTransfer(item, 'product', idea.name)}>Nhập sản phẩm</button><button type="button" className="btn btn-outline btn-sm" onClick={() => onTransfer(item, 'marketing', idea.name, { section: 'product', index: i, title: `Ý tưởng: ${idea.name}`, lines: [idea.reason] })}>Gửi sang AI Marketing</button></span>}</li>; })}</ul></section>;
  return <div className={styles.report}>
    <p className={styles.lead}>{analysis.summary}</p>
    {report ? <>
      <section className={styles.metrics} aria-label="Thước đo thị trường">
        <div className={styles.metric}><span>Nhiệt độ thị trường</span><strong>{TREND[report.trend.status].label.toLocaleUpperCase('vi')}</strong><em className={styles.badge} data-tone={TREND[report.trend.status].tone}>{report.trend.status === 'peaking' ? 'Tín hiệu mạnh' : report.trend.status === 'early' ? 'Tín hiệu sớm' : 'Chỉ để tham khảo'}</em><p>{report.trend.reason || 'Tín hiệu từ lần quét 7 ngày gần nhất.'} 1 lần quét, chưa phải xu hướng theo thời gian.</p></div>
        <div className={styles.metric}><span>Sức mua thực tế</span><strong>{report.buyingIntent.score === null ? 'Chưa đủ dữ liệu' : `${report.buyingIntent.score} / 10`}</strong>{buyTone(report.buyingIntent.score) && <em className={styles.badge} data-tone={buyTone(report.buyingIntent.score)!.tone}>{buyTone(report.buyingIntent.score)!.label}</em>}<p>{report.buyingIntent.score === null ? 'Chưa có bình luận làm căn cứ.' : `Dựa trên ${number.format(report.commentCount)} bình luận.`} {report.buyingIntent.reason}</p></div>
        <div className={styles.metric}><span>Quy mô dữ liệu</span><strong>{items.length} video</strong><p>{views > 0 ? `${number.format(views)} lượt xem · ` : ''}AI dùng {analysis.relevantCount} video làm căn cứ.</p></div>
      </section>
      <div className={styles.split}><div className={styles.main}>
      {ideas}
      <section className={styles.block}><h3>Ý tưởng nội dung cho shop</h3><p className={styles.muted}>Suy từ caption và bình luận; AI chưa xem hình ảnh hay lời thoại trong video.</p>
        <div className={styles.formula}><div><h4>Cách mở đầu video hút khách (3 giây đầu)</h4>{bullets(report.hooks)}</div><div><h4>Góc quay và bối cảnh</h4>{bullets(report.formats)}</div>
          <div><h4>Từ khóa và hashtag đang có trong dữ liệu</h4>{report.keywords.length + report.hashtags.length ? <p>{[...report.keywords.map(point => point.text), ...report.hashtags].join(' | ')}</p> : <p className={styles.muted}>Chưa đủ dữ liệu từ các bài đã quét.</p>}</div></div></section>
      </div><div className={styles.side}>
      {report.whyNow.length > 0 && <section className={styles.block}><h3>Vì sao đang được quan tâm</h3>{bullets(report.whyNow)}</section>}
      <section className={styles.block}><h3>Chân dung sản phẩm thắng thế</h3>
        <div className={styles.triple}><div><h4>Đặc điểm ăn tiền</h4>{bullets(report.specs)}</div><div><h4>Khách mục tiêu</h4>{bullets(report.audience)}</div><div><h4>Mức giá tâm lý</h4>{bullets(report.price)}</div></div>
        {report.commentCount === 0 && <p className={styles.warning}>Lượt này chưa thu được bình luận nào, nên phần khách thích và khách lo chưa có căn cứ.</p>}
        <div className={`${styles.versus} ${styles.proscons}`}><div><h4>Khách thích</h4>{bullets(report.drivers)}</div><div><h4>Khách lo ngại</h4>{bullets(report.hesitations)}</div></div>
      </section>
      </div></div>
    </> : suppliers ? <>
      <section className={styles.metrics} aria-label="Toàn cảnh nguồn cung">
        <div className={styles.metric}><span>Nhà cung cấp phù hợp</span><strong>{suppliers.suppliers.length}</strong><p>Trong {suppliers.collected} trang tìm được.{suppliers.filterNote && ` ${suppliers.filterNote}`}</p></div>
        <div className={styles.metric}><span>Trang đọc được nội dung</span><strong>{suppliers.pagesRead} / {suppliers.collected}</strong><p>Trang còn lại chỉ có mô tả ngắn từ Google.</p></div>
        <div className={styles.metric}><span>Khớp nhu cầu nhất</span><strong>{top ? `${top.matchScore ?? '–'} / 10` : 'Chưa có'}</strong><p>{top ? top.name : 'Chưa có nhà cung cấp đủ căn cứ.'}</p></div>
      </section>
      <section className={styles.block}><h3>So sánh nguồn hàng</h3>
        {!suppliers.suppliers.length ? <p className={styles.muted}>Không có trang nào đủ căn cứ là nhà cung cấp phù hợp. Thử tên sản phẩm cụ thể hơn.</p> : <>
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th scope="col">Nhà cung cấp</th><th scope="col">Mô hình</th><th scope="col">Khu vực</th><th scope="col">Cung ứng và giá sỉ</th><th scope="col">Độ tin cậy</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{suppliers.suppliers.map(card => { const item = items.find(entry => entry.key === card.source); const phone = card.phones[0]; const none = <span className={styles.none}><span aria-hidden="true">—</span><span className={styles.srOnly}>chưa công khai</span></span>;
              return <tr key={card.source}>
                <th scope="row" data-label="Nhà cung cấp"><strong>{card.name}</strong>{item && <span className={styles.muted}>{host(item.url)}</span>}<span className={styles.muted}>Khớp nhu cầu {card.matchScore ?? '–'}/10</span></th>
                <td data-label="Mô hình">{TIER_LABEL[card.tier]}</td>
                <td data-label="Khu vực">{card.address || none}</td>
                <td data-label="Cung ứng và giá sỉ"><ul className={styles.terms}><li>MOQ: {card.moq || none}</li><li>Giá sỉ: {card.price || none}</li>{card.strengths && <li className={styles.muted}>{card.strengths}</li>}</ul></td>
                <td data-label="Độ tin cậy">{card.greenFlags.length + card.redFlags.length ? <ul className={styles.flags}>{card.greenFlags.slice(0, 2).map((flag, i) => <li key={`g${i}`} className={styles.badge} data-tone="green">Xác minh: {flag}</li>)}{card.redFlags.map((flag, i) => <li key={`r${i}`} className={styles.badge} data-tone="amber">Lưu ý: {flag}</li>)}</ul> : <span className={styles.muted}>Chưa đủ dữ liệu</span>}</td>
                <td data-label="Thao tác"><div className={styles.rowActions}>
                  {phone && <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(card.source, phone)}>{copied === card.source ? 'Đã sao chép' : 'Sao chép Zalo / SĐT'}</button>}
                  {item && <a className="btn btn-outline btn-sm" href={item.url} target="_blank" rel="noopener noreferrer">Mở website</a>}
                  {item && <button type="button" className="btn btn-primary btn-sm" onClick={() => onTransfer(item, 'product', product || undefined)}>Nhập sản phẩm</button>}
                  {phone && <span className={styles.muted}>{card.phones.join(' · ')}</span>}</div></td>
              </tr>; })}</tbody></table></div>
          <p className={styles.footnote}>Dấu — là chưa công khai, cần hỏi trực tiếp.</p></>}
      </section>
      {(suppliers.tierMix.length > 0 || suppliers.regions.length > 0) && <section className={styles.block}><h3>Nguồn cung nhìn từ kết quả tìm</h3><div className={styles.versus}><div><h4>Loại hình nguồn hàng</h4>{bullets(suppliers.tierMix)}</div><div><h4>Khu vực tập trung</h4>{bullets(suppliers.regions)}</div></div></section>}
      {suppliers.suppliers.length > 0 && <section className={styles.block}><h3>Kịch bản nhắn tin mở lời khi liên hệ xưởng</h3>
        {suppliers.message && <div className={styles.message}><p>{suppliers.message}</p><button type="button" className="btn btn-outline btn-sm" onClick={() => copy('message', suppliers.message)}>{copied === 'message' ? 'Đã sao chép' : 'Sao chép mẫu tin nhắn'}</button></div>}
        {suppliers.suppliers.some(card => card.questions.length > 0) && <details className={styles.fold}><summary>Câu hỏi nên hỏi từng nhà cung cấp</summary>{suppliers.suppliers.map(card => card.questions.length > 0 && <div key={card.source} className={styles.askBlock}><h4>{card.name}</h4><ol className={styles.bullets}>{card.questions.map((question, i) => <li key={i}>{question}</li>)}</ol></div>)}</details>}
      </section>}
    </> : <>
      {analysis.findings.length > 0 && <section className={styles.block}><h3>Nhận định từ dữ liệu</h3><ul className={styles.bullets}>{analysis.findings.map((finding, i) => <li key={i}><strong>{finding.title}</strong><p>{finding.detail}</p></li>)}</ul></section>}
      {ideas}
    </>}
    <Caveats list={analysis.caveats} />
    {kind === 'tiktok' && <details className={styles.fold} open={!analysis.productIdeas.some(idea => items.some(entry => entry.key === idea.sources[0]))}><summary>Nguồn đối chiếu ({cited.length})</summary>
      {!cited.length ? <p className={styles.muted}>Không có kết quả nào đủ liên quan để làm căn cứ.</p> : <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th scope="col">Kênh và bài gốc</th><th scope="col">Tương tác chính</th><th scope="col">Điểm đắt giá nhất của bài</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{cited.map(item => <tr key={item.key}>
          <th scope="row" data-label="Kênh và bài gốc"><span className={styles.muted}>{kind === 'tiktok' ? 'TikTok' : host(item.url)}</span><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'Bài nguồn'}</a></th>
          <td data-label="Tương tác chính">{kind === 'tiktok' ? metricsText(item.metrics) || '—' : 'Kết quả tìm trên Google'}{!!item.comments?.length && <span className={styles.muted}> · AI đã đọc {item.comments.length} bình luận</span>}</td>
          <td data-label="Điểm đắt giá nhất của bài">{report?.sourceNotes[item.key] || `${item.text.slice(0, 200)}${item.text.length > 200 ? '…' : ''}`}</td>
          <td data-label="Thao tác"><div className={styles.rowActions}><button type="button" className="btn btn-outline btn-sm" onClick={() => onTransfer(item, 'product')}>Nhập sản phẩm</button><button type="button" className={styles.link} onClick={() => onTransfer(item, 'marketing')}>Tạo brief Marketing</button></div></td>
        </tr>)}</tbody></table></div>}
    </details>}
    <p className={styles.footnote}>AI phân tích lúc {when(analysis.createdAt)}. AI có thể sai, hãy kiểm tra lại trước khi nhập hàng hoặc đăng bài.</p>
  </div>;
}

const IMPACT: Record<NewsImpact, { label: string; tone: string }> = { opportunity: { label: 'Cơ hội', tone: 'green' }, risk: { label: 'Rủi ro', tone: 'red' }, neutral: { label: 'Cần biết', tone: 'muted' } };
const FORMAT: Record<ContentFormat, string> = { post: 'Bài đăng Facebook', video: 'Video ngắn', infographic: 'Infographic', blog: 'Bài blog' };
const dayText = (date: string, daysLeft: number) => `${date.split('-').reverse().join('/')}${daysLeft > 0 ? ` · còn ${daysLeft} ngày` : daysLeft === 0 ? ' · hôm nay' : ''}`;

/** Báo cáo theo dõi thị trường: đọc theo thứ tự "chuyện gì xảy ra → shop nên làm gì → gửi ý tưởng sang AI Marketing". */
function MarketView({ analysis, market, items, onTransfer }: { analysis: SourcingAnalysis; market: MarketReport; items: SourcingItem[]; onTransfer: OnTransfer }) {
  const find = (sources: string[]) => sources.map(key => items.find(item => item.key === key)).filter((item): item is SourcingItem => !!item);
  const links = (sources: string[]) => { const found = find(sources); return found.length > 0 && <span className={styles.srcLinks}>Nguồn: {found.slice(0, 3).map((item, i) => <a key={item.key} href={item.url} target="_blank" rel="noopener noreferrer">{i > 0 && ', '}{host(item.url)}</a>)}</span>; };
  const risks = market.news.filter(news => news.impact === 'risk').length, chances = market.news.filter(news => news.impact === 'opportunity').length;
  const cited = find([...new Set([...market.news, ...market.competitors, ...market.trends, ...market.contentIdeas, ...market.occasions].flatMap(entry => entry.sources))]);
  return <div className={styles.report}>
    <p className={styles.lead}>{analysis.summary}</p>
    <section className={styles.metrics} aria-label="Tóm tắt">
      <div className={styles.metric}><span>Tín hiệu tin tức</span><strong>{market.news.length} tin</strong><p className={styles.signals}><em className={styles.badge} data-tone="green">{chances} cơ hội</em><em className={styles.badge} data-tone="red">{risks} rủi ro</em></p><p><a className={styles.link} href="#sourcing-news">Xem tin</a></p></div>
      <div className={styles.metric}><span>Dịp gần nhất</span><strong>{market.occasions[0]?.name ?? 'Chưa có'}</strong><p>{market.occasions[0] ? dayText(market.occasions[0].date, market.occasions[0].daysLeft) : 'Không có dịp trong 60 ngày tới.'}</p></div>
      <div className={styles.metric}><span>Ý tưởng nội dung</span><strong>{market.contentIdeas.length}</strong><p><a className={styles.link} href="#sourcing-ideas">Xem ý tưởng</a></p></div>
    </section>
    <div className={styles.split}><div className={styles.main}>
    <section className={styles.block} id="sourcing-ideas"><h3>Ý tưởng nên làm ngay</h3><p className={styles.muted}>Mỗi ý tưởng thành một brief nháp trong Marketing, shop duyệt rồi mới đăng.</p>
      {market.contentIdeas.length ? <ul className={styles.ideas}>{market.contentIdeas.map((idea, i) => { const source = find(idea.sources)[0] ?? null; return <li key={i}>
        <span className={styles.ideaMeta}><em className={styles.badge} data-tone="green">{FORMAT[idea.format]}</em>{idea.occasion && <em className={styles.badge} data-tone="amber">{idea.occasion}</em>}</span>
        <strong>{idea.title}</strong><p>{idea.angle}</p>
        {idea.hook && <p className={styles.hook}>“{idea.hook}”</p>}
        {idea.audience && <p>Khách nhắm tới: {idea.audience}</p>}
        {idea.keywords.length > 0 && <p className={styles.kw}>{idea.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</p>}
        <span className={styles.actions}><button type="button" className="btn btn-primary btn-sm" onClick={() => onTransfer(source, 'marketing', undefined, { section: 'content', index: i, title: `${FORMAT[idea.format]}: ${idea.title}`, lines: [idea.angle, idea.hook && `Mở đầu: ${idea.hook}`, idea.keywords.length ? `Từ khóa: ${idea.keywords.join(', ')}` : '', idea.occasion && `Dịp: ${idea.occasion}`].filter(Boolean) })}>Gửi sang AI Marketing</button>{links(idea.sources)}</span>
      </li>; })}</ul> : <p className={styles.muted}>Chưa đủ dữ liệu để đề xuất nội dung. Thử chọn dịp sắp tới hoặc mở rộng khoảng thời gian.</p>}
    </section>
    </div><div className={styles.side}>
    <section className={styles.block} id="sourcing-news"><h3>Tin tức ảnh hưởng tới shop</h3>
      {market.news.length ? <ul className={styles.feed}>{market.news.map((news, i) => <li key={i}>
        <span className={styles.badge} data-tone={IMPACT[news.impact].tone}>{IMPACT[news.impact].label}</span>
        <div><strong>{news.title}</strong><p>{news.detail}</p>{news.action && <p className={styles.todo}><b>Shop nên:</b> {news.action}</p>}{links(news.sources)}</div>
      </li>)}</ul> : <p className={styles.muted}>Không có tin nào đủ liên quan trong khoảng thời gian đã chọn.</p>}
    </section>
    {market.occasions.length > 0 && <section className={styles.block}><h3>Dịp sắp tới và cách khai thác</h3>
      <ul className={styles.feed}>{market.occasions.map(occasion => <li key={occasion.name}><span className={styles.badge} data-tone="amber">{dayText(occasion.date, occasion.daysLeft)}</span><div><strong>{occasion.name}</strong><p>{occasion.angle}</p>{links(occasion.sources)}</div></li>)}</ul>
    </section>}
    <section className={styles.block}><h3>Đối thủ đang làm gì</h3>
      {market.competitorsTracked.length > 0 && <p className={styles.muted}>Đang theo dõi: {market.competitorsTracked.join(' · ')}</p>}
      {market.competitors.length ? <ul className={styles.rivals}>{market.competitors.map((rival, i) => <li key={i}><strong>{rival.name}</strong><p>{rival.activity}</p>{rival.takeaway && <p className={styles.todo}><b>Học được:</b> {rival.takeaway}</p>}{links(rival.sources)}</li>)}</ul> :<p className={styles.muted}>{market.competitorsTracked.length ? 'Chưa thấy hoạt động mới của đối thủ. Fanpage ít được Google cập nhật, thử thêm link website.' : 'Thêm đối thủ ở ô Đối thủ phía trên để theo dõi.'}</p>}
    </section>
    {(market.trends.length > 0 || market.keywords.length > 0) && <section className={styles.block}><h3>Xu hướng và từ khóa của ngành</h3>
      <div className={styles.versus}><div><h4>Xu hướng</h4>{bullets(market.trends)}</div><div><h4>Từ khóa nên dùng khi viết bài</h4>{market.keywords.length ? <p className={styles.kw}>{market.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</p> : <p className={styles.muted}>Chưa đủ dữ liệu.</p>}</div></div>
    </section>}
    </div></div>
    <Caveats list={analysis.caveats} />
    {cited.length > 0 && <details className={styles.fold}><summary>Nguồn đối chiếu ({cited.length})</summary><ul className={styles.sources}>{cited.map(item => <li key={item.key}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || host(item.url)}</a><span className={styles.muted}>{host(item.url)}</span>{item.text && <span className={styles.sourceText}>{item.text.slice(0, 240)}</span>}</li>)}</ul></details>}
    <p className={styles.footnote}>AI phân tích lúc {when(analysis.createdAt)}. AI có thể sai, hãy mở nguồn để kiểm tra trước khi đăng bài hoặc ra quyết định.</p>
  </div>;
}

/** Ngăn kéo bên phải: điền sẵn từ báo cáo, lưu xong vẫn ở lại trang kết quả. */
function Transfer({ item, runId, kind, name: suggested, idea, industry, busy, error, work, onClose, onDone }: TransferState & { industry: string; busy: boolean; error: string; work: (fn: () => Promise<void>) => Promise<void>; onClose: () => void; onDone: (notice: Notice) => void }) {
  const first = useRef<HTMLInputElement>(null), panel = useRef<HTMLElement>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState((suggested || item?.title || '').slice(0, 500));
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState(''); // do shop tự viết: văn bản cào về không đi thẳng vào danh mục mà AI Chat đọc
  const [done, setDone] = useState<Notice>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (first.current ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? []);
      const firstControl = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); firstControl?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className={styles.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={kind === 'product' ? 'Nhập sản phẩm mới' : 'Gửi sang AI Marketing'} className={styles.drawer}>
      <header className={styles.drawerHead}><h2>{kind === 'product' ? 'Nhập sản phẩm mới' : 'Gửi sang AI Marketing'}</h2><button type="button" className="btn btn-text btn-sm" onClick={onClose}>Đóng</button></header>
      <p className={styles.muted}>Nguồn: {item ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || host(item.url)}</a> : 'lịch dịp bán hàng của Tendly'}</p>
      {done ? <div className={styles.drawerDone} role="status"><p>{done.message}</p><div className={styles.actions}>{done.href && <Link className="btn btn-outline btn-sm" href={done.href}>{done.label}</Link>}<button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Đóng</button></div></div> : <form onSubmit={e => { e.preventDefault(); void work(async () => {
        if (kind === 'marketing' && idea) {
          const view = await marketingWorkspaceClient.read();
          await marketingWorkspaceClient.act(view.revision, 'sourcingIdea', { runId, idea: { section: idea.section, index: idea.index }, confirmed: true, knowledge: currentAiKnowledge() });
          const result = { message: 'Đã tạo brief nháp trong Marketing, có sẵn thông điệp, đối tượng và từ khóa. Chọn sản phẩm rồi duyệt để AI viết bài.', href: '/marketing?tab=campaigns', label: 'Mở Marketing' }; setDone(result); onDone(result);
          return;
        }
        if (!item) throw new Error('Không có bài nguồn để nhập.');
        const query = new URLSearchParams({ run: runId, item: item.key });
        const { item: source }: { item: SourcingItem } = await (await dashboardRequest(`/api/sourcing/requests?${query}`)).json();
        if (kind === 'product') {
          await productApi.importSourced({ sku, name, price: Number(price), qty: 0, stockKnown: false, material: '', emoji: '📦', category: industry, sizes: [], colors: [], sourceName: source.source, sourceUrl: source.url, sourceUpdatedAt: source.collectedAt, description: description.trim() });
          const result = { message: 'Đã thêm sản phẩm mới. Nhập tồn kho và kiểm tra thông tin trong FAQ và sản phẩm.', href: '/cai-dat?tab=products', label: 'Mở danh mục' }; setDone(result); onDone(result);
        } else {
          const view = await marketingWorkspaceClient.read();
          await marketingWorkspaceClient.act(view.revision, 'sourcingIdea', { runId, itemKey: item.key, confirmed: true, knowledge: currentAiKnowledge() });
          const result = { message: 'Đã tạo brief nháp trong Marketing.', href: '/marketing?tab=campaigns', label: 'Mở Marketing' }; setDone(result); onDone(result);
        }
      }); }}>
        <fieldset className={styles.drawerFields} disabled={busy}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {kind === 'product' ? <><label className={styles.field}>Mã SKU mới<input ref={first} required maxLength={100} value={sku} onChange={e => setSku(e.target.value)} /></label>
            <label className={styles.field}>Tên sản phẩm<input required maxLength={500} value={name} onChange={e => setName(e.target.value)} /></label>
            <label className={styles.field}>Giá bán dự kiến (đ)<input type="number" min="0" max="1000000000" required value={price} onChange={e => setPrice(e.target.value)} /></label>
            <label className={styles.field}>Mô tả sản phẩm (tự viết, có thể để trống)<textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /><small>AI Chat sẽ đọc phần này.</small></label>
            <p className={styles.muted}>Ngành hàng: {industry} · Tồn kho chưa xác nhận, lượng ban đầu 0 · Giá nhập, size, màu chưa có nguồn.</p></>
            : idea ? <div className={styles.briefPreview}><strong>{idea.title}</strong>{idea.lines.map((line, i) => <p key={i}>{line}</p>)}<p className={styles.muted}>Brief nháp được điền sẵn từ báo cáo. Sản phẩm đang bán và ưu đãi chưa chọn; shop hoàn thiện rồi duyệt.</p></div>
            : <p>Tên brief: Ý tưởng: {item?.title}<br /><span className={styles.muted}>Sản phẩm đang bán và ưu đãi chưa chọn. Brief ở trạng thái nháp, chờ shop hoàn thiện và duyệt.</span></p>}
          <div className={styles.actions}><button type="submit" className="btn btn-primary">{kind === 'product' ? 'Lưu vào danh mục sản phẩm' : 'Tạo brief nháp'}</button><button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button></div>
        </fieldset>
      </form>}
    </aside>
  </div>;
}
