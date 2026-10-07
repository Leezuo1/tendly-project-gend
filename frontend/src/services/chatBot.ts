/**
 * "AI" giả lập cho khung chat: so khớp từ khoá với FAQ + danh mục sản phẩm trong mock DB.
 * Khi có backend, thay botReply/agentReply bằng lời gọi API tới model thật.
 */
import { LAST_ORDER } from '../mocks/customer';
import type { Faq, Product } from '../types';
import { formatMoney, normalize } from '../utils/format';

export interface ConversationCtx {
  productId: string | null;
  size: string | null;
  color: string | null;
}

export interface BotReply {
  text: string;
  quickReplies: string[];
  ctx: ConversationCtx;
  handoff?: 'negative' | 'request';
  matchedFaq?: Faq;
}

/** so khớp nguyên cụm từ (đã bỏ dấu) */
const has = (t: string, phrase: string) => ` ${t} `.includes(` ${phrase} `);
const hasAny = (t: string, phrases: string[]) => phrases.some((p) => has(t, p));

const NEGATIVE = [
  'bi loi', 'hang loi', 'loi may', 'loi chi', 'giao loi', 'that vong', 'buc minh', 'buc qua', 'buc boi',
  'te qua', 'qua te', 'lua dao', 'kho chiu', 'chan qua', 'qua chan', 'tuc gian', 'khong hai long',
  'kem chat luong', 'hoan tien', 'phan nan', 'khieu nai', 'bi rach', 'hu hong', 'bi hu', 'giao sai', 'thieu hang',
];
const HUMAN = ['nhan vien', 'gap nguoi', 'nguoi that', 'tu van vien', 'admin', 'chu shop'];
const STOP = new Set([
  'shop', 'khong', 'bao', 'nhieu', 'the', 'nao', 'duoc', 'cho', 'minh', 'toi', 'chi', 'anh', 'vay', 'nhu',
  'cua', 'san', 'pham', 'hang', 'nha', 'nhe', 'thi', 'khi', 'sao', 'tinh', 'oi', 'hay', 'co',
]);
// Từ trong tên sản phẩm dễ trùng với từ giao tiếp sau khi bỏ dấu (vậy→vay, dạ→da, thật→that...)
const GENERIC_NAME_WORDS = new Set([
  'ao', 'nu', 'cao', 'cap', 'tendly', 'in', 'chu', 'co', 'dang', 'form', 'vai', 'dai', 'tron', 'lung', 'mem',
  'day', 'mong', 'lop', 'hai', 'chinh', 'hang', 'vay', 'hop', 'tui', 'so', 'ong', 'tay', 'len', 'du', 'da',
  'bo', 'that', 'rong', 'tiec',
]);
const SIZE_PATTERN = /(?:^| )size (x{0,3}s|m|x{0,3}l|\d{2,3}|freesize)(?: |$)/;

export const emptyCtx = (): ConversationCtx => ({ productId: null, size: null, color: null });

export function detectNegative(text: string): boolean {
  return hasAny(normalize(text), NEGATIVE);
}

export function findProduct(t: string, products: Product[]): Product | null {
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const sku = normalize(p.sku);
    if (has(t, sku) || has(t, sku.replace(/\s/g, ''))) return p;
    const words = normalize(p.name).split(' ').filter((w) => w.length >= 2 && !GENERIC_NAME_WORDS.has(w));
    let score = words.filter((w) => has(t, w)).length;
    if (has(t, normalize(p.category))) score += 2;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 1 ? best : null;
}

export function matchFaq(text: string, faqs: Faq[]): Faq | null {
  const t = normalize(text);
  let best: Faq | null = null;
  let bestScore = 0;
  for (const f of faqs) {
    if (!f.active) continue;
    let score = 0;
    f.keywords.forEach((kw) => { if (kw.trim() && has(t, normalize(kw))) score += 3; });
    new Set(normalize(f.question).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)))
      .forEach((w) => { if (has(t, w)) score += 1; });
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= 2 ? best : null;
}

function extractSize(t: string): string | null {
  const m = t.match(SIZE_PATTERN);
  return m ? m[1].toUpperCase() : null;
}

function findColor(t: string, product: Product): string | null {
  return [...product.colors]
    .sort((a, b) => b.length - a.length)
    .find((c) => has(t, normalize(c))) ?? null;
}

const sizeOptions = (p: Product) => p.sizes.slice(0, 4).map((s) => `Size ${s}`);
const colorOptions = (p: Product) => p.colors.slice(0, 4).map((c) => `Màu ${c}`);
const singleSize = (p: Product) => (p.sizes.length === 1 ? p.sizes[0] : null);

function similarInStock(p: Product, products: Product[]) {
  return products.find((x) => x.id !== p.id && x.category === p.category && x.qty > 0) ?? null;
}

export function botReply(text: string, faqs: Faq[], products: Product[], ctx: ConversationCtx): BotReply {
  const t = normalize(text);

  if (hasAny(t, NEGATIVE)) {
    return {
      text: 'Dạ Tendly thành thật xin lỗi vì trải nghiệm không tốt này ạ. Để đảm bảo hỗ trợ chị nhanh và chính xác nhất, mình xin phép chuyển chị đến nhân viên hỗ trợ nhé ạ 🙏',
      quickReplies: [], ctx, handoff: 'negative',
    };
  }
  if (hasAny(t, HUMAN)) {
    return {
      text: 'Dạ chị chờ mình một chút, mình chuyển chị sang nhân viên tư vấn ngay nha 🙌',
      quickReplies: [], ctx, handoff: 'request',
    };
  }

  const mentioned = findProduct(t, products);
  const product = mentioned ?? products.find((p) => p.id === ctx.productId) ?? null;
  const sameProduct = !!product && product.id === ctx.productId;
  const askedSize = extractSize(t);
  const color = product ? findColor(t, product) : null;
  const next: ConversationCtx = {
    productId: product?.id ?? null,
    size: askedSize ?? (sameProduct ? ctx.size : null),
    color: color ?? (sameProduct ? ctx.color : null),
  };

  // ---- Xác nhận đặt hàng ----
  if (has(t, 'xac nhan dat hang') || has(t, 'xac nhan')) {
    if (!product) return { text: 'Dạ chị muốn đặt sản phẩm nào ạ? Chị gửi tên hoặc mã sản phẩm giúp mình nha 🥰', quickReplies: [], ctx: next };
    const size = next.size ?? singleSize(product);
    if (!size) return { text: `Dạ chị lấy ${product.name} size nào ạ?`, quickReplies: sizeOptions(product), ctx: next };
    const c = next.color ?? product.colors[0];
    const orderNo = `#TD-${10300 + Math.floor(Math.random() * 600)}`;
    return {
      text: `Dạ mình đã lên đơn ${orderNo} cho chị rồi nè 🎉 ${product.name} — Size ${size}, màu ${c}: ${formatMoney(product.price)}${product.price >= 300000 ? ' (được freeship)' : ''}. Shop sẽ gọi xác nhận trong ít phút, chị để ý điện thoại giúp mình nha 💕`,
      quickReplies: ['Thời gian giao hàng bao lâu?', 'Shop có giao COD không?'],
      ctx: { ...next, size, color: c },
    };
  }

  // ---- Muốn chốt đơn ----
  if (hasAny(t, ['chot don', 'dat hang', 'mua ngay', 'chot', 'lay luon', 'len don', 'dat mua'])) {
    if (!product) return { text: 'Dạ chị muốn chốt sản phẩm nào ạ? Chị gửi tên hoặc mã sản phẩm giúp mình nha 🥰', quickReplies: [], ctx: next };
    if (product.qty === 0) {
      const alt = similarInStock(product, products);
      return {
        text: `Dạ tiếc quá, ${product.name} vừa hết hàng mất rồi ạ 😢${alt ? ` Chị tham khảo ${alt.name} (${formatMoney(alt.price)}) đang còn hàng nha!` : ''}`,
        quickReplies: alt ? [`Xem ${alt.sku}`] : [], ctx: next,
      };
    }
    const size = next.size ?? singleSize(product);
    if (!size) return { text: `Dạ chị lấy ${product.name} size nào ạ?`, quickReplies: sizeOptions(product), ctx: next };
    const c = next.color ?? product.colors[0];
    return {
      text: `Dạ mình tóm tắt đơn cho chị nha: ${product.name} • Size ${size} • Màu ${c} • Giá ${formatMoney(product.price)}. Chị xác nhận để mình lên đơn liền ạ!`,
      quickReplies: ['Xác nhận đặt hàng', 'Đổi size/màu'],
      ctx: { ...next, size, color: c },
    };
  }

  // ---- Đổi size / màu trong lúc chốt đơn ----
  if (has(t, 'doi size mau') && product) {
    return {
      text: `Dạ ${product.name} có ${product.sizes.length > 1 ? `size ${product.sizes.join(', ')}` : product.sizes[0]} và các màu ${product.colors.join(', ')}. Chị chọn lại giúp mình nha 👇`,
      quickReplies: [...sizeOptions(product).slice(0, 3), ...colorOptions(product).slice(0, 2)],
      ctx: next,
    };
  }

  // ---- Hỏi màu ----
  if (product && has(t, 'mau') && hasAny(t, ['khac', 'nao', 'gi', 'them'])) {
    return {
      text: `Dạ ${product.name} hiện có ${product.colors.length} màu: ${product.colors.join(', ')} ạ. Chị thích màu nào để mình giữ hàng cho chị nha?`,
      quickReplies: colorOptions(product),
      ctx: next,
    };
  }

  const faq = matchFaq(text, faqs);

  // ---- Hỏi về sản phẩm / tồn kho / size / giá ----
  const asksStock = hasAny(t, ['con hang', 'con khong', 'het hang', 'con size', 'gia', 'bao nhieu tien', 'con ko', 'con k']);
  if (product && (mentioned || askedSize || color || asksStock)) {
    const parts: string[] = [];
    const label = mentioned ? product.name : 'mẫu này';
    let quickReplies = ['Chốt đơn ngay', 'Hỏi thêm màu khác'];

    if (product.qty === 0) {
      const alt = similarInStock(product, products);
      parts.push(`Dạ tiếc quá, ${label} đang tạm hết hàng ạ 😢`);
      if (alt) parts.push(`Chị tham khảo ${alt.name} (${formatMoney(alt.price)}) đang còn hàng nha!`);
      quickReplies = alt ? [`Xem ${alt.sku}`] : [];
    } else if (askedSize && !product.sizes.map((s) => s.toUpperCase()).includes(askedSize)) {
      parts.push(`Dạ ${label} không có size ${askedSize} ạ, mẫu này chỉ có ${product.sizes.length > 1 ? `size ${product.sizes.join(', ')}` : product.sizes[0]}.`);
      quickReplies = sizeOptions(product);
      next.size = null;
    } else {
      const what = [askedSize && `size ${askedSize}`, color && `màu ${color}`].filter(Boolean).join(' ');
      parts.push(`Dạ ${label}${what ? ` ${what}` : ''} còn hàng nè chị ơi 🎉${product.qty < 20 ? ` (chỉ còn ${product.qty} sản phẩm thôi ạ)` : ''}`);
      if (mentioned || hasAny(t, ['gia', 'bao nhieu tien'])) parts.push(`Giá ${formatMoney(product.price)}.`);
      if (faq) parts.push(faq.answer);
      else if (!color) parts.push('Chị có cần mình tư vấn thêm màu nào không ạ?');
      else parts.push('Chị chốt luôn không ạ?');
    }
    return { text: parts.join(' '), quickReplies, ctx: next, matchedFaq: faq ?? undefined };
  }

  if (faq) return { text: `Dạ ${faq.answer.charAt(0).toLowerCase()}${faq.answer.slice(1)}`, quickReplies: [], ctx: next, matchedFaq: faq };

  if (hasAny(t, ['de sau', 'suy nghi them', 'de em coi', 'de coi them', 'tham khao them', 'xem them da'])) {
    return { text: 'Dạ không sao ạ, chị cứ thoải mái tham khảo nha. Mình giữ hàng cho chị tới hết hôm nay, cần gì chị nhắn Tendly liền nè 💕', quickReplies: [], ctx: next };
  }
  if (hasAny(t, ['cam on', 'thank', 'thanks', 'ok shop'])) {
    return { text: 'Dạ Tendly cảm ơn chị nhiều ạ 💕 Chúc chị một ngày thật vui!', quickReplies: [], ctx: next };
  }
  if (hasAny(t, ['chao', 'hello', 'hi', 'alo', 'shop oi', 'xin chao'])) {
    return {
      text: 'Chào chị 👋 Tendly có thể hỗ trợ gì cho chị ạ?',
      quickReplies: ['Shop có giao COD không?', 'Phí ship bao nhiêu?', 'Đổi trả trong bao lâu?'],
      ctx: next,
    };
  }

  return {
    text: 'Dạ câu này mình chưa chắc lắm ạ 🥲 Chị muốn mình chuyển sang nhân viên tư vấn không ạ?',
    quickReplies: ['Gặp nhân viên', 'Shop có giao COD không?'],
    ctx: next,
  };
}

/** Phản hồi giả lập của nhân viên thật sau khi chuyển tiếp */
export function agentReply(text: string): { text: string; quickReplies: string[] } {
  const t = normalize(text);
  if (hasAny(t, ['hoan tien', 'tra lai tien'])) {
    return {
      text: `Dạ em ghi nhận yêu cầu hoàn tiền ${formatMoney(LAST_ORDER.price)} cho đơn ${LAST_ORDER.code} rồi ạ. Shipper sẽ qua lấy lại hàng, tiền hoàn về tài khoản của chị trong 3–5 ngày làm việc. Em thật sự xin lỗi chị vì sự bất tiện này 🙏`,
      quickReplies: ['Khi nào shipper tới?', 'Cảm ơn em'],
    };
  }
  if (hasAny(t, ['doi hang', 'dong y', 'doi moi', 'doi ao'])) {
    const code = `#DH-${2000 + Math.floor(Math.random() * 900)}`;
    return {
      text: `Dạ em đã tạo yêu cầu đổi hàng ${code} cho chị rồi ạ. Shipper sẽ qua lấy áo lỗi và giao áo mới cùng lúc trong 1–2 ngày, chị không mất phí gì hết. Em gửi kèm mã XINLOI10 giảm 10% cho đơn sau như lời xin lỗi của shop nha 💕`,
      quickReplies: ['Khi nào shipper tới?', 'Cảm ơn em'],
    };
  }
  if (hasAny(t, ['khi nao', 'bao gio', 'shipper', 'may gio'])) {
    return {
      text: 'Dạ shipper sẽ liên hệ chị trong ngày mai, khung 9h–12h ạ. Nếu giờ đó chị bận cứ nhắn em đổi lịch nha.',
      quickReplies: ['Cảm ơn em'],
    };
  }
  if (hasAny(t, ['cam on', 'ok', 'oke', 'duoc roi'])) {
    return { text: 'Dạ không có gì ạ, cảm ơn chị đã kiên nhẫn với Tendly. Có gì chị cứ nhắn em nha 💕', quickReplies: [] };
  }
  return { text: 'Dạ em ghi nhận rồi ạ, chị chờ em kiểm tra một chút rồi phản hồi chị liền nha.', quickReplies: [] };
}

/** Tóm tắt vấn đề để bàn giao cho nhân viên */
export function summarizeIssue(text: string): string {
  const t = normalize(text);
  let issue = 'Khách phàn nàn';
  if (hasAny(t, ['loi may', 'loi chi', 'chi may'])) issue = has(t, 'tay ao') ? 'Lỗi may tay áo' : 'Lỗi đường may';
  else if (hasAny(t, ['rach', 'hu hong', 'bi hu'])) issue = 'Sản phẩm hư hỏng';
  else if (hasAny(t, ['giao sai', 'thieu hang'])) issue = 'Giao sai / thiếu hàng';
  else if (hasAny(t, ['hoan tien'])) issue = 'Yêu cầu hoàn tiền';
  else if (hasAny(t, ['cham', 'tre'])) issue = 'Giao hàng chậm';
  else if (hasAny(t, ['loi'])) issue = 'Sản phẩm bị lỗi';
  if (hasAny(t, ['lan thu 2', 'lan thu hai', 'lan 2', 'lan nua'])) issue += ' · Lần lỗi thứ 2';
  return issue;
}
