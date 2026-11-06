import { SourcingInputError } from '@/lib/services/sourcingSearch';
import type { SourcingCriteria, SourcingItem, SourcingRun } from '@/lib/types/sourcing';

export function defaultSourcingCriteria(industry = ''): SourcingCriteria {
  return { industry, kind: 'tiktok', keywords: [], product: '', minPrice: null, maxPrice: null, currency: 'VND', unit: 'sản phẩm',
    quantity: null, maxMoq: null, region: 'Việt Nam', required: '', excluded: '', quality: '', leadTime: '', audience: '', resultLimit: 20 };
}
export function parseSourcingCriteria(value: unknown): SourcingCriteria {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourcingInputError('Tiêu chí tìm nguồn không hợp lệ.');
  const input = value as Record<string, unknown>;
  const text = (key: string, max = 500) => {
    if (typeof input[key] !== 'string' || (input[key] as string).length > max || /[\u0000-\u001f\u007f]/.test(input[key] as string)) throw new SourcingInputError(`Trường ${key} không hợp lệ.`);
    return (input[key] as string).trim();
  };
  const number = (key: string) => {
    const value = input[key];
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new SourcingInputError(`Trường ${key} cần số nguyên không âm hoặc để trống.`);
    return value;
  };
  if (input.kind !== 'tiktok' && input.kind !== 'suppliers') throw new SourcingInputError('Chọn khám phá hoặc tìm nhà cung cấp.');
  if (input.currency !== 'VND') throw new SourcingInputError('Hiện hỗ trợ tiêu chí giá VND.');
  if (!Array.isArray(input.keywords) || input.keywords.length > 3 || input.keywords.some(k => typeof k !== 'string' || k.trim().length < 2 || k.length > 120 || !/^[\p{L}\p{N} .(),&+%\/-]+$/u.test(k))) throw new SourcingInputError('Chọn tối đa 3 truy vấn, mỗi truy vấn 2–120 ký tự, không có URL/cú pháp tìm kiếm.');
  const criteria: SourcingCriteria = { industry: text('industry', 100), kind: input.kind, keywords: [...new Set(input.keywords.map(k => k.trim()).filter(Boolean))], product: text('product', 120),
    minPrice: number('minPrice'), maxPrice: number('maxPrice'), currency: 'VND', unit: text('unit', 60), quantity: number('quantity'), maxMoq: number('maxMoq'),
    region: text('region', 100), required: text('required'), excluded: text('excluded'), quality: text('quality'), leadTime: text('leadTime', 100), audience: text('audience'), resultLimit: Number(input.resultLimit) };
  if (criteria.minPrice !== null && criteria.maxPrice !== null && criteria.minPrice > criteria.maxPrice) throw new SourcingInputError('Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.');
  if (!criteria.unit || !criteria.region || !Number.isInteger(input.resultLimit) || criteria.resultLimit < 1 || criteria.resultLimit > 20) throw new SourcingInputError('Nhập đơn vị, khu vực và giới hạn 1–20 kết quả mỗi truy vấn.');
  return criteria;
}

export function sourcingItems(run: SourcingRun): SourcingItem[] {
  if (!['succeeded', 'empty'].includes(run.status) || !run.result) return [];
  return run.kind === 'tiktok' ? (run.result.posts ?? []).map(post => ({ key: JSON.stringify([post.source, post.externalId]), title: post.text.slice(0, 160), text: post.text,
    url: post.url, source: post.source, collectedAt: post.collectedAt, metrics: post.metrics, price: null, currency: null, unit: null, moq: null, region: null }))
    : (run.result.candidates ?? []).map(item => ({ key: JSON.stringify(['google', item.url]), title: item.title, text: item.description, url: item.url,
      source: 'google', collectedAt: item.collectedAt || new Date(run.updatedAt).toISOString(), price: item.price ?? null, currency: item.currency ?? null, unit: item.unit ?? null, moq: item.moq ?? null, region: item.region ?? null }));
}
export function compareSourcingItem(item: SourcingItem, criteria: SourcingCriteria) {
  const matched: string[] = [], missing: string[] = [], mismatched: string[] = [];
  if (criteria.minPrice !== null || criteria.maxPrice !== null) {
    if (item.price === null || item.currency !== criteria.currency || item.unit !== criteria.unit) missing.push('Giá nhập / tiền tệ / đơn vị');
    else if ((criteria.minPrice !== null && item.price < criteria.minPrice) || (criteria.maxPrice !== null && item.price > criteria.maxPrice)) mismatched.push('Giá ngoài khoảng yêu cầu'); else matched.push('Khoảng giá');
  }
  if (criteria.maxMoq !== null) {
    if (item.moq === null || item.unit !== criteria.unit) missing.push('MOQ / đơn vị');
    else if (item.moq > criteria.maxMoq) mismatched.push('MOQ vượt giới hạn'); else matched.push('MOQ');
  }
  if (criteria.region) { if (!item.region) missing.push('Khu vực nhà cung cấp'); else if (item.region !== criteria.region) mismatched.push('Khu vực'); else matched.push('Khu vực'); }
  const haystack = `${item.title} ${item.text}`.toLocaleLowerCase('vi');
  for (const term of criteria.required.split(',').map(t => t.trim()).filter(Boolean)) {
    if (haystack.includes(term.toLocaleLowerCase('vi'))) matched.push(`Có nhắc: ${term}`); else missing.push(`Chưa thấy: ${term}`);
  }
  for (const term of criteria.excluded.split(',').map(t => t.trim()).filter(Boolean)) if (haystack.includes(term.toLocaleLowerCase('vi'))) mismatched.push(`Có từ loại trừ: ${term}`);
  if (criteria.quality) missing.push('Chất lượng / chứng từ cần kiểm tra');
  if (criteria.leadTime) missing.push('Thời gian cung ứng');
  return { matched, missing, mismatched };
}
