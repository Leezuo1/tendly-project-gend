'use client';

/**
 * Cửa sổ nhỏ hỗ trợ người bán TRONG LÚC LIVE (~360px): liếc là biết mẫu đang lên sóng còn bao nhiêu,
 * nên giới thiệu mẫu nào tiếp, có cảnh báo gì, nhóm nào chờ nhắn riêng. Dùng trong cửa sổ nổi (Picture-in-Picture),
 * popup hoặc mở trên điện thoại (/livestream/mini?session=...). Không dùng confirm() vì dễ che màn hình live.
 */
import React, { useEffect, useState } from 'react';
import { useLiveSession } from '@/lib/hooks/useLiveSession';
import { liveClient } from '@/lib/services/liveClient';
import type { LiveGroup, LiveIntent, LiveSnapshot } from '@/lib/types/live';
import { formatMoney } from '@/lib/utils/format';
import './live-mini.css';

const SHORT: Record<LiveIntent, string> = {
  order: 'Chốt đơn', price: 'Hỏi giá', size_advice: 'Tư vấn size', stock: 'Còn hàng?', view: 'Xin xem mẫu',
  shipping: 'Ship/COD', return: 'Đổi trả', complaint: 'Phàn nàn', question: 'Câu hỏi', other: 'Khác',
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra');

function elapsed(from: number, now: number) {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function SendButton({ group, sessionId, onMessage }: { group: LiveGroup; sessionId: string; onMessage: (m: string) => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Bấm lần 1 để "lên đạn", lần 2 mới gửi; tự huỷ sau 4 giây
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const click = async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    try {
      const r = await liveClient.approve(sessionId, group.key, group.replyText, group.revision);
      onMessage(`Đã nhắn ${r.sent} khách${r.notAllowed ? ` · ${r.notAllowed} không nhắn được` : ''}${r.failed ? ` · ${r.failed} lỗi` : ''}`);
    } catch (e) {
      onMessage(errorText(e));
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };
  return (
    <button type="button" className={`btn btn-sm ${armed ? 'btn-primary' : 'btn-outline'}`} disabled={busy} onClick={click}>
      {busy ? 'Đang gửi…' : armed ? `Gửi thật ${group.pending}?` : `Nhắn ${group.pending}`}
    </button>
  );
}

/** Phiên đã tạo, người bán chưa bật live: hướng dẫn + tự chuyển sang dữ liệu live khi phát hiện stream. */
function Waiting() {
  return (
    <div className="live-mini">
      <div className="live-mini-head">
        <span className="live-mini-dot" />
        <b>Đang chờ bạn bật live…</b>
      </div>
      <div className="live-mini-waiting">
        <div className="live-mini-spinner" />
        <ol>
          <li>Mở Facebook trên máy/điện thoại, chọn <b>Phát trực tiếp</b>.</li>
          <li>Chọn phát trên <b>Trang của shop</b> (không phải trang cá nhân).</li>
          <li>Bấm <b>Phát trực tiếp</b> — Tendly tự nhận stream trong vài giây và cửa sổ này chuyển sang hỗ trợ bán hàng.</li>
        </ol>
        <span className="live-mini-muted">Cứ để cửa sổ này mở, kéo đặt cạnh màn hình live.</span>
        <a className="btn btn-primary" href="https://www.facebook.com/live/producer" target="_blank" rel="noreferrer">Mở Facebook Live ↗</a>
      </div>
    </div>
  );
}

function MiniBody({ snapshot, apply, fullUrl }: { snapshot: LiveSnapshot; apply: (s: LiveSnapshot) => void; fullUrl: string }) {
  const { session, stats, onAir } = snapshot;
  const live = session.status === 'live';
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(snapshot.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const onAirStock = onAir ? snapshot.stock.find((s) => s.sku === onAir.sku) : null;
  const outOfStock = snapshot.stock.filter((s) => s.level === 'out');
  const urgent = snapshot.groups.filter((g) => g.needsHuman && g.pending > 0);
  const sendable = snapshot.groups.filter((g) => !g.needsHuman && g.pending > 0).slice(0, 3);
  // Cùng cách đếm với stats.orders: đơn chưa huỷ và có ít nhất 1 món còn hàng
  const recentOrders = snapshot.orders
    .filter((o) => o.status !== 'cancelled' && o.total > 0 && now - o.createdAt <= 5 * 60_000).length;

  const setOnAir = async (sku: string | null) => {
    try {
      apply(await liveClient.setOnAir(session.id, sku));
      setMessage(sku ? `Đang lên sóng ${sku}` : 'Đã bỏ chọn mẫu');
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  return (
    <div className="live-mini">
      <div className="live-mini-head">
        <span className={`live-mini-dot${live ? ' on' : ''}`} />
        <b>{live ? 'LIVE' : 'Đã kết thúc'}</b>
        <span className="live-mini-time">{elapsed(session.liveAt ?? session.startedAt, session.endedAt ?? now)}</span>
        <a className="live-mini-link" href={fullUrl} target="_blank" rel="noreferrer">Mở đầy đủ ↗</a>
      </div>

      <div className="live-mini-stats">
        <div><b>{stats.orders}</b><span>đơn{recentOrders ? ` (+${recentOrders})` : ''}</span></div>
        <div><b>{formatMoney(stats.revenue)}</b><span>dự kiến</span></div>
        <div><b>{stats.comments}</b><span>bình luận</span></div>
        <div><b>{stats.pendingReplies}</b><span>chờ nhắn</span></div>
      </div>

      <div className={`live-mini-onair level-${onAirStock?.level ?? 'ok'}`}>
        <span className="live-mini-label">Đang lên sóng</span>
        {onAir ? (
          <>
            <b>{onAir.name}</b>
            <span>{onAir.sku} · {formatMoney(onAir.price)}</span>
            <span className="live-mini-big">còn {Math.max(0, onAir.remaining)}</span>
          </>
        ) : <span>Chưa chọn mẫu — bình luận &ldquo;1&rdquo;, &ldquo;chốt M&rdquo; chưa gán được sản phẩm</span>}
        {live && (
          <select value={session.onAirSku ?? ''} onChange={(e) => void setOnAir(e.target.value || null)}>
            <option value="">— Đổi mẫu —</option>
            {snapshot.products.map((p) => <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}
          </select>
        )}
      </div>

      {(outOfStock.length > 0 || urgent.length > 0) && (
        <div className="live-mini-alerts">
          {outOfStock.map((s) => <div key={s.sku}>⛔ <b>{s.sku}</b> hết hàng — báo khách trên live</div>)}
          {urgent.map((g) => <div key={g.key}>⚠️ {g.pending} khách {SHORT[g.intent].toLowerCase()}{g.productName ? ` · ${g.sku}` : ''} — xem ở trang đầy đủ</div>)}
        </div>
      )}

      <div className="live-mini-section">
        <span className="live-mini-label">Lên sóng tiếp theo</span>
        {!snapshot.queue.length && <span className="live-mini-empty">Chưa có mẫu nào được hỏi thêm</span>}
        {snapshot.queue.slice(0, 3).map((q) => (
          <div key={q.sku} className="live-mini-row">
            <span><b>{q.sku}</b> {q.requests} người hỏi · còn {Math.max(0, q.remaining)}</span>
            {live && q.remaining > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => void setOnAir(q.sku)}>Lên sóng</button>}
          </div>
        ))}
      </div>

      <div className="live-mini-section">
        <span className="live-mini-label">Chờ nhắn riêng</span>
        {!sendable.length && <span className="live-mini-empty">Không có nhóm nào chờ gửi</span>}
        {sendable.map((g) => (
          <div key={g.key} className="live-mini-row">
            <span>{SHORT[g.intent]}{g.sku ? ` · ${g.sku}` : ''} <span className="live-mini-muted">({g.count})</span></span>
            {live && <SendButton group={g} sessionId={session.id} onMessage={setMessage} />}
          </div>
        ))}
      </div>

      <div className="live-mini-section live-mini-feed">
        <span className="live-mini-label">Bình luận mới</span>
        {snapshot.recent.slice(0, 5).map((c) => (
          <div key={c.commentId} className="live-mini-comment">
            <b>{c.authorName || 'Khách'}</b> {c.text}
            {c.intent !== 'other' && <span className="live-mini-tag">{SHORT[c.intent]}</span>}
          </div>
        ))}
      </div>

      {message && <div className="live-mini-toast">{message}</div>}
    </div>
  );
}

export function LiveMiniPanel({ sessionId, fullUrl = '/livestream' }: { sessionId: string; fullUrl?: string }) {
  const { snapshot, error, apply } = useLiveSession(sessionId);
  if (!snapshot) {
    return (
      <div className="live-mini">
        <div className="live-mini-empty">{error ? errorText(error) : 'Đang tải phiên live…'}</div>
      </div>
    );
  }
  if (snapshot.session.waiting) return <Waiting />;
  return <MiniBody snapshot={snapshot} apply={apply} fullUrl={fullUrl} />;
}
