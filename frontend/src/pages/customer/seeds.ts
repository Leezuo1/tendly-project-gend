import { CUSTOMER, LAST_ORDER } from '../../mocks/customer';
import { snapshot } from '../../services/api';
import type { ChatSeed } from './ChatWidget';

const productIdBySku = (sku: string) => snapshot.products().find((p) => p.sku === sku)?.id ?? null;

/** Hội thoại mẫu: hôm qua khách hỏi áo size L, hôm nay AI nhắn gợi ý cá nhân hoá */
export function chatSeed(): ChatSeed {
  return {
    mode: 'bot',
    ctx: { productId: productIdBySku(LAST_ORDER.productSku), size: 'L', color: null },
    quickReplies: ['Chốt đơn ngay', 'Hỏi thêm màu khác', 'Để sau'],
    items: [
      { kind: 'divider', id: 'd1', label: 'Hôm qua' },
      { kind: 'msg', id: 'm1', from: 'bot', time: '09:10', text: 'Chào chị 👋 Tendly có thể hỗ trợ gì cho chị ạ?' },
      { kind: 'msg', id: 'm2', from: 'customer', time: '09:14', text: 'Áo này size L còn không shop, ship về Hà Nội mấy ngày vậy ạ?' },
      { kind: 'msg', id: 'm3', from: 'bot', flag: 'ai', time: '09:14', text: 'Dạ mình còn hàng size L nè chị ơi 🎉 Ship về Hà Nội mất 1–2 ngày làm việc ạ. Chị có cần mình tư vấn thêm màu nào không ạ?' },
      { kind: 'msg', id: 'm4', from: 'customer', time: '09:16', text: 'Dạ để em coi thêm nha, cảm ơn shop' },
      { kind: 'divider', id: 'd2', label: 'Hôm nay' },
      { kind: 'msg', id: 'm5', from: 'bot', flag: 'personal', time: '08:30', text: `Chị ${CUSTOMER.name} ơi, áo mà chị hỏi hôm qua (size L) đang còn hàng nè 🥰 Mình để dành hàng cho chị tới hết hôm nay thôi ạ, chị chốt giúp mình nha!` },
    ],
  };
}

/** Hội thoại mẫu: khách bức xúc → AI phát hiện cảm xúc âm → chuyển cho nhân viên Thu Hà */
export function handoffSeed(): ChatSeed {
  return {
    mode: 'agent',
    ctx: { productId: productIdBySku(LAST_ORDER.productSku), size: 'L', color: null },
    quickReplies: ['Đồng ý đổi hàng', 'Xin hoàn tiền thay vì đổi'],
    items: [
      { kind: 'divider', id: 'd1', label: 'Hôm nay' },
      { kind: 'msg', id: 'm1', from: 'customer', time: '14:02', text: 'Áo em nhận hôm qua bị lỗi chỉ may ở tay áo, đây là lần thứ 2 shop giao hàng lỗi rồi đó, em thất vọng quá' },
      { kind: 'msg', id: 'm2', from: 'bot', flag: 'ai', time: '14:02', text: 'Dạ Tendly thành thật xin lỗi vì trải nghiệm không tốt này ạ. Để đảm bảo hỗ trợ chị nhanh và chính xác nhất, mình xin phép chuyển chị đến nhân viên hỗ trợ nhé ạ 🙏' },
      { kind: 'system', id: 's1', text: 'Đã phát hiện cảm xúc tiêu cực — ưu tiên chuyển tiếp ngay' },
      { kind: 'handoff', id: 'h1', agent: 'Thu Hà' },
      {
        kind: 'context', id: 'c1', agent: 'Thu Hà',
        rows: [
          { label: 'Đơn hàng', value: `${LAST_ORDER.code} · ${LAST_ORDER.item}` },
          { label: 'Vấn đề', value: 'Lỗi may tay áo · Lần lỗi thứ 2' },
          { label: 'Cảm xúc khách hàng', value: 'Tiêu cực' },
        ],
      },
      { kind: 'msg', id: 'm3', from: 'agent', time: '14:03', text: `Chào chị, em là Hà bên Tendly. Em xem lại đơn ${LAST_ORDER.code} của chị rồi ạ, thực sự xin lỗi chị vì lỗi may lần này. Em xử lý đổi hàng mới + gửi kèm phần hỗ trợ ngay cho chị nha, chị chờ em 1 phút ạ.` },
    ],
  };
}
