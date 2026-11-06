/**
 * Câu trả lời mẫu cho từng nhóm bình luận — điền giá/tồn kho từ dữ liệu shop, không gọi AI.
 * Không bịa thông tin shop chưa khai báo (phí ship, chính sách đổi trả lấy từ FAQ nếu có).
 */
import { normalize, formatMoney } from '@/lib/utils/format';
import type { AiKnowledge } from '@/lib/types/ai';
import type { LiveIntent, LivePreparation } from '@/lib/types/live';
import type { LiveProduct } from '@/lib/services/live/classify';

export interface TemplateResult {
  text: string;
  needsHuman: boolean;
}

function faqAnswer(knowledge: AiKnowledge, phrases: string[]): string | null {
  const faq = knowledge.faqs.find((f) => {
    const t = ` ${normalize([f.question, f.tag, ...f.keywords].join(' '))} `;
    return phrases.some((p) => t.includes(` ${p} `));
  });
  return faq ? faq.answer.trim() : null;
}

const PRODUCT_INTENTS: LiveIntent[] = ['order', 'price', 'stock', 'view', 'size_advice'];

/** Câu mẫu của nhóm; placeholder được điền riêng cho từng khách lúc gửi (fillTemplate). */
export function groupTemplate(intent: LiveIntent, product: LiveProduct | null, knowledge: AiKnowledge, outOfStock = false, preparation?: LivePreparation | null): TemplateResult {
  if (PRODUCT_INTENTS.includes(intent) && !product) {
    // Chưa biết khách hỏi mẫu nào: shop chọn "mẫu đang lên sóng" hoặc tự trả lời
    return { text: 'Dạ {ten_khach} ơi, bạn đang hỏi mẫu nào ạ? Bạn gửi shop tên hoặc mã sản phẩm để shop báo giá và giữ hàng nha 💕', needsHuman: true };
  }
  switch (intent) {
    case 'order':
      return outOfStock
        ? { text: 'Dạ {ten_khach} ơi, tiếc quá {san_pham} vừa hết hàng rồi ạ 😢 Shop gợi ý mẫu {goi_y} cũng rất xinh, bạn muốn xem không ạ?', needsHuman: false }
        : { text: `Dạ shop ghi nhận yêu cầu {san_pham} {mau} {size} x{so_luong} ({gia}) của {ten_khach}. Shop kiểm tra tồn size/màu trước khi xác nhận. Bạn gửi giúp shop ${preparation?.receivingFields || 'SĐT + địa chỉ nhận hàng'} nhé.`, needsHuman: !!product?.sizes.length || !!product?.colors.length };
    case 'price':
      return { text: 'Dạ {ten_khach} ơi, {san_pham} giá {gia}, lượng còn trong phiên là {con_lai}. Shop kiểm tra size/màu bạn chọn trước khi xác nhận nhé.', needsHuman: false };
    case 'stock':
      return { text: 'Dạ {san_pham} còn {con_lai} theo lượng trong phiên. Bạn cần size/màu nào để shop kiểm tra trước khi xác nhận?', needsHuman: !!product?.sizes.length || !!product?.colors.length };
    case 'view':
      return { text: 'Dạ shop đã ghi nhận bạn muốn xem {san_pham}. Host sẽ kiểm tra để giới thiệu; giá {gia}.', needsHuman: false };
    case 'size_advice': {
      const entry = preparation?.catalog.find(item => item.sku === product?.sku);
      return entry?.sizeChart && entry.sizeSource
        ? { text: `Bảng size tham khảo của {san_pham}: ${entry.sizeChart}. Nguồn: ${entry.sizeSource}.${entry.fit ? ` Form dáng: ${entry.fit}.` : ''} Bạn gửi số đo để shop đối chiếu, chưa thể đảm bảo vừa.`, needsHuman: false }
        : { text: 'Dạ shop chưa có bảng size có nguồn cho {san_pham}. Bạn gửi số đo, shop nhờ người phụ trách kiểm tra trước khi tư vấn nhé.', needsHuman: true };
    }
    case 'shipping': {
      const answer = faqAnswer(knowledge, ['ship', 'giao hang', 'van chuyen', 'cod', 'phi ship']);
      return answer
        ? { text: `Dạ {ten_khach} ơi, ${answer}`, needsHuman: false }
        : { text: 'Dạ {ten_khach} ơi, bạn ở tỉnh/thành nào ạ? Shop báo phí ship và thời gian giao cho mình nha.', needsHuman: true };
    }
    case 'return': {
      const answer = faqAnswer(knowledge, ['doi tra', 'doi hang', 'tra hang', 'hoan tien', 'bao hanh']);
      return { text: `Dạ {ten_khach} ơi, ${answer ? `${answer} ` : ''}Bạn gửi shop mã đơn và ảnh sản phẩm, shop kiểm tra điều kiện đổi trả cho mình ngay nha.`, needsHuman: true };
    }
    case 'complaint':
      return { text: 'Dạ shop rất xin lỗi {ten_khach} vì trải nghiệm chưa tốt ạ. Bạn gửi giúp shop mã đơn và hình ảnh, shop kiểm tra và xử lý ngay cho mình nha.', needsHuman: true };
    case 'question':
      return { text: 'Dạ {ten_khach} ơi, shop nhắn riêng giải đáp cho mình nha ạ.', needsHuman: true };
    default:
      return { text: '', needsHuman: true };
  }
}

export interface FillContext {
  customerName: string;
  product: LiveProduct | null;
  color: string | null;
  size: string | null;
  qty: number | null;
  remaining: number | null;
  suggestion: string | null;
}

/** Điền placeholder cho một khách; thiếu dữ liệu thì bỏ trống gọn gàng thay vì in "{size}". */
export function fillTemplate(template: string, ctx: FillContext): string {
  const p = ctx.product;
  const values: Record<string, string> = {
    ten_khach: ctx.customerName.trim() || 'bạn',
    san_pham: p ? p.name : '',
    mau: ctx.color ?? '',
    size: ctx.size ? `size ${ctx.size}` : '',
    so_luong: String(ctx.qty ?? 1),
    gia: p ? formatMoney(p.price) : '',
    con_lai: ctx.remaining === null ? '' : String(Math.max(0, ctx.remaining)),
    ds_size: p?.sizes.length ? p.sizes.join(', ') : 'free size',
    ds_mau: p?.colors.length ? p.colors.join(', ') : 'như hình',
    goi_y: ctx.suggestion ?? 'khác',
  };
  return template
    .replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? values[key] : all))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** Mẫu cùng danh mục còn hàng để gợi ý khi khách chốt mẫu đã hết. */
export function suggestAlternative(product: LiveProduct | null, products: LiveProduct[], remainingOf: (sku: string) => number): string | null {
  if (!product) return null;
  const alt = products.find((p) => p.sku !== product.sku && p.category === product.category && remainingOf(p.sku) > 0)
    ?? products.find((p) => p.sku !== product.sku && remainingOf(p.sku) > 0);
  return alt ? `${alt.name} (${alt.sku})` : null;
}

const QUESTION_TITLE: Partial<Record<LiveIntent, (name: string) => string>> = {
  price: (n) => `${n} giá bao nhiêu?`,
  stock: (n) => `${n} còn hàng không?`,
  view: (n) => `Cho xem mẫu ${n}`,
  size_advice: (n) => `${n} mặc size nào vừa?`,
  order: (n) => `Chốt đơn ${n}`,
};

/**
 * Câu hỏi đại diện của nhóm để hiện trên cửa sổ Trợ lý Live: có sản phẩm thì dùng câu chuẩn ("Đầm voan giá bao nhiêu?"),
 * không thì lấy bình luận rõ nghĩa nhất trong nhóm (dài nhất nhưng không quá 120 ký tự).
 */
export function groupQuestion(intent: LiveIntent, productName: string | null, samples: string[]): string {
  const title = productName ? QUESTION_TITLE[intent] : undefined;
  if (title && productName) return title(productName);
  const best = [...samples].map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && s.length <= 120)
    .sort((a, b) => b.length - a.length)[0] ?? samples[0]?.slice(0, 120) ?? '';
  if (!best) return 'Câu hỏi của khách';
  const text = best.charAt(0).toUpperCase() + best.slice(1);
  return /[?!.]$/.test(text) || intent === 'complaint' ? text : `${text}?`;
}

/** Phàn nàn / đổi trả: tiêu đề cảnh báo và gợi ý shop nói ngay trên live (lấy chính sách từ FAQ, không bịa). */
export function groupAlert(intent: LiveIntent, people: number, samples: string[], knowledge: AiKnowledge): { title: string; tip: string } | null {
  if (intent !== 'complaint' && intent !== 'return') return null;
  const text = ` ${normalize(samples.join(' '))} `;
  if (intent === 'return') {
    const policy = faqAnswer(knowledge, ['doi tra', 'doi hang', 'tra hang', 'hoan tien', 'bao hanh']);
    return { title: `${people} khách hỏi đổi trả`, tip: policy ? `Nhắc lại chính sách trên live: ${policy}` : 'Mời khách nhắn riêng mã đơn và ảnh sản phẩm để shop kiểm tra đổi trả.' };
  }
  const shipping = /\s(giao|ship|cham|chua nhan|van chuyen)/.test(text);
  if (shipping) {
    const policy = faqAnswer(knowledge, ['ship', 'giao hang', 'van chuyen', 'phi ship']);
    return { title: `${people} khách phàn nàn giao hàng chậm`,
      tip: policy ? `Xin lỗi khách và nói rõ: ${policy}` : 'Xin lỗi khách, hứa kiểm tra đơn và nhắn riêng ngay sau live.' };
  }
  const quality = /\s(loi|hong|rach|chat luong|sai hang|thieu)/.test(text);
  return { title: `${people} khách phàn nàn${quality ? ' về chất lượng sản phẩm' : ''}`,
    tip: 'Xin lỗi khách trên live, mời khách nhắn riêng mã đơn và ảnh để shop xử lý ngay sau phiên.' };
}
