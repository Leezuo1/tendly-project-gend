import type { Product } from '@/lib/types/admin';

export const TEMPLATE_VARS = [
  { key: 'ten_khach', label: 'Tên khách' },
  { key: 'san_pham', label: 'Sản phẩm' },
  { key: 'size', label: 'Size' },
  { key: 'mau', label: 'Màu' },
  { key: 'khu_vuc', label: 'Khu vực' },
  { key: 'ma_don', label: 'Mã đơn' },
  { key: 'voucher', label: 'Voucher' },
  { key: 'the_san_pham', label: 'Thẻ sản phẩm' },
] as const;

export interface TemplateContext {
  ten_khach: string;
  san_pham: string;
  size: string;
  mau: string;
  khu_vuc: string;
  ma_don: string;
  voucher: string;
  product: Product | null;
}

/** Dữ liệu mẫu để xem trước — tương ứng khách "chị Lan" trong khung chat */
export function sampleContext(product: Product | null): TemplateContext {
  return {
    ten_khach: 'chị Lan',
    san_pham: 'Áo thun basic',
    size: 'L',
    mau: 'Trắng',
    khu_vuc: 'Hà Nội',
    ma_don: '#TD-10287',
    voucher: 'XINLOI10',
    product,
  };
}

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fillTemplate(text: string, ctx: TemplateContext): string {
  const filled = text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key === 'the_san_pham' || key === 'product') return match;
    const value = (ctx as unknown as Record<string, string>)[key];
    return typeof value === 'string' ? value : match;
  });
  return capitalizeFirst(filled);
}

export type BodyBlock = { type: 'p'; text: string } | { type: 'product' };

export function renderBody(body: string, ctx: TemplateContext): BodyBlock[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (chunk === '{the_san_pham}' ? { type: 'product' } : { type: 'p', text: fillTemplate(chunk, ctx) }));
}
