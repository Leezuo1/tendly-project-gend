import { industries } from '@/lib/data/workspace';

// Seed queries guide collection; they are not measured trends or AI recommendations.
const seedKeywords: Record<string, string[]> = {
  'Thời trang & phụ kiện': ['thời trang', 'phối đồ', 'phụ kiện thời trang'],
  'Mỹ phẩm & làm đẹp': ['mỹ phẩm', 'chăm sóc da', 'trang điểm'],
  'Nhà cửa & đời sống': ['đồ gia dụng', 'trang trí nhà', 'đồ dùng tiện ích'],
  'Thực phẩm & đồ uống': ['đồ ăn', 'đồ uống', 'ăn vặt'],
  'Điện tử & công nghệ': ['đồ công nghệ', 'phụ kiện điện thoại', 'thiết bị thông minh'],
};

export class SourcingInputError extends Error {}

/** Truy vấn TikTok bám ngành hàng của shop: từ khóa chưa nhắc tới sản phẩm/ngành thì ghép với sản phẩm quan tâm hoặc từ khóa chính của ngành. */
export function scopedTiktokQueries(industry: string, keywords: string[], product = '') {
  const seeds = seedKeywords[industry] ?? [];
  const terms = keywords.map(keyword => keyword.trim()).filter(Boolean);
  if (!terms.length) return product.trim() ? [product.trim()] : [...seeds];
  const lower = (text: string) => text.toLocaleLowerCase('vi');
  const anchor = product.trim() || seeds[0] || '';
  const scoped = (keyword: string) => !anchor || [anchor, ...seeds].some(term => lower(keyword).includes(lower(term)));
  return [...new Set(terms.map(keyword => scoped(keyword) ? keyword : `${anchor} ${keyword}`.slice(0, 120)))];
}

export function prepareSourcingSearch(input: Record<string, unknown>, now = new Date()) {
  const industry = typeof input.industry === 'string' ? input.industry.trim() : '';
  if (!industries.includes(industry)) throw new SourcingInputError('Ngành hàng không hợp lệ.');
  if (!Object.hasOwn(seedKeywords, industry)) {
    throw new SourcingInputError('Chưa hỗ trợ tìm sản phẩm cho ngành này. Vui lòng chọn một ngành sản phẩm cụ thể.');
  }
  return {
    status: 'prepared' as const,
    industry,
    market: 'VN' as const,
    keywords: [...seedKeywords[industry]],
    period: { from: new Date(now.getTime() - 7 * 86400_000).toISOString(), to: now.toISOString() },
    collectionStarted: false,
    message: 'Đã chuẩn bị từ khóa đầu vào. API kế hoạch chưa khởi chạy Apify hoặc phân tích xu hướng.',
  };
}

// Actor-specific adapters must map provider fields to this shape before normalization.
export interface SourcingPostInput {
  source: string;
  externalId: string;
  url: string;
  text: string;
  authorId?: string | null;
  publishedAt?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
}

function metric(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizePost(input: SourcingPostInput, collectedAt: string) {
  if (![input.source, input.externalId, input.url, input.text].every(value => typeof value === 'string' && value.trim())) return null;
  let url: URL;
  try { url = new URL(input.url); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const published = typeof input.publishedAt === 'string' ? Date.parse(input.publishedAt) : NaN;
  return {
    source: input.source.trim().toLowerCase(),
    externalId: input.externalId.trim(),
    url: url.href,
    text: input.text.trim(),
    authorId: typeof input.authorId === 'string' ? input.authorId.trim() || null : null,
    publishedAt: Number.isFinite(published) && published <= Date.parse(collectedAt) ? new Date(published).toISOString() : null,
    collectedAt,
    metrics: { views: metric(input.views), likes: metric(input.likes), comments: metric(input.comments), shares: metric(input.shares) },
  };
}

export type SourcingPost = NonNullable<ReturnType<typeof normalizePost>>;

export function normalizeSourcingPosts(inputs: SourcingPostInput[], now = new Date()) {
  const collectedAt = now.toISOString();
  const posts = new Map<string, SourcingPost>();
  let rejectedCount = 0;
  let duplicateCount = 0;
  for (const input of inputs) {
    const post = normalizePost(input, collectedAt);
    if (!post) { rejectedCount++; continue; }
    const key = JSON.stringify([post.source, post.externalId]);
    if (posts.has(key)) { duplicateCount++; continue; }
    posts.set(key, post);
  }
  return { posts: [...posts.values()], rejectedCount, duplicateCount };
}
