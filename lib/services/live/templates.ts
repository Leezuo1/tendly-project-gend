/**
 * Câu trả lời mẫu cho từng nhóm bình luận — điền giá/tồn kho từ dữ liệu shop, không gọi AI.
 * Không bịa thông tin shop chưa khai báo (phí ship, chính sách đổi trả lấy từ FAQ nếu có).
 */
import { normalize, formatMoney } from '@/lib/utils/format';
import type { AiKnowledge } from '@/lib/types/ai';
import type { LiveIntent } from '@/lib/types/live';
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
export function groupTemplate(intent: LiveIntent, product: LiveProduct | null, knowledge: AiKnowledge, outOfStock = false): TemplateResult {
  if (PRODUCT_INTENTS.includes(intent) && !product) {
    // Chưa biết khách hỏi mẫu nào: shop chọn "mẫu đang lên sóng" hoặc tự trả lời
    return { text: 'Dạ {ten_khach} ơi, bạn đang hỏi mẫu nào ạ? Bạn gửi shop tên hoặc mã sản phẩm để shop báo giá và giữ hàng nha 💕', needsHuman: true };
  }
  switch (intent) {
    case 'order':
      return outOfStock
        ? { text: 'Dạ {ten_khach} ơi, tiếc quá {san_pham} vừa hết hàng rồi ạ 😢 Shop gợi ý mẫu {goi_y} cũng rất xinh, bạn muốn xem không ạ?', needsHuman: false }
        : { text: 'Dạ shop đã giữ {san_pham} {mau} {size} x{so_luong} ({gia}) cho {ten_khach} rồi ạ. Bạn gửi giúp shop SĐT + địa chỉ nhận hàng để shop lên đơn nha 💕', needsHuman: false };
    case 'price':
      return { text: 'Dạ {ten_khach} ơi, {san_pham} giá {gia}, shop còn {con_lai} sản phẩm (size {ds_size}, màu {ds_mau}). Bạn ưng size/màu nào nhắn shop giữ hàng liền nha 💕', needsHuman: false };
    case 'stock':
      return { text: 'Dạ {san_pham} hiện còn {con_lai} sản phẩm ạ (size {ds_size}, màu {ds_mau}). Bạn chốt size/màu nào shop giữ cho mình nha!', needsHuman: false };
    case 'view':
      return { text: 'Dạ shop lên mẫu {san_pham} ngay đây ạ, {ten_khach} xem live nha. Giá {gia}, còn {con_lai} sản phẩm 💕', needsHuman: false };
    case 'size_advice':
      return { text: 'Dạ {san_pham} có size {ds_size} ạ. Bạn cho shop xin chiều cao + cân nặng, shop tư vấn size vừa nhất cho {ten_khach} nha!', needsHuman: false };
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
