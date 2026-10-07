'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconChat, IconClose, IconSend } from '@/components/ui/Icons';
import { useShop } from '@/components/shared/ShopProvider';
import { AGENT, CUSTOMER, LAST_ORDER } from '@/lib/data/customer';
import { emailApi, snapshot } from '@/lib/services/api';
import { agentReply, findProduct, summarizeIssue, type ConversationCtx } from '@/lib/services/chatBot';
import { askShopAi } from '@/lib/services/aiChat';
import { clockTime, initials, normalize, uid } from '@/lib/utils/format';

export type ChatItem =
  | { kind: 'divider'; id: string; label: string }
  | { kind: 'msg'; id: string; from: 'customer' | 'bot' | 'agent'; text: string; time: string; flag?: 'ai' | 'personal' }
  | { kind: 'system'; id: string; text: string }
  | { kind: 'handoff'; id: string; agent: string }
  | { kind: 'context'; id: string; agent: string; rows: { label: string; value: string }[] };

export type ChatMode = 'bot' | 'agent';

export interface ChatSeed {
  items: ChatItem[];
  quickReplies: string[];
  mode: ChatMode;
  ctx: ConversationCtx;
}

const msg = (from: 'customer' | 'bot' | 'agent', text: string, flag?: 'ai' | 'personal'): ChatItem => ({
  kind: 'msg', id: uid('msg'), from, text, flag, time: clockTime(),
});

const jitter = (ms: number) => ms + Math.random() * ms * 0.4;

export function ChatWidget({ seed }: { seed: ChatSeed }) {
  const shop = useShop();
  const [items, setItems] = useState<ChatItem[]>(seed.items);
  const [quickReplies, setQuickReplies] = useState(seed.quickReplies);
  const [mode, setMode] = useState<ChatMode>(seed.mode);
  const [typing, setTyping] = useState<ChatMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(true);
  const [unread, setUnread] = useState(0);

  const ctxRef = useRef(seed.ctx);
  const openRef = useRef(open);
  const timers = useRef<number[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const firstScroll = useRef(true);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // lần đầu nhảy thẳng xuống cuối, các lần sau cuộn mượt theo tin mới
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'auto' : 'smooth' });
    firstScroll.current = false;
  }, [items, typing, quickReplies, open]);

  const wait = (ms: number) => new Promise<void>((resolve) => { timers.current.push(window.setTimeout(resolve, ms)); });

  const push = (...next: ChatItem[]) => {
    setItems((prev) => [...prev, ...next]);
    if (!openRef.current) setUnread((u) => u + next.filter((i) => i.kind === 'msg').length);
  };

  const handoff = async (text: string, reason: 'negative' | 'request') => {
    if (reason === 'negative') {
      await wait(500);
      push({ kind: 'system', id: uid('sys'), text: 'Đã phát hiện cảm xúc tiêu cực — ưu tiên chuyển tiếp ngay' });
      // kịch bản "Khách đang bực" bên Cấu hình AI → ghi log email xin lỗi
      if (emailApi.isTriggerEnabled('negative')) {
        void emailApi.logSent('negative', `${CUSTOMER.name} N.`, 'voucher xin lỗi 10%');
      }
    }
    await wait(900);
    const product = snapshot.products().find((p) => p.id === ctxRef.current.productId);
    const rows = reason === 'negative'
      ? [
          { label: 'Đơn hàng', value: `${LAST_ORDER.code} · ${LAST_ORDER.item}` },
          { label: 'Vấn đề', value: summarizeIssue(text) },
          { label: 'Cảm xúc khách hàng', value: 'Tiêu cực' },
        ]
      : [
          { label: 'Sản phẩm quan tâm', value: product ? product.name : 'Chưa xác định' },
          { label: 'Yêu cầu', value: 'Muốn trao đổi trực tiếp với nhân viên' },
          { label: 'Cảm xúc khách hàng', value: 'Bình thường' },
        ];
    push(
      { kind: 'handoff', id: uid('ho'), agent: AGENT.name },
      { kind: 'context', id: uid('ctx'), agent: AGENT.name, rows },
    );
    setMode('agent');
    await wait(700);
    setTyping('agent');
    await wait(jitter(1500));
    setTyping(null);
    push(msg('agent', reason === 'negative'
      ? `Chào ${CUSTOMER.call}, em là Hà bên ${shop.name}. Em xem lại đơn ${LAST_ORDER.code} của ${CUSTOMER.call} rồi ạ, thực sự xin lỗi ${CUSTOMER.call} vì sự cố lần này. Em hỗ trợ đổi hàng mới hoặc hoàn tiền ngay cho ${CUSTOMER.call} nha, ${CUSTOMER.call} muốn chọn cách nào ạ?`
      : `Chào ${CUSTOMER.call}, em là Hà bên ${shop.name} đây ạ. ${CUSTOMER.call.charAt(0).toUpperCase() + CUSTOMER.call.slice(1)} cần em hỗ trợ gì thêm nè?`));
    setQuickReplies(reason === 'negative' ? ['Đồng ý đổi hàng', 'Xin hoàn tiền thay vì đổi'] : []);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setQuickReplies([]);
    setBusy(true);
    push(msg('customer', text));

    try {
      if (mode === 'agent') {
        await wait(600);
        setTyping('agent');
        await wait(jitter(1400));
        const r = agentReply(text);
        setTyping(null);
        push(msg('agent', r.text));
        setQuickReplies(r.quickReplies);
      } else {
        await wait(350);
        setTyping('bot');
        const product = findProduct(normalize(text), snapshot.products());
        if (product) ctxRef.current = { productId: product.id, size: null, color: null };
        const context = items.flatMap((item) => item.kind === 'msg' ? [{
          role: item.from === 'customer' ? 'user' as const : 'model' as const,
          text: item.text.slice(0, 2000),
        }] : []).slice(-10);
        const r = await askShopAi(text, context);
        const reason = r.analysis.needsHuman ? (r.analysis.sentiment === 'negative' ? 'negative' : 'request') : undefined;
        setTyping(null);
        push(msg('bot', r.reply, 'ai'));
        if (reason) await handoff(text, reason);
      }
    } catch (error) {
      push({ kind: 'system', id: uid('sys'), text: error instanceof Error ? error.message : 'AI chưa thể trả lời. Vui lòng thử lại.' });
    } finally {
      setTyping(null);
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  if (!open) {
    return (
      <button className="chat-launcher" onClick={() => { setOpen(true); setUnread(0); }} aria-label="Mở khung chat">
        <IconChat />
        {unread > 0 && <span className="unread">{unread}</span>}
      </button>
    );
  }

  const shopBadge = initials(shop.name);
  const isAgent = mode === 'agent';

  return (
    <div className="widget">
      <div className="widget-header">
        <div className={`shop-avatar${isAgent ? ' agent' : ''}`}>{isAgent ? AGENT.initials : shopBadge}</div>
        <div className="who">
          <div className="shop-name">{isAgent ? `${shop.name} · ${AGENT.name}` : shop.name}</div>
          <div className="shop-status">
            <span className="status-dot" />
            {typing ? 'Đang soạn tin...' : isAgent ? 'Nhân viên đang hỗ trợ trực tiếp' : 'Thường trả lời trong vài phút'}
          </div>
        </div>
        <button className="widget-close" onClick={() => { firstScroll.current = true; setOpen(false); }} aria-label="Thu nhỏ khung chat"><IconClose /></button>
      </div>

      <div className="widget-body" ref={bodyRef}>
        {items.map((item) => {
          switch (item.kind) {
            case 'divider':
              return <div key={item.id} className="day-divider">{item.label}</div>;
            case 'system':
              return <div key={item.id} className="system-note"><span className="dot-pulse" />{item.text}</div>;
            case 'handoff':
              return <div key={item.id} className="handoff-banner">🔁 Đã chuyển tiếp đến nhân viên: {item.agent}</div>;
            case 'context':
              return (
                <div key={item.id} className="context-card">
                  <div className="ctx-title">Ngữ cảnh đã bàn giao cho {item.agent}</div>
                  {item.rows.map((r) => <div key={r.label} className="ctx-row">{r.label}: <b>{r.value}</b></div>)}
                </div>
              );
            case 'msg': {
              if (item.from === 'customer') {
                return (
                  <div key={item.id} className="msg-row out">
                    <div className="msg-col">
                      <div className="bubble">{item.text}</div>
                      <div className="bubble-time">{item.time}</div>
                    </div>
                  </div>
                );
              }
              const agent = item.from === 'agent';
              return (
                <div key={item.id} className="msg-row in">
                  <div className={`bubble-avatar${agent ? ' agent' : ''}`}>{agent ? AGENT.initials : shopBadge}</div>
                  <div className="msg-col">
                    {agent && <span className="agent-flag">👩‍💼 {AGENT.name} — Nhân viên CSKH</span>}
                    {item.flag === 'ai' && <span className="ai-flag">🤖 Trả lời tự động</span>}
                    {item.flag === 'personal' && <span className="highlight-tag">✨ Gợi ý cá nhân hóa dành riêng cho {CUSTOMER.call}</span>}
                    <div className={`bubble${item.flag === 'personal' ? ' highlight-bubble' : ''}`}>{item.text}</div>
                    <div className="bubble-time">{item.time}</div>
                  </div>
                </div>
              );
            }
          }
        })}

        {typing && (
          <div className="msg-row in">
            <div className={`bubble-avatar${typing === 'agent' ? ' agent' : ''}`}>{typing === 'agent' ? AGENT.initials : shopBadge}</div>
            <div className="msg-col">
              <div className="bubble typing" aria-label="Đang soạn tin"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {quickReplies.length > 0 && !typing && (
          <div className="widget-quick-replies">
            {quickReplies.map((q) => (
              <button key={q} className="quick-reply" onClick={() => send(q)} disabled={busy}>{q}</button>
            ))}
          </div>
        )}
      </div>

      <div className="widget-footer">
        <form className="widget-input-row" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAgent ? `Nhắn cho ${AGENT.name}...` : 'Nhập tin nhắn...'}
            aria-label="Nội dung tin nhắn"
          />
          <button className="widget-send" type="submit" disabled={busy || !input.trim()} aria-label="Gửi">
            <IconSend />
          </button>
        </form>
        <div className="powered-by">Vận hành bởi <b>Tendly</b></div>
      </div>
    </div>
  );
}
