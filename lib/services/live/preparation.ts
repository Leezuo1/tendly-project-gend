import { normalize } from '@/lib/utils/format';
import type { AiKnowledge } from '@/lib/types/ai';
import type { LivePreparation } from '@/lib/types/live';

export class LivePreparationError extends Error {}
export function parseLivePreparation(value: unknown, products: AiKnowledge['products']): LivePreparation {
  const fail = (message: string): never => { throw new LivePreparationError(message); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Điền thông tin chuẩn bị phiên.');
  const input = value as Record<string, unknown>;
  const text = (record: Record<string, unknown>, key: string, max: number) => {
    if (typeof record[key] !== 'string' || (record[key] as string).length > max) return fail(`Trường ${key} không hợp lệ.`);
    return (record[key] as string).trim();
  };
  const host = text(input, 'host', 150), scheduledAt = text(input, 'scheduledAt', 40);
  if (!host || (scheduledAt && !Number.isFinite(Date.parse(scheduledAt)))) return fail('Nhập host và thời gian dự kiến hợp lệ.');
  if (typeof input.allowPrivate !== 'boolean' || typeof input.allowPublic !== 'boolean') return fail('Chọn riêng quyền nhắn riêng và trả lời công khai.');
  if (!Array.isArray(input.catalog) || !input.catalog.length || input.catalog.length > 200) return fail('Chọn 1–200 SKU cho phiên.');
  const skus = new Set<string>(), codes = new Set<string>();
  const catalog = input.catalog.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Danh mục phiên không hợp lệ.');
    const entry = raw as Record<string, unknown>, sku = text(entry, 'sku', 100);
    const matching = products.filter(product => normalize(product.sku).replace(/ /g, '') === normalize(sku).replace(/ /g, ''));
    const product = matching[0], key = normalize(sku).replace(/ /g, '');
    if (matching.length !== 1 || product.sku !== sku || product.stockKnown === false || skus.has(key)) return fail('SKU bị trùng, không tồn tại hoặc chưa xác nhận tồn kho.');
    skus.add(key);
    if (!Array.isArray(entry.codes) || entry.codes.length > 10) return fail('Tối đa 10 mã host / tên gọi khác mỗi SKU.');
    const aliases = entry.codes.map(code => {
      if (typeof code !== 'string' || !/^[\p{L}\p{N} -]{2,60}$/u.test(code.trim())) return fail('Mã host cần 2–60 ký tự chữ hoặc số.');
      const key = normalize(code);
      if (codes.has(key) || products.some(p => normalize(p.sku).replace(/ /g, '') === key.replace(/ /g, ''))) return fail('Mã host bị trùng hoặc trùng mã SKU.');
      if (/^(\d|xs|s|m|l|xl|xxl|size|chot|gia|ship|lay|dat|mua|trang|den|hong|vang|xanh)$/.test(key)) return fail('Mã host trùng cú pháp chốt, size hoặc màu. Dùng mã như A1 / 03.');
      codes.add(key); return code.trim();
    });
    const sizeChart = text(entry, 'sizeChart', 2000), sizeSource = text(entry, 'sizeSource', 500), fit = text(entry, 'fit', 500);
    if (!!sizeChart !== !!sizeSource) return fail('Bảng size cần kèm nguồn; bỏ trống cả hai nếu chưa có.');
    return { sku, codes: aliases, sizeChart, sizeSource, fit };
  });
  const receivingFields = text(input, 'receivingFields', 500), handoff = text(input, 'handoff', 500), holdPolicy = text(input, 'holdPolicy', 500);
  if (!receivingFields || !handoff || !holdPolicy) return fail('Điền thông tin nhận hàng, chuyển giao và điều kiện giữ lượng.');
  return { host, scheduledAt, campaignId: text(input, 'campaignId', 100), receivingFields, handoff, holdPolicy, allowPrivate: input.allowPrivate, allowPublic: input.allowPublic, catalog };
}

/** Remove host codes before quantity parsing: "chốt 03" means the product, not three units. */
export function liveHostContext(text: string, preparation?: LivePreparation | null) {
  let cleaned = ` ${normalize(text)} `;
  const matches = preparation?.catalog.filter(item => item.codes.some(code => cleaned.includes(` ${normalize(code)} `))) ?? [];
  if (matches.length !== 1) return { text, sku: null, ambiguous: matches.length > 1 };
  for (const code of matches[0].codes) cleaned = cleaned.split(` ${normalize(code)} `).join(' ');
  return { text: `${cleaned.trim() || 'chốt'}${text.includes('?') ? '?' : ''}`, sku: matches[0].sku, ambiguous: false };
}
