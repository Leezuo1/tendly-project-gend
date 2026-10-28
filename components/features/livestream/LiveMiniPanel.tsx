'use client';

/**
 * Cửa sổ "Trợ lý Live" (~360px) hỗ trợ người bán TRONG LÚC LIVE, gồm 3 tab:
 * - Ưu tiên: cảnh báo phàn nàn/đổi trả + câu hỏi nhiều người hỏi nhất (từ bình luận trong livestream) kèm câu trả lời gợi ý.
 * - Đơn: đơn khách chốt trong live để shop chốt lại lần nữa.
 * - Sản phẩm: tồn kho, mẫu đang lên sóng, flash sale.
 * Dùng trong cửa sổ nổi (Picture-in-Picture), popup hoặc trên điện thoại (/livestream/mini?session=...).
 * Không dùng confirm() vì dễ che màn hình live — nút gửi thật bấm 2 lần.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveSession } from '@/lib/hooks/useLiveSession';
import { liveClient } from '@/lib/services/liveClient';
import type { LiveGroup, LiveIntent, LiveOrder, LiveSnapshot } from '@/lib/types/live';
import { formatMoney } from '@/lib/utils/format';
import './live-mini.css';

type Tab = 'priority' | 'orders' | 'products';
type Theme = 'light' | 'dark';

/** Không đưa vào tab Ưu tiên: chốt đơn nằm ở tab Đơn, "khác" là chào hỏi/spam. */
const NOT_PRIORITY: LiveIntent[] = ['order', 'other'];
const ALERT_INTENTS: LiveIntent[] = ['complaint', 'return'];
const ORDER_STATUS: Record<LiveOrder['status'], string> = {
  draft: 'Chờ chốt', awaiting_info: 'Chờ thông tin', confirmed: 'Đã chốt', cancelled: 'Đã huỷ',
};
const THEME_KEY = 'tendly-live-mini-theme';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra');

function elapsed(from: number, now: number) {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function askersText(g: LiveGroup) {
  const names = g.askers.slice(0, 2);
  const others = g.people - names.length;
  if (!names.length) return `${g.people} khách`;
  return others > 0 ? `${names.join(', ')} và ${others} người khác` : names.join(' và ');
}

/** Nhóm vẫn cần xử lý: chưa bấm "Đã trả lời", hoặc có bình luận mới sau lần bấm đó. */
const isOpen = (g: LiveGroup) => g.handledAt === null || g.lastAt > g.handledAt;

/** Sáng/tối nhớ theo trình duyệt; dùng chung cho cửa sổ nổi và trang chính (cùng JS). */
const themeListeners = new Set<() => void>();
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
function writeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // không lưu được (chế độ riêng tư) — vẫn đổi trong lần mở này
  }
  memoryTheme = theme;
  for (const l of themeListeners) l();
}
let memoryTheme: Theme | null = null;
const subscribeTheme = (l: () => void) => {
  themeListeners.add(l);
  return () => { themeListeners.delete(l); };
};
const currentTheme = () => memoryTheme ?? readTheme();

/** Bấm lần 1 để "lên đạn", lần 2 mới chạy; tự huỷ sau 4 giây. */
function ConfirmButton({ label, armedLabel, busyLabel, onConfirm, primary }: {
  label: string; armedLabel: string; busyLabel: string; onConfirm: () => Promise<void>; primary?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const click = async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };
  return (
    <button type="button" className={`btn btn-sm ${armed || primary ? 'btn-primary' : 'btn-outline'}`} disabled={busy} onClick={click}>
      {busy ? busyLabel : armed ? armedLabel : label}
    </button>
  );
}

interface TabProps {
  snapshot: LiveSnapshot;
  apply: (s: LiveSnapshot) => void;
  notify: (m: string) => void;
  live: boolean;
}

function useAction(notify: (m: string) => void) {
  return async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (e) {
      notify(errorText(e));
    }
  };
}

function PriorityTab({ snapshot, apply, notify, live }: TabProps) {
  const sessionId = snapshot.session.id;
  const act = useAction(notify);
  const [picked, setPicked] = useState<string | null>(null);
  const open = snapshot.groups.filter(isOpen);
  const alerts = open.filter((g) => ALERT_INTENTS.includes(g.intent) && g.alert);
  const questions = open.filter((g) => !NOT_PRIORITY.includes(g.intent) && !ALERT_INTENTS.includes(g.intent))
    .sort((a, b) => b.people - a.people || b.lastAt - a.lastAt);
  const top = questions.find((g) => g.key === picked) ?? questions[0];
  const rest = questions.filter((g) => g !== top);

  const handled = (g: LiveGroup) => act(async () => {
    apply(await liveClient.markHandled(sessionId, g.key));
    setPicked(null);
  });
  const sendPrivate = (g: LiveGroup) => act(async () => {
    const r = await liveClient.approve(sessionId, g.key, g.replyText, g.revision);
    notify(`Đã nhắn ${r.sent} khách${r.notAllowed ? ` · ${r.notAllowed} không nhắn được` : ''}${r.failed ? ` · ${r.failed} lỗi` : ''}`);
  });
  const sendPublic = (g: LiveGroup) => act(async () => {
    apply(await liveClient.replyPublicly(sessionId, g.key, g.replyText, g.revision));
    notify('Đã trả lời bằng comment');
  });

  if (!alerts.length && !top) {
    return <div className="lm-empty">Chưa có gì cần xử lý. Câu hỏi và phàn nàn của khách trong live sẽ hiện ở đây.</div>;
  }
  return (
    <div className="lm-stack">
      {alerts.map((g) => (
        <div key={g.key} className="lm-alert">
          <div className="lm-alert-title">⚠️ {g.alert?.title}{g.productName ? ` · ${g.productName}` : ''}</div>
          <div className="lm-alert-tip">{g.alert?.tip}</div>
          {g.samples[0] && <div className="lm-quote">&ldquo;{g.samples[0]}&rdquo;</div>}
          {live && (
            <div className="lm-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => void handled(g)}>Đã xử lý</button>
            </div>
          )}
        </div>
      ))}

      {top && (
        <div className="lm-card">
          <div className="lm-card-head">
            <span className="lm-chip lm-chip-hot">Trả lời ngay</span>
            <span className="lm-muted">{top.people} người hỏi</span>
          </div>
          <div className="lm-question">{top.question}</div>
          <div className="lm-muted">{askersText(top)}</div>
          <div className="lm-answer">
            <span className="lm-label">Có thể trả lời</span>
            <div>{top.needsHuman && top.replySource !== 'shop' ? 'Shop trả lời trực tiếp trên live — chưa có câu trả lời mẫu chắc chắn.' : top.preview}</div>
          </div>
          {live && (
            <div className="lm-actions">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void handled(top)}>Đã trả lời</button>
              {!top.needsHuman && top.pending > 0 && (
                <ConfirmButton label={`Nhắn riêng ${top.pending}`} armedLabel={`Gửi thật ${top.pending}?`} busyLabel="Đang gửi…"
                  onConfirm={() => sendPrivate(top)} />
              )}
              {/* Nhóm đã comment rồi mà vẫn hiện ở đây nghĩa là có bình luận mới → cho comment lại */}
              {!top.needsHuman && (
                <ConfirmButton label={top.publicReplied ? 'Comment lại' : 'Trả lời bằng comment'} armedLabel="Đăng comment?"
                  busyLabel="Đang đăng…" onConfirm={() => sendPublic(top)} />
              )}
            </div>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="lm-list">
          {rest.map((g) => (
            <button key={g.key} type="button" className="lm-list-row" onClick={() => setPicked(g.key)}>
              <span>{g.question}</span>
              <b>{g.people} người</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ snapshot, apply, notify, live }: TabProps) {
  const sessionId = snapshot.session.id;
  const act = useAction(notify);
  const orders = snapshot.orders.filter((o) => o.status !== 'cancelled')
    .sort((a, b) => Number(a.status === 'confirmed') - Number(b.status === 'confirmed') || b.updatedAt - a.updatedAt);
  const confirmGroups = snapshot.groups.filter((g) => g.intent === 'order' && !g.needsHuman && g.pending > 0);
  const setStatus = (o: LiveOrder, status: LiveOrder['status']) => act(async () => {
    apply(await liveClient.updateOrder(sessionId, o.id, status));
  });

  return (
    <div className="lm-stack">
      <div className="lm-stats">
        <div><b>{snapshot.stats.orders}</b><span>đơn</span></div>
        <div><b>{formatMoney(snapshot.stats.revenue)}</b><span>dự kiến</span></div>
        <div><b>{snapshot.stats.customers}</b><span>khách</span></div>
      </div>
      {live && confirmGroups.map((g) => (
        <div key={g.key} className="lm-row lm-row-box">
          <span>Nhắn xác nhận đơn{g.productName ? ` · ${g.productName}` : ''}</span>
          <ConfirmButton label={`Nhắn ${g.pending}`} armedLabel={`Gửi thật ${g.pending}?`} busyLabel="Đang gửi…" onConfirm={() => act(async () => {
            const r = await liveClient.approve(sessionId, g.key, g.replyText, g.revision);
            notify(`Đã nhắn ${r.sent} khách${r.notAllowed ? ` · ${r.notAllowed} không nhắn được` : ''}`);
          })} />
        </div>
      ))}
      {!orders.length && <div className="lm-empty">Chưa có đơn. Khách bình luận &ldquo;chốt&rdquo;, &ldquo;lấy 1&rdquo;… sẽ hiện ở đây.</div>}
      {orders.map((o) => (
        <div key={o.id} className={`lm-order${o.status === 'confirmed' ? ' done' : ''}`}>
          <div className="lm-row">
            <b>{o.customerName || 'Khách'}</b>
            <span className={`lm-chip lm-status-${o.status}`}>{ORDER_STATUS[o.status]}</span>
          </div>
          {o.items.map((it, i) => (
            <div key={i} className={`lm-item${it.stockOk ? '' : ' out'}`}>
              {it.qty}× {it.name}{[it.color, it.size].filter(Boolean).length ? ` (${[it.color, it.size].filter(Boolean).join(', ')})` : ''}
              {!it.stockOk && <span className="lm-chip lm-chip-out">hết hàng</span>}
            </div>
          ))}
          <div className="lm-row">
            <b>{formatMoney(o.total)}</b>
            {live && o.status !== 'confirmed' && (
              <span className="lm-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void setStatus(o, 'cancelled')}>Huỷ</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={o.total <= 0} onClick={() => void setStatus(o, 'confirmed')}>Chốt đơn</button>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlashEditor({ sku, current, sessionId, apply, notify, onDone }: {
  sku: string; current: number; sessionId: string; apply: (s: LiveSnapshot) => void; notify: (m: string) => void; onDone: () => void;
}) {
  const [value, setValue] = useState(String(current));
  const act = useAction(notify);
  const save = (price: number | null) => act(async () => {
    apply(await liveClient.setFlashPrice(sessionId, sku, price));
    notify(price === null ? `Đã tắt flash sale ${sku}` : `Flash sale ${sku}: ${formatMoney(price)}`);
    onDone();
  });
  const price = Number(value.replace(/[^\d]/g, ''));
  return (
    <div className="lm-flash-edit">
      <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Giá flash sale" />
      <button type="button" className="btn btn-sm btn-primary" disabled={!price} onClick={() => void save(price)}>Lưu</button>
      <button type="button" className="btn btn-sm btn-outline" onClick={onDone}>Huỷ</button>
    </div>
  );
}

function ProductsTab({ snapshot, apply, notify, live }: TabProps) {
  const { session, onAir } = snapshot;
  const act = useAction(notify);
  const [editing, setEditing] = useState<string | null>(null);
  const stockOf = new Map(snapshot.stock.map((s) => [s.sku, s]));
  const asked = new Map(snapshot.queue.map((q) => [q.sku, q.requests]));
  const rank = { out: 0, low: 1, ok: 2 };
  const products = snapshot.products.map((p) => {
    const s = stockOf.get(p.sku);
    const remaining = s ? s.remaining : p.stock;
    const level = s?.level ?? (p.stock <= 0 ? 'out' : p.stock <= 3 ? 'low' : 'ok');
    return { ...p, remaining, held: s?.held ?? 0, level };
  }).sort((a, b) => Number(b.sku === session.onAirSku) - Number(a.sku === session.onAirSku)
    || rank[a.level] - rank[b.level] || (asked.get(b.sku) ?? 0) - (asked.get(a.sku) ?? 0));

  const setOnAir = (sku: string | null) => act(async () => {
    apply(await liveClient.setOnAir(session.id, sku));
    notify(sku ? `Đang lên sóng ${sku}` : 'Đã bỏ chọn mẫu');
  });

  return (
    <div className="lm-stack">
      <div className="lm-onair">
        <span className="lm-label">Đang lên sóng</span>
        {onAir ? <b>{onAir.name} · còn {Math.max(0, onAir.remaining)}</b>
          : <span className="lm-muted">Chưa chọn mẫu — bình luận &ldquo;1&rdquo;, &ldquo;chốt M&rdquo; chưa gán được sản phẩm</span>}
      </div>
      {snapshot.queue[0] && snapshot.queue[0].remaining > 0 && (
        <div className="lm-hint">👉 Nên giới thiệu tiếp <b>{snapshot.queue[0].name}</b>: {snapshot.queue[0].recommendation}</div>
      )}
      {!products.length && <div className="lm-empty">Chưa có sản phẩm. Thêm sản phẩm trong Cấu hình AI trước khi bắt đầu phiên.</div>}
      {products.map((p) => (
        <div key={p.sku} className={`lm-product level-${p.level}${p.sku === session.onAirSku ? ' onair' : ''}`}>
          <div className="lm-row">
            <b>{p.name}</b>
            <span className={`lm-chip lm-level-${p.level}`}>
              {p.level === 'out' ? 'Hết hàng' : `Còn ${Math.max(0, p.remaining)}`}
            </span>
          </div>
          <div className="lm-row lm-muted">
            <span>
              {p.sku} · {p.flashPrice !== null
                ? <><s>{formatMoney(p.basePrice)}</s> <b className="lm-flash-price">{formatMoney(p.price)}</b></>
                : formatMoney(p.price)}
            </span>
            <span>{p.held ? `giữ ${p.held}` : ''}{asked.get(p.sku) ? ` · ${asked.get(p.sku)} người hỏi` : ''}</span>
          </div>
          {live && editing === p.sku ? (
            <FlashEditor sku={p.sku} current={p.flashPrice ?? p.basePrice} sessionId={session.id} apply={apply} notify={notify}
              onDone={() => setEditing(null)} />
          ) : live && (
            <div className="lm-actions">
              {p.sku === session.onAirSku
                ? <button type="button" className="btn btn-sm btn-outline" onClick={() => void setOnAir(null)}>Bỏ lên sóng</button>
                : <button type="button" className="btn btn-sm btn-outline" disabled={p.remaining <= 0} onClick={() => void setOnAir(p.sku)}>Lên sóng</button>}
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(p.sku)}>
                {p.flashPrice !== null ? 'Sửa flash sale' : '⚡ Flash sale'}
              </button>
              {p.flashPrice !== null && (
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void act(async () => {
                  apply(await liveClient.setFlashPrice(session.id, p.sku, null));
                  notify(`Đã tắt flash sale ${p.sku}`);
                })}>Tắt</button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Phiên đã tạo, người bán chưa bật live: hướng dẫn + tự chuyển sang dữ liệu live khi phát hiện stream. */
function Waiting() {
  return (
    <div className="lm-waiting">
      <div className="live-mini-spinner" />
      <ol>
        <li>Mở Facebook trên máy/điện thoại, chọn <b>Phát trực tiếp</b>.</li>
        <li>Chọn phát trên <b>Trang của shop</b> (không phải trang cá nhân).</li>
        <li>Bấm <b>Phát trực tiếp</b> — Tendly tự nhận stream trong vài giây và cửa sổ này chuyển sang hỗ trợ bán hàng.</li>
      </ol>
      <span className="lm-muted">Cứ để cửa sổ này mở, kéo đặt cạnh màn hình live.</span>
      <a className="btn btn-primary" href="https://www.facebook.com/live/producer" target="_blank" rel="noreferrer">Mở Facebook Live ↗</a>
    </div>
  );
}

export function LiveMiniPanel({ sessionId, fullUrl = '/livestream' }: { sessionId: string; fullUrl?: string }) {
  const { snapshot, error, paused, setPaused, apply } = useLiveSession(sessionId);
  const [tab, setTab] = useState<Tab>('priority');
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light' as Theme);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);
  const toggleTheme = () => writeTheme(theme === 'dark' ? 'light' : 'dark');

  const session = snapshot?.session;
  const live = session?.status === 'live';
  const waiting = Boolean(session?.waiting);
  const open = snapshot?.groups.filter(isOpen) ?? [];
  const priorityCount = open.filter((g) => !NOT_PRIORITY.includes(g.intent) && (!ALERT_INTENTS.includes(g.intent) || g.alert)).length;
  const newOrders = snapshot?.orders.filter((o) => (o.status === 'draft' || o.status === 'awaiting_info') && o.total > 0).length ?? 0;
  const lowStock = snapshot?.products.filter((p) => {
    const s = snapshot.stock.find((x) => x.sku === p.sku);
    return s ? s.level !== 'ok' : p.stock <= 3;
  }).length ?? 0;
  const props = snapshot && { snapshot, apply, notify: setMessage, live };

  return (
    <div className="live-mini" data-theme={theme}>
      <div className="lm-head">
        <span className={`live-mini-dot${live && !waiting && !paused ? ' on' : ''}`} />
        <b>Trợ lý Live</b>
        <span className="live-mini-time">
          {!session ? '' : waiting ? 'chờ bật live' : !live ? 'đã kết thúc'
            : paused ? 'tạm dừng' : elapsed(session.liveAt ?? session.startedAt, now)}
        </span>
        <span className="lm-head-actions">
          {live && (
            <button type="button" className="lm-icon" title={paused ? 'Tiếp tục cập nhật' : 'Tạm dừng cập nhật'}
              onClick={() => setPaused(!paused)}>{paused ? '▶' : '⏸'}</button>
          )}
          <button type="button" className="lm-icon" title={minimized ? 'Mở rộng' : 'Thu nhỏ'} onClick={() => setMinimized(!minimized)}>
            {minimized ? '▢' : '—'}
          </button>
          <button type="button" className="lm-icon" title="Đổi giao diện sáng/tối" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
          <a className="lm-icon" href={fullUrl} target="_blank" rel="noreferrer" title="Mở trang đầy đủ">↗</a>
        </span>
      </div>

      {minimized ? (
        snapshot && !waiting && (
          <div className="lm-mini-line">
            {priorityCount} cần xử lý · {newOrders} đơn chờ chốt · {lowStock} mẫu sắp hết
          </div>
        )
      ) : !snapshot || !props ? (
        <div className="lm-empty">{error ? errorText(error) : 'Đang tải phiên live…'}</div>
      ) : waiting ? (
        <Waiting />
      ) : (
        <>
          <div className="lm-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'priority'} className={tab === 'priority' ? 'active' : ''}
              onClick={() => setTab('priority')}>Ưu tiên ({priorityCount})</button>
            <button type="button" role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : ''}
              onClick={() => setTab('orders')}>Đơn{newOrders ? ` (+${newOrders})` : ''}</button>
            <button type="button" role="tab" aria-selected={tab === 'products'} className={tab === 'products' ? 'active' : ''}
              onClick={() => setTab('products')}>Sản phẩm{lowStock ? ` (${lowStock} sắp hết)` : ''}</button>
          </div>
          {error ? <div className="live-mini-error">Mất kết nối, đang thử lại… ({errorText(error)})</div> : null}
          {tab === 'priority' && <PriorityTab {...props} />}
          {tab === 'orders' && <OrdersTab {...props} />}
          {tab === 'products' && <ProductsTab {...props} />}
        </>
      )}

      {message && <div className="live-mini-toast">{message}</div>}
    </div>
  );
}
