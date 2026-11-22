// Code-side check before an AI reply is sent without a human: the prompt asks the model not to invent
// prices, links or contact data, but only this check makes that a hard rule.
const UNIT = '(?:đ|₫|vnd|vnđ|đồng|k|nghìn|ngàn|tr|triệu)';
const AMOUNT = new RegExp(`(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(${UNIT})(?![\\p{L}\\p{N}])`, 'giu');
const MULTIPLIER: Record<string, number> = { k: 1e3, nghìn: 1e3, ngàn: 1e3, tr: 1e6, triệu: 1e6 };

/** VND amounts written with a unit ("259k", "199.000đ", "1,5 triệu"). shortcut: bare numbers without a unit are ignored. */
export function vndAmounts(text: string): number[] {
  return [...text.normalize('NFC').matchAll(AMOUNT)].map(([, number, unit]) => {
    const multiplier = MULTIPLIER[unit.toLowerCase()];
    // With a thousands unit "1.5" is a decimal; with đ/vnd, "." and "," are thousands separators.
    const value = multiplier ? Number(number.replace(',', '.')) : Number(number.replace(/[.,]/g, ''));
    return Math.round(value * (multiplier ?? 1));
  });
}

// Dãy số từ 8 chữ số (số tài khoản, CCCD, điện thoại); bỏ dấu cách, chấm, gạch nối giữa hai nhóm ≥3 chữ số để "0123 456 789 0" không lọt mà "size 38 39 40 41" không bị gộp.
// shortcut: số viết tách từng cặp ("01 23 45 67 89") vẫn lọt, nâng cấp nếu gặp thực tế.
const digitRuns = (text: string) => text.replace(/(?<=\d{3})[\s.\-](?=\d{3})/g, '').match(/\d{8,}/g) ?? [];

/**
 * Why a reply must not be auto-sent, or null. `known` is the data the shop supplied (catalog, FAQ, offers, order summary).
 * `longNumbers`: bật khi tin khách có ảnh. Số đọc từ ảnh biên lai/giấy tờ không được lặp lại trừ khi shop đã có số đó (lời nhắc chỉ dặn, đây là chặn cứng).
 */
export function unsupportedReplyReason(reply: string, known: string, options: { longNumbers?: boolean } = {}): string | null {
  const urls = (text: string) => (text.match(/(?:https?:\/\/|www\.)[^\s"')]+/gi) ?? []).map(url => url.replace(/[.,;:!?]+$/, '').toLowerCase());
  const allowedUrls = new Set(urls(known));
  if (urls(reply).some(url => !allowedUrls.has(url))) return 'Câu trả lời có đường dẫn không nằm trong dữ liệu của shop.';
  // Structured data (JSON prices, flashPrice, order totals) has no unit, so every number the shop supplied counts as an allowed amount.
  const allowed = new Set([...vndAmounts(known), ...(known.match(/(?<![\p{L}\p{N}])\d[\d.,]*(?![\p{L}\p{N}])/gu) ?? []).map(n => Number(n.replace(/[.,]/g, '')))]);
  if (vndAmounts(reply).some(amount => !allowed.has(amount))) return 'Câu trả lời nêu số tiền không có trong danh mục, FAQ hoặc đơn của khách.';
  if (options.longNumbers) {
    const knownRuns = new Set(digitRuns(known));
    if (digitRuns(reply).some(run => !knownRuns.has(run))) return 'Câu trả lời có dãy số dài (số tài khoản, giấy tờ, điện thoại) không có trong dữ liệu của shop.';
  }
  return null;
}
