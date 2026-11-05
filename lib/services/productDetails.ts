import type { ProductDetails } from '@/lib/types/admin';

const TEXT_LIMITS = { brand: 100, description: 2000, usp: 1000, targetAudience: 1000,
  relatedReason: 1000, limitations: 1500, careInstructions: 1500, sourceName: 200, sourceUpdatedAt: 40 } as const;
const LIST_LIMITS = { features: 20, benefits: 20, useCases: 20, keywords: 40, relatedProductIds: 20 } as const;

export function parseProductDetails(value: Record<string, unknown>): ProductDetails {
  const result: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || value[key].length > max) throw new Error(`Thông tin ${key} không hợp lệ (tối đa ${max} ký tự).`);
    result[key] = value[key].trim();
  }
  for (const [key, max] of Object.entries(LIST_LIMITS)) {
    const list = value[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length > max || list.some(item => typeof item !== 'string' || item.length > 500)) throw new Error(`Danh sách ${key} không hợp lệ (tối đa ${max} mục).`);
    result[key] = [...new Set(list.map(item => item.trim()).filter(Boolean))];
  }
  for (const key of ['sourceUrl', 'imageUrl'] as const) {
    const url = value[key];
    if (url === undefined) continue;
    if (typeof url !== 'string' || url.length > 2000) throw new Error('Đường dẫn sản phẩm không hợp lệ.');
    if (url && !(key === 'imageUrl' && /^\/products\/[a-zA-Z0-9._-]+$/.test(url))) {
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new Error('Đường dẫn sản phẩm không hợp lệ.'); }
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Đường dẫn sản phẩm phải dùng HTTP/HTTPS và không chứa thông tin đăng nhập.');
    }
    result[key] = url;
  }
  if (result.sourceUpdatedAt && !Number.isFinite(Date.parse(String(result.sourceUpdatedAt)))) throw new Error('Ngày cập nhật nguồn không hợp lệ.');
  if (value.stockKnown !== undefined) {
    if (typeof value.stockKnown !== 'boolean') throw new Error('Trạng thái tồn kho không hợp lệ.');
    result.stockKnown = value.stockKnown;
  }
  return result as ProductDetails;
}
