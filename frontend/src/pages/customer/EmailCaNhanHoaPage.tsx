import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmailBody } from '../../components/EmailBody';
import { IconCopy } from '../../components/Icons';
import { useShop } from '../../components/ShopContext';
import { useToast } from '../../components/Toast';
import { CUSTOMER, LAST_ORDER } from '../../mocks/customer';
import { snapshot } from '../../services/api';
import { fillTemplate, renderBody, sampleContext } from '../../services/emailTemplate';
import { formatMoney, initials } from '../../utils/format';
import { CustomerPreview } from './CustomerPreview';

type MailKind = 'personal' | 'promo' | 'order';
interface Mail { id: MailKind; subject: string; preview: string; time: string }

const PROMO_CODE = 'CUOITUAN15';
const SHIPPING_FEE = 25000;

export default function EmailCaNhanHoaPage() {
  const shop = useShop();
  const toast = useToast();
  const [session, setSession] = useState(0);
  const [activeId, setActiveId] = useState<MailKind>('personal');
  const [unread, setUnread] = useState<Set<MailKind>>(() => new Set(['promo']));
  const [orderState, setOrderState] = useState<'idle' | 'loading' | { code: string }>('idle');

  // đọc lại template mỗi lần làm mới để thấy chỉnh sửa từ trang Cấu hình AI
  const { trigger, ctx } = useMemo(() => {
    const product = snapshot.products().find((p) => p.sku === LAST_ORDER.productSku) ?? null;
    return { trigger: snapshot.trigger('ask-no-order'), ctx: sampleContext(product) };
  }, [session]);

  const personalSubject = fillTemplate(trigger.subject, ctx);
  const personalPreview = renderBody(trigger.body, ctx).find((b, i) => i > 0 && b.type === 'p');

  const mails: Mail[] = [
    {
      id: 'personal', subject: personalSubject, time: '10 phút',
      preview: personalPreview?.type === 'p' ? personalPreview.text : '',
    },
    { id: 'promo', subject: 'Ưu đãi cuối tuần — giảm 15% toàn shop', preview: 'Duy nhất trong 2 ngày, áp dụng cho mọi đơn hàng...', time: '3 ngày' },
    { id: 'order', subject: `Xác nhận đơn hàng ${LAST_ORDER.code}`, preview: `Cảm ơn ${CUSTOMER.call} đã đặt hàng tại ${shop.name}...`, time: '2 tuần' },
  ];
  const active = mails.find((m) => m.id === activeId)!;

  const select = (id: MailKind) => {
    setActiveId(id);
    setUnread((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const reset = () => {
    setSession((s) => s + 1);
    setActiveId('personal');
    setUnread(new Set(['promo']));
    setOrderState('idle');
  };

  const placeOrder = () => {
    setOrderState('loading');
    setTimeout(() => setOrderState({ code: `#TD-${10300 + Math.floor(Math.random() * 600)}` }), 1200);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      toast(`Đã sao chép mã ${PROMO_CODE}`);
    } catch {
      toast(`Mã của bạn: ${PROMO_CODE}`, 'info');
    }
  };

  const badge = {
    personal: <div className="mail-badge">✨ Gợi ý cá nhân hóa từ {shop.name}</div>,
    promo: <div className="mail-badge promo">🎁 Khuyến mãi</div>,
    order: <div className="mail-badge order">📦 Đơn hàng</div>,
  }[active.id];

  const shopBadge = initials(shop.name);

  return (
    <CustomerPreview
      variant="mail"
      note="Xem trước: email cá nhân hóa khách hàng nhận được trong hộp thư — góc nhìn của khách hàng"
      onReset={reset}
    >
      <div className="mail-shell">
        <div className="mail-list-pane">
          <div className="mail-list-head">
            Hộp thư đến
            {unread.size > 0 && <span className="count">{unread.size} chưa đọc</span>}
          </div>
          <div className="mail-list">
            {mails.map((m) => (
              <button
                key={m.id}
                className={`mail-item${m.id === activeId ? ' active' : ''}${unread.has(m.id) ? ' unread' : ''}`}
                onClick={() => select(m.id)}
              >
                <div className={`mail-avatar${m.id === 'personal' ? '' : ' muted'}`}>{shopBadge}</div>
                <div className="mail-item-body">
                  <div className="mail-item-top"><span className="mail-sender">{shop.name}</span><span className="mail-time">{m.time}</span></div>
                  <div className="mail-subject">{m.subject}</div>
                  <div className="mail-preview">{m.preview}</div>
                </div>
                {unread.has(m.id) && <div className="unread-dot" />}
              </button>
            ))}
          </div>
        </div>

        <div className="mail-detail" key={active.id}>
          <div className="mail-detail-head">
            {badge}
            <div className="mail-subject-lg">{active.subject}</div>
            <div className="mail-meta-row">
              <div className="mail-meta-avatar">{shopBadge}</div>
              <div className="mail-meta-text">
                <div className="from">{shop.name} &lt;{shop.email}&gt;</div>
                <div className="to">Đến: {CUSTOMER.email}</div>
              </div>
              <div className="mail-meta-time">{active.time} trước</div>
            </div>
          </div>

          <div className="mail-body">
            {active.id === 'personal' && (
              <>
                <EmailBody body={trigger.body} ctx={ctx} />
                {typeof orderState === 'object' ? (
                  <>
                    <button className="btn-cta done" disabled>✓ Đã chốt đơn {orderState.code}</button>
                    <div className="cta-note">
                      {shop.name} đã giữ hàng cho {CUSTOMER.call}! Shop sẽ gọi số điện thoại của {CUSTOMER.call} để xác nhận địa chỉ giao hàng trong ít phút 💕
                    </div>
                  </>
                ) : (
                  <button className="btn-cta" onClick={placeOrder} disabled={orderState === 'loading'}>
                    {orderState === 'loading' && <span className="spinner" />}
                    {orderState === 'loading' ? 'Đang giữ hàng...' : 'Chốt đơn ngay'}
                  </button>
                )}
              </>
            )}

            {active.id === 'promo' && (
              <>
                <p>Chào {CUSTOMER.call} {CUSTOMER.name},</p>
                <p>Cuối tuần này {shop.name} giảm <b>15% toàn bộ sản phẩm</b>, áp dụng cho mọi đơn hàng, không giới hạn số lượng. Ưu đãi chỉ kéo dài 2 ngày thôi nha!</p>
                <div className="coupon-box">
                  <div>
                    <div className="coupon-code">{PROMO_CODE}</div>
                    <div className="coupon-sub">Nhập mã khi thanh toán · HSD: Chủ nhật này</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={copyCode}><IconCopy width={14} height={14} />Sao chép</button>
                </div>
                <Link className="btn-cta" to="/khach-hang/chat">Mua sắm ngay</Link>
              </>
            )}

            {active.id === 'order' && (
              <>
                <p>Cảm ơn {CUSTOMER.call} đã đặt hàng tại {shop.name}! Đơn hàng <b>{LAST_ORDER.code}</b> đã được giao thành công.</p>
                <div className="order-steps">
                  {['Đã đặt', 'Đã xác nhận', 'Đang giao', 'Đã nhận'].map((s) => (
                    <div key={s} className="order-step done"><div className="bar" />{s}</div>
                  ))}
                </div>
                <table className="order-table">
                  <tbody>
                    <tr><td>{LAST_ORDER.item}, màu {LAST_ORDER.color} × 1</td><td>{formatMoney(LAST_ORDER.price)}</td></tr>
                    <tr><td>Phí vận chuyển</td><td>{formatMoney(SHIPPING_FEE)}</td></tr>
                    <tr className="total"><td>Tổng cộng (COD)</td><td>{formatMoney(LAST_ORDER.price + SHIPPING_FEE)}</td></tr>
                  </tbody>
                </table>
                <p>Giao đến: {CUSTOMER.fullName} · {CUSTOMER.city}</p>
                <Link className="btn-cta" to="/khach-hang/chuyen-tiep">Cần hỗ trợ đơn này?</Link>
              </>
            )}

            <div className="mail-sign">Thân mến,<br />Team {shop.name} 💕</div>
          </div>
        </div>
      </div>
    </CustomerPreview>
  );
}
