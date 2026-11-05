import { normalizeSourcingPosts, prepareSourcingSearch, SourcingInputError } from '@/lib/services/sourcingSearch';

export type SourcingKind = 'tiktok' | 'suppliers';
export const sourcingActors = { tiktok: 'clockworks/tiktok-scraper', suppliers: 'apify/google-search-scraper' } as const;

export class SourcingProviderError extends Error {
  constructor(message: string, readonly status = 502, readonly code = 'APIFY_ERROR') { super(message); }
}

export function apifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new SourcingProviderError('Chưa cấu hình APIFY_API_TOKEN trên server.', 503, 'APIFY_NOT_CONFIGURED');
  return token;
}

export function sourcingRequest(kind: SourcingKind, input: Record<string, unknown>, now = new Date()) {
  if (kind === 'tiktok') {
    const plan = prepareSourcingSearch(input, now);
    return {
      context: { industry: plan.industry, keywords: plan.keywords, market: plan.market, period: plan.period },
      actorInput: {
        searchQueries: plan.keywords, searchSection: '/video', resultsPerPage: 20,
        proxyCountryCode: 'VN', videoSearchDateFilter: 'PAST_WEEK',
        shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false, shouldDownloadAvatars: false, shouldDownloadMusicCovers: false,
        scrapeRelatedVideos: false, scrapeRelatedSearchWords: false,
        maxFollowersPerProfile: 0, maxFollowingPerProfile: 0, commentsPerPost: 0,
      },
    };
  }
  const product = typeof input.product === 'string' ? input.product.trim().replace(/\s+/g, ' ') : '';
  if (product.length < 2 || product.length > 120 || /[\u0000-\u001f\u007f]/.test(product)
    || !/^[\p{L}\p{N}\s.,()&+%\/-]+$/u.test(product) || product.split(' ').length > 16) {
    throw new SourcingInputError('Tên sản phẩm cần từ 2–120 ký tự, tối đa 16 từ; không nhập URL hoặc cú pháp tìm kiếm.');
  }
  const queries = [`${product} bán sỉ Việt Nam`, `${product} nhà sản xuất nhà phân phối Việt Nam`];
  return {
    context: { product, queries, market: 'VN' },
    actorInput: {
      queries: queries.join('\n'), countryCode: 'vn', languageCode: 'vi', maxPagesPerQuery: 1,
      focusOnPaidAds: false, aiOverview: { scrapeFullAiOverview: false },
      aiModeSearch: { enableAiMode: false }, websiteContentScraper: { enable: false },
    },
  };
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const providerId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9]{1,64}$/.test(value) ? value : '';

export async function apifyRequest(path: string, token: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`https://api.apify.com/v2/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000), cache: 'no-store', redirect: 'error',
    });
  } catch {
    throw new SourcingProviderError('Không nhận được phản hồi từ Apify. Không tự gửi lại lượt chạy để tránh phát sinh phí trùng.', 502, 'APIFY_UNAVAILABLE');
  }
  if (!response.ok) {
    throw new SourcingProviderError('Apify không xử lý được yêu cầu. Kiểm tra token, quyền Actor và số dư trong Console.', 502,
      response.status < 500 ? 'APIFY_REJECTED' : 'APIFY_UNAVAILABLE');
  }
  try { return await response.json(); }
  catch { throw new SourcingProviderError('Dữ liệu phản hồi từ Apify không hợp lệ.', 502, 'APIFY_BAD_RESPONSE'); }
}

export function parseApifyRun(payload: unknown) {
  const data = record(record(payload).data);
  const id = providerId(data.id);
  const status = text(data.status);
  if (!id || !['READY', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMING-OUT', 'TIMED-OUT', 'ABORTING', 'ABORTED'].includes(status)) {
    throw new SourcingProviderError('Trạng thái lượt chạy Apify không hợp lệ.', 502, 'APIFY_BAD_RESPONSE');
  }
  return { id, status, datasetId: providerId(data.defaultDatasetId) };
}

export async function startApifyRun(kind: SourcingKind, actorInput: unknown, token: string) {
  const actor = sourcingActors[kind].replace('/', '~');
  // No automatic POST retry: a lost response can still mean a billable run was created.
  return parseApifyRun(await apifyRequest(`actors/${actor}/runs?timeout=300&maxTotalChargeUsd=0.5`, token, actorInput));
}

export function normalizeTikTok(items: unknown[], period: { from: string; to: string }, now = new Date()) {
  const normalized = normalizeSourcingPosts(items.map(item => {
    const raw = record(item);
    const author = record(raw.authorMeta);
    const seconds = typeof raw.createTime === 'number' && Number.isFinite(raw.createTime) ? raw.createTime : NaN;
    const time = seconds * 1000;
    const publishedAt = text(raw.createTimeISO) || (Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? new Date(time).toISOString() : null);
    return {
      source: 'tiktok', externalId: text(raw.id), url: text(raw.webVideoUrl), text: text(raw.text),
      authorId: text(author.id) || text(author.name) || text(raw['authorMeta.name']) || null,
      publishedAt, views: raw.playCount as number, likes: raw.diggCount as number,
      comments: raw.commentCount as number, shares: raw.shareCount as number,
    };
  }), now);
  const from = Date.parse(period.from), to = Date.parse(period.to);
  const posts = normalized.posts.filter(post => post.publishedAt && Date.parse(post.publishedAt) >= from && Date.parse(post.publishedAt) < to);
  return {
    ...normalized, posts,
    excludedByDateCount: normalized.posts.length - posts.length,
    coverage: 'sample' as const,
    message: 'Mẫu bài TikTok theo truy vấn và proxy VN; không bảo đảm tác giả/người xem ở Việt Nam. Chưa phân tích AI hoặc xác nhận xu hướng.',
  };
}

function supplierUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['gclid', 'fbclid'].includes(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

export function normalizeSupplierResults(items: unknown[]) {
  const candidates = new Map<string, { title: string; url: string; description: string; position: number | null; queries: string[]; verified: false }>();
  let rejectedCount = 0, duplicateCount = 0;
  for (const item of items) {
    const page = record(item);
    if (!Array.isArray(page.organicResults)) throw new SourcingProviderError('Output Google thiếu organicResults; cần kiểm tra schema Actor.', 502, 'APIFY_BAD_DATASET');
    const query = text(record(page.searchQuery).term);
    for (const value of page.organicResults) {
      const raw = record(value);
      const url = supplierUrl(raw.url), title = text(raw.title);
      if (!url || !title) { rejectedCount++; continue; }
      const existing = candidates.get(url);
      if (existing) {
        duplicateCount++;
        if (query && !existing.queries.includes(query)) existing.queries.push(query);
        continue;
      }
      candidates.set(url, { title, url, description: text(raw.description),
        position: typeof raw.position === 'number' && Number.isSafeInteger(raw.position) && raw.position > 0 ? raw.position : null,
        queries: query ? [query] : [], verified: false });
    }
  }
  return { candidates: [...candidates.values()], rejectedCount, duplicateCount,
    message: 'Đầu mối từ kết quả Google; chưa đọc trang gốc, chưa xác minh bán sỉ, giá hoặc MOQ.' };
}
