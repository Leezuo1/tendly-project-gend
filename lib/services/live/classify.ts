/**
 * Phân loại bình luận livestream bằng luật — không gọi AI, nên chạy được với hàng nghìn bình luận/phiên.
 * AI chỉ dùng cho phần luật không hiểu (xem engine.ts).
 */
import { normalize } from '@/lib/utils/format';
import type { AiKnowledge } from '@/lib/types/ai';
import type { LiveIntent } from '@/lib/types/live';

export type LiveProduct = AiKnowledge['products'][number];

export interface Classified {
  intent: LiveIntent;
  sku: string | null;
  color: string | null;
  size: string | null;
  qty: number | null;
}

// Viết tắt hay gặp trên live → dạng đầy đủ (đã bỏ dấu)
const ABBREVIATIONS: Record<string, string> = {
  sz: 'size', ko: 'khong', k: 'khong', kh: 'khong', hok: 'khong', hong: 'khong', khg: 'khong',
  bn: 'bao nhieu', bnh: 'bao nhieu', bnhiu: 'bao nhieu', bnhieu: 'bao nhieu',
  ib: 'inbox', inb: 'inbox', dc: 'duoc', dk: 'duoc', sp: 'san pham', sdt: 'so dien thoai',
  hn: 'ha noi', sg: 'sai gon', hcm: 'sai gon', mn: 'moi nguoi', ad: 'shop', sh: 'shop',
};

/** Bỏ dấu, chữ thường, mở rộng viết tắt; luôn có khoảng trắng 2 đầu để dò theo cụm từ. */
export function liveText(text: string): string {
  const words = normalize(text).split(' ').filter(Boolean).map((w) => ABBREVIATIONS[w] ?? w);
  return ` ${words.join(' ')} `;
}

const has = (t: string, phrases: string[]) => phrases.some((p) => t.includes(` ${p} `));

const COMPLAINT = ['lua dao', 'te qua', 'that vong', 'buc minh', 'hang loi', 'bi loi', 'san pham loi', 'bi hong', 'hu hong',
  'khong nhan duoc', 'chua nhan duoc hang', 'chua nhan hang', 'giao cham', 'cham qua', 'khieu nai', 'chat luong kem',
  'kem chat luong', 'sai hang', 'giao sai', 'thieu hang', 'boc phot'];
const RETURN = ['doi tra', 'doi hang', 'tra hang', 'doi size', 'doi mau', 'hoan hang', 'hoan tien', 'doi sang'];
// Tránh từ một âm tiết dễ nhầm khi bỏ dấu: "dat" (đặt/đắt), "mua" (mua/mùa), "cho em" (cho em hỏi/xem)
const ORDER = ['chot', 'chot don', 'lay', 'dat hang', 'dat mua', 'dat 1', 'dat 2', 'muon mua', 'em mua', 'minh mua', 'mua 1',
  'mua 2', 'mua nha', 'gui cho', 'ship cho', 'len don', 'giu cho', 'giu hang'];
const PRICE = ['gia', 'bao nhieu', 'xin gia', 'inbox', 'bao tien', 'nhieu tien', 'price', 'gia sao', 'gia nhieu'];
const STOCK = ['con hang', 'con khong', 'het hang', 'con size', 'con mau', 'con ko', 'con nua khong', 'con nhieu khong', 'het chua'];
const VIEW = ['xem', 'len mau', 'cho xem', 'soi', 'zoom', 'quay', 'mac thu', 'thu', 'xem mau', 'xem lai', 'cho coi', 'coi'];
const SHIPPING = ['ship', 'cod', 'phi ship', 'van chuyen', 'giao hang', 'bao lau', 'may ngay', 'freeship', 'free ship'];
const QUESTION = ['khong', 'sao', 'the nao', 'nhu nao', 'nao', 'gi', 'chua', 'duoc khong', 'co khong', 'shop oi'];
const GENERIC_SIZES = ['xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', 'free size', 'freesize'];

const BODY = /\b\d{2,3}\s?kg\b|\b1m\d{1,2}\b|\b\d{2,3}\s?cm\b/;
const ADVICE = ['mac size', 'size nao', 'size gi', 'mac vua', 'tu van', 'mac duoc khong', 'vua khong', 'can nang', 'chieu cao'];

/** SKU "AT-01" khớp "at01", "at 01", "AT-01", "#AT01". */
function skuForms(sku: string): string[] {
  const spaced = normalize(sku);
  const compact = spaced.replace(/\s+/g, '');
  return [...new Set([spaced, compact].filter((f) => f.length >= 2))];
}

/** Bỏ chữ thương hiệu ra khỏi tên để dò theo tên sản phẩm (vd "Áo thun basic cotton Tendly" → "ao thun basic cotton"). */
function nameForm(name: string, shopName: string): string {
  const brand = normalize(shopName);
  return normalize(name).split(' ').filter((w) => w && w !== brand).join(' ');
}

export function findProduct(t: string, products: LiveProduct[], shopName = ''): LiveProduct | null {
  // Ưu tiên SKU (chính xác nhất), sau đó tên đầy đủ (từ 2 từ trở lên, tên dài khớp trước)
  for (const p of products) if (skuForms(p.sku).some((f) => t.includes(` ${f} `))) return p;
  const byName = products
    .map((p) => ({ p, name: nameForm(p.name, shopName) }))
    .filter(({ name }) => name.split(' ').length >= 2)
    .sort((a, b) => b.name.length - a.name.length);
  return byName.find(({ name }) => t.includes(` ${name} `))?.p ?? null;
}

function findOption(t: string, options: string[]): string | null {
  // Lựa chọn dài khớp trước ("xanh navy" trước "xanh")
  const sorted = [...options].sort((a, b) => normalize(b).length - normalize(a).length);
  return sorted.find((o) => normalize(o) && t.includes(` ${normalize(o)} `)) ?? null;
}

function findQty(t: string): number | null {
  const m = /\bx\s?(\d{1,2})\b/.exec(t) ?? /\b(\d{1,2})\s?(cai|chiec|bo|san pham|ao|dam|quan|vay|set)\b/.exec(t)
    ?? /\bsl\s?(\d{1,2})\b/.exec(t) ?? /\b(?:lay|chot|dat|mua)\s(\d{1,2})\b/.exec(t);
  const qty = m ? Number(m[1]) : null;
  return qty && qty > 0 && qty <= 50 ? qty : null;
}

/**
 * @param onAir mẫu shop đang giới thiệu — bình luận ngắn như "1", "chốt M trắng", "giá bn" được gán cho mẫu này.
 */
export function classifyLiveComment(
  text: string, products: LiveProduct[], onAir: LiveProduct | null = null, shopName = '',
): Classified {
  // Ý định dò trên chữ đã mở rộng viết tắt; sản phẩm/màu/size dò trên chữ gốc đã bỏ dấu,
  // vì viết tắt có thể trùng tên màu (vd "hong" = "không" nhưng cũng là màu "Hồng")
  const raw = ` ${normalize(text)} `;
  const mentioned = findProduct(raw, products, shopName);
  const product = mentioned ?? onAir;
  const color = product ? findOption(raw, product.colors) : null;
  const size = product ? findOption(raw, product.sizes.length ? product.sizes : GENERIC_SIZES) : findOption(raw, GENERIC_SIZES);
  const qty = findQty(raw);
  const t = liveText(color ? raw.replace(` ${normalize(color)} `, ' ') : raw);
  const words = t.trim().split(' ').filter(Boolean);
  const isQuestion = text.includes('?') || has(t, QUESTION);
  const out = (intent: LiveIntent, p: LiveProduct | null = product): Classified => ({
    intent, sku: p?.sku ?? null, color: p ? color : null, size, qty: intent === 'order' ? (qty ?? 1) : qty,
  });

  if (!raw.trim()) return out('other', null);
  if (has(t, COMPLAINT)) return out('complaint');
  if (has(t, RETURN)) return out('return');
  // Hỏi tư vấn size trước khi xét "chốt/lấy" vì "lấy size nào hợp" là câu hỏi, không phải chốt đơn
  if (BODY.test(t) || has(t, ADVICE)) return out('size_advice');
  // Quy ước live: chỉ bình luận một con số ("1", "+1", "2") nghĩa là muốn chốt
  if (words.length === 1 && /^\d{1,2}$/.test(words[0])) return out('order');
  if (has(t, ORDER) && !(isQuestion && !qty && !size && !color)) return out('order');
  if (has(t, STOCK)) return out('stock');
  if (has(t, PRICE)) return out('price');
  if (has(t, SHIPPING)) return out('shipping');
  if (has(t, VIEW)) return out('view', mentioned ?? onAir);
  // "M trắng", "size L" không kèm chữ chốt vẫn là chốt mẫu đang lên sóng
  if (product && (size || color) && words.length <= 4 && !isQuestion) return out('order');
  if (isQuestion) return out('question', mentioned);
  return out('other', mentioned);
}

/** Ý định cần nhắn riêng cho khách (gom nhóm để shop duyệt). */
export const REPLY_INTENTS: LiveIntent[] = ['order', 'price', 'size_advice', 'stock', 'view', 'shipping', 'return', 'complaint', 'question'];
/** Nhóm cần shop tự viết/duyệt kỹ, không gửi câu mẫu tự động. */
export const HUMAN_INTENTS: LiveIntent[] = ['complaint', 'return'];

export function groupKeyOf(c: Classified, stockOk = true): string | null {
  if (!REPLY_INTENTS.includes(c.intent)) return null;
  if (c.intent === 'order' && !stockOk) return `order_out:${c.sku ?? '-'}`;
  return `${c.intent}:${c.sku ?? '-'}`;
}
