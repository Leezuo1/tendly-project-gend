'use client';

/** Session preparation and approval share the existing Live cockpit and mini window. */
import React, { useState } from 'react';
import { LiveSetup, LiveDraftReview } from './LiveSetup';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { Toast } from '@/components/shared/Toast';
import { MarketingDataNotice } from '@/components/features/marketing/MarketingDataNotice';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { useLiveSession } from '@/lib/hooks/useLiveSession';
import { liveClient } from '@/lib/services/liveClient';
import { miniUrl, openLiveMini } from '@/lib/services/liveMiniWindow';
import type { LiveGroup, LiveIntent, LiveOrderStatus, LiveSnapshot } from '@/lib/types/live';
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
      {group.publicReplyUnknown && <p className="hint">Chưa rõ comment công khai đã đăng. Kiểm tra Facebook trước khi xử lý tiếp.</p>}
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
  const s = snapshot.summary;

  return (
    <>
      {session.waiting && (
        <div className="card pc-notice">
          <b>⏳ Phiên đã sẵn sàng — đang chờ bạn bật live.</b>
          <span> Mở Facebook, chọn Phát trực tiếp trên Trang của shop. Tendly tự nhận stream trong vài giây.</span>
          <a className="btn btn-primary btn-sm" href="https://www.facebook.com/live/producer" target="_blank" rel="noreferrer">Mở Facebook Live ↗</a>
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <h2>{live ? '🔴' : '⏹️'} {session.title}</h2>
          <span className="hint">Facebook · {session.waiting ? 'Chờ phát Live' : `bắt đầu ${time(session.liveAt ?? session.startedAt)}`}</span>
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
            <div><b>Chốt nháp nhiều nhất</b>{s.topOrdered.map((p) => <div key={p.sku}>{p.name}: {p.count} sp</div>)}</div>
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
        {snapshot.groups.map((g) => <GroupCard key={g.key} group={g} sessionId={session.id} live={live && session.preparation?.allowPrivate !== false} onDone={reload} onToast={onToast} />)}
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
  const onToast = (message: string) => { setToast(message); setTimeout(() => setToast(null), 4000); };
  const list = useMarketingData(liveClient.sessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { snapshot, error, apply, reload } = useLiveSession(activeId);
  const saved = (id: string) => { setCreating(false); setActiveId(id); list.reload(); if (id === activeId) reload(); };
  return <div className="marketing-root"><div className="shell">
    <Sidebar currentPath="livestream" onToast={onToast} />
    <main className="main">
      <div className="page-head live-section-head"><div><h1>AI Livestream</h1><p>Host tập trung lên sóng. Tendly gom câu hỏi, ghi nhận đơn nháp và chờ bạn duyệt phản hồi.</p></div><button className="btn btn-primary" onClick={() => setCreating(value => !value)}>{creating ? 'Đóng chuẩn bị' : 'Chuẩn bị phiên mới'}</button></div>
      {list.error ? <MarketingDataNotice error={list.error} onRetry={list.reload} /> : <>
        {(creating || (!list.loading && !list.data?.length && !snapshot)) && <LiveSetup onSaved={saved} onToast={onToast} />}
        <section className="card"><div className="card-head"><h2>Phiên của shop</h2><span className="hint">Nháp → duyệt dữ liệu → bắt đầu</span></div>
          {!list.data?.length && <div className="pc-empty">{list.loading ? 'Đang tải phiên…' : 'Chưa có phiên nào. Chuẩn bị danh mục và người phụ trách để bắt đầu.'}</div>}
          <div className="live-session-list">{list.data?.map(item => <button key={item.id} className={`live-session-item${activeId === item.id ? ' selected' : ''}`} onClick={() => { setCreating(false); setActiveId(item.id); }}><span className={`live-session-state ${item.status}`}>{item.status === 'draft' ? 'Bản nháp' : item.status === 'live' ? 'Đang hoạt động' : 'Đã kết thúc'}</span><b>{item.title}</b><small>{new Date(item.startedAt).toLocaleString('vi-VN')} · {item.comments} bình luận · {item.orders} đơn</small></button>)}</div>
        </section>
        {error ? <MarketingDataNotice error={error} onRetry={reload} /> : null}
        {snapshot && !creating && (snapshot.session.status === 'draft' ? <LiveDraftReview key={`${snapshot.session.id}:${snapshot.session.preparationRevision}`} snapshot={snapshot} onSaved={saved} onToast={onToast} apply={apply} /> : <>
          {snapshot.session.preparation && <section className="card live-session-context"><h2>{snapshot.session.preparation.host} phụ trách</h2><p>Duyệt bởi {snapshot.session.approvedBy} · {snapshot.session.approvedAt ? new Date(snapshot.session.approvedAt).toLocaleString('vi-VN') : ''}</p><p>Mã host: {snapshot.session.preparation.catalog.filter(item => item.codes.length).map(item => `${item.codes.join(', ')} → ${item.sku}`).join(' · ') || 'Chưa đặt'}<br />Chuyển người: {snapshot.session.preparation.handoff}<br />Giữ lượng: {snapshot.session.preparation.holdPolicy}</p><p className="hint">Flash price áp dụng đến khi tắt / kết thúc phiên. Đơn nháp giữ giá lúc ghi nhận.</p></section>}
          <SessionPanel snapshot={snapshot} apply={apply} reload={reload} onToast={onToast} />
          <section className="card"><div className="card-head"><h2>Việc cần chăm sóc tiếp</h2><a href="/hop-thoai">Mở Customer Care →</a></div><p className="hint">{snapshot.session.preparation?.handoff || 'Người phụ trách kiểm tra trước khi liên hệ khách.'}</p>
            {snapshot.orders.filter(order => order.status === 'draft' || order.status === 'awaiting_info').map(order => <div key={order.id} className="live-row"><span><b>{order.customerName}</b> · {order.items.some(item => !item.stockOk) ? 'Thiếu lượng trong phiên; cần kiểm tra nguồn hàng' : order.status === 'awaiting_info' ? 'Chờ thông tin nhận hàng' : 'Đơn nháp chờ xác nhận'}</span></div>)}
            {snapshot.groups.filter(group => group.needsHuman && group.pending).map(group => <div className="live-row" key={group.key}><span>{group.question} · {group.people} khách · cần người phụ trách</span></div>)}
            {!snapshot.orders.some(order => ['draft', 'awaiting_info'].includes(order.status)) && !snapshot.groups.some(group => group.needsHuman && group.pending) && <p>Không có mục đang chờ xử lý trong dữ liệu phiên.</p>}
          </section>
          {!!snapshot.timeline?.length && <details className="card"><summary>Lịch sử mẫu lên sóng</summary>{snapshot.timeline.map(event => <p key={event.at}>{time(event.at)} · {event.sku || 'Bỏ chọn mẫu'}</p>)}</details>}
        </>)}
      </>}
    </main>
  </div><Toast message={toast} /></div>;
}
