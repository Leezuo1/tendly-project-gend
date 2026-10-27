'use client';

/**
 * Trang Livestream TỐI GIẢN để chạy thử lõi + API (chọn nguồn, bắt đầu/kết thúc phiên, mẫu lên sóng, duyệt nhóm).
 * Dashboard thật (trong lúc live + tổng quan) do Hiển làm, dùng lib/services/liveClient.ts và lib/hooks/useLiveSession.ts.
 */
import React, { useEffect, useState, type FormEvent } from 'react';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { Toast } from '@/components/shared/Toast';
import { MarketingDataNotice } from '@/components/features/marketing/MarketingDataNotice';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { useLiveSession } from '@/lib/hooks/useLiveSession';
import { liveClient } from '@/lib/services/liveClient';
import { miniUrl, openLiveMini } from '@/lib/services/liveMiniWindow';
import type { LiveGroup, LiveIntent, LiveOrderStatus, LiveSnapshot, LiveSourceOption } from '@/lib/types/live';
import { formatMoney } from '@/lib/utils/format';

const INTENT_LABEL: Record<LiveIntent, string> = {
  order: '🛒 Chốt đơn', price: '💰 Hỏi giá', size_advice: '📏 Tư vấn size', stock: '📦 Còn hàng?', view: '👀 Xin xem mẫu',
  shipping: '🚚 Ship/COD', return: '🔁 Đổi trả', complaint: '⚠️ Phàn nàn', question: '❓ Câu hỏi khác', other: '💬 Khác',
};
const ORDER_LABEL: Record<LiveOrderStatus, string> = {
  draft: 'Nháp', awaiting_info: 'Chờ SĐT/địa chỉ', confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ',
};
const time = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Đã có lỗi xảy ra');

function GroupCard({ group, sessionId, live, onDone, onToast }: {
  group: LiveGroup; sessionId: string; live: boolean; onDone: () => void; onToast: (m: string) => void;
}) {
  const [text, setText] = useState(group.replyText);
  const [busy, setBusy] = useState(false);
  const [seenRevision, setSeenRevision] = useState(group.revision);
  // Câu trả lời đổi trên server (AI soạn xong, người khác sửa) → cập nhật ô soạn
  if (group.revision !== seenRevision) {
    setSeenRevision(group.revision);
    setText(group.replyText);
  }
  const approve = async () => {
    if (!window.confirm(`Nhắn riêng cho ${group.pending} khách trong nhóm này?`)) return;
    setBusy(true);
    try {
      const r = await liveClient.approve(sessionId, group.key, text, group.revision);
      onToast(`Đã gửi ${r.sent}${r.notAllowed ? `, ${r.notAllowed} không nhắn riêng được` : ''}${r.failed ? `, ${r.failed} lỗi` : ''}${r.unknown ? `, ${r.unknown} chưa rõ kết quả` : ''}`);
      onDone();
    } catch (e) {
      onToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`live-group${group.needsHuman ? ' human' : ''}`}>
      <div className="live-group-head">
        <b>{INTENT_LABEL[group.intent]}{group.productName ? ` · ${group.productName}` : ''}</b>
        <span className="hint">{group.count} bình luận · chờ gửi {group.pending} · đã gửi {group.sent}{group.notAllowed ? ` · không nhắn được ${group.notAllowed}` : ''}</span>
      </div>
      {group.needsHuman && <span className="tag tag-rfm">Shop nên xem kỹ trước khi gửi</span>}
      {group.replySource === 'ai' && <span className="tag tag-loop">✨ AI soạn</span>}
      <div className="live-samples">{group.samples.map((s, i) => <span key={i}>&ldquo;{s}&rdquo;</span>)}</div>
      <textarea className="pc-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
      <div className="live-row">
        <span className="hint">Dùng được: {'{ten_khach} {san_pham} {mau} {size} {so_luong} {gia} {con_lai}'}</span>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !live || !group.pending || !text.trim()} onClick={approve}>
          {busy ? 'Đang gửi...' : `Duyệt & nhắn riêng ${group.pending} khách`}
        </button>
      </div>
    </div>
  );
}

function SessionPanel({ snapshot, apply, reload, onToast }: {
  snapshot: LiveSnapshot; apply: (s: LiveSnapshot) => void; reload: () => void; onToast: (m: string) => void;
}) {
  const { session, stats } = snapshot;
  const live = session.status === 'live';
  const [comment, setComment] = useState({ name: '', text: '' });
  const run = async (action: () => Promise<LiveSnapshot>, ok?: string) => {
    try {
      apply(await action());
      if (ok) onToast(ok);
    } catch (e) {
      onToast(errorText(e));
    }
  };
  const openMini = async () => {
    const how = await openLiveMini(session.id);
    onToast(how === 'pip' ? 'Đã mở cửa sổ nổi — kéo đặt cạnh màn hình live'
      : how === 'popup' ? 'Trình duyệt không hỗ trợ cửa sổ nổi, đã mở cửa sổ nhỏ'
        : 'Trình duyệt chặn cửa sổ bật lên, hãy cho phép popup');
  };
  const copyMiniLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${miniUrl(session.id)}`);
      onToast('Đã chép link — mở trên điện thoại (cần nhập mã quản trị lần đầu)');
    } catch {
      onToast(`${location.origin}${miniUrl(session.id)}`);
    }
  };
  const addComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.text.trim()) return;
    void run(() => liveClient.addComment(session.id, comment.name, comment.text));
    setComment({ ...comment, text: '' });
  };
  const s = snapshot.summary;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>{live ? '🔴' : '⏹️'} {session.title}</h2>
          <span className="hint">{session.platform === 'demo' ? 'Phiên demo' : 'Facebook'} · bắt đầu {time(session.startedAt)}</span>
        </div>
        <div className="live-stats">
          <div><b>{stats.comments}</b><span>bình luận</span></div>
          <div><b>{stats.customers}</b><span>khách</span></div>
          <div><b>{stats.orders}</b><span>đơn nháp</span></div>
          <div><b>{formatMoney(stats.revenue)}</b><span>doanh thu dự kiến</span></div>
          <div><b>{stats.pendingReplies}</b><span>chờ nhắn</span></div>
          <div><b>{stats.sentReplies}</b><span>đã nhắn riêng</span></div>
          <div><b>{stats.aiCalls}</b><span>lần gọi AI</span></div>
          <div><b>{stats.avgResponseSec === null ? '—' : `${stats.avgResponseSec}s`}</b><span>phản hồi TB</span></div>
        </div>
        <div className="live-row">
          <label>Mẫu đang lên sóng&nbsp;
            <select value={session.onAirSku ?? ''} disabled={!live}
              onChange={(e) => void run(() => liveClient.setOnAir(session.id, e.target.value || null), 'Đã đổi mẫu đang lên sóng')}>
              <option value="">— Chưa chọn —</option>
              {snapshot.products.map((p) => <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}
            </select>
          </label>
          {snapshot.onAir && <span className="hint">{formatMoney(snapshot.onAir.price)} · còn {snapshot.onAir.remaining}</span>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void openMini()}>🪟 Mở cửa sổ nổi</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyMiniLink()}>📱 Link cho điện thoại</button>
          {live && (
            <button type="button" className="btn btn-outline btn-sm pc-danger"
              onClick={() => window.confirm('Kết thúc phiên live và tạo báo cáo?') && void run(() => liveClient.end(session.id), 'Đã kết thúc phiên')}>
              Kết thúc phiên
            </button>
          )}
          {!live && <button type="button" className="btn btn-outline btn-sm" onClick={reload}>Tải lại</button>}
        </div>
      </div>

      {s && (
        <div className="card">
          <div className="card-head"><h2>📊 Tóm tắt cuối phiên</h2><span className="hint">Gợi ý {s.adviceSource === 'ai' ? 'do AI' : 'theo luật'}</span></div>
          <p>{s.highlights}</p>
          <p className="hint">Tỉ lệ khách chốt: {s.conversionRate}% · Cao điểm: {s.peakAt ? time(s.peakAt) : '—'}</p>
          <div className="live-cols">
            <div><b>Hỏi nhiều nhất</b>{s.topAsked.map((p) => <div key={p.sku}>{p.name}: {p.count} khách</div>)}</div>
            <div><b>Bán chạy nhất</b>{s.topOrdered.map((p) => <div key={p.sku}>{p.name}: {p.count} sp</div>)}</div>
            <div><b>Hỏi nhiều, chưa ai chốt</b>{s.askedNotOrdered.length ? s.askedNotOrdered.map((p) => <div key={p.sku}>{p.name}: {p.count}</div>) : <div>—</div>}</div>
          </div>
          <b>Gợi ý nhập hàng</b>
          {s.advice.map((a) => (
            <div key={a.sku} className="live-row">
              <span className={`tag ${a.action === 'restock' ? 'tag-loop' : a.action === 'reduce' ? 'tag-rfm' : 'tag-vip'}`}>
                {a.action === 'restock' ? 'Nên nhập thêm' : a.action === 'reduce' ? 'Hạn chế nhập' : 'Giữ mức nhập'}
              </span>
              <span>{a.name} — {a.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="live-cols">
        <div className="card">
          <div className="card-head"><h2>📺 Lên sóng tiếp theo</h2></div>
          {!snapshot.queue.length && <div className="pc-empty">Chưa có mẫu nào được hỏi thêm.</div>}
          {snapshot.queue.map((q) => (
            <div key={q.sku} className="live-row">
              <span><b>{q.sku}</b> · {q.recommendation}</span>
              {live && q.remaining > 0 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void run(() => liveClient.setOnAir(session.id, q.sku), `Đang lên sóng ${q.sku}`)}>Lên sóng</button>
              )}
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-head"><h2>📦 Tồn kho</h2></div>
          {snapshot.stock.map((st) => (
            <div key={st.sku} className="live-row">
              <span><b>{st.sku}</b> {st.name}</span>
              <span className={`tag ${st.level === 'out' ? 'tag-rfm' : st.level === 'low' ? 'tag-vip' : 'tag-loop'}`}>
                {st.level === 'out' ? 'Hết hàng' : st.level === 'low' ? 'Sắp hết' : 'Còn'} · còn {st.remaining}/{st.stock} (giữ {st.held})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>💬 Nhóm bình luận cần nhắn riêng</h2><span className="hint">AI gom bình luận cùng ý, shop duyệt 1 lần cho cả nhóm</span></div>
        {!snapshot.groups.length && <div className="pc-empty">Chưa có bình luận cần trả lời.</div>}
        {snapshot.groups.map((g) => <GroupCard key={g.key} group={g} sessionId={session.id} live={live} onDone={reload} onToast={onToast} />)}
      </div>

      <div className="card">
        <div className="card-head"><h2>🛒 Đơn nháp</h2><span className="hint">Mỗi khách 1 đơn — chốt nhiều lần được gộp lại</span></div>
        {!snapshot.orders.length && <div className="pc-empty">Chưa có ai chốt đơn.</div>}
        {snapshot.orders.map((o) => (
          <div key={o.id} className="live-row live-order">
            <span><b>{o.customerName || 'Khách'}</b> — {o.items.map((i) => `${i.sku} ${i.color ?? ''} ${i.size ?? ''} x${i.qty}${i.stockOk ? '' : ' (hết hàng)'}`).join(', ')}</span>
            <span>{formatMoney(o.total)}</span>
            <select value={o.status} onChange={(e) => void run(() => liveClient.updateOrder(session.id, o.id, e.target.value as LiveOrderStatus))}>
              {(Object.keys(ORDER_LABEL) as LiveOrderStatus[]).map((k) => <option key={k} value={k}>{ORDER_LABEL[k]}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><h2>Bình luận mới nhất</h2></div>
        {live && session.platform === 'demo' && (
          <form className="live-row" onSubmit={addComment}>
            <input className="pc-input" placeholder="Tên khách" value={comment.name} onChange={(e) => setComment({ ...comment, name: e.target.value })} />
            <input className="pc-input" placeholder="Gõ bình luận thử, vd: chốt M trắng" value={comment.text} onChange={(e) => setComment({ ...comment, text: e.target.value })} />
            <button className="btn btn-primary btn-sm" disabled={!comment.text.trim()}>Gửi bình luận</button>
          </form>
        )}
        {snapshot.recent.map((c) => (
          <div key={c.commentId} className="live-comment">
            <span className="hint">{time(c.createdAt)}</span>
            <b>{c.authorName || 'Ẩn danh'}</b>
            <span>{c.text}</span>
            <span className="tag tag-vip">{INTENT_LABEL[c.intent]}{c.sku ? ` · ${c.sku}` : ''}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function LivestreamShell() {
  const [toast, setToast] = useState<string | null>(null);
  const onToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const list = useMarketingData(liveClient.sessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { snapshot, error, apply, reload } = useLiveSession(activeId);
  const [platform, setPlatform] = useState<'demo' | 'facebook'>('demo');
  const [title, setTitle] = useState('');
  const [sources, setSources] = useState<LiveSourceOption[] | null>(null);
  const [sourceKey, setSourceKey] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (platform !== 'facebook' || sources) return;
    liveClient.sources().then((r) => setSources(r.sources), (e) => { setSources([]); onToast(errorText(e)); });
  }, [platform, sources]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const source = sources?.find((s) => `${s.kind}:${s.id}` === sourceKey);
    if (platform === 'facebook' && !source) return onToast('Chọn video Live hoặc bài đăng làm nguồn bình luận');
    setStarting(true);
    try {
      const session = await liveClient.start({ platform, title, ...(source ? { sourceKind: source.kind, sourceId: source.id } : {}) });
      setActiveId(session.id);
      list.reload();
    } catch (err) {
      onToast(errorText(err));
    } finally {
      setStarting(false);
    }
  };

  const fatal = list.error;
  return (
    <div className="marketing-root">
      <div className="shell">
        <Sidebar currentPath="livestream" onToast={onToast} />
        <main className="main">
          <div className="page-head">
            <h1>Livestream</h1>
            <p>Tendly đọc bình luận live, gom câu hỏi trùng, giữ đơn cho khách chốt và nhắn riêng sau khi shop duyệt. <span className="hint">(Bản chạy thử — dashboard chính thức đang làm.)</span></p>
          </div>

          {fatal ? <MarketingDataNotice error={fatal} onRetry={list.reload} /> : (
            <>
              <form className="card" onSubmit={start}>
                <div className="card-head"><h2>Bắt đầu phiên live</h2></div>
                <div className="live-row">
                  <button type="button" className={`chip${platform === 'demo' ? ' selected' : ''}`} onClick={() => setPlatform('demo')}>🎬 Live demo</button>
                  <button type="button" className={`chip${platform === 'facebook' ? ' selected' : ''}`} onClick={() => setPlatform('facebook')}>Facebook</button>
                  <button type="button" className="chip" disabled title="Sắp ra mắt">TikTok · sắp ra mắt</button>
                  <button type="button" className="chip" disabled title="Sắp ra mắt">Shopee · sắp ra mắt</button>
                </div>
                {platform === 'facebook' && (
                  <select className="pc-input" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)}>
                    <option value="">{sources ? (sources.length ? '— Chọn video Live / bài đăng —' : 'Không đọc được nguồn từ Fanpage') : 'Đang tải...'}</option>
                    {sources?.map((s) => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.kind === 'live_video' ? '🔴 ' : '📝 '}{s.title}</option>)}
                  </select>
                )}
                <div className="live-row">
                  <input className="pc-input" placeholder="Tên phiên (tuỳ chọn)" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <button className="btn btn-primary" disabled={starting}>{starting ? 'Đang bắt đầu...' : 'Bắt đầu'}</button>
                </div>
                <p className="hint">Phiên dùng sản phẩm, giá, tồn kho và FAQ trong Cấu hình AI tại thời điểm bắt đầu.</p>
              </form>

              <div className="card">
                <div className="card-head"><h2>Các phiên</h2></div>
                {!list.data?.length && <div className="pc-empty">{list.loading ? 'Đang tải...' : 'Chưa có phiên nào.'}</div>}
                {list.data?.map((s) => (
                  <div key={s.id} className="live-row">
                    <span>{s.status === 'live' ? '🔴' : '⏹️'} <b>{s.title}</b> · {new Date(s.startedAt).toLocaleString('vi-VN')} · {s.comments} bình luận · {s.orders} đơn · {formatMoney(s.revenue)}</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveId(s.id)}>{activeId === s.id ? 'Đang mở' : 'Mở'}</button>
                  </div>
                ))}
              </div>

              {error ? <MarketingDataNotice error={error} onRetry={reload} /> : null}
              {snapshot && <SessionPanel snapshot={snapshot} apply={apply} reload={reload} onToast={onToast} />}
            </>
          )}
        </main>
      </div>
      <Toast message={toast} />
    </div>
  );
}
