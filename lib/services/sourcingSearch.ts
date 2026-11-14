import { industries } from '@/lib/data/workspace';

// Seed queries guide collection; they are not measured trends or AI recommendations.
const seedKeywords: Record<string, string[]> = {
  'Thời trang & phụ kiện': ['thời trang hot trend', 'review quần áo đáng mua', 'phụ kiện thời trang hot'],
  'Mỹ phẩm & làm đẹp': ['mỹ phẩm hot trend', 'review skincare đáng mua', 'trang điểm hot'],
  'Nhà cửa & đời sống': ['đồ gia dụng hot trend', 'review đồ tiện ích đáng mua', 'trang trí nhà hot'],
  'Thực phẩm & đồ uống': ['đồ ăn vặt hot trend', 'review đồ uống đáng thử', 'đồ ăn hot'],
  'Điện tử & công nghệ': ['đồ công nghệ hot trend', 'review phụ kiện điện thoại đáng mua', 'thiết bị thông minh hot'],
};

export class SourcingInputError extends Error {}

/** Truy vấn TikTok: không tự ghép từ khóa của ngành vào từ khóa người dùng (ra truy vấn lạ như "mỹ phẩm áo polo"); chỉ ghép sản phẩm quan tâm khi từ khóa chưa nhắc tới nó. */
export function scopedTiktokQueries(industry: string, keywords: string[], product = '') {
  const terms = keywords.map(keyword => keyword.trim()).filter(Boolean);
  const anchor = product.trim();
  if (!terms.length) return anchor ? [anchor] : [...(seedKeywords[industry] ?? [])];
  const lower = (text: string) => text.toLocaleLowerCase('vi');
  return [...new Set(terms.map(keyword => !anchor || lower(keyword).includes(lower(anchor)) ? keyword : `${anchor} ${keyword}`.slice(0, 120)))];
}

/** Điểm "hot" đo bằng code: lượt xem mỗi giờ từ lúc đăng (tối thiểu 6 giờ để video vừa đăng không vọt lên) nhân với tỉ lệ tương tác. Thiếu số liệu = 0. */
export function hotScore(post: { publishedAt: string | null; metrics: { views: number | null; likes: number | null; comments: number | null; shares: number | null } }, now = Date.now()) {
  const { views, likes, comments, shares } = post.metrics;
  if (!views || !post.publishedAt) return 0;
  const hours = Math.max(6, (now - Date.parse(post.publishedAt)) / 3_600_000);
  return (views / hours) * (1 + Math.min(1, ((likes ?? 0) + (comments ?? 0) + (shares ?? 0)) / views));
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
  topComments?: SourcingComment[];
}
export type SourcingComment = { text: string; likes: number | null };

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
    topComments: input.topComments ?? [],
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
