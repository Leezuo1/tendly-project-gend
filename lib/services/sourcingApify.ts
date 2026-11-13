import { normalizeSourcingPosts, prepareSourcingSearch, SourcingInputError, type SourcingComment } from '@/lib/services/sourcingSearch';
import type { SupplierCandidate } from '@/lib/types/sourcing';

export type SourcingKind = 'tiktok' | 'suppliers';
export const sourcingActors = { tiktok: 'clockworks/tiktok-scraper', suppliers: 'apify/google-search-scraper' } as const;
// TikTok thu thêm bình luận (tính phí theo sự kiện của Actor) nên trần phí cao hơn.
export const sourcingBudgetUsd = { tiktok: 1, suppliers: 0.5 } as const;
const COMMENTS_PER_POST = 10;

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
    if (input.keywords !== undefined && (!Array.isArray(input.keywords) || !input.keywords.length || input.keywords.length > 3
      || input.keywords.some(k => typeof k !== 'string' || k.trim().length < 2 || k.length > 120 || !/^[\p{L}\p{N}\s.,()&+%\/-]+$/u.test(k)))) throw new SourcingInputError('Truy vấn TikTok không hợp lệ.');
    const keywords = input.keywords === undefined ? plan.keywords : [...new Set((input.keywords as string[]).map(k => k.trim()))];
    const limit = input.resultLimit ?? 20;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new SourcingInputError('Giới hạn kết quả phải từ 1–20.');
    return {
      context: { industry: plan.industry, keywords, market: plan.market, period: plan.period, resultLimit: limit },
      actorInput: {
        // Apify's input schema defines resultsPerPage as "per hashtag, profile, or search query", so split it to keep the paid total near `limit`.
        searchQueries: keywords, searchSection: '/video', resultsPerPage: Math.ceil(limit / Math.max(1, keywords.length)),
        proxyCountryCode: 'VN', videoSearchDateFilter: 'PAST_WEEK',
        shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false, shouldDownloadAvatars: false, shouldDownloadMusicCovers: false,
        scrapeRelatedVideos: false, scrapeRelatedSearchWords: false,
        maxFollowersPerProfile: 0, maxFollowingPerProfile: 0, commentsPerPost: COMMENTS_PER_POST,
      },
    };
  }
  const product = typeof input.product === 'string' ? input.product.trim().replace(/\s+/g, ' ') : '';
  if (product.length < 2 || product.length > 120 || /[\u0000-\u001f\u007f]/.test(product)
    || !/^[\p{L}\p{N}\s.,()&+%\/-]+$/u.test(product) || product.split(' ').length > 16) {
    throw new SourcingInputError('Tên sản phẩm cần từ 2–120 ký tự, tối đa 16 từ; không nhập URL hoặc cú pháp tìm kiếm.');
  }
  const region = input.region ?? 'Việt Nam';
  if (typeof region !== 'string' || !region.trim() || region.length > 100 || !/^[\p{L}\p{N} .,()-]+$/u.test(region)) throw new SourcingInputError('Khu vực nhà cung cấp không hợp lệ.');
  const queries = [`${product} bán sỉ ${region}`, `${product} nhà sản xuất nhà phân phối ${region}`];
  const limit = input.resultLimit ?? 20;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new SourcingInputError('Giới hạn kết quả phải từ 1–20.');
  return {
    context: { product, queries, market: 'VN', resultLimit: limit },
    actorInput: {
      queries: queries.join('\n'), countryCode: 'vn', languageCode: 'vi', maxPagesPerQuery: 1,
      focusOnPaidAds: false, aiOverview: { scrapeFullAiOverview: false },
      aiModeSearch: { enableAiMode: false }, websiteContentScraper: { enable: true },
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
  return parseApifyRun(await apifyRequest(`actors/${actor}/runs?timeout=300&maxTotalChargeUsd=${sourcingBudgetUsd[kind]}`, token, actorInput));
}

const metricValue = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
/** Chỉ nhận dataset trên api.apify.com để không gửi token tới host lạ. */
function commentsDataset(item: unknown) {
  const raw = record(item);
  try {
    const url = new URL(text(raw.commentsDatasetUrl ?? raw.commentsDatasetURL));
    return url.protocol === 'https:' && url.hostname === 'api.apify.com' ? url.pathname.match(/^\/v2\/datasets\/([A-Za-z0-9]{1,64})\/items\/?$/)?.[1] ?? '' : '';
  } catch { return ''; }
}
export const commentDatasets = (items: unknown[]) => [...new Set(items.map(commentsDataset).filter(Boolean))];

/** Gom bình luận theo id video: theo videoWebUrl của bình luận; dataset chỉ của một video thì gán cho video đó. Giữ bình luận nhiều thích nhất. */
export function groupTikTokComments(items: unknown[], datasets: Record<string, unknown[]>, perPost = COMMENTS_PER_POST) {
  const owners = new Map<string, string[]>();
  for (const item of items) {
    const dataset = commentsDataset(item), video = text(record(item).id);
    if (dataset && video && !owners.get(dataset)?.includes(video)) owners.set(dataset, [...owners.get(dataset) ?? [], video]);
  }
  const byVideo = new Map<string, SourcingComment[]>();
  for (const [dataset, rows] of Object.entries(datasets)) for (const row of rows) {
    const raw = record(row), body = text(raw.text);
    const only = owners.get(dataset)?.length === 1 ? owners.get(dataset)![0] : '';
    const video = text(raw.videoWebUrl).match(/\/video\/(\d+)/)?.[1] || only;
    if (body && video) byVideo.set(video, [...byVideo.get(video) ?? [], { text: body.slice(0, 300), likes: metricValue(raw.diggCount) }]);
  }
  for (const [video, list] of byVideo) byVideo.set(video, list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, perPost));
  return byVideo;
}

export function normalizeTikTok(items: unknown[], period: { from: string; to: string }, now = new Date(), comments = new Map<string, SourcingComment[]>()) {
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
      ...(comments.has(text(raw.id)) ? { topComments: comments.get(text(raw.id)) } : {}),
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

// shortcut: giữ đầu trang (giới thiệu, chính sách sỉ) và cuối trang (footer liên hệ); tách theo mục nếu thông tin hay nằm giữa trang.
const condensePage = (page: string) => page.length > 4000 ? `${page.slice(0, 3000)}
…
${page.slice(-1000)}` : page;

export function normalizeSupplierResults(items: unknown[], now = new Date()) {
  const candidates = new Map<string, SupplierCandidate>();
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
      candidates.set(url, { title, url, description: text(raw.description), page: condensePage(text(record(raw.websiteContent).text)),
        position: typeof raw.position === 'number' && Number.isSafeInteger(raw.position) && raw.position > 0 ? raw.position : null,
        queries: query ? [query] : [], verified: false, collectedAt: now.toISOString(), source: 'google',
        price: null, currency: null, unit: null, moq: null, region: null, leadTime: null });
    }
  }
  return { candidates: [...candidates.values()], rejectedCount, duplicateCount,
    message: 'Đầu mối từ kết quả Google; chưa đọc trang gốc, chưa xác minh bán sỉ, giá hoặc MOQ.' };
}
